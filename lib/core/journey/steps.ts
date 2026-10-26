/**
 * Logique du parcours : état de chaque étape, étape courante et prochaine action attendue.
 * Une étape n'est « faite » que si ses décisions sont confirmées ; un changement en amont la
 * signale « à revoir » sans effacer les décisions déjà prises.
 * Les étapes internes sont regroupées en six étapes visibles pour le chercheur.
 */
export type StepId = "domain" | "research" | "framing" | "instrument" | "data" | "quality" | "variables" | "plan" | "results";
export type StageId = "domain" | "research" | "data" | "verification" | "plan" | "results";

export const STEP_LABELS: Record<StepId, string> = {
  domain: "Domaine et spécialité",
  research: "Sujet de recherche",
  framing: "Cohérence de ma recherche",
  instrument: "Mode de collecte",
  data: "Fichier",
  quality: "Qualité des données",
  variables: "Variables",
  plan: "Plan d'analyse",
  results: "Résultats",
};

export const STAGES: Array<{ id: StageId; label: string; steps: StepId[]; purpose: string }> = [
  { id: "domain", label: "Mon domaine et ma spécialité", steps: ["domain"], purpose: "La perspective scientifique de votre étude." },
  { id: "research", label: "Mon sujet de recherche", steps: ["research", "framing"], purpose: "Votre question, vos objectifs, vos hypothèses et leur cohérence." },
  { id: "data", label: "Mes données", steps: ["instrument", "data"], purpose: "Comment les données ont été collectées, puis votre fichier." },
  { id: "verification", label: "Vérification des données", steps: ["quality", "variables"], purpose: "Qualité des données, type de données reconnu et correspondance des variables." },
  { id: "plan", label: "Plan d'analyse proposé", steps: ["plan"], purpose: "Les moteurs et analyses proposés, à valider avant tout calcul." },
  { id: "results", label: "Résultats et interprétation", steps: ["results"], purpose: "Les résultats, leur interprétation et le rapport." },
];

export const stageOf = (step: StepId) => STAGES.find((s) => s.steps.includes(step))!;

/** Ce que l'étape permet d'obtenir (lecteurs d'écran). */
export const STEP_PURPOSE: Record<StepId, string> = {
  domain: "La perspective scientifique de votre étude.",
  research: "Votre question, vos objectifs et vos hypothèses.",
  framing: "Chaque question reliée à son objectif, son hypothèse et ses variables.",
  instrument: "Comment les données ont été collectées.",
  data: "Votre fichier de données.",
  quality: "Un état des données vérifié.",
  variables: "Chaque concept relié à la bonne question.",
  plan: "Les analyses à réaliser, validées par vous.",
  results: "Les résultats, leur interprétation et le rapport.",
};

export type StepState = "done" | "current" | "todo" | "stale";

export const STEP_STATE_LABELS: Record<StepState, string> = { done: "Confirmée", current: "En cours", todo: "À venir", stale: "À revoir" };

export interface JourneyFlags {
  domain: boolean;
  research: boolean;
  /** Chaîne question → objectif → hypothèse → variables validée (ou à revoir après modification). */
  framing: "none" | "confirmed" | "stale";
  instrument: boolean;
  data: boolean;
  quality: boolean;
  mapping: "none" | "confirmed" | "stale";
  plan: "none" | "validated" | "stale";
  results: "none" | "fresh" | "stale";
}

const NEXT_ACTION: Record<StepId, string> = {
  domain: "Choisissez votre domaine et votre spécialité.",
  research: "Décrivez votre recherche (au minimum le sujet) puis cliquez sur « Analyser ma recherche ».",
  framing: "Vérifiez les liens proposés entre vos questions, objectifs, hypothèses et variables, puis validez la chaîne.",
  instrument: "Indiquez comment vos données ont été collectées (questionnaire, entretiens, documents…).",
  data: "Importez votre fichier de données (CSV ou Excel).",
  quality: "Indiquez la provenance des données, vérifiez le type de données reconnu et les décisions demandées, puis confirmez.",
  variables: "Vérifiez quelle question mesure chaque concept, puis confirmez.",
  plan: "Examinez le plan proposé (moteurs et analyses), puis validez-le pour lancer les calculs.",
  results: "Lisez la synthèse, puis téléchargez le rapport.",
};

export const STEP_ORDER: StepId[] = ["domain", "research", "framing", "instrument", "data", "quality", "variables", "plan", "results"];

export interface JourneyState {
  steps: Array<{ id: StepId; label: string; state: StepState }>;
  stages: Array<{ id: StageId; label: string; state: StepState; steps: StepId[] }>;
  current: StepId;
  nextAction: string;
}

export function journeySteps(flags: JourneyFlags): JourneyState {
  const done: Record<StepId, boolean> = {
    domain: flags.domain,
    research: flags.research,
    framing: flags.framing === "confirmed",
    instrument: flags.instrument,
    data: flags.data,
    quality: flags.quality,
    variables: flags.mapping === "confirmed",
    plan: flags.plan === "validated",
    results: flags.results === "fresh",
  };
  const stale: Record<StepId, boolean> = {
    domain: false,
    research: false,
    framing: flags.framing === "stale",
    instrument: false,
    data: false,
    quality: false,
    variables: flags.mapping === "stale",
    plan: flags.plan === "stale",
    results: flags.results === "stale",
  };
  const current = STEP_ORDER.find((id) => !done[id]) ?? "results";
  const allDone = STEP_ORDER.every((id) => done[id]);
  const steps = STEP_ORDER.map((id) => ({ id, label: STEP_LABELS[id], state: (stale[id] ? "stale" : done[id] ? "done" : id === current ? "current" : "todo") as StepState }));
  const stateOf = (id: StepId) => steps.find((s) => s.id === id)!.state;
  const stages = STAGES.map((stage) => {
    const states = stage.steps.map(stateOf);
    const state: StepState = states.includes("stale") ? "stale" : states.every((s) => s === "done") ? "done" : states.includes("current") ? "current" : states.some((s) => s === "done") ? "current" : "todo";
    return { id: stage.id, label: stage.label, state, steps: stage.steps };
  });
  return {
    current,
    nextAction: allDone
      ? NEXT_ACTION.results
      : stale[current]
        ? `${STEP_LABELS[current]} : des éléments ont changé depuis votre dernière confirmation. ${NEXT_ACTION[current]}`
        : current === "results"
          ? "Les calculs n'ont pas encore été lancés : validez le plan d'analyse."
          : NEXT_ACTION[current],
    steps,
    stages,
  };
}
