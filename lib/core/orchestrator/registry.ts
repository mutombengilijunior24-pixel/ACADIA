/**
 * Registre des moteurs d'ACADIA et de leurs capacités RÉELLES.
 * « operational » : code existant, testé, branché sur le parcours. « planned » : capacité inscrite pour
 * conserver le contexte de recherche, sans aucune interface de calcul : ACADIA explique son absence
 * et propose les alternatives disponibles.
 */
import type { ObservationStructure, ResearchObjective, SourceType, VariableNature } from "./classification";
import type { DomainId, SpecialtyId } from "./taxonomy";

export type EngineId =
  | "research-understanding"
  | "data-preparation"
  | "descriptive-statistics"
  | "inferential-statistics"
  | "paired-tests"
  | "time-series"
  | "econometrics"
  | "financial-statements"
  | "qualitative-analysis"
  | "causal-evaluation"
  | "reconciliation";

export interface EngineEntry {
  id: EngineId;
  name: string;
  status: "operational" | "planned";
  domains: DomainId[] | "all";
  specialties: SpecialtyId[] | "all";
  sources: SourceType[] | "all";
  structures: ObservationStructure[] | "all";
  objectives: ResearchObjective[] | "all";
  /** Natures de variables nécessaires (au moins une). */
  requires: VariableNature[];
  preconditions: string[];
  functions: string[];
  limits: string[];
  /** Fichiers de tests qui valident le moteur (vides pour un moteur prévu). */
  validationTests: string[];
  /** Où le moteur intervient dans le parcours. */
  entryPoint: string | null;
}

const TABULAR: SourceType[] = ["survey", "transactional", "administrative_geographic", "other", "interviews_text", "financial_statements", "economic_time_series"];

