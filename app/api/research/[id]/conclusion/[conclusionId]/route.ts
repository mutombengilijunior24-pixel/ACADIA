// ============================================================
// ACADIA — LECTURE ET VALIDATION D'UNE CONCLUSION SCIENTIFIQUE (Mission 7, blocs 1 et 2)
//
// PATCH (bloc 2) : workflow de validation humaine — accept/reject/edit,
// même patron que Mission 6 (interpretation/[id]/route.ts). Une
// édition ("edit") est repassée par les mêmes garde-fous
// (InterpretationGuards.ts) en mode SOUPLE ("needs_review" si
// violation, jamais un rejet dur — contrairement à /formulate qui
// applique le validateur strict de la mission §31-33 sur la sortie
// IA). "accept"/"reject" ne modifient jamais le texte, seulement
// validationStatus.
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, updateScientificConclusionContent } from "@/lib/server/research/ResearchStateService";
import { buildScientificInterpretationContext, isInterpretationOutdated } from "@/lib/server/research/ScientificInterpretationContextBuilder";
import { assessHypotheses } from "@/lib/core/analysis/HypothesisAssessmentEngine";
import { checkCausality, checkNumericConsistency, checkContradiction, collectKnownNumbers, type TextField, type ContradictionCheckItem } from "@/lib/core/analysis/InterpretationGuards";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { AuditAction } from "@/lib/server/audit/AuditLog";

export const runtime = "nodejs";

function readDatasetUpdatedAt(dataset: unknown): string | undefined {
  if (dataset && typeof dataset === "object" && "updatedAt" in dataset && typeof (dataset as { updatedAt: unknown }).updatedAt === "string") {
    return (dataset as { updatedAt: string }).updatedAt;
  }
  return undefined;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string; conclusionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, conclusionId } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const conclusion = (record.project.scientificConclusions ?? []).find((c) => c.id === conclusionId);
  if (!conclusion) return notFound("Conclusion introuvable.");

  const isOutdated = isInterpretationOutdated(
    readDatasetUpdatedAt(record.dataset),
    record.project.analysisPlan?.updatedAt,
    conclusion
  );

  return Response.json({ conclusion: { ...conclusion, isOutdated } }, { status: 200 });
}

const bodySchema = z.object({
  action: z.enum(["accept", "reject", "edit"]),
  edits: z
    .object({
      researchQuestionConclusion: z.string().optional(),
      objectiveConclusions: z.array(z.object({ objectiveId: z.string(), statement: z.string().min(1) })).optional(),
      hypothesisConclusions: z.array(z.object({ hypothesisId: z.string(), statement: z.string().min(1) })).optional(),
      generalConclusion: z.string().min(1).optional(),
      limitations: z.array(z.string()).optional(),
      warnings: z.array(z.string()).optional(),
    })
    .optional(),
});

const AUDIT_ACTION_BY_DECISION: Record<"accepted" | "rejected" | "edited" | "needs_review", AuditAction> = {
  accepted: "SCIENTIFIC_CONCLUSION_VALIDATED",
  rejected: "SCIENTIFIC_CONCLUSION_REJECTED",
  edited: "SCIENTIFIC_CONCLUSION_EDITED",
  needs_review: "SCIENTIFIC_CONCLUSION_EDITED",
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string; conclusionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, conclusionId } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const conclusion = (record.project.scientificConclusions ?? []).find((c) => c.id === conclusionId);
  if (!conclusion) return notFound("Conclusion introuvable.");
  if (!conclusion.content) {
    return Response.json({ error: "Aucune formulation IA à valider pour cette conclusion — appelez /formulate d'abord." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  const { action, edits } = parsed.data;

  if (action === "edit" && (!edits || Object.keys(edits).length === 0)) {
    return Response.json({ error: "L'action 'edit' requiert au moins un champ modifié dans 'edits'." }, { status: 400 });
  }

  const knownObjectiveIds = new Set(conclusion.objectiveConclusions.map((o) => o.objectiveId));
  const knownHypothesisIds = new Set(conclusion.hypothesisConclusions.map((h) => h.hypothesisId));

  let patch: Parameters<typeof updateScientificConclusionContent>[3];
  let resultingStatus: "accepted" | "rejected" | "edited" | "needs_review";

  if (action === "accept") {
    patch = { validationStatus: "accepted" };
    resultingStatus = "accepted";
  } else if (action === "reject") {
    patch = { validationStatus: "rejected" };
    resultingStatus = "rejected";
  } else {
    const merged = {
      researchQuestionConclusion: edits!.researchQuestionConclusion ?? conclusion.content.researchQuestionConclusion,
      objectiveConclusions: (edits!.objectiveConclusions ?? conclusion.content.objectiveConclusions).filter((o) => knownObjectiveIds.has(o.objectiveId)),
      hypothesisConclusions: (edits!.hypothesisConclusions ?? conclusion.content.hypothesisConclusions).filter((h) => knownHypothesisIds.has(h.hypothesisId)),
      generalConclusion: edits!.generalConclusion ?? conclusion.content.generalConclusion,
      limitations: edits!.limitations ?? conclusion.content.limitations,
      warnings: edits!.warnings ?? conclusion.content.warnings,
    };

    let validationStatus: "edited" | "needs_review" = "edited";
    let guardWarnings;

    if (record.project.analysisPlan) {
      const run = (record.project.statisticalRuns ?? []).find((r) => r.id === conclusion.statisticalRunId);
      if (run) {
        const hypothesisAssessments = assessHypotheses(record.project, record.project.analysisPlan, run);
        const aiContext = buildScientificInterpretationContext(record.project, run, hypothesisAssessments);

        const fields: TextField[] = [
          { field: "researchQuestionConclusion", text: merged.researchQuestionConclusion },
          ...merged.objectiveConclusions.map((o, i) => ({ field: `objectiveConclusions[${i}].statement`, text: o.statement })),
          ...merged.hypothesisConclusions.map((h, i) => ({ field: `hypothesisConclusions[${i}].statement`, text: h.statement })),
          { field: "generalConclusion", text: merged.generalConclusion },
          ...merged.limitations.map((l, i) => ({ field: `limitations[${i}]`, text: l })),
          ...merged.warnings.map((w, i) => ({ field: `warnings[${i}]`, text: w })),
        ];
        const contradictionItems: ContradictionCheckItem[] = merged.hypothesisConclusions.map((h, i) => ({
          field: `hypothesisConclusions[${i}].statement`,
          text: h.statement,
          hypothesisId: h.hypothesisId,
        }));
        const decisionByHypothesisId = new Map(conclusion.hypothesisConclusions.map((h) => [h.hypothesisId, { decision: h.decision }]));

        const violations = [
          ...checkCausality(fields),
          ...checkNumericConsistency(fields, collectKnownNumbers(aiContext)),
          ...checkContradiction(contradictionItems, decisionByHypothesisId),
        ];

        if (violations.length > 0) {
          validationStatus = "needs_review";
          guardWarnings = violations;
        }
      }
    }

    patch = { ...merged, validationStatus, guardWarnings };
    resultingStatus = validationStatus;
  }

  const updated = await updateScientificConclusionContent(user.id, id, conclusionId, patch);
  if (!updated) return notFound();

  await logAudit({
    actorId: user.id,
    action: AUDIT_ACTION_BY_DECISION[resultingStatus],
    entityType: "ResearchProject",
    entityId: id,
    metadata: { conclusionId, action, resultingStatus },
  });

  return Response.json({ conclusion: updated }, { status: 200 });
}
