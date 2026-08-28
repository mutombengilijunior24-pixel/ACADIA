// ============================================================
// ACADIA — COMPARAISON DE VERSIONS (P16)
//
// Diff déterministe entre deux snapshots de soumission. N'affirme
// jamais qu'une correction est résolue avec certitude : le terme
// "potentiellement" est utilisé chaque fois que la conclusion
// dérive d'une simple corrélation de section, jamais d'une preuve
// (Partie 13 du sprint). Une correction sur une section qu'ACADIA
// ne sait pas diffé (ex. "Discussion", "Conclusion") reste
// TOUJOURS "non résolue" — jamais une fausse déduction.
// ============================================================

import type { Submission, RevisionComparison, RevisionChangeItem, Correction } from "./SupervisionTypes";

function textDiff(previous: string[], current: string[]): { added: string[]; removed: string[] } {
  const prevSet = new Set(previous.map((t) => t.trim().toLowerCase()));
  const currSet = new Set(current.map((t) => t.trim().toLowerCase()));
  return {
    added: current.filter((t) => !prevSet.has(t.trim().toLowerCase())),
    removed: previous.filter((t) => !currSet.has(t.trim().toLowerCase())),
  };
}

function normalize(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, ""); // retire les accents pour une comparaison robuste
}

export interface RevisionDiffResult {
  comparison: RevisionComparison;
  /** Clés normalisées des sections réellement modifiées — usage interne (croisement des corrections). */
  touchedSectionKeys: string[];
}

