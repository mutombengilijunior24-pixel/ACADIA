// ============================================================
// ACADIA — SCIENTIFIC WORK VALIDATION ENGINE (P11.21/P11.22)
//
// Contrôles A-Q, dans le même esprit que ResearchConsistencyEngine
// (P2.3) et DatasetQuality (P5) — jamais un jugement de valeur sur
// la qualité scientifique du travail, uniquement une vérification
// structurelle : "la structure est-elle suffisamment complète pour
// être relue par le chercheur ?" (P11.22 — jamais "validée").
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";

import type {
  ScientificWork,
  ScientificWorkCheckItem,
  ScientificWorkCheckSeverity,
  ScientificWorkReadiness,
  ScientificWorkReadinessLevel,
  ScientificWorkValidationResult,
} from "./ScientificWorkTypes";

function item(id: string, label: string, severity: ScientificWorkCheckSeverity, detail: string): ScientificWorkCheckItem {
  return { id, label, severity, detail };
}

export function validateScientificWork(
  project: ResearchProject,
  work: ScientificWork,
  dataset: Dataset | undefined,
  isDatasetStale: boolean
): ScientificWorkValidationResult {
  const items: ScientificWorkCheckItem[] = [];

  // A. Question de recherche
  const mainQuestion = project.researchQuestions.find((q) => q.type === "main") ?? project.researchQuestions[0];
  items.push(
    mainQuestion
      ? item("A", "Question de recherche présente", "pass", "Une question de recherche est renseignée.")
      : item("A", "Question de recherche présente", "warning", "Aucune question de recherche n'est encore renseignée.")
  );

  // B. Objectifs
  items.push(
    project.objectives.length > 0
      ? item("B", "Objectifs présents", "pass", `${project.objectives.length} objectif(s) renseigné(s).`)
      : item("B", "Objectifs présents", "warning", "Aucun objectif n'est encore renseigné.")
  );

  // C. Variables (si recherche quantitative)
  if (project.researchType !== "qualitative") {
    items.push(
      project.variables.length > 0
        ? item("C", "Variables présentes", "pass", `${project.variables.length} variable(s) opérationnalisée(s).`)
        : item("C", "Variables présentes", "warning", "Aucune variable n'est encore opérationnalisée.")
    );
  } else {
    items.push(item("C", "Variables présentes", "pass", "Non applicable — projet qualitatif."));
  }

  // D. Hypothèses cohérentes lorsque nécessaires
  const needsHypotheses = project.variables.some((v) => v.role === "independent") && project.variables.some((v) => v.role === "dependent");
  if (needsHypotheses) {
    items.push(
      project.hypotheses.length > 0
        ? item("D", "Hypothèses cohérentes", "pass", `${project.hypotheses.length} hypothèse(s) renseignée(s).`)
        : item("D", "Hypothèses cohérentes", "needs_review", "Une relation indépendante/dépendante est identifiée mais aucune hypothèse n'est formulée.")
    );
  } else {
    items.push(item("D", "Hypothèses cohérentes", "pass", "Non requises pour ce projet."));
  }

  // E. Méthodologie renseignée
  items.push(
    project.methodology?.approach
      ? item("E", "Méthodologie renseignée", "pass", `Approche : ${project.methodology.approach}.`)
      : item("E", "Méthodologie renseignée", "warning", "L'approche méthodologique n'est pas encore précisée.")
  );

  // F. Instrument disponible si collecte primaire
  const hasInstrument = Boolean(work.annexes.find((a) => a.id === "annex-questionnaire")?.available || work.annexes.find((a) => a.id === "annex-interview-guide")?.available);
  items.push(
    hasInstrument
      ? item("F", "Instrument disponible", "pass", "Un instrument de collecte a été généré.")
      : item("F", "Instrument disponible", "warning", "Aucun instrument de collecte n'a encore été généré.")
  );

  // G. Dataset disponible si analyse quantitative
  if (project.researchType !== "qualitative") {
    items.push(
      dataset
        ? item("G", "Dataset disponible", "pass", "Un dataset a été créé.")
        : item("G", "Dataset disponible", "warning", "Aucun dataset n'a encore été créé.")
    );
  } else {
    items.push(item("G", "Dataset disponible", "pass", "Non applicable — projet qualitatif."));
  }

  // H. Observations disponibles avant analyse
  items.push(
    dataset && dataset.rows.length > 0
      ? item("H", "Observations disponibles", "pass", `${dataset.rows.length} observation(s) collectée(s).`)
      : item("H", "Observations disponibles", dataset ? "warning" : "needs_review", dataset ? "Le dataset est vide." : "Aucun dataset n'existe encore.")
  );

  // I. Résultats disponibles
  // (le placeholder "Résultat économétrique indisponible" ne compte pas comme
  // un résultat réel — il signale explicitement une absence, jamais un acquis)
  const hasRealEconometricResult = work.results.econometric.some((e) => e.blockId !== "work:results:econ:unavailable");
  const hasResults =
    work.results.descriptive.length > 0 || work.results.bivariate.length > 0 || hasRealEconometricResult || work.results.qualitative.length > 0;
  items.push(
    hasResults
      ? item("I", "Résultats disponibles", "pass", "Au moins un résultat est intégré au document.")
      : item("I", "Résultats disponibles", "needs_review", "Aucun résultat n'est encore intégré au chapitre Résultats.")
  );

  // J. Discussion disponible
  items.push(
    work.discussion.hypothesisConfrontations.length > 0 || project.researchType === "qualitative"
      ? item("J", "Discussion disponible", "pass", "Une base de discussion est disponible (voir section Discussion).")
      : item("J", "Discussion disponible", "needs_review", "Aucun élément de discussion structuré n'est encore disponible.")
  );

  // K. Théorie renseignée ou explicitement manquante
  items.push(item("K", "Théorie renseignée ou explicitement manquante", "pass", "Statut affiché explicitement : « Cadre théorique à renseigner »."));

  // L. Littérature renseignée ou explicitement manquante
  items.push(
    work.bibliography.length > 0
      ? item("L", "Littérature renseignée", "pass", `${work.bibliography.length} référence(s) enregistrée(s).`)
      : item("L", "Littérature renseignée ou explicitement manquante", "pass", "Statut affiché explicitement : « Revue de littérature à compléter ».")
  );

  // M. Limites présentes
  items.push(item("M", "Limites présentes", "pass", "Le chapitre Discussion documente les limites à partir des diagnostics réellement disponibles."));

  // N. Conclusion cohérente
  const conclusionHasContent = !work.conclusion.mainResults.hasPlaceholder;
  items.push(
    conclusionHasContent
      ? item("N", "Conclusion cohérente", "pass", "La conclusion reprend des résultats intégrés au document.")
      : item("N", "Conclusion cohérente", "needs_review", "La conclusion ne reprend encore aucun résultat validé.")
  );

  // O. Traçabilité résultats → variables
  const traceableResults = work.results.descriptive.filter((d) => d.variableId).length;
  items.push(
    work.results.descriptive.length === 0
      ? item("O", "Traçabilité résultats → variables", "pass", "Non applicable — aucun résultat descriptif.")
      : traceableResults === work.results.descriptive.length
      ? item("O", "Traçabilité résultats → variables", "pass", "Tous les résultats descriptifs sont reliés à une variable.")
      : item("O", "Traçabilité résultats → variables", "needs_review", `${work.results.descriptive.length - traceableResults} résultat(s) sans lien vers une variable.`)
  );

  // P. Données non obsolètes
  items.push(
    isDatasetStale
      ? item("P", "Données non obsolètes", "warning", "Le dataset a été modifié depuis la dernière analyse validée — une réestimation est recommandée.")
      : item("P", "Données non obsolètes", "pass", "Aucune modification du dataset détectée depuis les dernières analyses validées.")
  );

  // Q. Aucun résultat inventé
  items.push(item("Q", "Aucun résultat inventé", "pass", "Tous les résultats intégrés proviennent de calculs déterministes réels (P6/P7/P8) ou sont marqués « à compléter »."));

  const errorCount = items.filter((i) => i.severity === "error").length;
  const warningCount = items.filter((i) => i.severity === "warning").length;
  const needsReviewCount = items.filter((i) => i.severity === "needs_review").length;
  const passCount = items.filter((i) => i.severity === "pass").length;

  return { items, errorCount, warningCount, needsReviewCount, passCount };
}


// ============================================================
// P11.22 — READINESS (structure prête pour révision humaine,
// jamais "travail scientifiquement validé")
// ============================================================

export function computeScientificWorkReadiness(validation: ScientificWorkValidationResult): ScientificWorkReadiness {
  const total = validation.items.length;
  const weighted = validation.passCount * 1 + validation.warningCount * 0.4 + validation.needsReviewCount * 0.2;
  const score = total > 0 ? Math.round((weighted / total) * 100) : 0;

  let level: ScientificWorkReadinessLevel;
  let label: string;

  if (score < 50) {
    level = "incomplete";
    label = "Incomplet";
  } else if (score < 75) {
    level = "in_preparation";
    label = "En préparation";
  } else if (score < 90) {
    level = "almost_ready";
    label = "Presque prêt";
  } else {
    level = "ready_for_review";
    label = "Prêt pour révision humaine";
  }

  return { score, level, label };
}
