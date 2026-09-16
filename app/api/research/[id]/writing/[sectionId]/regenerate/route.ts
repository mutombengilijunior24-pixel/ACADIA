// ============================================================
// ACADIA — RÉGÉNÉRATION D'UNE SECTION DE RÉDACTION (Mission 9)
//
// Reconstruit intégralement le contenu à partir de l'état de recherche
// ACTUEL (mission §26/§53 : une régénération après modification d'une
// hypothèse, par exemple, ne doit jamais conserver silencieusement
// l'ancien texte) — ajoute une nouvelle version, ne supprime jamais
// les précédentes.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { regenerateSectionById, WritingForbiddenError, WritingNotFoundError } from "@/lib/server/research/WritingSectionService";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(_request: Request, context: { params: Promise<{ id: string; sectionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, sectionId } = await context.params;
  try {
    const section = await regenerateSectionById(id, sectionId, { userId: user.id });
    return Response.json({ section }, { status: 200 });
  } catch (error) {
    if (error instanceof WritingNotFoundError) return notFound(error.message || undefined);
    if (error instanceof WritingForbiddenError) return forbidden(error.message, { actorId: user.id, entityType: "ResearchProject", entityId: id });
    const message = error instanceof Error ? error.message : "Échec de la régénération.";
    return Response.json({ error: message }, { status: 502 });
  }
}
