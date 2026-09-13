// ============================================================
// ACADIA — VALIDATION D'UNE VERSION D'ANALYSE
// (mission Server Contracts & Research Persistence)
//
// GET : lecture du contrat ResearchAnalysisResponse courant (voir
// lib/core/research/ResearchAnalysisResponse.ts) — compatible avec
// les anciens projets (version 1 synthétisée si analysisHistory est
// absent, voir hasAnalyzableUnderstanding/buildResearchAnalysisResponse).
//
// PATCH : le chercheur valide ("validate") ou rejette ("reject")
// explicitement UNE version déjà générée par l'analyse en profondeur
// (voir /api/research/[id]/deep-analysis). Ne modifie jamais le
// contenu de la version elle-même (understanding/variables/relations
// restent inchangés) — seul `validation` change. Même patron que
// PATCH /api/research/[id]/interpretation/[interpretationId]
// (accept/reject), appliqué ici au niveau d'une version d'analyse
// entière plutôt qu'à une interprétation.
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import {
  getResearchProjectRecord,
  updateResearchAnalysisValidationRecord,
} from "@/lib/server/research/ResearchStateService";
import {
  buildResearchAnalysisResponse,
  hasAnalyzableUnderstanding,
} from "@/lib/core/research/ResearchAnalysisResponse";
import { logAudit } from "@/lib/server/audit/AuditLog";

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

  if (!hasAnalyzableUnderstanding(record.project)) {
    return Response.json(
      { error: "Aucune analyse n'a encore été produite pour ce projet." },
      { status: 400 }
    );
  }

  return Response.json({ analysisResponse: buildResearchAnalysisResponse(record.project) }, { status: 200 });
}

const bodySchema = z.object({
  action: z.enum(["validate", "reject"]),
  // Optionnel : version précise à valider/rejeter (utile si le
  // chercheur consulte une version antérieure depuis l'historique).
  // Par défaut, la version COURANTE (la plus récente) est visée.
  versionId: z.string().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  if (!hasAnalyzableUnderstanding(record.project)) {
    return Response.json(
      { error: "Aucune analyse n'a encore été produite pour ce projet." },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const currentResponse = buildResearchAnalysisResponse(record.project);
  const targetVersionId = parsed.data.versionId ?? currentResponse.currentVersion.id;

  // Version "fantôme" (projet antérieur à cette mission, aucun
  // analysisHistory réel) : rien à persister par id — on informe
  // clairement plutôt que d'échouer silencieusement.
  if (!record.project.analysisHistory?.some((v) => v.id === targetVersionId)) {
    return Response.json(
      {
        error:
          "Cette version d'analyse provient d'un projet antérieur à cette fonctionnalité et ne peut pas encore être validée individuellement — relancez une analyse en profondeur pour créer une version validable.",
      },
      { status: 400 }
    );
  }

  const validation = parsed.data.action === "validate" ? "validated" : "rejected";

  const updatedProject = await updateResearchAnalysisValidationRecord(user.id, id, targetVersionId, validation);
  if (!updatedProject) return notFound();

  await logAudit({
    actorId: user.id,
    action: "RESEARCH_ANALYSIS_VALIDATED",
    entityType: "ResearchProject",
    entityId: id,
    metadata: { versionId: targetVersionId, action: parsed.data.action },
  });

  return Response.json({ analysisResponse: buildResearchAnalysisResponse(updatedProject) }, { status: 200 });
}
