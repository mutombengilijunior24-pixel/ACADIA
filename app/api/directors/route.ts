// ============================================================
// ACADIA — ANNUAIRE DES DIRECTEURS (lecture, comptes connectés)
//
// Liste des directeurs actifs que l'étudiant peut choisir pour son
// travail. Jamais les notes internes de l'administration.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { listActiveDirectors } from "@/lib/server/directors/DirectorsService";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const directors = await listActiveDirectors();
  return Response.json({ directors }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}
