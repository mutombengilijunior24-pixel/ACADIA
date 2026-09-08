// ============================================================
// ACADIA — CONNEXION (P13)
// ============================================================

import { cookies } from "next/headers";
import { findUserByEmail } from "@/lib/auth/UserStore";
import { verifyPassword } from "@/lib/auth/passwords";
import { createSessionToken, SESSION_COOKIE_MAX_AGE_SECONDS, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { toPublicUser } from "@/lib/auth/AuthTypes";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const email = (body.email ?? "").trim();

  const limit = rateLimiter.check(rateLimitKey("login", email || "unknown"), 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }
  const password = body.password ?? "";

  const user = await findUserByEmail(email);
  // Message volontairement identique pour email inconnu et mot de passe
  // incorrect — ne jamais révéler si une adresse email est enregistrée.
  const invalidCredentials = async () => {
    await logAudit({ action: "LOGIN_FAILED", entityType: "User", metadata: { email } });
    return Response.json({ error: "Email ou mot de passe incorrect." }, { status: 401 });
  };

  if (!user) return invalidCredentials();

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) return invalidCredentials();

  const token = createSessionToken(user.id);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
  });

  await trackProductEvent({ userId: user.id, eventType: "AUTH_LOGIN" });

  return Response.json({ user: toPublicUser(user) }, { status: 200 });
}
