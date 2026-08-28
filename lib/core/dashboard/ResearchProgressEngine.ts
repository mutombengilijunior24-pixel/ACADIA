// ============================================================
// ACADIA — MOTEUR DE PROGRESSION RÉELLE (P14)
//
// Remplace les pourcentages/étapes fabriqués du dashboard
// (`ProgressChart`, `ProgressGoals` — voir ACADIA_P14_AUDIT.md §2)
// par une dérivation réelle, calculée uniquement à partir de
// données déjà présentes dans le projet. Ne recalcule jamais de
// science : réutilise les moteurs existants (cohérence de
// recherche, méthodologie) et se contente d'observer la
// présence/absence de contenu réel pour le reste.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { InstrumentRecord } from "@/contexts/ResearchContext";
import type { TheoreticalFrameworkEntry } from "@/lib/core/research/TheoreticalFrameworkTypes";

export interface ResearchProgressStep {
  id: string;
  label: string;
  done: boolean;
  href: string;
}

export interface ResearchProgressResult {
  percent: number;
  steps: ResearchProgressStep[];
  nextStep: ResearchProgressStep | null;
}

export function computeResearchProgress(
  project: ResearchProject,
  theoryEntries: TheoreticalFrameworkEntry[],
  instrument: InstrumentRecord | undefined,
  hasExport: boolean
): ResearchProgressResult {
  const href = `/dashboard/research/${project.id}`;

  const principalHypothesis = project.hypotheses.some(
    (h) => h.role === "general" && h.status !== "rejected"
  );

  const steps: ResearchProgressStep[] = [
    {
      id: "problem",
      label: "Problématique formulée",
      done: Boolean(project.problem?.statement),
      href,
    },
    {
      id: "objectives",
      label: "Objectifs définis",
      done: project.objectives.length > 0,
      href,
    },
    {
      id: "variables",
      label: "Variables opérationnalisées",
      done: project.variables.some((v) => (v.dimensions?.length ?? 0) > 0),
      href,
    },
    {
      id: "theory",
      label: "Cadre théorique renseigné",
      done: theoryEntries.length > 0,
      href,
    },
    {
      id: "hypothesis",
      label: "Hypothèse principale identifiée",
      done: principalHypothesis,
      href,
    },
    {
      id: "methodology",
      label: "Méthodologie validée",
      done: project.methodology.status === "accepted",
      href,
    },
    {
      id: "instrument",
      label: "Instrument de collecte généré",
      done: Boolean(instrument?.questionnaire || instrument?.interviewGuide),
      href,
    },
    {
      id: "export",
      label: "Document exporté",
      done: hasExport,
      href,
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const percent = Math.round((doneCount / steps.length) * 100);
  const nextStep = steps.find((s) => !s.done) ?? null;

  return { percent, steps, nextStep };
}
