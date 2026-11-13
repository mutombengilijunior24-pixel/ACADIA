// ============================================================
// ACADIA — PROFIL ÉTUDIANT DU COMPTE CONNECTÉ (lecture)
//
// Niveau d'études et institution saisis à l'inscription : ils pré-remplissent
// l'assistant « Nouvelle recherche ». Uniquement le compte de la session.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const profile = await prisma.studentProfile.findUnique({ where: { userId: user.id }, select: { studyLevel: true, institution: true } });
  return Response.json({ profile: profile ?? null }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}
