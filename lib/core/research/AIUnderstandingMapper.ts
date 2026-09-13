// ============================================================
// ACADIA — CONVERSION A1 → RESEARCH CORE (mission Preview WOW)
//
// Extrait de ResearchIntelligenceEngine.ts pour être réutilisable
// SANS RISQUE côté client (composants "use client") : ce module ne
// dépend que de types purs (ResearchTypes.ts), jamais du SDK OpenAI
// ni de lib/ai/openai/client.ts (qui lève une exception s'il est
// chargé dans un navigateur, y compris transitivement). Un seul point
// de conversion AIResearchUnderstanding → ResearchUnderstanding,
// partagé par :
// - ResearchIntelligenceEngine.ts (parcours authentifié, analyse en
//   profondeur) ;
// - contexts/ResearchContext.tsx (createResearchFromPreview, preview
//   anonyme devenue projet après inscription).
// Avant cette extraction, ces deux appelants dupliquaient chacun leur
// propre mapping (l'un via A1 réel, l'autre via l'ancien
// PreviewNarrativeAI) — plus aucune raison de diverger, les deux
// consomment désormais EXACTEMENT le même contrat A1.
// ============================================================

import type {
  ResearchUnderstanding,
  ConfidenceLevel,
} from "./ResearchTypes";

import type { AIResearchUnderstanding } from "@/lib/ai/openai/SubjectUnderstandingAI";

export function normalizeConfidence(value: unknown): ConfidenceLevel {
  if (value === "high" || value === "medium" || value === "low") {
    return value;
  }
  return "medium";
}

export function convertAIUnderstanding(
  understanding: AIResearchUnderstanding
): ResearchUnderstanding {
  return {
    researchFocus: understanding.researchFocus,

    phenomenon: understanding.phenomenon || undefined,
    problem: understanding.problem || undefined,
    researchQuestion: understanding.researchQuestion || undefined,

    objective: understanding.generalObjective || undefined,
    objectives:
      (understanding.specificObjectives ?? []).length > 0
        ? understanding.specificObjectives
        : undefined,

    engineVersion: understanding.engineVersion,

    mainConcepts: understanding.mainConcepts,
    population: understanding.population,
    location: understanding.location,

    researchModeTags: understanding.researchModeTags,
    fieldConfidence: understanding.fieldConfidence,
    phenomenonTable: understanding.phenomenonTable,

    proposedRelationship: understanding.proposedRelationship
      ? {
          from: understanding.proposedRelationship.from,
          to: understanding.proposedRelationship.to,
          relation: understanding.proposedRelationship.relation,
          description: understanding.proposedRelationship.description,
        }
      : undefined,

    assumptions: understanding.assumptions,
    pointsToConfirm: understanding.pointsToConfirm,

    confidence: normalizeConfidence(understanding.confidence),

    status: "proposed",
  };
}
