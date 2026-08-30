// ============================================================
// ACADIA — RETRY CONTRÔLÉ POUR ERREURS TRANSITOIRES (P20.5)
//
// Réutilisé pour toute opération d'écriture critique dont l'échec
// n'est du qu'à la base de données/au pooler (jamais à une erreur de
// validation ou d'autorisation, qui ne doivent jamais être
// réessayées). Ne fait AUCUNE hypothèse métier — un simple wrapper
// générique, pas un deuxième client Prisma.
// ============================================================

const TRANSIENT_PRISMA_CODES = new Set([
  "P1001", // Impossible de joindre le serveur de base de données
  "P1002", // Le serveur de base de données a atteint le délai d'attente
  "P1017", // Le serveur a fermé la connexion
  "P2024", // Délai dépassé en récupérant une connexion du pool
]);

const TRANSIENT_MESSAGE_PATTERNS = [/ECONNRESET/i, /ETIMEDOUT/i, /Connection terminated/i, /Can't reach database server/i, /connection.*closed/i];

function isTransientError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const code = (error as { code?: string }).code;
    if (code && TRANSIENT_PRISMA_CODES.has(code)) return true;
    const name = (error as { name?: string }).name;
    if (name === "PrismaClientInitializationError" || name === "PrismaClientRustPanicError") return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return TRANSIENT_MESSAGE_PATTERNS.some((p) => p.test(message));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Réessaie `fn` jusqu'à `maxAttempts` fois, uniquement lorsque
 * l'échec est reconnu comme transitoire (pooler/réseau) — jamais une
 * erreur de validation, d'autorisation, ou une violation de
 * contrainte d'unicité (celles-ci doivent être traitées par
 * l'appelant, pas masquées par une nouvelle tentative).
 */
export async function withTransientRetry<T>(fn: () => Promise<T>, maxAttempts = 3, delaysMs: number[] = [200, 600]): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientError(error) || attempt === maxAttempts - 1) throw error;
      await sleep(delaysMs[attempt] ?? delaysMs[delaysMs.length - 1]);
    }
  }
  throw lastError;
}

/** Vrai si l'erreur Prisma est une violation de contrainte d'unicité portant sur les champs donnés. */
export function isUniqueConstraintOn(error: unknown, fields: string[]): boolean {
  if (!error || typeof error !== "object") return false;
  const code = (error as { code?: string }).code;
  if (code !== "P2002") return false;
  const target = (error as { meta?: { target?: string[] | string } }).meta?.target;
  const targetFields = Array.isArray(target) ? target : typeof target === "string" ? [target] : [];
  return fields.every((f) => targetFields.includes(f));
}
