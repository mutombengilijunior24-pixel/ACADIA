// ============================================================
// ACADIA — FORMULATION IA D'UNE CONCLUSION SCIENTIFIQUE (Mission 7, bloc 2)
//
// Étape volontairement séparée de la génération déterministe
// (conclusion/generate) — même patron que Mission 6. Différence
// majeure avec Mission 6 : la sortie IA est revalidée par
// ScientificConclusionValidator.ts et toute violation REJETTE la
// génération entière (rien n'est persisté) — mission §31-33
// "validator FAIL", plus strict que le "needs_review" de Mission 6.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, setScientificConclusionContent } from "@/lib/server/research/ResearchStateService";
import { assessHypotheses } from "@/lib/core/analysis/HypothesisAssessmentEngine";
import { buildScientificInterpretationContext, isInterpretationOutdated } from "@/lib/server/research/ScientificInterpretationContextBuilder";
import { interpretScientificConclusion, type ScientificConclusionSourceContent } from "@/lib/ai/openai/ScientificConclusionAI";
import { validateScientificConclusion } from "@/lib/core/analysis/ScientificConclusionValidator";
import { classifyAIError, sanitizeMessage, AI_USER_FACING_ERROR } from "@/lib/ai/openai/errorClassification";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { ScientificConclusionContent } from "@/lib/core/analysis/ScientificConclusionTypes";
import { z } from "zod";

export const runtime = "nodejs";

function readDatasetUpdatedAt(dataset: unknown): string | undefined {
  if (dataset && typeof dataset === "object" && "updatedAt" in dataset && typeof (dataset as { updatedAt: unknown }).updatedAt === "string") {
    return (dataset as { updatedAt: string }).updatedAt;
  }
  return undefined;
}

const bodySchema = z.object({ force: z.boolean().optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string; conclusionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, conclusionId } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const limit = rateLimiter.check(rateLimitKey("research-conclusion-formulate", user.id), 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de formulations demandées récemment. Réessayez plus tard." }, { status: 429 });
  }

  const conclusion = (record.project.scientificConclusions ?? []).find((c) => c.id === conclusionId);
  if (!conclusion) return notFound("Conclusion introuvable.");

  if (isInterpretationOutdated(readDatasetUpdatedAt(record.dataset), record.project.analysisPlan?.updatedAt, conclusion)) {
    await logAudit({
      actorId: user.id,
      action: "SCIENTIFIC_CONCLUSION_OUTDATED",
      entityType: "ResearchProject",
      entityId: id,
      metadata: { conclusionId },
    });
    return Response.json(
      { error: "Cette conclusion est obsolète : le dataset ou le plan d'analyse ont changé depuis. Générez une nouvelle conclusion avant de la formuler." },
      { status: 409 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const force = parsed.success ? Boolean(parsed.data.force) : false;
  if (conclusion.content && (conclusion.content.validationStatus === "accepted" || conclusion.content.validationStatus === "edited") && !force) {
    return Response.json(
      { error: "Cette conclusion a déjà été validée par un chercheur (acceptée ou éditée) — passez force: true pour la régénérer et écraser cette validation." },
      { status: 409 }
    );
  }

  if (!record.project.analysisPlan) {
    return Response.json({ error: "Aucun plan d'analyse pour ce projet." }, { status: 400 });
  }
  const run = (record.project.statisticalRuns ?? []).find((r) => r.id === conclusion.statisticalRunId);
  if (!run) return notFound("Exécution statistique associée introuvable.");

  const hypothesisAssessments = assessHypotheses(record.project, record.project.analysisPlan, run);
  const aiContext = buildScientificInterpretationContext(record.project, run, hypothesisAssessments);

  const source: ScientificConclusionSourceContent = {
    researchQuestionConclusion: conclusion.researchQuestionConclusion?.conclusion,
    objectiveConclusions: conclusion.objectiveConclusions.map((o) => ({ objectiveId: o.objectiveId, conclusion: o.conclusion })),
    hypothesisConclusions: conclusion.hypothesisConclusions.map((h) => ({
      hypothesisId: h.hypothesisId,
      decision: h.decision,
      conclusion: h.conclusion,
    })),
    generalConclusion: conclusion.generalConclusion,
    limitations: conclusion.limitations,
    warnings: conclusion.warnings,
  };

  try {
    const aiResult = await interpretScientificConclusion(aiContext, source);

    const violations = validateScientificConclusion(aiResult, conclusion, aiContext);
    if (violations.length > 0) {
      return Response.json(
        {
          error: "La formulation IA n'a pas passé la validation scientifique (décision modifiée, chiffre inventé, causalité abusive, ou référence inconnue) et n'a pas été enregistrée.",
          violations,
        },
        { status: 422 }
      );
    }

    const content: ScientificConclusionContent = {
      researchQuestionConclusion: aiResult.researchQuestionConclusion,
      objectiveConclusions: aiResult.objectiveConclusions,
      hypothesisConclusions: aiResult.hypothesisConclusions,
      generalConclusion: aiResult.generalConclusion,
      limitations: aiResult.limitations,
      warnings: aiResult.warnings,
      validationStatus: "generated",
      generatedAt: new Date().toISOString(),
    };

    const updated = await setScientificConclusionContent(user.id, id, conclusionId, content);
    if (!updated) return notFound();

    await logAudit({
      actorId: user.id,
      action: force ? "SCIENTIFIC_CONCLUSION_REGENERATED" : "SCIENTIFIC_CONCLUSION_FORMULATED",
      entityType: "ResearchProject",
      entityId: id,
      metadata: { conclusionId },
    });

    return Response.json({ conclusion: updated }, { status: 200 });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Une erreur inattendue est survenue pendant la formulation.";
    console.error("ACADIA — SCIENTIFIC CONCLUSION FORMULATE ERROR:", sanitizeMessage(rawMessage));
    const classified = classifyAIError(rawMessage);
    return Response.json({ error: AI_USER_FACING_ERROR, code: classified.code }, { status: 502 });
  }
}
