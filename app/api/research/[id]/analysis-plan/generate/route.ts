// ============================================================
// ACADIA — GÉNÉRATION DU PLAN D'ANALYSE (Module 4, incrément 1)
//
// 100% déterministe (voir AnalysisPlanEngine.ts) — remplace le
// plan précédent s'il existe. Ne calcule aucun résultat
// statistique : uniquement la liste des analyses proposées.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, setAnalysisPlanRecord } from "@/lib/server/research/ResearchStateService";
import { generateAnalysisPlan } from "@/lib/core/analysis/AnalysisPlanEngine";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";

export const runtime = "nodejs";

function isDataset(value: unknown): value is Dataset {
  return Boolean(value) && Array.isArray((value as { columns?: unknown }).columns);
}

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  if (!isDataset(record.dataset)) {
    return Response.json({ error: "Aucun dataset importé pour ce projet." }, { status: 400 });
  }

  const plan = generateAnalysisPlan(record.project, record.dataset);
  await setAnalysisPlanRecord(user.id, id, plan);

  await logAudit({
    actorId: user.id,
    action: "ANALYSIS_PLAN_GENERATED",
    entityType: "ResearchProject",
    entityId: id,
    metadata: { itemCount: plan.items.length },
  });

  return Response.json({ plan }, { status: 201 });
}
