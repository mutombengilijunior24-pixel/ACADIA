// ============================================================
// ACADIA — RESEARCH PROJECT : ACCÈS PAR PROJET UNIQUE (additif)
//
// Vient s'ajouter à GET/PUT /api/research-state (qui reste
// inchangée et continue de servir le Research Wizard / la
// synchronisation en bloc) — ne la remplace pas. Utile aux futurs
// modules qui n'ont besoin d'agir que sur UN projet précis, sans
// resynchroniser l'intégralité de l'état de l'utilisateur.
//
// ownerId toujours dérivé de la session, jamais du corps de la
// requête ni de l'URL — mêmes conventions que le reste de l'API
// (voir lib/supervision/apiAuth.ts).
//
// DELETE archive le projet (status="archived") plutôt qu'une
// suppression réelle — cohérent avec la limite déjà assumée par
// ResearchStateService ("ne supprime jamais une ligne").
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import {
  getResearchProjectRecord,
  updateResearchProjectRecord,
  archiveResearchProjectRecord,
} from "@/lib/server/research/ResearchStateService";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { Research } from "@/types/Research";
import type { ResearchProject as ScientificProject } from "@/lib/core/research/ResearchTypes";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  return Response.json({ record }, { status: 200 });
}

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  let body: { research?: Partial<Research>; project?: Partial<ScientificProject> };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const existing = await getResearchProjectRecord(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const patch: Partial<{ research: Research; project: ScientificProject }> = {};
  if (body.research) patch.research = { ...(existing.research as Research), ...body.research };
  if (body.project) patch.project = { ...existing.project, ...body.project } as ScientificProject;

  const updated = await updateResearchProjectRecord(user.id, id, patch);
  if (!updated) return notFound();

  await logAudit({ actorId: user.id, action: "RESEARCH_UPDATED", entityType: "ResearchProject", entityId: id });

  return Response.json({ record: updated }, { status: 200 });
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const existing = await getResearchProjectRecord(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const archived = await archiveResearchProjectRecord(user.id, id);
  if (!archived) return notFound();

  await logAudit({ actorId: user.id, action: "RESEARCH_ARCHIVED", entityType: "ResearchProject", entityId: id });

  return Response.json({ ok: true, status: "archived" }, { status: 200 });
}
