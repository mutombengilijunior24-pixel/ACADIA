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
import { sendPasswordResetEmail, appUrl } from "@/lib/email/EmailProvider";

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

  // Réponse identique que le compte existe ou non — ne jamais révéler
  // si une adresse email est enregistrée (voir le même principe déjà
  // appliqué dans /api/auth/login).
  if (!user) {
    return Response.json({ ok: true }, { status: 200 });
  }

  const { token } = await createPasswordResetToken(user.id);
  const resetLink = `${appUrl()}/reset-password?token=${token}`;
  await sendPasswordResetEmail(user.email, resetLink);

  // Le lien n'est JAMAIS renvoyé dans la réponse API — ce serait un
  // contournement complet de l'authentification (n'importe qui
  // connaissant un email obtiendrait le token de réinitialisation).
  // Exception strictement limitée au développement local, pour
  // pouvoir tester le flux sans service email réel configuré.
  const devOnly = process.env.NODE_ENV !== "production" ? { resetLink } : {};
  return Response.json({ ok: true, ...devOnly }, { status: 200 });
}
