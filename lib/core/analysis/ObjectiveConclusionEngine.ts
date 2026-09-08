// ============================================================
// ACADIA — MOTEUR DE CONCLUSION D'OBJECTIF (Mission 7, bloc 1)
//
// 100% déterministe, prose template — jamais "effet" ni "impact
// causal" (voir mission §20) : le vocabulaire reste au niveau de
// l'association statistique sauf si la méthodologie du projet
// justifie explicitement une lecture causale (aucun mécanisme de ce
// type n'existe encore dans ACADIA — voir audit Mission 7).
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { HypothesisConclusion, ObjectiveConclusion, ObjectiveCoverage } from "./ScientificConclusionTypes";

function isSpecific(role: string | undefined, type: string | undefined): boolean {
  return role === "specific" || type === "specific";
}

export function buildObjectiveConclusions(
  project: ResearchProject,
  coverages: ObjectiveCoverage[],
  hypothesisConclusions: HypothesisConclusion[]
): ObjectiveConclusion[] {
  const specificObjectives = project.objectives.filter((o) => isSpecific(o.role, o.type));

  return specificObjectives.map((objective) => {
    const coverage = coverages.find((c) => c.objectiveId === objective.id);
    if (!coverage) {
      throw new Error(`Couverture manquante pour l'objectif ${objective.id} — computeObjectiveCoverage doit être appelé sur les mêmes objectifs.`);
    }

    const related = hypothesisConclusions.filter((hc) => coverage.linkedHypothesisIds.includes(hc.hypothesisId));

    let conclusion: string;

    if (coverage.status === "NONE") {
      conclusion = "Cet objectif n'est pas suffisamment couvert par les données et analyses actuellement disponibles.";
    } else if (related.length === 0) {
      // Objectif purement descriptif (aucune hypothèse), couverture FULL via statistiques descriptives.
      conclusion = "Les résultats disponibles permettent de décrire les variables associées à cet objectif, sans qu'aucune hypothèse ne soit directement testée pour cet objectif.";
    } else {
      const supported = related.filter((c) => c.decision === "SUPPORTED");
      const notSupported = related.filter((c) => c.decision === "NOT_SUPPORTED");
      const partial = related.filter((c) => c.decision === "PARTIALLY_SUPPORTED");
      const inconclusive = related.filter((c) => c.decision === "INCONCLUSIVE");

      if (notSupported.length === 0 && partial.length === 0 && inconclusive.length === 0) {
        conclusion = `Les résultats permettent de conclure que cet objectif est atteint : l'ensemble des hypothèses associées (${supported.length}) reçoivent un soutien empirique dans l'échantillon étudié.`;
      } else if (supported.length === 0 && partial.length === 0) {
        conclusion = "Les résultats disponibles ne fournissent pas suffisamment d'évidence statistique pour conclure que cet objectif est atteint.";
      } else if (inconclusive.length === related.length) {
        conclusion = "Les résultats disponibles ne permettent pas encore de statuer sur l'atteinte de cet objectif.";
      } else {
        conclusion = "Les résultats fournissent un soutien empirique partiel pour cet objectif : certaines hypothèses associées sont soutenues par les données, d'autres ne le sont pas ou restent incertaines.";
      }

      if (coverage.status === "PARTIAL") {
        conclusion += " Cette conclusion reste partielle : certaines hypothèses reliées à cet objectif n'ont pas encore pu être évaluées avec les résultats actuellement disponibles.";
      }
    }

    return {
      objectiveId: objective.id,
      coverage,
      conclusion,
      hypothesisIds: coverage.linkedHypothesisIds,
      generatedAt: new Date().toISOString(),
    };
  });
}
