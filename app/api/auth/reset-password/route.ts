// ============================================================
// ACADIA — RÉINITIALISATION DU MOT DE PASSE (P13)
// ============================================================

import { consumePasswordResetToken, updateUserPassword } from "@/lib/auth/UserStore";
import { hashPassword, isPasswordStrongEnough } from "@/lib/auth/passwords";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { token?: string; newPassword?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const token = body.token ?? "";
  const newPassword = body.newPassword ?? "";

  const limit = rateLimiter.check(rateLimitKey("reset-password", token || "unknown"), 10, 15 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }

  if (!isPasswordStrongEnough(newPassword)) {
    return Response.json({ error: "Le mot de passe doit contenir au moins 8 caractères." }, { status: 400 });
  }

  const userId = await consumePasswordResetToken(token);
  if (!userId) {
    return Response.json({ error: "Ce lien de réinitialisation est invalide ou expiré." }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);
  await updateUserPassword(userId, passwordHash);

  return Response.json({ ok: true }, { status: 200 });
}
