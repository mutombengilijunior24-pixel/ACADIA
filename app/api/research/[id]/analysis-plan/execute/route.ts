// ============================================================
// ACADIA — EXÉCUTION DU PLAN D'ANALYSE (Mission 5, incrément 1)
//
// N'exécute que les AnalysisItem déjà validés par le chercheur
// (status "accepted"/"modified", priorité ≠ "not_recommended") —
// voir StatisticalExecutionEngine.ts. Aucun calcul statistique
// n'a lieu ici : uniquement orchestration + persistance du run.
// Zéro appel OpenAI.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, appendStatisticalRunRecord } from "@/lib/server/research/ResearchStateService";
import { executeAnalysisPlan, DEFAULT_ALPHA } from "@/lib/core/statistics/StatisticalExecutionEngine";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { z } from "zod";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";

export const runtime = "nodejs";

const bodySchema = z.object({ alpha: z.union([z.literal(0.1), z.literal(0.05), z.literal(0.01)]).optional() });

function isDataset(value: unknown): value is Dataset {
  return Boolean(value) && Array.isArray((value as { columns?: unknown }).columns);
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
    return Response.json({ error: "Aucun plan d'analyse à exécuter pour ce projet." }, { status: 400 });
  }
  if (!isDataset(record.dataset)) {
    return Response.json({ error: "Aucun dataset importé pour ce projet." }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  const alpha = parsed.success && parsed.data.alpha !== undefined ? parsed.data.alpha : DEFAULT_ALPHA;

  const run = executeAnalysisPlan(record.project, record.dataset, record.project.analysisPlan, alpha);
  await appendStatisticalRunRecord(user.id, id, run);

  await logAudit({
    actorId: user.id,
    action: "STATISTICAL_RUN_EXECUTED",
    entityType: "ResearchProject",
    entityId: id,
    metadata: { runId: run.id, status: run.status, resultCount: run.results.length },
  });

  return Response.json({ run }, { status: 201 });
}
