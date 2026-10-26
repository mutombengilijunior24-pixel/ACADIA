/**
 * Étapes du moteur « Gestion financière » : même logique que le parcours général (une étape n'est
 * « faite » que confirmée ; un changement en amont la signale « à revoir » sans rien effacer),
 * regroupées en six étapes visibles.
 */
import type { StepState } from "@/lib/core/journey/steps";

export type FinanceStepId = "domain" | "source" | "review" | "diagnosis" | "research" | "framing" | "indicators" | "criteria" | "reasoning" | "report";
export type FinanceStageId = "domain" | "statements" | "diagnosis" | "subject" | "reasoning" | "report";

export const FINANCE_STEP_LABELS: Record<FinanceStepId, string> = {
  domain: "Domaine et spécialité",
  source: "Source des états",
  review: "Vérification des chiffres",
  diagnosis: "L'état de l'entreprise",
  research: "Sujet de recherche",
  framing: "Cohérence de ma recherche",
  indicators: "Indicateurs à analyser",
  criteria: "Critères de vérification",
  reasoning: "Raisonnement d'ACADIA",
  report: "Chapitre des résultats",
};

export const FINANCE_STAGES: Array<{ id: FinanceStageId; label: string; steps: FinanceStepId[] }> = [
  { id: "domain", label: "Mon domaine et ma spécialité", steps: ["domain"] },
  { id: "statements", label: "Mes états financiers", steps: ["source", "review"] },
  { id: "diagnosis", label: "L'état de l'entreprise", steps: ["diagnosis"] },
  { id: "subject", label: "Mon sujet de recherche", steps: ["research", "framing", "indicators"] },
  { id: "reasoning", label: "Le raisonnement d'ACADIA", steps: ["criteria", "reasoning"] },
  { id: "report", label: "Mon chapitre de résultats", steps: ["report"] },
];

export const FINANCE_STEP_ORDER: FinanceStepId[] = FINANCE_STAGES.flatMap((s) => s.steps);

export const financeStageOf = (step: FinanceStepId) => FINANCE_STAGES.find((s) => s.steps.includes(step))!;

const NEXT_ACTION: Record<FinanceStepId, string> = {
  domain: "Choisissez votre domaine et votre spécialité.",
  source: "Choisissez comment fournir vos états financiers : saisie, fichier, ou entreprise fictive de démonstration.",
  review: "Vérifiez chaque chiffre avec le document d'origine, corrigez les écarts signalés, puis validez vos états.",
  diagnosis: "Lisez l'état de l'entreprise établi par ACADIA, puis confirmez-en la lecture.",
  research: "Décrivez votre sujet de recherche, puis cliquez sur « Analyser ma recherche ».",
  framing: "Vérifiez les liens entre vos questions, objectifs, hypothèses et variables, puis validez la chaîne.",
  indicators: "Choisissez les indicateurs qui mesurent chacune de vos variables.",
  criteria: "Vérifiez les critères qui permettront de juger chaque hypothèse, puis validez-les.",
  reasoning: "Lisez le raisonnement d'ACADIA hypothèse par hypothèse.",
  report: "Retenez le plan de votre chapitre de résultats, puis téléchargez le rapport.",
};

type Tri = "none" | "confirmed" | "stale";

export interface FinanceFlags {
  domain: boolean;
  source: boolean;
  review: "none" | "validated" | "stale";
  diagnosis: "none" | "seen" | "stale";
  research: boolean;
  framing: Tri;
  indicators: Tri;
  criteria: Tri;
  reasoning: "none" | "seen" | "stale";
  report: "none" | "done" | "stale";
}

export interface FinanceJourneyState {
  steps: Array<{ id: FinanceStepId; label: string; state: StepState }>;
  stages: Array<{ id: FinanceStageId; label: string; state: StepState; steps: FinanceStepId[] }>;
  current: FinanceStepId;
  nextAction: string;
}

export function financeSteps(flags: FinanceFlags): FinanceJourneyState {
  const done: Record<FinanceStepId, boolean> = {
    domain: flags.domain,
    source: flags.source,
    review: flags.review === "validated",
    diagnosis: flags.diagnosis === "seen",
    research: flags.research,
    framing: flags.framing === "confirmed",
    indicators: flags.indicators === "confirmed",
    criteria: flags.criteria === "confirmed",
    reasoning: flags.reasoning === "seen",
    report: flags.report === "done",
  };
  const stale: Record<FinanceStepId, boolean> = {
    domain: false,
    source: false,
    review: flags.review === "stale",
    diagnosis: flags.diagnosis === "stale",
    research: false,
    framing: flags.framing === "stale",
    indicators: flags.indicators === "stale",
    criteria: flags.criteria === "stale",
    reasoning: flags.reasoning === "stale",
    report: flags.report === "stale",
  };
  const current = FINANCE_STEP_ORDER.find((id) => !done[id]) ?? "report";
  const allDone = FINANCE_STEP_ORDER.every((id) => done[id]);
  const steps = FINANCE_STEP_ORDER.map((id) => ({ id, label: FINANCE_STEP_LABELS[id], state: (stale[id] ? "stale" : done[id] ? "done" : id === current ? "current" : "todo") as StepState }));
  const stateOf = (id: FinanceStepId) => steps.find((s) => s.id === id)!.state;
  const stages = FINANCE_STAGES.map((stage) => {
    const states = stage.steps.map(stateOf);
    const state: StepState = states.includes("stale") ? "stale" : states.every((s) => s === "done") ? "done" : states.includes("current") ? "current" : states.some((s) => s === "done") ? "current" : "todo";
    return { id: stage.id, label: stage.label, state, steps: stage.steps };
  });
  return {
    current,
    nextAction: allDone ? NEXT_ACTION.report : stale[current] ? `${FINANCE_STEP_LABELS[current]} : des éléments ont changé depuis votre dernière confirmation. ${NEXT_ACTION[current]}` : NEXT_ACTION[current],
    steps,
    stages,
  };
}
