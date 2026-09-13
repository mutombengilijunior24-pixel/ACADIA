// ============================================================
// ACADIA — GARDE DE CONCURRENCE (mission Security + AI Cost Foundation)
//
// Protection anti double-clic / double-onglet : empêche qu'une même
// clé logique (ex. même anonymousSessionId + même route) déclenche
// deux appels IA coûteux simultanément.
//
// LIMITE ASSUMÉE (même discipline de transparence que RateLimiter.ts) :
// protection PAR INSTANCE serverless uniquement — une vraie garde
// cross-instance demanderait un verrou distribué (Redis SETNX ou
// équivalent Postgres), non installé ici. Reste utile car un double
// clic atterrit presque toujours sur la même instance dans la même
// seconde ; pour les routes qui persistent déjà un état vérifiable
// (ex. deep-analysis : variables.length > 0, questionnaire :
// instrument déjà généré), CET état persisté reste la protection
// cross-instance réelle — ce garde n'est qu'une couche supplémentaire
// pour les cas sans état persisté à vérifier (ex. preview anonyme).
// ============================================================

const inFlight = new Map<string, number>();

/**
 * Tente d'entrer dans la section critique identifiée par `key`.
 * Retourne false si `maxConcurrent` requêtes sont déjà en cours pour
 * cette clé — l'appelant doit alors répondre sans lancer l'appel IA.
 * TOUJOURS appairé à exitConcurrency() dans un `finally`.
 */
export function tryEnterConcurrency(key: string, maxConcurrent = 1): boolean {
  const current = inFlight.get(key) ?? 0;
  if (current >= maxConcurrent) return false;
  inFlight.set(key, current + 1);
  return true;
}

export function exitConcurrency(key: string): void {
  const current = inFlight.get(key) ?? 0;
  if (current <= 1) {
    inFlight.delete(key);
  } else {
    inFlight.set(key, current - 1);
  }
}