export const ENGINES: EngineEntry[] = [
  {
    id: "research-understanding",
    name: "Compréhension de la recherche",
    status: "operational",
    domains: "all",
    specialties: "all",
    sources: "all",
    structures: "all",
    objectives: "all",
    requires: [],
    preconditions: ["Au moins le sujet de la recherche."],
    functions: ["Repérage des concepts, variables et relations supposées", "Nature de l'étude (descriptive, comparative, explicative…)", "Questions de clarification prioritaires", "Indicateurs proposés"],
    limits: ["Analyse déterministe par règles : propositions à confirmer, pas une compréhension sémantique complète."],
    validationTests: ["tests/understanding/understanding.test.ts", "tests/data/understanding.test.ts"],
    entryPoint: "Étape « Mon sujet de recherche »",
  },
  {
    id: "data-preparation",
    name: "Importation, vérification et cartographie des données",
    status: "operational",
    domains: "all",
    specialties: "all",
    sources: "all",
    structures: "all",
    objectives: "all",
    requires: [],
    preconditions: ["Un fichier CSV ou Excel."],
    functions: ["Importation CSV / Excel", "Profil et diagnostic de qualité", "Codes de non-réponse, doublons, exclusions réversibles", "Questions conditionnelles et cohérence des réponses", "Correspondance concepts ↔ questions ↔ colonnes"],
    limits: ["Les décisions de préparation restent en mémoire pendant la session."],
    validationTests: ["tests/data/csv-import.test.ts", "tests/data/xlsx-import.test.ts", "tests/data/profile.test.ts", "tests/data/flow.test.ts", "tests/journey/reliability.test.ts"],
    entryPoint: "Étapes « Mes données » et « Vérification des données »",
  },
  {
    id: "descriptive-statistics",
    name: "Statistiques descriptives",
    status: "operational",
    domains: "all",
    specialties: "all",
    sources: TABULAR,
    structures: "all",
    objectives: "all",
    requires: ["nominal", "ordinal", "quantitative_discrete", "quantitative_continuous", "geographic", "derived"],
    preconditions: ["Types de variables confirmés ou détectés avec une confiance suffisante."],
    functions: ["Effectifs et pourcentages (dénominateurs explicites)", "Moyenne, médiane, écart-type, quartiles", "Graphiques modifiables (Word, Excel)"],
    limits: ["Décrit chaque variable : ne teste aucune relation et ne modélise pas la dépendance temporelle."],
    validationTests: ["tests/data/descriptive.test.ts", "tests/data/regression.test.ts"],
    entryPoint: "Plan d'analyse : analyses descriptives",
  },
  {
    id: "inferential-statistics",
    name: "Analyse statistique inférentielle",
    status: "operational",
    domains: "all",
    specialties: "all",
    sources: ["survey", "transactional", "administrative_geographic", "other"],
    structures: ["cross_sectional", "grouped_hierarchical"],
    objectives: ["compare", "associate", "explain", "evaluate_effect", "predict"],
    requires: ["nominal", "ordinal", "quantitative_discrete", "quantitative_continuous"],
    preconditions: ["Observations indépendantes (une unité par ligne, interrogée une fois).", "Deux variables aux types confirmés.", "Effectifs suffisants (effectifs attendus, taille des groupes)."],
    functions: ["Tableau croisé et Chi² d'indépendance (Fisher exact pour un 2 × 2)", "Test t de Welch", "ANOVA à un facteur", "Corrélations de Pearson et de Spearman", "Mesures 2 × 2 (différence, risque relatif, odds ratio)"],
    limits: ["Pas de tests appariés, de régression, de séries temporelles ni de modèles multiniveaux.", "Montre des associations, jamais une causalité."],
    validationTests: ["tests/data/inferential.test.ts", "tests/journey/reliability.test.ts"],
    entryPoint: "Plan d'analyse : analyses de relation",
  },
  {
    id: "paired-tests",
    name: "Tests pour mesures appariées ou répétées",
    status: "planned",
    domains: "all",
    specialties: "all",
    sources: "all",
    structures: ["paired_repeated"],
    objectives: ["compare", "evaluate_effect"],
    requires: ["quantitative_continuous", "ordinal", "nominal"],
    preconditions: ["Mesures des mêmes unités à plusieurs moments ou dans plusieurs conditions."],
    functions: ["(prévu) t apparié, Wilcoxon, McNemar"],
    limits: ["Non implémenté."],
    validationTests: [],
    entryPoint: null,
  },
  {
    id: "time-series",
    name: "Analyse de séries temporelles",
    status: "planned",
    domains: ["economics", "management"],
    specialties: "all",
    sources: ["economic_time_series", "transactional"],
    structures: ["time_series"],
    objectives: "all",
    requires: ["date_time", "quantitative_continuous"],
    preconditions: ["Une observation par période, périodes régulières."],
    functions: ["(prévu) tendance, saisonnalité, stationnarité, autocorrélation"],
    limits: ["Non implémenté."],
    validationTests: [],
    entryPoint: null,
  },
  {
    id: "econometrics",
    name: "Économétrie (régressions, panel)",
    status: "planned",
    domains: ["economics", "management"],
    specialties: "all",
    sources: "all",
    structures: ["cross_sectional", "time_series", "panel"],
    objectives: ["explain", "predict", "evaluate_effect"],
    requires: ["quantitative_continuous"],
    preconditions: ["Modèle justifié par le cadre théorique ; hypothèses du modèle vérifiées."],
    functions: ["(prévu) régressions linéaire et logistique, modèles de panel"],
    limits: ["Non implémenté."],
    validationTests: [],
    entryPoint: null,
  },
  {
    id: "financial-statements",
    name: "Analyse des états financiers",
    status: "planned",
    domains: ["management", "economics"],
    specialties: ["finance", "entrepreneurship", "management_other", "monetary_banking"],
    sources: ["financial_statements"],
    structures: "all",
    objectives: ["describe", "diagnose", "compare", "reconcile"],
    requires: ["quantitative_continuous"],
    preconditions: ["Bilan et compte de résultat structurés par poste et par exercice."],
    functions: ["(prévu) ratios de structure, de rentabilité, de liquidité et de solvabilité ; analyse horizontale et verticale"],
    limits: ["Non implémenté."],
    validationTests: [],
    entryPoint: null,
  },
  {
    id: "qualitative-analysis",
    name: "Analyse qualitative avancée",
    status: "planned",
    domains: "all",
    specialties: "all",
    sources: ["interviews_text"],
    structures: "all",
    objectives: ["understand_qualitative", "describe"],
    requires: ["free_text"],
    preconditions: ["Transcriptions ou réponses ouvertes."],
    functions: ["(prévu) codage thématique, catégorisation, verbatims"],
    limits: ["Non implémenté."],
    validationTests: [],
    entryPoint: null,
  },
  {
    id: "causal-evaluation",
    name: "Évaluation d'impact (causale)",
    status: "planned",
    domains: "all",
    specialties: "all",
    sources: "all",
    structures: "all",
    objectives: ["evaluate_effect"],
    requires: [],
    preconditions: ["Dispositif d'évaluation : groupe de comparaison, mesures avant/après, expérimentation ou quasi-expérimentation."],
    functions: ["(prévu) différences de différences, appariement"],
    limits: ["Non implémenté."],
    validationTests: [],
    entryPoint: null,
  },
  {
    id: "reconciliation",
    name: "Rapprochement comptable ou financier",
    status: "planned",
    domains: ["management", "economics"],
    specialties: ["finance", "management_other"],
    sources: ["financial_statements", "transactional"],
    structures: "all",
    objectives: ["reconcile"],
    requires: ["quantitative_continuous"],
    preconditions: ["Deux sources de montants à rapprocher."],
    functions: ["(prévu) rapprochement et justification des écarts"],
    limits: ["Non implémenté."],
    validationTests: [],
    entryPoint: null,
  },
];

export const engineOf = (id: EngineId) => ENGINES.find((e) => e.id === id)!;
export const operationalEngines = () => ENGINES.filter((e) => e.status === "operational");
