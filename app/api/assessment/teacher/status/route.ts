// ============================================================
// ACADIA — STATUT ENSEIGNANT DE L'UTILISATEUR COURANT
//
// Endpoint minimal pour la navigation (Sidebar.tsx) : un utilisateur
// n'a "Espace enseignant" affiché que s'il possède réellement un
// TeacherProfile — jamais un lien visible pour tout le monde avec un
// état vide en secours (retour utilisateur, Mission Teacher Workspace
// — voir mémoire navigation-role-aware-not-universal). Ne réutilise
// pas /api/assessment/teacher/dashboard, volontairement plus lourd
// (agrégats complets) pour un simple besoin d'affichage de menu.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const teacherProfile = await prisma.teacherProfile.findUnique({ where: { userId: user.id }, select: { userId: true } });
  return Response.json({ isTeacher: !!teacherProfile }, { status: 200 });
}
