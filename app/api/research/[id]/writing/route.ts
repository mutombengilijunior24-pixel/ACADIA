// ============================================================
// ACADIA — LISTE DES SECTIONS DE RÉDACTION (Mission 9)
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { listSections, WritingForbiddenError, WritingNotFoundError } from "@/lib/server/research/WritingSectionService";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  try {
    const sections = await listSections(user.id, id);
    return Response.json({ sections }, { status: 200 });
  } catch (error) {
    if (error instanceof WritingNotFoundError) return notFound();
    if (error instanceof WritingForbiddenError) return forbidden(error.message, { actorId: user.id, entityType: "ResearchProject", entityId: id });
    throw error;
  }
}
