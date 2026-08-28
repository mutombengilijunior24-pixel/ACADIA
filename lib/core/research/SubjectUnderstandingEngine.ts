import type { ResearchData } from "@/types/Research";

import type {
  ResearchUnderstanding,
} from "./ResearchTypes";

/* =========================================================
   ACADIA — SUBJECT UNDERSTANDING ENGINE
   A1 — Compréhension intelligente du sujet
========================================================= */

export interface SubjectUnderstandingResult {
  understanding: ResearchUnderstanding;
  reasoning?: string;
}

/**
 * A1 transforme les informations brutes de recherche
 * en compréhension structurée du sujet.
 *
 * IMPORTANT :
 * A1 ne crée pas encore les variables.
 * Il prépare la compréhension qui permettra
 * au futur moteur de proposer les variables.
 */
export function understandResearchSubject(
  research: ResearchData
): SubjectUnderstandingResult {
  const title = research.title.trim();

  if (!title) {
    throw new Error(
      "Impossible d'analyser un sujet de recherche vide."
    );
  }

  const understanding: ResearchUnderstanding = {
    researchFocus: title,

    mainConcepts: [],

    population:
      research.population?.trim() || undefined,

    location:
      research.location?.trim() || undefined,

    proposedRelationship: {
      from: "",
      to: "",
      relation: "unknown",
    },

    assumptions: [],

    pointsToConfirm: [],

    confidence: "low",

    status: "proposed",
  };

  return {
    understanding,

    reasoning:
      "Compréhension initiale créée à partir des informations fournies par le chercheur.",
  };
}