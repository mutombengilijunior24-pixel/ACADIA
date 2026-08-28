// ============================================================
// ACADIA — CHANGEMENT DE MOT DE PASSE (P13)
// ============================================================

import { cookies } from "next/headers";
import { findUserById, updateUserPassword } from "@/lib/auth/UserStore";
import { hashPassword, isPasswordStrongEnough, verifyPassword } from "@/lib/auth/passwords";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const cookieStore = await cookies();
  const session = verifySessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
  if (!session) {
    return Response.json({ error: "Session expirée. Reconnectez-vous." }, { status: 401 });
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const user = await findUserById(session.userId);
  if (!user) {
    return Response.json({ error: "Compte introuvable." }, { status: 404 });
  }

  const valid = await verifyPassword(body.currentPassword ?? "", user.passwordHash);
  if (!valid) {
    return Response.json({ error: "Mot de passe actuel incorrect." }, { status: 401 });
  }

  if (!isPasswordStrongEnough(body.newPassword ?? "")) {
    return Response.json({ error: "Le nouveau mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
  }

  const passwordHash = await hashPassword(body.newPassword!);
  await updateUserPassword(user.id, passwordHash);

  return Response.json({ ok: true }, { status: 200 });
}
