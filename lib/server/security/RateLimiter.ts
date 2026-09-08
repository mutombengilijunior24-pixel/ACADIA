// ============================================================
// ACADIA — LIMITATION DE DÉBIT (P17 ; renforcé — audit "100 étudiants" 08/09/2026)
//
// Interface stable + implémentation en mémoire process (fenêtre
// glissante + anti-rafale). Limite assumée et non résolue par ce
// correctif : en environnement serverless multi-instance (Vercel),
// chaque instance a son propre compteur mémoire — un utilisateur qui
// atterrit sur 2 instances différentes peut dépasser la limite
// nominale globale. Une vraie limite globale demanderait un magasin
// partagé (Redis/KV) : infrastructure supplémentaire non installée
// dans ce projet, volontairement hors scope de ce correctif ciblé
// (voir rapport Bloc 1, Partie 8 — la mission demande explicitement
// de ne pas inventer une architecture lourde ici).
//
// Ce que ce correctif protège réellement, y compris en serverless
// multi-instance (car il agit au sein d'une même instance, là où la
// quasi-totalité des abus accidentels se produisent — double clic,
// bouton "regénérer" pressé plusieurs fois, boucle de retry cassée) :
// un même compteur logique (même clé, ex. même utilisateur + même
// route) ne peut plus être sollicité deux fois en moins de
// MIN_INTERVAL_MS, quel que soit le nombre d'appels encore autorisés
// dans la fenêtre horaire. Ce que ce correctif NE protège PAS : un
// abus délibéré et distribué sur plusieurs instances serverless
// simultanément — voir limite ci-dessus.
// ============================================================

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

export interface RateLimiter {
  check(key: string, limit: number, windowMs: number): RateLimitResult;
}

// Anti double-clic / rafale immédiate / appels parallèles du même
// utilisateur. Volontairement court : ce limiteur est PARTAGÉ par des
// routes aux usages très différents (ex. /login, /register, chaque
// route qui appelle OpenAI) — la valeur doit rester bien en dessous de
// tout rythme humain plausible (retaper un mot de passe prend
// plusieurs secondes) pour ne jamais gêner un utilisateur légitime
// pressé, tout en bloquant un double clic ou une boucle de retry
// cassée (typiquement quelques dizaines à quelques centaines de ms).
const MIN_INTERVAL_MS = 800;

class InMemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; windowStart: number; lastHitAt: number }>();

  check(key: string, limit: number, windowMs: number): RateLimitResult {
    const now = Date.now();
    const entry = this.hits.get(key);

    if (entry && now - entry.lastHitAt < MIN_INTERVAL_MS) {
      return { allowed: false, remaining: Math.max(0, limit - entry.count), resetAt: entry.windowStart + windowMs };
    }

    if (!entry || now - entry.windowStart >= windowMs) {
      this.hits.set(key, { count: 1, windowStart: now, lastHitAt: now });
      return { allowed: true, remaining: limit - 1, resetAt: now + windowMs };
    }

    entry.count += 1;
    entry.lastHitAt = now;
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
