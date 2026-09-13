// ============================================================
// ACADIA — SESSION ANONYME + HACHAGE IP (mission Security + AI Cost Foundation)
//
// Principe central de la mission (§4) : une IP n'est PAS une
// identité. Un campus universitaire peut exposer une seule IP
// publique partagée par des centaines d'étudiants (NAT) — limiter
// par IP brute reviendrait à bloquer tout un amphithéâtre pour la
// faute d'un seul script abusif.
//
// Stratégie retenue :
// - anonymousSessionId (cookie HttpOnly, un identifiant aléatoire
//   par navigateur) devient le signal D'IDENTITÉ principal pour le
//   quota "normal" d'un visiteur anonyme.
// - l'IP, jamais stockée en clair, est hachée (HMAC-SHA256 avec un
//   secret serveur) et sert de signal D'ABUS SECONDAIRE, avec un
//   seuil beaucoup plus large (pensé pour "un campus entier", pas
//   "une personne") — voir AnonymousPreviewGuard.ts.
// ============================================================

import { createHmac, randomUUID } from "node:crypto";
import { cookies } from "next/headers";

export const ANONYMOUS_SESSION_COOKIE = "acadia_anon_session";

const ANON_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 jours

// Réutilise SESSION_SECRET (déjà provisionné pour les sessions
// authentifiées, voir lib/auth/session.ts) plutôt que d'exiger une
// nouvelle variable d'environnement pour ce correctif ciblé. Un
// secret dédié (IP_HASH_SECRET) pourra être introduit plus tard sans
// changer la forme de ce module.
function getHashSecret(): string {
  return process.env.IP_HASH_SECRET || process.env.SESSION_SECRET || "acadia-dev-fallback-secret";
}

/**
 * Hache une adresse IP — ne conserve JAMAIS l'IP en clair. Le même
 * secret produit toujours le même hash pour une IP donnée (permet de
 * compter les tentatives d'UNE MÊME IP sans jamais la stocker lisible
 * dans les logs/la base).
 */
export function hashIp(ip: string): string {
  return createHmac("sha256", getHashSecret()).update(ip).digest("hex").slice(0, 32);
}

/**
 * Extrait l'IP depuis les en-têtes de la requête — best-effort
 * (x-forwarded-for peut contenir plusieurs IP séparées par une
 * virgule derrière un proxy ; on ne garde que la première, la plus
 * proche du client réel).
 */
export function extractClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "local";
}

/**
 * Lit l'anonymousSessionId existant (cookie) sans jamais en créer un
 * nouveau — utilisé en lecture seule quand la route n'a pas la main
 * sur les en-têtes de réponse (ex. Server Component).
 */
export async function readAnonymousSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(ANONYMOUS_SESSION_COOKIE)?.value ?? null;
}

/**
 * Lit l'anonymousSessionId existant ou en pose un nouveau (cookie
 * HttpOnly, non lisible en JS côté client — c'est un identifiant
 * technique anti-abus, jamais une donnée que le front doit lire).
 * Retourne l'id ET indique s'il vient d'être créé (pour poser le
 * cookie sur la réponse HTTP, une Route Handler ne pouvant écrire un
 * cookie qu'via NextResponse/`cookies().set`).
 */
export async function getOrCreateAnonymousSessionId(): Promise<{ id: string; isNew: boolean }> {
  const store = await cookies();
  const existing = store.get(ANONYMOUS_SESSION_COOKIE)?.value;
  if (existing) return { id: existing, isNew: false };

  const id = randomUUID();
  store.set(ANONYMOUS_SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: ANON_SESSION_MAX_AGE_SECONDS,
    path: "/",
  });
  return { id, isNew: true };
}
