// ============================================================
// ACADIA — LECTURE ET VALIDATION D'UNE INTERPRÉTATION SCIENTIFIQUE (Mission 6, incréments 1 et 4)
//
// GET : lecture, avec `isOutdated` dérivé (jamais persisté).
//
// PATCH (incrément 4) : workflow de validation humaine —
// accept/reject/edit. Ne recalcule jamais une statistique. Une
// édition ("edit") est repassée par les mêmes garde-fous que la
// formulation IA (InterpretationGuards.ts) : un texte humain qui
// contredit une décision déjà tranchée, affirme une causalité ou cite
// un chiffre non traçable est signalé exactement comme une prose IA
// le serait — les garde-fous s'appliquent au texte, pas à son
// origine. "accept"/"reject" ne modifient jamais le texte lui-même,
// seulement validationStatus.
// ============================================================

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, updateScientificInterpretationContent } from "@/lib/server/research/ResearchStateService";
import { buildScientificInterpretationContext, isInterpretationOutdated } from "@/lib/server/research/ScientificInterpretationContextBuilder";
import { runInterpretationGuards } from "@/lib/core/analysis/InterpretationGuards";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { ScientificFindingCategory } from "@/lib/core/analysis/ScientificInterpretationTypes";

export const runtime = "nodejs";

function readDatasetUpdatedAt(dataset: unknown): string | undefined {
  if (dataset && typeof dataset === "object" && "updatedAt" in dataset && typeof (dataset as { updatedAt: unknown }).updatedAt === "string") {
    return (dataset as { updatedAt: string }).updatedAt;
  }
  return undefined;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string; interpretationId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, interpretationId } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const interpretation = (record.project.scientificInterpretations ?? []).find((i) => i.id === interpretationId);
  if (!interpretation) return notFound("Interprétation introuvable.");

  const isOutdated = isInterpretationOutdated(
    readDatasetUpdatedAt(record.dataset),
    record.project.analysisPlan?.updatedAt,
    interpretation
  );

  return Response.json({ interpretation: { ...interpretation, isOutdated } }, { status: 200 });
}

const findingSchema = z.object({
  id: z.string().optional(),
  category: z.enum(["descriptive", "hypothesis", "sample_quality", "methodological_limitation"]),
  statement: z.string().min(1),
  relatedResultIds: z.array(z.string()).default([]),
  relatedHypothesisId: z.string().optional(),
});

const bodySchema = z.object({
  action: z.enum(["accept", "reject", "edit"]),
  edits: z
    .object({
      summary: z.string().min(1).optional(),
      findings: z.array(findingSchema).optional(),
      recommendations: z.array(z.string()).optional(),
      limitations: z.array(z.string()).optional(),
    })
    .optional(),
});

export async function PATCH(request: Request, context: { params: Promise<{ id: string; interpretationId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, interpretationId } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const interpretation = (record.project.scientificInterpretations ?? []).find((i) => i.id === interpretationId);
  if (!interpretation) return notFound("Interprétation introuvable.");
  if (!interpretation.content) {
    return Response.json({ error: "Aucune formulation IA à valider pour cette interprétation — appelez /formulate d'abord." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  const { action, edits } = parsed.data;

  if (action === "edit" && (!edits || Object.keys(edits).length === 0)) {
    return Response.json({ error: "L'action 'edit' requiert au moins un champ modifié dans 'edits'." }, { status: 400 });
  }

  const run = (record.project.statisticalRuns ?? []).find((r) => r.id === interpretation.statisticalRunId);
  const knownResultIds = new Set(run?.results.map((r) => r.id) ?? []);
  const knownHypothesisIds = new Set(record.project.hypotheses.map((h) => h.id));

  let patch: Parameters<typeof updateScientificInterpretationContent>[3];

  if (action === "accept") {
    patch = { validationStatus: "accepted" };
  } else if (action === "reject") {
    patch = { validationStatus: "rejected" };
  } else {
    const merged = {
      summary: edits!.summary ?? interpretation.content.summary,
      findings: (edits!.findings ?? interpretation.content.findings).map((f) => ({
        id: f.id ?? randomUUID(),
        category: f.category as ScientificFindingCategory,
        statement: f.statement,
        relatedResultIds: f.relatedResultIds.filter((rid) => knownResultIds.has(rid)),
        relatedHypothesisId: f.relatedHypothesisId && knownHypothesisIds.has(f.relatedHypothesisId) ? f.relatedHypothesisId : undefined,
      })),
      recommendations: edits!.recommendations ?? interpretation.content.recommendations,
      limitations: edits!.limitations ?? interpretation.content.limitations,
    };

    let validationStatus: "edited" | "needs_review" = "edited";
    let guardWarnings: ReturnType<typeof runInterpretationGuards> | undefined;

    if (run) {
      const aiContext = buildScientificInterpretationContext(record.project, run, interpretation.hypothesisAssessments);
      const violations = runInterpretationGuards({ ...merged, validationStatus: "edited", generatedAt: new Date().toISOString() }, aiContext);
      if (violations.length > 0) {
        validationStatus = "needs_review";
        guardWarnings = violations;
      }
    }

    patch = { ...merged, validationStatus, guardWarnings };
  }

  const updated = await updateScientificInterpretationContent(user.id, id, interpretationId, patch);
  if (!updated) return notFound();

  await logAudit({
    actorId: user.id,
    action: "SCIENTIFIC_INTERPRETATION_VALIDATED",
    entityType: "ResearchProject",
    entityId: id,
    metadata: { interpretationId, action, resultingStatus: patch.validationStatus },
  });

  return Response.json({ interpretation: updated }, { status: 200 });
}
