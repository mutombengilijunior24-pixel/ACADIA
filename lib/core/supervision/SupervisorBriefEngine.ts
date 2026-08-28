// ============================================================
// ACADIA — BRIEF DIRECTEUR (P16)
//
// Assistance déterministe au directeur : réutilise
// checkResearchConsistency (P13.2) et computeResearchProgress
// (P14/P15), aucune science recalculée. Ne valide jamais le
// travail — toujours suffixé du disclaimer imposé par le sprint
// ("Analyse préparatoire ACADIA — validation du directeur requise.").
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { TheoreticalFrameworkEntry } from "@/lib/core/research/TheoreticalFrameworkTypes";
import type { InstrumentRecord } from "@/contexts/ResearchContext";
import { checkResearchConsistency } from "@/lib/core/research/ResearchConsistencyEngine";
import { computeResearchProgress } from "@/lib/core/dashboard/ResearchProgressEngine";
import type { SupervisorBrief } from "./SupervisionTypes";

export const BRIEF_DISCLAIMER = "Analyse préparatoire ACADIA — validation du directeur requise.";

export function buildSupervisorBrief(
  submissionId: string,
  project: ResearchProject,
  theoryEntries: TheoreticalFrameworkEntry[],
  instrument: InstrumentRecord | undefined
): Omit<SupervisorBrief, "id"> {
  const consistency = checkResearchConsistency(project, theoryEntries);
  const progress = computeResearchProgress(project, theoryEntries, instrument, false);

  const strengths = consistency.checks
    .filter((c) => c.severity === "pass")
    .map((c) => `${c.category} : en ordre.`);

  const inconsistencies = consistency.checks
    .filter((c) => c.severity === "warning" || c.severity === "error")
    .map((c) => c.message);

  const incompleteSections = consistency.checks
    .filter((c) => c.severity === "needs_review")
    .map((c) => c.message);

  const importantQuestions: string[] = [];
  if (!project.problem?.statement) importantQuestions.push("La problématique est-elle définitivement arrêtée ?");
  if (!theoryEntries.length) importantQuestions.push("Quel cadre théorique le chercheur compte-t-il mobiliser ?");
  if (!project.methodology?.population) importantQuestions.push("La population d'étude a-t-elle été discutée avec le chercheur ?");

  const hasError = consistency.checks.some((c) => c.severity === "error");
  const hasWarning = consistency.checks.some((c) => c.severity === "warning");
  const overallState: SupervisorBrief["overallState"] = hasError ? "bloquant" : hasWarning ? "a_verifier" : "solide";

  return {
    submissionId,
    generatedAt: new Date().toISOString(),
    generatedBy: "acadia",
    status: "generated",
    overallState,
    strengths,
    inconsistencies,
    incompleteSections,
    importantQuestions,
    progressPercent: progress.percent,
    disclaimer: BRIEF_DISCLAIMER,
  };
}
