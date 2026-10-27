/**
 * Étapes du moteur « Économétrie et macroéconomie » : une étape n'est « faite » que confirmée ; un
 * changement en amont la signale « à revoir » sans rien effacer. Six étapes visibles.
 */
import type { StepState } from "@/lib/core/journey/steps";

export type EconStepId = "domain" | "data" | "presentation" | "research" | "framing" | "model" | "reasoning" | "report";
export type EconStageId = "domain" | "data" | "presentation" | "subject" | "reasoning" | "report";

export const ECON_STEP_LABELS: Record<EconStepId, string> = {
  domain: "Domaine et spécialité",
  data: "Mes séries",
  presentation: "Présentation des données",
  research: "Sujet de recherche",
  framing: "Cohérence de ma recherche",
  model: "Mon modèle économétrique",
  reasoning: "Le raisonnement économétrique",
  report: "Chapitre des résultats",
};

export const ECON_STAGES: Array<{ id: EconStageId; label: string; steps: EconStepId[] }> = [
  { id: "domain", label: "Mon domaine et ma spécialité", steps: ["domain"] },
  { id: "data", label: "Mes séries temporelles", steps: ["data"] },
  { id: "presentation", label: "Présentation des données", steps: ["presentation"] },
  { id: "subject", label: "Mon sujet et mon modèle", steps: ["research", "framing", "model"] },
  { id: "reasoning", label: "Le raisonnement économétrique", steps: ["reasoning"] },
  { id: "report", label: "Mon chapitre de résultats", steps: ["report"] },
];

export const ECON_STEP_ORDER: EconStepId[] = ECON_STAGES.flatMap((s) => s.steps);

const NEXT_ACTION: Record<EconStepId, string> = {
  domain: "Choisissez votre domaine et votre spécialité.",
  data: "Importez vos séries (Excel ou CSV), saisissez-les, ou partez des données fictives de démonstration ; vérifiez le rôle de chaque série, puis validez.",
  presentation: "Lisez la présentation de vos données (évolutions, statistiques, agrégats), puis confirmez-en la lecture.",
  research: "Décrivez votre sujet de recherche, puis cliquez sur « Analyser ma recherche ».",
  framing: "Vérifiez les liens entre vos questions, objectifs, hypothèses et variables, puis validez la chaîne.",
  model: "Associez à chaque hypothèse sa variable expliquée, sa variable explicative et le signe attendu, choisissez la forme du modèle, puis validez.",
  reasoning: "Lisez le raisonnement économétrique : stationnarité, estimation, tests de validation et verdict sur chaque hypothèse.",
  report: "Relisez le plan de votre chapitre, puis téléchargez le rapport Word et le classeur Excel.",
};

export type Tri = "none" | "confirmed" | "stale";

export interface EconFlags {
  domain: boolean;
  data: Tri;
  presentation: Tri;
  research: boolean;
  framing: Tri;
  model: Tri;
  reasoning: Tri;
  report: Tri;
}

export interface EconJourneyState {
  steps: Array<{ id: EconStepId; label: string; state: StepState }>;
  stages: Array<{ id: EconStageId; label: string; state: StepState; steps: EconStepId[] }>;
  current: EconStepId;
  nextAction: string;
}

export function econSteps(flags: EconFlags): EconJourneyState {
  const done = (id: EconStepId) => (id === "domain" ? flags.domain : id === "research" ? flags.research : flags[id] === "confirmed");
  const stale = (id: EconStepId) => id !== "domain" && id !== "research" && flags[id] === "stale";
  const current = ECON_STEP_ORDER.find((id) => !done(id)) ?? "report";
  const allDone = ECON_STEP_ORDER.every(done);
  const steps = ECON_STEP_ORDER.map((id) => ({ id, label: ECON_STEP_LABELS[id], state: (stale(id) ? "stale" : done(id) ? "done" : id === current ? "current" : "todo") as StepState }));
  const stateOf = (id: EconStepId) => steps.find((s) => s.id === id)!.state;
  const stages = ECON_STAGES.map((stage) => {
    const states = stage.steps.map(stateOf);
    const state: StepState = states.includes("stale") ? "stale" : states.every((s) => s === "done") ? "done" : states.includes("current") || states.some((s) => s === "done") ? "current" : "todo";
    return { id: stage.id, label: stage.label, state, steps: stage.steps };
  });
  return { current, nextAction: allDone ? NEXT_ACTION.report : stale(current) ? `${ECON_STEP_LABELS[current]} : des éléments ont changé depuis votre dernière confirmation. ${NEXT_ACTION[current]}` : NEXT_ACTION[current], steps, stages };
}
