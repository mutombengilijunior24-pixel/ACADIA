// ============================================================
// ACADIA — FORMULATION IA D'UNE INTERPRÉTATION SCIENTIFIQUE (Mission 6, incréments 2-4)
//
// Étape volontairement séparée de la génération déterministe
// (interpretation/generate) — voir mission §hybride "rules-first,
// AI-second, validation-last" : cette route ne fait qu'ajouter une
// prose IA à une interprétation dont les décisions d'hypothèse sont
// déjà tranchées, jamais l'inverse. Ne recalcule jamais une
// statistique. Toute référence à un résultat/une hypothèse renvoyée
// par l'IA est revérifiée contre les identifiants réellement connus
// avant persistance (voir ScientificInterpretationAI.ts en-tête).
//
// Incrément 3 : la prose est ensuite passée aux garde-fous
// (InterpretationGuards.ts) — toute violation détectée fait basculer
// validationStatus à "needs_review" au lieu de "generated" ; le texte
// lui-même n'est jamais modifié ni rejeté, seul son statut change.
//
// Incrément 4 : refuse de dépenser un appel OpenAI sur une base
// obsolète (dataset/plan modifiés depuis le run associé — voir
// isInterpretationOutdated), et refuse d'écraser silencieusement une
// formulation déjà validée par un humain ("accepted"/"edited") sauf
// si l'appelant confirme explicitement via { force: true }.
// ============================================================

import { randomUUID } from "node:crypto";
import { z } from "zod";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, setScientificInterpretationContent } from "@/lib/server/research/ResearchStateService";
import { interpretScientificResults } from "@/lib/ai/openai/ScientificInterpretationAI";
import { buildScientificInterpretationContext, isInterpretationOutdated } from "@/lib/server/research/ScientificInterpretationContextBuilder";
import { runInterpretationGuards } from "@/lib/core/analysis/InterpretationGuards";
import { classifyAIError, sanitizeMessage, AI_USER_FACING_ERROR } from "@/lib/ai/openai/errorClassification";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { ScientificFinding, ScientificInterpretationContent } from "@/lib/core/analysis/ScientificInterpretationTypes";

export const runtime = "nodejs";

function readDatasetUpdatedAt(dataset: unknown): string | undefined {
  if (dataset && typeof dataset === "object" && "updatedAt" in dataset && typeof (dataset as { updatedAt: unknown }).updatedAt === "string") {
    return (dataset as { updatedAt: string }).updatedAt;
  }
  return undefined;
}

const bodySchema = z.object({ force: z.boolean().optional() });

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

  if (isInterpretationOutdated(readDatasetUpdatedAt(record.dataset), record.project.analysisPlan?.updatedAt, interpretation)) {
    return Response.json(
      { error: "Cette interprétation est obsolète : le dataset ou le plan d'analyse ont changé depuis. Générez une nouvelle interprétation avant de la formuler." },
      { status: 409 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const force = parsed.success ? Boolean(parsed.data.force) : false;
  if (interpretation.content && (interpretation.content.validationStatus === "accepted" || interpretation.content.validationStatus === "edited") && !force) {
    return Response.json(
      { error: "Cette interprétation a déjà été validée par un chercheur (acceptée ou éditée) — passez force: true pour la régénérer et écraser cette validation." },
      { status: 409 }
    );
  }

  const knownResultIds = new Set(run.results.map((r) => r.id));
  const knownHypothesisIds = new Set(record.project.hypotheses.map((h) => h.id));
  const aiContext = buildScientificInterpretationContext(record.project, run, interpretation.hypothesisAssessments);

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

    const guardViolations = runInterpretationGuards(content, aiContext);
    if (guardViolations.length > 0) {
      content.validationStatus = "needs_review";
      content.guardWarnings = guardViolations;
    }

    const updated = await setScientificInterpretationContent(user.id, id, interpretationId, content);
    if (!updated) return notFound();

    await logAudit({
      actorId: user.id,
      action: "SCIENTIFIC_INTERPRETATION_FORMULATED",
      entityType: "ResearchProject",
      entityId: id,
      metadata: { interpretationId, findingCount: findings.length, guardViolationCount: guardViolations.length, forced: force },
    });

    return Response.json({ interpretation: updated }, { status: 200 });
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Une erreur inattendue est survenue pendant la formulation.";
    console.error("ACADIA — SCIENTIFIC INTERPRETATION FORMULATE ERROR:", sanitizeMessage(rawMessage));
    const classified = classifyAIError(rawMessage);
    return Response.json({ error: AI_USER_FACING_ERROR, code: classified.code }, { status: 502 });
  }
}
