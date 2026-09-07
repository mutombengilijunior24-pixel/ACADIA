// ============================================================
// ACADIA — SUGGESTIONS DE MAPPING SCIENTIFIQUE (Module 3, incrément 1)
//
// Lecture pure — ne modifie jamais le dataset. Compare les colonnes
// du dataset déjà importé (Module 2) aux questions du questionnaire
// déjà généré pour ce projet (P4), lorsqu'il existe. Aucun appel IA
// dans cet incrément (voir ScientificMappingEngine.ts).
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord } from "@/lib/server/research/ResearchStateService";
import { suggestMappingsForDataset } from "@/lib/server/dataset/ScientificMappingEngine";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";

export const runtime = "nodejs";

function isDataset(value: unknown): value is Dataset {
  return Boolean(value) && Array.isArray((value as { columns?: unknown }).columns);
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
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

  const dataset = record.dataset;
  const questionnaire = record.instrument?.questionnaire;

  const suggestions = suggestMappingsForDataset(dataset, questionnaire);

  return Response.json(
    {
      suggestions,
      hasQuestionnaire: Boolean(questionnaire),
      totalColumns: dataset.columns.length,
      suggestedCount: suggestions.filter((s) => s.best).length,
    },
    { status: 200 }
  );
}
