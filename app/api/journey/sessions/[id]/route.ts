// ============================================================
// ACADIA — UNE INTERPRÉTATION ENREGISTRÉE : LECTURE, SAUVEGARDE,
// RENOMMAGE / ARCHIVAGE, SUPPRESSION
//
// Sauvegarde automatique avec révision (concurrence optimiste) :
// 409 si l'interprétation a été modifiée ailleurs entre-temps.
// La suppression définitive efface aussi le fichier stocké.
// ============================================================

import { z } from "zod";

import { isJourneyKind, payloadSchemaFor } from "@/lib/core/journey/kinds";
import { PERSISTENCE_LIMITS, sessionSummarySchema } from "@/lib/core/journey/persistence";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { documentStorageProvider } from "@/lib/server/documents/DocumentStorageProvider";
import { deleteSession, getSession, journeyErrorResponse, ownerAndKindOf, ownerOf, saveSession, updateSessionMeta } from "@/lib/server/journey/JourneySessionService";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { forbidden, getSessionUser, notFound, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const saveSchema = z.object({
  revision: z.number().int().nonnegative(),
  title: z.string().trim().min(1).max(PERSISTENCE_LIMITS.titleLength),
  stage: z.string().max(40),
  payload: z.unknown(),
  summary: sessionSummarySchema.nullable(),
});

const patchSchema = z.object({ title: z.string().trim().min(1).max(PERSISTENCE_LIMITS.titleLength).optional(), status: z.enum(["active", "archived"]).optional() });

async function ownership(id: string, userId: string): Promise<Response | null> {
  const owner = await ownerOf(id);
  if (!owner) return notFound("Interprétation introuvable.");
  if (owner !== userId) return forbidden("Cette interprétation ne vous appartient pas.", { actorId: userId, entityType: "JourneySession", entityId: id });
  return null;
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  try {
    const record = await getSession(user.id, id);
    if (!record) return notFound("Interprétation introuvable.");
    if (record === "forbidden") return forbidden("Cette interprétation ne vous appartient pas.", { actorId: user.id, entityType: "JourneySession", entityId: id });
    let payload: unknown = null;
    try {
      payload = JSON.parse(record.payload);
    } catch {
      payload = null;
    }
    return Response.json(
      {
        session: {
          id: record.id,
          kind: record.kind,
          title: record.title,
          status: record.status,
          stage: record.stage,
          revision: record.revision,
          payload,
          file: record.fileDocumentId ? { name: record.fileName, size: record.fileSize, sha256: record.fileSha256 } : null,
          updatedAt: record.updatedAt,
        },
      },
      { status: 200, headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    return journeyErrorResponse(error);
  }
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  if (!rateLimiter.check(rateLimitKey("journey-save", user.id), 600, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de sauvegardes : réessayez dans quelques minutes." }, { status: 429 });
  const parsed = saveSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  try {
    const record = await ownerAndKindOf(id);
    if (!record) return notFound("Interprétation introuvable.");
    if (record.ownerId !== user.id) return forbidden("Cette interprétation ne vous appartient pas.", { actorId: user.id, entityType: "JourneySession", entityId: id });
    // Validé selon le moteur ENREGISTRÉ : une sauvegarde ne peut pas changer le moteur d'une interprétation.
    if (!isJourneyKind(record.kind)) return Response.json({ error: "Moteur d'interprétation inconnu." }, { status: 400 });
    const payload = payloadSchemaFor(record.kind).safeParse(parsed.data.payload);
    if (!payload.success) return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
    const saved = await saveSession(user.id, id, { revision: parsed.data.revision, title: parsed.data.title, stage: parsed.data.stage, payload: JSON.stringify(payload.data), summary: parsed.data.summary ? JSON.stringify(parsed.data.summary) : null });
    return Response.json(saved, { status: 200 });
  } catch (error) {
    return journeyErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success || (!parsed.data.title && !parsed.data.status)) return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  try {
    const denied = await ownership(id, user.id);
    if (denied) return denied;
    await updateSessionMeta(user.id, id, parsed.data);
    if (parsed.data.status) await logAudit({ actorId: user.id, action: parsed.data.status === "archived" ? "JOURNEY_SESSION_ARCHIVED" : "JOURNEY_SESSION_RESTORED", entityType: "JourneySession", entityId: id });
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return journeyErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  try {
    const denied = await ownership(id, user.id);
    if (denied) return denied;
    const { fileDocumentId } = await deleteSession(user.id, id);
    if (fileDocumentId) await documentStorageProvider.delete(fileDocumentId).catch(() => false);
    await logAudit({ actorId: user.id, action: "JOURNEY_SESSION_DELETED", entityType: "JourneySession", entityId: id });
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return journeyErrorResponse(error);
  }
}
