// ============================================================
// ACADIA — TARIFICATION DES MODÈLES (mission Security + AI Cost Foundation)
//
// ATTENTION — RÈGLE ANTI-INVENTION APPLIQUÉE AUX COÛTS :
//
// AI_MODEL vaut "gpt-5.6" par défaut (lib/ai/openai/config.ts) — un
// nom de modèle déjà signalé par un audit antérieur du projet comme
// n'existant probablement pas au catalogue officiel OpenAI publié.
// Les tarifs ci-dessous sont donc des PLACEHOLDERS clairement
// étiquetés comme tels, jamais présentés comme des tarifs officiels
// vérifiés. estimatedCostUsd calculé à partir d'eux doit être traité
// comme une ESTIMATION D'ORDRE DE GRANDEUR, jamais comme une facture
// exacte — d'où le champ séparé actualCostUsd sur AIUsageLedger,
// prévu pour un futur rapprochement avec la facturation réelle
// OpenAI, non implémenté ici (aucune API de coût réel exposée par
// OpenAI au niveau de la requête individuelle à ce jour).
//
// Avant tout usage commercial réel de ces chiffres (marge brute,
// ARPU...), un humain doit vérifier/mettre à jour cette table avec
// les tarifs réellement facturés par le fournisseur.
// ============================================================

export interface ModelPricingRates {
  /** USD pour 1 000 000 tokens d'entrée (non mis en cache). */
  inputPerMillion: number;
  /** USD pour 1 000 000 tokens d'entrée mis en cache (prompt caching). */
  cachedInputPerMillion: number;
  /** USD pour 1 000 000 tokens de sortie. */
  outputPerMillion: number;
  /** true = tarif vérifié par un humain ; false = placeholder générique. */
  verified: boolean;
}

// Tarifs par défaut (placeholder générique, ordre de grandeur d'un
// modèle "standard" au moment de l'écriture) — utilisés pour tout
// modèle absent de la table ci-dessous.
const DEFAULT_RATES: ModelPricingRates = {
  inputPerMillion: 2.5,
  cachedInputPerMillion: 1.25,
  outputPerMillion: 10,
  verified: false,
};

// Complète cette table dès que les tarifs réels du modèle utilisé en
// production sont confirmés — ne jamais marquer verified:true sans
// vérification humaine réelle.
const MODEL_RATES: Record<string, ModelPricingRates> = {
  // "gpt-5.6" — nom placeholder (voir config.ts) : tarif non vérifié,
  // aligné sur DEFAULT_RATES tant qu'aucun tarif réel n'est confirmé.
};

export function getModelRates(model: string): ModelPricingRates {
  return MODEL_RATES[model] ?? DEFAULT_RATES;
}

/**
 * Estimation d'ordre de grandeur du coût d'un appel — jamais un
 * montant facturé réel (voir avertissement en tête de fichier).
 */
export function estimateCostUsd(
  model: string,
  usage: { inputTokens?: number | null; cachedInputTokens?: number | null; outputTokens?: number | null }
): number {
  const rates = getModelRates(model);
  const input = Math.max(0, (usage.inputTokens ?? 0) - (usage.cachedInputTokens ?? 0));
  const cached = usage.cachedInputTokens ?? 0;
  const output = usage.outputTokens ?? 0;

  const cost =
    (input / 1_000_000) * rates.inputPerMillion +
    (cached / 1_000_000) * rates.cachedInputPerMillion +
    (output / 1_000_000) * rates.outputPerMillion;

  // Arrondi à 6 décimales (cohérent avec Decimal(12,6) côté Prisma).
  return Math.round(cost * 1_000_000) / 1_000_000;
}
