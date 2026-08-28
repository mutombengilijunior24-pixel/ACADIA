// ============================================================
// ACADIA — PROPOSITION D'HYPOTHÈSES SECONDAIRES (P13.2)
//
// AIResearchAdapter.ts (non modifié — voir ACADIA_P13_2_AUDIT.md)
// ne produit qu'UNE hypothèse (la principale, H), dérivée de la
// relation unique proposée par A1. Ce fichier comble le vide
// structurel identifié par l'audit : proposer des hypothèses
// SECONDAIRES, dérivées UNIQUEMENT des dimensions déjà
// opérationnalisées de la variable explicative existante — jamais
// une nouvelle variable inventée, jamais un nouveau mécanisme
// théorique inventé. 100 % déterministe, aucun appel OpenAI.
//
// Les propositions ont `status: "proposed"` — jamais imposées,
// toujours validables/rejetables par le chercheur (même mécanisme
// que le reste de l'application).
// ============================================================

import type { ResearchProject, ResearchHypothesis, ResearchVariable } from "./ResearchTypes";

const RELATION_TEMPLATES: Record<string, (from: string, to: string) => string> = {
  influence: (from, to) => `${from} influence ${to}.`,
  impact: (from, to) => `${from} a un impact sur ${to}.`,
  effect: (from, to) => `${from} a un effet sur ${to}.`,
  relationship: (from, to) => `Il existe une relation entre ${from} et ${to}.`,
  association: (from, to) => `${from} est associé(e) à ${to}.`,
  correlation: (from, to) => `${from} est corrélé(e) à ${to}.`,
};

const DEFAULT_TEMPLATE = RELATION_TEMPLATES.influence;

function findPrimaryVariables(project: ResearchProject): { independent?: ResearchVariable; dependent?: ResearchVariable } {
  return {
    independent: project.variables.find((v) => v.role === "independent"),
    dependent: project.variables.find((v) => v.role === "dependent"),
  };
}

// ------------------------------------------------------------
// RECOMMANDATION DU NOMBRE D'HYPOTHÈSES SECONDAIRES (Étape 5)
//
// Jamais 3 par défaut : la recommandation dérive du nombre réel de
// dimensions déjà opérationnalisées sur la variable explicative.
// ------------------------------------------------------------

export interface SecondaryHypothesisCountRecommendation {
  recommended: 2 | 3;
  justification: string;
}

export function recommendSecondaryHypothesisCount(project: ResearchProject): SecondaryHypothesisCountRecommendation {
  const { independent } = findPrimaryVariables(project);
  const dimensionCount = independent?.dimensions?.length ?? 0;

  if (independent && dimensionCount >= 3) {
    return {
      recommended: 3,
      justification: `ACADIA recommande 3 hypothèses secondaires car votre variable explicative « ${independent.name} » comporte ${dimensionCount} dimensions distinctes déjà opérationnalisées.`,
    };
  }

  if (independent && dimensionCount === 2) {
    return {
      recommended: 2,
      justification: `ACADIA recommande 2 hypothèses secondaires car votre variable explicative « ${independent.name} » comporte 2 dimensions déjà opérationnalisées.`,
    };
  }

  return {
    recommended: 2,
    justification: "Recommandation par défaut : votre variable explicative ne comporte pas encore assez de dimensions opérationnalisées pour une recommandation plus précise — vous pouvez ajuster ce choix librement.",
  };
}

// ------------------------------------------------------------
// PROPOSITION DES HYPOTHÈSES SECONDAIRES
// ------------------------------------------------------------

export function proposeSecondaryHypotheses(project: ResearchProject, targetCount: number): ResearchHypothesis[] {
  const { independent, dependent } = findPrimaryVariables(project);
  if (!independent || !dependent) return [];

  const relationKey = project.understanding?.proposedRelationship?.relation;
  const template = (relationKey && RELATION_TEMPLATES[relationKey]) || DEFAULT_TEMPLATE;

  const existingStatements = (project.hypotheses ?? []).map((h) => h.statement.toLowerCase());

  const proposals: ResearchHypothesis[] = [];
  for (const dimension of independent.dimensions ?? []) {
    if (proposals.length >= targetCount) break;

    const statement = template(dimension.name, dependent.name);
    if (existingStatements.some((s) => s === statement.toLowerCase())) continue;

    proposals.push({
      id: `hypothesis-secondary-${dimension.id}`,
      statement,
      role: "specific",
      variableIds: [independent.id, dependent.id],
      status: "proposed",
      confidence: "medium",
    });
  }

  return proposals;
}
