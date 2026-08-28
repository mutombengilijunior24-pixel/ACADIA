// ============================================================
// ACADIA — PRÉPARATION À LA GÉNÉRATION DU QUESTIONNAIRE (P15)
//
// N'invente rien et ne recalcule aucune science : observe
// uniquement la présence/absence d'éléments déjà réels dans le
// projet pour décider si le bouton « Générer mon questionnaire »
// doit être activé, et pour construire le résumé affiché avant
// génération (Partie 7 du sprint P15). QuestionnaireGenerationEngine
// (protégé) n'est ni modifié ni dupliqué ici.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { TheoreticalFrameworkEntry } from "@/lib/core/research/TheoreticalFrameworkTypes";

export interface QuestionnaireReadiness {
  ready: boolean;
  missing: string[];
}

export function computeQuestionnaireGenerationReadiness(
  project: ResearchProject
): QuestionnaireReadiness {
  const missing: string[] = [];

  if (!project.problem?.statement) missing.push("Problématique");
  if (project.objectives.length === 0) missing.push("Objectifs");

  const hasPrincipalHypothesis = project.hypotheses.some(
    (h) => h.role === "general" && h.status !== "rejected"
  );
  if (!hasPrincipalHypothesis) missing.push("Hypothèse principale");

  const operationalizedVariables = project.variables.filter(
    (v) => (v.dimensions?.length ?? 0) > 0
  );
  if (operationalizedVariables.length === 0) missing.push("Variables opérationnalisées");

  const totalIndicators = project.variables.reduce(
    (sum, v) =>
      sum +
      (v.indicators?.length ?? 0) +
      (v.dimensions ?? []).reduce((s, d) => s + (d.indicators?.length ?? 0), 0),
    0
  );
  if (totalIndicators === 0) missing.push("Indicateurs");

  return { ready: missing.length === 0, missing };
}

export interface QuestionnaireGenerationSummary {
  subject: string;
  problem?: string;
  objectives: string[];
  hypotheses: string[];
  variables: string[];
  indicatorCount: number;
  population?: string;
  level?: string;
  theoryCount: number;
}

export function buildQuestionnaireGenerationSummary(
  project: ResearchProject,
  theoryEntries: TheoreticalFrameworkEntry[] = []
): QuestionnaireGenerationSummary {
  const totalIndicators = project.variables.reduce(
    (sum, v) =>
      sum +
      (v.indicators?.length ?? 0) +
      (v.dimensions ?? []).reduce((s, d) => s + (d.indicators?.length ?? 0), 0),
    0
  );

  return {
    subject: project.title,
    problem: project.problem?.statement,
    objectives: project.objectives.map((o) => o.text),
    hypotheses: project.hypotheses
      .filter((h) => h.status !== "rejected")
      .map((h) => h.statement),
    variables: project.variables.map((v) => v.name),
    indicatorCount: totalIndicators,
    population: project.methodology?.population,
    level: project.level,
    theoryCount: theoryEntries.length,
  };
}
