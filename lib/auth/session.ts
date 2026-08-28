// ============================================================
// ACADIA — SESSIONS (P13)
//
// Cookie HttpOnly signé (HMAC-SHA256, via l'implémentation crypto
// native de Node — aucune dépendance supplémentaire pour cette
// partie). Le cookie contient uniquement l'identifiant utilisateur
// et une expiration ; aucune donnée sensible n'y est stockée.
// ============================================================

import { createHmac, timingSafeEqual } from "node:crypto";
import type { SessionPayload } from "./AuthTypes";

export const SESSION_COOKIE_NAME = "acadia_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 jours

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET manquant — voir .env.example.");
  }
  return secret;
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function createSessionToken(userId: string): string {
  const payload: SessionPayload = {
    userId,
    issuedAt: Date.now(),
    expiresAt: Date.now() + SESSION_TTL_MS,
  };
  const encoded = base64url(JSON.stringify(payload));
  const signature = sign(encoded);
  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string | undefined | null): SessionPayload | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, signature] = parts;

  const expectedSignature = sign(encoded);
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as SessionPayload;
    if (typeof payload.userId !== "string" || typeof payload.expiresAt !== "number") return null;
    if (payload.expiresAt < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_MAX_AGE_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
