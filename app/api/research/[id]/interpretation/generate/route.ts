// ============================================================
// ACADIA — GÉNÉRATION DE L'INTERPRÉTATION SCIENTIFIQUE (Mission 6, incréments 1 et 4)
//
// Incrément 1 : décision d'hypothèse uniquement (voir
// HypothesisAssessmentEngine.ts) — aucune prose IA, zéro appel
// OpenAI. Lit un StatisticalAnalysisRun déjà exécuté (Mission 5)
// sans jamais recalculer une statistique.
//
// Incrément 4 : capture datasetUpdatedAt/analysisPlanUpdatedAt au
// moment de la génération — jamais recalculés après coup, comparés à
// la valeur courante à la lecture pour dériver `isOutdated`.
// ============================================================

import { randomUUID } from "node:crypto";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, appendScientificInterpretationRecord } from "@/lib/server/research/ResearchStateService";
import { assessHypotheses } from "@/lib/core/analysis/HypothesisAssessmentEngine";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { ensureEntitlement, EntitlementRequiredError } from "@/lib/server/billing/EntitlementService";
import { getCatalogEntry, getEffectivePriceUsd } from "@/lib/server/billing/PricingConfig";
import { z } from "zod";

function readDatasetUpdatedAt(dataset: unknown): string {
  if (dataset && typeof dataset === "object" && "updatedAt" in dataset && typeof (dataset as { updatedAt: unknown }).updatedAt === "string") {
    return (dataset as { updatedAt: string }).updatedAt;
  }
  return "";
}

export const runtime = "nodejs";

const bodySchema = z.object({ statisticalRunId: z.string().optional() });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  // Mission Conversion + Pay-as-you-progress — "Interprétation 🔒".
  try {
    await ensureEntitlement(user.id, id, "INTERPRETATION");
  } catch (error) {
    if (error instanceof EntitlementRequiredError) {
      return Response.json(
        {
          error: "Cette étape nécessite de débloquer « Interprétation scientifique ».",
          entitlementRequired: getCatalogEntry(error.key),
          priceUsd: getEffectivePriceUsd(error.key),
        },
        { status: 402 }
      );
    }
    throw error;
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
  const run = requestedRunId ? runs.find((r) => r.id === requestedRunId) : runs[runs.length - 1];
  if (!run) {
    return Response.json({ error: "Exécution statistique introuvable." }, { status: 404 });
  }

  const hypothesisAssessments = assessHypotheses(record.project, record.project.analysisPlan, run);

  const interpretation = {
    id: randomUUID(),
    projectId: id,
    statisticalRunId: run.id,
    hypothesisAssessments,
    datasetUpdatedAt: readDatasetUpdatedAt(record.dataset),
    analysisPlanUpdatedAt: record.project.analysisPlan.updatedAt,
    createdAt: new Date().toISOString(),
  };

  await appendScientificInterpretationRecord(user.id, id, interpretation);

  await logAudit({
    actorId: user.id,
    action: "SCIENTIFIC_INTERPRETATION_GENERATED",
    entityType: "ResearchProject",
    entityId: id,
    metadata: { interpretationId: interpretation.id, statisticalRunId: run.id, hypothesisCount: hypothesisAssessments.length },
  });

  return Response.json({ interpretation }, { status: 201 });
}
