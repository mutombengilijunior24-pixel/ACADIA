// ============================================================
// ACADIA — AUDIT DE COHÉRENCE VERTICALE DE LA RÉDACTION (Mission 9, §13/§38)
//
// Vérifie que la CONCLUSION déjà écrite (voir WritingAdapters.ts)
// couvre réellement chaque objectif et chaque hypothèse du projet — le
// risque concret que ce module doit détecter est une conclusion
// rédigée avant que tous les objectifs n'aient une ObjectiveConclusion
// (Mission 7), jamais une invention de couverture. Aucune clé
// étrangère Question↔Objectif n'existe dans ResearchTypes.ts (voir
// ResearchObjective) : leur correspondance reste positionnelle/par
// comptage (mission §13), signalée en "info", jamais "blocking" sur ce
// seul critère. Purement déterministe, aucun appel OpenAI.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { WritingCoherenceReport, WritingCoherenceIssue, WritingSection } from "./WritingTypes";

export function buildWritingCoherenceReport(project: ResearchProject, sections: WritingSection[]): WritingCoherenceReport {
  const issues: WritingCoherenceIssue[] = [];

  const conclusions = project.scientificConclusions ?? [];
  const latestConclusion = conclusions[conclusions.length - 1];

  const objectivesTotal = project.objectives.length;
  const objectivesCovered = latestConclusion
    ? project.objectives.filter((o) => latestConclusion.objectiveConclusions.some((oc) => oc.objectiveId === o.id)).length
    : 0;

  const mainQuestions = project.researchQuestions.filter((q) => q.type === "main");
  const questionsTotal = mainQuestions.length || project.researchQuestions.length;
  const questionsCovered = latestConclusion?.researchQuestionConclusion ? Math.min(1, questionsTotal) : 0;

  if (project.researchQuestions.length !== project.objectives.length) {
    issues.push({
      id: "qo-count-mismatch",
      severity: "info",
      message: `${project.researchQuestions.length} question(s) de recherche pour ${project.objectives.length} objectif(s) — correspondance positionnelle non garantie (aucune relation explicite dans ce projet, à vérifier par le chercheur).`,
    });
  }

  if (!latestConclusion) {
    issues.push({ id: "no-conclusion", severity: "warning", sectionType: "CONCLUSION", message: "Aucune conclusion scientifique générée pour ce projet — la section Conclusion de la rédaction reste un espace réservé." });
  } else if (objectivesTotal > 0 && objectivesCovered < objectivesTotal) {
    issues.push({
      id: "objectives-not-covered",
      severity: "blocking",
      sectionType: "CONCLUSION",
      message: `${objectivesCovered}/${objectivesTotal} objectif(s) couvert(s) par la conclusion scientifique — ${objectivesTotal - objectivesCovered} objectif(s) sans ObjectiveConclusion associée.`,
    });
  }

  const hypothesesTotal = project.hypotheses.length;
  const hypothesesCovered = latestConclusion ? project.hypotheses.filter((h) => latestConclusion.hypothesisConclusions.some((hc) => hc.hypothesisId === h.id)).length : 0;
  if (latestConclusion && hypothesesTotal > 0 && hypothesesCovered < hypothesesTotal) {
    issues.push({
      id: "hypotheses-not-covered",
      severity: "blocking",
      sectionType: "CONCLUSION",
      message: `${hypothesesCovered}/${hypothesesTotal} hypothèse(s) couverte(s) par la conclusion scientifique — ${hypothesesTotal - hypothesesCovered} hypothèse(s) sans HypothesisConclusion associée.`,
    });
  }

  for (const section of sections) {
    const hasPlaceholder = section.blocks.some((b) => b.hasPlaceholder);
    if (hasPlaceholder) {
      issues.push({
        id: `placeholder-${section.type}`,
        severity: "info",
        sectionType: section.type,
        message: "Cette section contient encore un espace réservé (\"à compléter par le chercheur\") — matière source insuffisante au moment de la génération.",
      });
    }
    if (section.guardWarnings && section.guardWarnings.length > 0) {
      issues.push({
        id: `guard-${section.type}`,
        severity: "warning",
        sectionType: section.type,
        message: `${section.guardWarnings.length} alerte(s) du garde-fou anti-hallucination sur cette section — à vérifier avant validation.`,
      });
    }
  }

  return {
    projectId: project.id,
    generatedAt: new Date().toISOString(),
    issues,
    objectivesCovered,
    objectivesTotal,
    questionsCovered,
    questionsTotal,
  };
}
