// ============================================================
// ACADIA — LISTE DES CONCLUSIONS SCIENTIFIQUES (Mission 7, bloc 1)
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord } from "@/lib/server/research/ResearchStateService";
import { isInterpretationOutdated } from "@/lib/server/research/ScientificInterpretationContextBuilder";

export const runtime = "nodejs";

function readDatasetUpdatedAt(dataset: unknown): string | undefined {
  if (dataset && typeof dataset === "object" && "updatedAt" in dataset && typeof (dataset as { updatedAt: unknown }).updatedAt === "string") {
    return (dataset as { updatedAt: string }).updatedAt;
  }
  return undefined;
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

  const currentDatasetUpdatedAt = readDatasetUpdatedAt(record.dataset);
  const currentAnalysisPlanUpdatedAt = record.project.analysisPlan?.updatedAt;

  const conclusions = (record.project.scientificConclusions ?? []).map((c) => ({
    ...c,
    isOutdated: isInterpretationOutdated(currentDatasetUpdatedAt, currentAnalysisPlanUpdatedAt, c),
  }));

  return Response.json({ conclusions }, { status: 200 });
}
