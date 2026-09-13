// ============================================================
// ACADIA — CONFIGURATION CENTRALISÉE DU PRICING (mission Conversion
// + Pay-as-you-progress)
//
// POINT UNIQUE DE VÉRITÉ pour "combien coûte quoi" et "sommes-nous en
// bêta" — la mission demande explicitement de NE PAS éparpiller des
// `if (beta) { free }` dans les routes. Tout code qui a besoin de
// savoir un prix ou si la bêta est active passe par ce fichier,
// jamais par sa propre logique locale.
//
// Vendre des ÉTAPES DE VALEUR, pas des tokens (mission §principe) :
// chaque clé correspond à une vraie capacité scientifique déjà
// existante dans le code (voir la colonne "Capacité" ci-dessous),
// jamais un compteur de tokens/appels IA.
// ============================================================

export const ENTITLEMENT_KEYS = [
  "PREVIEW",
  "RESEARCH_ANALYSIS",
  "METHODOLOGY",
  "QUESTIONNAIRE",
  "DATA_ANALYSIS",
  "INTERPRETATION",
  "WRITING",
  "DEFENSE",
] as const;

export type EntitlementKey = (typeof ENTITLEMENT_KEYS)[number];

export interface EntitlementCatalogEntry {
  key: EntitlementKey;
  label: string;
  /** Ce que le chercheur débloque concrètement — jamais "plus de tokens". */
  unlocks: string;
  /** Pourquoi c'est utile — répond à "pourquoi c'est utile" (mission §3). */
  why: string;
  /** Ce qu'il pourra faire ensuite une fois débloqué. */
  thenWhat: string;
  /** Prix normal (post-bêta), en USD. */
  priceUsd: number;
  /** Prix pendant la bêta — 0 aujourd'hui, configurable sans toucher au code appelant. */
  betaPriceUsd: number;
  /** Capacité scientifique réelle déjà existante que ce déblocage active. */
  capability: string;
}

// ------------------------------------------------------------
// BASCULE BÊTA — une seule variable d'environnement, un seul endroit.
// BILLING_BETA_MODE=false désactivera la bêta (prix réels appliqués)
// sans toucher à un seul appelant de getEffectivePriceUsd/isBetaMode.
// ------------------------------------------------------------

export function isBetaMode(): boolean {
  return process.env.BILLING_BETA_MODE !== "false";
}

export const ENTITLEMENT_CATALOG: Record<EntitlementKey, EntitlementCatalogEntry> = {
  PREVIEW: {
    key: "PREVIEW",
    label: "Aperçu du sujet",
    unlocks: "Compréhension, phénomène, problème et question de recherche proposés par ACADIA.",
    why: "Vérifier qu'ACADIA comprend réellement votre sujet avant tout engagement.",
    thenWhat: "Créer votre compte pour approfondir avec vos variables.",
    priceUsd: 0,
    betaPriceUsd: 0,
    capability: "A1 profondeur réduite (understandResearchWithAI, depth=\"preview\") — voir mission Preview WOW.",
  },
  RESEARCH_ANALYSIS: {
    key: "RESEARCH_ANALYSIS",
    label: "Analyse en profondeur",
    unlocks: "Variables, dimensions, indicateurs et relations proposés à partir de votre sujet.",
    why: "Impossible de construire une méthodologie sérieuse sans variables clairement identifiées.",
    thenWhat: "Valider ou corriger vos variables, puis construire votre méthodologie.",
    priceUsd: 5,
    betaPriceUsd: 0,
    capability: "A1 complet + A2 (analyzeResearch) — app/api/research/[id]/deep-analysis.",
  },
  METHODOLOGY: {
    key: "METHODOLOGY",
    label: "Méthodologie",
    unlocks: "Validation de l'orientation, du devis, de l'échantillonnage et de l'instrument recommandés.",
    why: "Une méthodologie validée est ce qui rend votre collecte de données défendable.",
    thenWhat: "Générer votre questionnaire ou guide d'entretien.",
    priceUsd: 5,
    betaPriceUsd: 0,
    capability: "MethodologyRecommendationEngine + validation humaine (MethodologyOverview.tsx).",
  },
  QUESTIONNAIRE: {
    key: "QUESTIONNAIRE",
    label: "Questionnaire / guide d'entretien",
    unlocks: "Génération de votre instrument de collecte, une question par indicateur validé.",
    why: "Un instrument mal construit invalide toute la collecte qui suit.",
    thenWhat: "Publier et collecter vos données.",
    priceUsd: 5,
    betaPriceUsd: 0,
    capability: "QuestionnaireGenerationEngine + enrichissement IA — .../questionnaire/generate.",
  },
  DATA_ANALYSIS: {
    key: "DATA_ANALYSIS",
    label: "Analyse des données",
    unlocks: "Plan d'analyse et exécutions statistiques sur vos données collectées.",
    why: "Passer de données brutes à des résultats scientifiquement exploitables.",
    thenWhat: "Interpréter vos résultats.",
    priceUsd: 10,
    betaPriceUsd: 0,
    capability: "AnalysisPlanEngine + exécutions statistiques — .../analysis-plan/generate, /runs.",
  },
  INTERPRETATION: {
    key: "INTERPRETATION",
    label: "Interprétation scientifique",
    unlocks: "Formulation de vos résultats et décisions d'hypothèses en langage académique.",
    why: "Traduire des chiffres en constats scientifiques défendables.",
    thenWhat: "Rédiger votre conclusion et votre document final.",
    priceUsd: 10,
    betaPriceUsd: 0,
    capability: "HypothesisAssessmentEngine + ScientificInterpretationAI — .../interpretation/generate.",
  },
  WRITING: {
    key: "WRITING",
    label: "Rédaction",
    unlocks: "Export du document scientifique structuré (chapitres, bibliographie).",
    why: "Produire un document prêt à être relu par votre encadreur.",
    thenWhat: "Préparer votre soutenance.",
    priceUsd: 10,
    betaPriceUsd: 0,
    capability: "DocumentBibliographyBuilder + export — non encore instrumenté par cette mission (voir rapport).",
  },
  DEFENSE: {
    key: "DEFENSE",
    label: "Préparation à la soutenance",
    unlocks: "Support de préparation à la défense de votre travail.",
    why: "Anticiper les questions et défendre vos choix méthodologiques.",
    thenWhat: "Soutenir votre travail.",
    priceUsd: 10,
    betaPriceUsd: 0,
    capability: "Non encore construit dans le code — clé réservée pour une évolution future (mission §2).",
  },
};

export function getCatalogEntry(key: EntitlementKey): EntitlementCatalogEntry {
  return ENTITLEMENT_CATALOG[key];
}

/** Prix réellement appliqué maintenant — bêta ou non, jamais recalculé ailleurs. */
export function getEffectivePriceUsd(key: EntitlementKey): number {
  const entry = getCatalogEntry(key);
  return isBetaMode() ? entry.betaPriceUsd : entry.priceUsd;
}
