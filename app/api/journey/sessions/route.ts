// ============================================================
// ACADIA — INTERPRÉTATIONS ENREGISTRÉES : LISTE ET CRÉATION
//
// ownerId toujours dérivé de la session serveur (jamais du corps).
// L'instantané est validé (schéma partagé, taille bornée) avant
// d'être enregistré ; les résultats ne sont jamais stockés comme
// faits : ils sont recalculés à la reprise.
// ============================================================

import { z } from "zod";

import { journeySnapshotSchema, PERSISTENCE_LIMITS } from "@/lib/core/journey/persistence";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { createSession, journeyErrorResponse, listSessions } from "@/lib/server/journey/JourneySessionService";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

const createSchema = z.object({
  id: z.uuid(),
  title: z.string().trim().min(1).max(PERSISTENCE_LIMITS.titleLength),
  stage: z.string().max(40),
  payload: journeySnapshotSchema,
});

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!rateLimiter.check(rateLimitKey("journey-list", user.id), 240, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de requêtes : réessayez dans quelques minutes." }, { status: 429 });
  const status = new URL(request.url).searchParams.get("status") === "archived" ? "archived" : "active";
  try {
    return Response.json({ sessions: await listSessions(user.id, status) }, { status: 200 });
  } catch (error) {
    return journeyErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!rateLimiter.check(rateLimitKey("journey-create", user.id), 30, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de créations : réessayez plus tard." }, { status: 429 });
  const parsed = createSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  try {
    const created = await createSession(user.id, { id: parsed.data.id, title: parsed.data.title, stage: parsed.data.stage, payload: JSON.stringify(parsed.data.payload) });
    await logAudit({ actorId: user.id, action: "JOURNEY_SESSION_CREATED", entityType: "JourneySession", entityId: created.id });
    return Response.json({ session: created }, { status: 201 });
  } catch (error) {
    return journeyErrorResponse(error);
  }
}
