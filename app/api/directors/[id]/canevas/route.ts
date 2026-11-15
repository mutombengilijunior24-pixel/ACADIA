// ============================================================
// ACADIA — CANEVAS D'UN DIRECTEUR (lecture, comptes connectés)
//
// Le canevas actif du compte directeur rattaché et validé ; null sinon
// (l'étudiant suit alors la logique générale d'ACADIA).
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getDirectorCanevas } from "@/lib/server/directors/DirectorsService";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  if (!id || id.length > 64) return Response.json({ canevas: null }, { status: 200 });
  return Response.json({ canevas: await getDirectorCanevas(id) }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}