export function compareSubmissions(previous: Submission, current: Submission): RevisionDiffResult {
  const added: RevisionChangeItem[] = [];
  const removed: RevisionChangeItem[] = [];
  const modified: RevisionChangeItem[] = [];
  const unchanged: RevisionChangeItem[] = [];
  const touchedSections = new Set<string>();

  const prevProject = previous.snapshot.project;
  const currProject = current.snapshot.project;

  // Problématique
  if ((prevProject.problem?.statement ?? "") !== (currProject.problem?.statement ?? "")) {
    modified.push({ label: "Problématique modifiée" });
    touchedSections.add("problematique");
  } else if (currProject.problem?.statement) {
    unchanged.push({ label: "Problématique inchangée" });
  }

  // Objectifs
  const objDiff = textDiff(
    (prevProject.objectives ?? []).map((o) => o.text),
    (currProject.objectives ?? []).map((o) => o.text)
  );
  if (objDiff.added.length) {
    added.push({ label: `${objDiff.added.length} objectif(s) ajouté(s)`, detail: objDiff.added.join(" · ") });
    touchedSections.add("objectifs");
  }
  if (objDiff.removed.length) {
    removed.push({ label: `${objDiff.removed.length} objectif(s) retiré(s)`, detail: objDiff.removed.join(" · ") });
    touchedSections.add("objectifs");
  }

  // Hypothèses
  const hypDiff = textDiff(
    (prevProject.hypotheses ?? []).map((h) => h.statement),
    (currProject.hypotheses ?? []).map((h) => h.statement)
  );
  if (hypDiff.added.length) {
    added.push({ label: `${hypDiff.added.length} hypothèse(s) ajoutée(s)`, detail: hypDiff.added.join(" · ") });
    touchedSections.add("hypotheses");
  }
  if (hypDiff.removed.length) {
    removed.push({ label: `${hypDiff.removed.length} hypothèse(s) retirée(s)`, detail: hypDiff.removed.join(" · ") });
    touchedSections.add("hypotheses");
  }
  if (!hypDiff.added.length && !hypDiff.removed.length && (currProject.hypotheses ?? []).length > 0) {
    unchanged.push({ label: "Hypothèses inchangées" });
  }

  // Variables (dimensions/indicateurs)
  const prevVariables = prevProject.variables ?? [];
  const currVariables = currProject.variables ?? [];
  for (const currVar of currVariables) {
    const prevVar = prevVariables.find((v) => v.id === currVar.id || v.name === currVar.name);
    if (!prevVar) {
      added.push({ label: `Variable « ${currVar.name} » ajoutée` });
      touchedSections.add("variables");
      continue;
    }
    const prevDim = prevVar.dimensions?.length ?? 0;
    const currDim = currVar.dimensions?.length ?? 0;
    const prevInd =
      (prevVar.indicators?.length ?? 0) + (prevVar.dimensions ?? []).reduce((s, d) => s + (d.indicators?.length ?? 0), 0);
    const currInd =
      (currVar.indicators?.length ?? 0) + (currVar.dimensions ?? []).reduce((s, d) => s + (d.indicators?.length ?? 0), 0);
    if (prevDim !== currDim || prevInd !== currInd) {
      modified.push({
        label: `Variable « ${currVar.name} » modifiée`,
        detail: `${currDim - prevDim >= 0 ? "+" : ""}${currDim - prevDim} dimension(s), ${currInd - prevInd >= 0 ? "+" : ""}${currInd - prevInd} indicateur(s)`,
      });
      touchedSections.add("variables");
      touchedSections.add("indicateurs");
    }
  }
  for (const prevVar of prevVariables) {
    const stillExists = currVariables.some((v) => v.id === prevVar.id || v.name === prevVar.name);
    if (!stillExists) {
      removed.push({ label: `Variable « ${prevVar.name} » retirée` });
      touchedSections.add("variables");
    }
  }

  // Méthodologie
  const prevMethodology = prevProject.methodology;
  const currMethodology = currProject.methodology;
  const methodologyFieldsChanged =
    (prevMethodology?.population ?? "") !== (currMethodology?.population ?? "") ||
    (prevMethodology?.samplingMethod ?? "") !== (currMethodology?.samplingMethod ?? "") ||
    (prevMethodology?.sampleSize ?? null) !== (currMethodology?.sampleSize ?? null) ||
    (prevMethodology?.analysisUnit ?? "") !== (currMethodology?.analysisUnit ?? "") ||
    JSON.stringify(prevMethodology?.techniques ?? []) !== JSON.stringify(currMethodology?.techniques ?? []);
  if (methodologyFieldsChanged) {
    modified.push({ label: "Méthodologie modifiée" });
    touchedSections.add("methodologie");
  } else if (currMethodology?.status) {
    unchanged.push({ label: "Méthodologie inchangée" });
  }

  // Questionnaire
  const prevQuestionCount =
    previous.snapshot.instrument?.questionnaire?.sections.reduce((s, sec) => s + sec.questions.length, 0) ?? 0;
  const currQuestionCount =
    current.snapshot.instrument?.questionnaire?.sections.reduce((s, sec) => s + sec.questions.length, 0) ?? 0;
  if (prevQuestionCount !== currQuestionCount) {
    const diff = currQuestionCount - prevQuestionCount;
    modified.push({
      label: `Questionnaire modifié : ${diff > 0 ? `${diff} question(s) ajoutée(s)` : `${-diff} question(s) retirée(s)`}`,
    });
    touchedSections.add("questionnaire");
  } else if (currQuestionCount > 0) {
    unchanged.push({ label: "Questionnaire inchangé" });
  }

  // Cadre théorique
  const prevTheoryCount = previous.snapshot.theoreticalFramework?.length ?? 0;
  const currTheoryCount = current.snapshot.theoreticalFramework?.length ?? 0;
  if (prevTheoryCount !== currTheoryCount) {
    modified.push({ label: "Cadre théorique modifié", detail: `${currTheoryCount} entrée(s) contre ${prevTheoryCount} précédemment` });
    touchedSections.add("litterature");
    touchedSections.add("theorique");
  }

  const comparison: RevisionComparison = {
    fromSubmissionId: previous.id,
    toSubmissionId: current.id,
    added,
    removed,
    modified,
    unchanged,
    potentiallyResolved: [],
    unresolved: [],
  };

  return { comparison, touchedSectionKeys: [...touchedSections] };
}

/**
 * Croise les corrections ouvertes de la version précédente avec les
 * clés de section réellement modifiées — jamais une affirmation de
 * résolution, uniquement "potentiellement résolu" si la section
 * concernée a changé, sinon explicitement "non résolu" si rien n'a
 * bougé sur cette section (y compris quand ACADIA ne sait pas
 * encore diffé cette section, ex. "Discussion").
 */
export function applyCorrectionsToComparison(
  comparison: RevisionComparison,
  openCorrections: Correction[],
  touchedSectionKeys: string[]
): RevisionComparison {
  const touched = new Set(touchedSectionKeys);

  const potentiallyResolved: RevisionChangeItem[] = [];
  const unresolved: RevisionChangeItem[] = [];

  for (const correction of openCorrections) {
    const key = normalize(correction.section);
    const sectionTouched = [...touched].some((k) => key.includes(k) || k.includes(key));
    if (sectionTouched) {
      potentiallyResolved.push({
        label: `Correction demandée précédemment sur « ${correction.section} » : potentiellement traitée`,
        detail: correction.description,
      });
    } else {
      unresolved.push({
        label: `Correction demandée précédemment sur « ${correction.section} » : toujours ouverte`,
        detail: correction.description,
      });
    }
  }

  return { ...comparison, potentiallyResolved, unresolved };
}
