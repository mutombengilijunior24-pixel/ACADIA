// ============================================================
// ACADIA — FORMULATION IA D'UNE INTERPRÉTATION SCIENTIFIQUE (Mission 6, incrément 2)
//
// Étape volontairement séparée de la génération déterministe
// (interpretation/generate) — voir mission §hybride "rules-first,
// AI-second, validation-last" : cette route ne fait qu'ajouter une
// prose IA à une interprétation dont les décisions d'hypothèse sont
// déjà tranchées, jamais l'inverse. Ne recalcule jamais une
// statistique. Toute référence à un résultat/une hypothèse renvoyée
// par l'IA est revérifiée contre les identifiants réellement connus
// avant persistance (voir ScientificInterpretationAI.ts en-tête).
// ============================================================

import { randomUUID } from "node:crypto";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, setScientificInterpretationContent } from "@/lib/server/research/ResearchStateService";
import {
  interpretScientificResults,
  type ScientificInterpretationContext,
  type ScientificInterpretationResultContext,
} from "@/lib/ai/openai/ScientificInterpretationAI";
import { classifyAIError, sanitizeMessage, AI_USER_FACING_ERROR } from "@/lib/ai/openai/errorClassification";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { ScientificFinding, ScientificInterpretationContent } from "@/lib/core/analysis/ScientificInterpretationTypes";

export const runtime = "nodejs";

/**
 * Arrondit à 6 chiffres significatifs avant transmission à l'IA — une
 * p-value comme 2.5396285894708624e-10 (mantisse brute d'un flottant
 * JS) resterait exacte non arrondie, mais produit une prose illisible
 * si l'IA la recopie telle quelle. 6 chiffres significatifs préservent
 * l'ordre de grandeur (donc la lecture "très significatif") sans
 * jamais arrondir à un faux zéro.
 */
function roundSignificant(value: number | null): number | null {
  if (value === null || !Number.isFinite(value)) return value;
  return Number(value.toPrecision(6));
}

export async function POST(request: Request, context: { params: Promise<{ id: string; interpretationId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, interpretationId } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const limit = rateLimiter.check(rateLimitKey("research-interpretation-formulate", user.id), 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de formulations demandées récemment. Réessayez plus tard." }, { status: 429 });
  }

  const interpretation = (record.project.scientificInterpretations ?? []).find((i) => i.id === interpretationId);
  if (!interpretation) return notFound("Interprétation introuvable.");

  const run = (record.project.statisticalRuns ?? []).find((r) => r.id === interpretation.statisticalRunId);
  if (!run) return notFound("Exécution statistique associée introuvable.");

  const variableById = new Map(record.project.variables.map((v) => [v.id, v]));
  const knownResultIds = new Set(run.results.map((r) => r.id));
  const knownHypothesisIds = new Set(record.project.hypotheses.map((h) => h.id));

  const results: ScientificInterpretationResultContext[] = run.results
    .filter((r) => r.status === "completed")
    .map((r) => ({
      id: r.id,
      analysisType: r.analysisType,
      label: r.variableIds.map((vid) => variableById.get(vid)?.name ?? vid).join(" × "),
      n: r.n,
      warnings: r.warnings,
      descriptive: r.descriptive
        ? {
            frequencyTable: r.descriptive.frequencyTable?.map((f) => ({
              label: f.label,
              count: f.count,
              percentage: f.percentage,
              validPercentage: f.validPercentage,
            })),
            numericalStatistics: r.descriptive.numericalStatistics
              ? {
                  min: roundSignificant(r.descriptive.numericalStatistics.min),
                  max: roundSignificant(r.descriptive.numericalStatistics.max),
                  mean: roundSignificant(r.descriptive.numericalStatistics.mean),
                  median: roundSignificant(r.descriptive.numericalStatistics.median),
                  standardDeviation: roundSignificant(r.descriptive.numericalStatistics.standardDeviation),
                }
              : undefined,
          }
        : undefined,
      bivariate: r.bivariate
        ? {
            method: r.bivariate.method,
            chiSquare: r.bivariate.chiSquare
              ? {
                  pValue: roundSignificant(r.bivariate.chiSquare.pValue),
                  cramersV: roundSignificant(r.bivariate.chiSquare.cramersV),
                  assumptionsMet: r.bivariate.chiSquare.assumptionsMet,
                }
              : undefined,
            pearson: r.bivariate.pearson
              ? { coefficient: roundSignificant(r.bivariate.pearson.coefficient), pValue: roundSignificant(r.bivariate.pearson.pValue) }
              : undefined,
            spearman: r.bivariate.spearman
              ? { coefficient: roundSignificant(r.bivariate.spearman.coefficient), pValue: roundSignificant(r.bivariate.spearman.pValue) }
              : undefined,
          }
        : undefined,
    }));

  const aiContext: ScientificInterpretationContext = {
    project: {
      title: record.project.title,
      researchType: record.project.researchType,
      domain: record.project.domain,
    },
    sampleSize: run.results.reduce((max, r) => Math.max(max, r.n), 0),
    alpha: run.alpha,
    hypotheses: interpretation.hypothesisAssessments.map((a) => ({
      hypothesisId: a.hypothesisId,
      statement: a.statement,
      decision: a.decision,
      confidence: a.confidence,
      rationale: a.rationale,
    })),
    results,
  };

  try {
    const aiResult = await interpretScientificResults(aiContext);

    const findings: ScientificFinding[] = aiResult.findings.map((f) => ({
      id: randomUUID(),
      category: f.category,
      statement: f.statement,
      relatedResultIds: f.relatedResultIds.filter((rid) => knownResultIds.has(rid)),
      relatedHypothesisId: f.relatedHypothesisId && knownHypothesisIds.has(f.relatedHypothesisId) ? f.relatedHypothesisId : undefined,
    }));

    const content: ScientificInterpretationContent = {
      summary: aiResult.summary,
      findings,
      recommendations: aiResult.recommendations,
      limitations: aiResult.limitations,
      validationStatus: "generated",
      generatedAt: new Date().toISOString(),
    };

    const updated = await setScientificInterpretationContent(user.id, id, interpretationId, content);
    if (!updated) return notFound();

    await logAudit({
      actorId: user.id,
      action: "SCIENTIFIC_INTERPRETATION_FORMULATED",
      entityType: "ResearchProject",
      entityId: id,
      metadata: { interpretationId, findingCount: findings.length },
    });

    return Response.json({ interpretation: updated }, { status: 200 });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Une erreur inattendue est survenue pendant la formulation.";
    console.error("ACADIA — SCIENTIFIC INTERPRETATION FORMULATE ERROR:", sanitizeMessage(rawMessage));
    const classified = classifyAIError(rawMessage);
    return Response.json({ error: AI_USER_FACING_ERROR, code: classified.code }, { status: 502 });
  }
}
