// ============================================================
// ACADIA — LIMITATION DE DÉBIT (P17)
//
// Interface stable + implémentation de développement en mémoire
// process (fenêtre glissante simple). Fonctionne correctement
// uniquement sur un seul processus serveur — limite assumée et
// documentée (voir ACADIA_P17_SECURITY.md §5). Recommandation de
// production : un magasin partagé (Redis/KV), non installé ici.
// ============================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): RateLimitResult;
}

class InMemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; windowStart: number }>();

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (!entry || now - entry.windowStart >= windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    entry.count += 1;
    const allowed = entry.count <= limit;
    return { allowed, remaining: Math.max(0, limit - entry.count), resetAt: entry.windowStart + windowMs };
  }
}

export const rateLimiter: RateLimiter = new InMemoryRateLimiter();

/**
 * Aide pour les routes sensibles : combine une clé (souvent l'IP ou
 * l'email tenté) avec un préfixe par route, pour éviter qu'une
 * limite sur /login n'affecte /register.
 */
export function rateLimitKey(routeName: string, identifier: string): string {
  return `${routeName}:${identifier}`;
}
