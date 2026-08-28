// ============================================================
// ACADIA — MOT DE PASSE OUBLIÉ (P13)
//
// Aucun service d'email n'est branché en bêta (voir
// ACADIA_P13_AUTH_ARCHITECTURE.md). Le lien de réinitialisation est
// renvoyé directement dans la réponse, jamais un faux message
// « un email vous a été envoyé » alors qu'aucun email ne part.
// ============================================================

import { findUserByEmail, createPasswordResetToken } from "@/lib/auth/UserStore";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { email?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();

  const limit = rateLimiter.check(rateLimitKey("forgot-password", email || "unknown"), 5, 15 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }

  const user = await findUserByEmail(email);

  if (!user) {
    return Response.json({ resetLink: null }, { status: 200 });
  }

  const { token } = await createPasswordResetToken(user.id);
  return Response.json({ resetLink: `/reset-password?token=${token}` }, { status: 200 });
}
