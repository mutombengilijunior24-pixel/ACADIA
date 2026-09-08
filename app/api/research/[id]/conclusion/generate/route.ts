// ============================================================
// ACADIA — GÉNÉRATION DE LA CONCLUSION SCIENTIFIQUE (Mission 7, bloc 1)
//
// Couche supérieure à Mission 6 (interpretation/generate) : compose
// HypothesisAssessment déjà tranché (Mission 6, jamais recalculé)
// avec la couverture des objectifs et la question de recherche
// principale (voir ScientificConclusionEngine.ts). Zéro appel
// OpenAI dans ce bloc.
//
// Si `interpretationId` est fourni, réutilise ses
// hypothesisAssessments déjà calculés (jamais une seconde décision
// parallèle) — sinon les calcule directement via
// assessHypotheses() (Mission 6), exactement comme le fait déjà
// interpretation/generate/route.ts.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, appendScientificConclusionRecord } from "@/lib/server/research/ResearchStateService";
import { assessHypotheses } from "@/lib/core/analysis/HypothesisAssessmentEngine";
import { buildScientificConclusion } from "@/lib/core/analysis/ScientificConclusionEngine";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { z } from "zod";

export const runtime = "nodejs";

const bodySchema = z.object({ statisticalRunId: z.string().optional(), interpretationId: z.string().optional() });

function readDatasetUpdatedAt(dataset: unknown): string {
  if (dataset && typeof dataset === "object" && "updatedAt" in dataset && typeof (dataset as { updatedAt: unknown }).updatedAt === "string") {
    return (dataset as { updatedAt: string }).updatedAt;
  }
  return "";
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  if (!record.project.analysisPlan) {
    return Response.json({ error: "Aucun plan d'analyse pour ce projet." }, { status: 400 });
  }
  const runs = record.project.statisticalRuns ?? [];
  if (runs.length === 0) {
    return Response.json({ error: "Aucune exécution statistique disponible pour ce projet." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const requestedRunId = parsed.success ? parsed.data.statisticalRunId : undefined;
  const requestedInterpretationId = parsed.success ? parsed.data.interpretationId : undefined;

  const run = requestedRunId ? runs.find((r) => r.id === requestedRunId) : runs[runs.length - 1];
  if (!run) {
    return Response.json({ error: "Exécution statistique introuvable." }, { status: 404 });
  }

  let interpretationId: string | undefined;
  let hypothesisAssessments;

  if (requestedInterpretationId) {
    const interpretation = (record.project.scientificInterpretations ?? []).find((i) => i.id === requestedInterpretationId);
    if (!interpretation) {
      return Response.json({ error: "Interprétation scientifique introuvable pour ce projet." }, { status: 404 });
    }
    if (interpretation.statisticalRunId !== run.id) {
      return Response.json({ error: "Cette interprétation ne correspond pas à l'exécution statistique sélectionnée." }, { status: 400 });
    }
    interpretationId = interpretation.id;
    hypothesisAssessments = interpretation.hypothesisAssessments;
  } else {
    hypothesisAssessments = assessHypotheses(record.project, record.project.analysisPlan, run);
  }

  const conclusion = buildScientificConclusion(
    record.project,
    run,
    hypothesisAssessments,
    readDatasetUpdatedAt(record.dataset),
    record.project.analysisPlan.updatedAt,
    interpretationId
  );

  await appendScientificConclusionRecord(user.id, id, conclusion);

  await logAudit({
    actorId: user.id,
    action: "SCIENTIFIC_CONCLUSION_GENERATED",
    entityType: "ResearchProject",
    entityId: id,
    metadata: {
      conclusionId: conclusion.id,
      statisticalRunId: run.id,
      hypothesisCount: conclusion.hypothesisConclusions.length,
      objectiveCount: conclusion.objectiveConclusions.length,
    },
  });

  return Response.json({ conclusion }, { status: 201 });
}
