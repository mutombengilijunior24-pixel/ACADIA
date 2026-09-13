// ============================================================
// ACADIA — TAXONOMIE DES MODES DE RECHERCHE (Research Intelligence V2)
//
// Constante partagée entre A1 (lib/ai/openai/SubjectUnderstandingAI.ts,
// qui produit ces tags), MethodologyRecommendationEngine (qui les
// consomme pour proposer un devis) et l'affichage (libellés lisibles).
// Un seul point de vérité pour la liste des tags — évite de la
// dupliquer dans chaque prompt/composant.
// ============================================================

import type { ResearchModeTag } from "./ResearchTypes";

export const RESEARCH_MODE_TAGS: ResearchModeTag[] = [
  "QUANTITATIVE_SURVEY",
  "QUALITATIVE",
  "FINANCIAL_ANALYSIS",
  "SECONDARY_DATA",
  "MIXED_METHOD",
  "CASE_STUDY",
  "DESCRIPTIVE",
  "CORRELATIONAL",
  "EXPLANATORY",
  "COMPARATIVE",
];

export const RESEARCH_MODE_LABELS: Record<ResearchModeTag, string> = {
  QUANTITATIVE_SURVEY: "Enquête quantitative",
  QUALITATIVE: "Recherche qualitative",
  FINANCIAL_ANALYSIS: "Analyse financière / comptable",
  SECONDARY_DATA: "Données secondaires",
  MIXED_METHOD: "Approche mixte",
  CASE_STUDY: "Étude de cas",
  DESCRIPTIVE: "Devis descriptif",
  CORRELATIONAL: "Devis corrélationnel",
  EXPLANATORY: "Devis explicatif",
  COMPARATIVE: "Devis comparatif",
};

/**
 * Tags qui, lorsqu'ils dominent (sans QUANTITATIVE_SURVEY ni
 * MIXED_METHOD également présents), indiquent qu'un questionnaire
 * n'est probablement pas l'outil de collecte principal — utilisé en
 * amont de QuestionnaireGenerationEngine (jamais dans le moteur
 * lui-même) pour ajouter une simple note, jamais pour bloquer.
 */
export const NON_QUESTIONNAIRE_DOMINANT_TAGS: ResearchModeTag[] = [
  "FINANCIAL_ANALYSIS",
  "SECONDARY_DATA",
];
