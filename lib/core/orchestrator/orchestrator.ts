/**
 * Orchestrateur : à partir de la fiche de classification, choisit les moteurs à mobiliser, vérifie
 * leurs préconditions et produit un routage justifié. La spécialité oriente la lecture ; l'objectif
 * et les propriétés des données déterminent les méthodes admissibles. Aucun test n'est déclenché
 * parce qu'il est techniquement possible, ni une causalité déduite du mot « impact ».
 */
import type { AnalysisPlan } from "@/lib/core/journey/plan";

import { STRUCTURE_LABELS, type ClassificationSheet, type ResearchObjective, type Uncertainty } from "./classification";
import { engineOf, type EngineId } from "./registry";
import { specialtyOf } from "./taxonomy";

export type RouteStatus = "ready" | "to_confirm" | "unavailable" | "not_needed" | "excluded";

export const ROUTE_STATUS_LABELS: Record<RouteStatus, string> = {
  ready: "Disponible",
  to_confirm: "À confirmer",
  unavailable: "Non disponible (prévu)",
  not_needed: "Non nécessaire",
  excluded: "Inadapté à ces données",
};

export interface RoutedStep {
  engineId: EngineId;
  engine: string;
  status: RouteStatus;
  /** Ce que le moteur fera (ou pourquoi il n'interviendra pas). */
  reason: string;
  conditions: string[];
  /** Capacités réellement disponibles à la place (moteur absent ou inadapté). */
  alternatives: string[];
  requested?: boolean;
}

export interface Routing {
  needs: string[];
  steps: RoutedStep[];
  perspective: string | null;
  /** Les tests de relation du plan sont-ils admissibles pour ces données ? */
  inferentialAllowed: boolean;
  inferentialReason: string | null;
  questions: Uncertainty[];
  summary: string;
}

const RELATIONAL: ResearchObjective[] = ["compare", "associate", "explain", "evaluate_effect", "predict"];

export function orchestrate(sheet: ClassificationSheet, options: { requested?: EngineId[] } = {}): Routing {
  const steps: RoutedStep[] = [];
  const needs: string[] = [];
  const objectives = new Set(sheet.objectives.map((o) => o.value));
  const hasData = !!sheet.datasetId;
  const source = sheet.source.value;
  const structure = sheet.structure.value;
  const relational = [...objectives].some((o) => RELATIONAL.includes(o));
  const add = (engineId: EngineId, status: RouteStatus, reason: string, conditions: string[] = [], alternatives: string[] = []) => {
    if (steps.some((s) => s.engineId === engineId)) return;
    steps.push({ engineId, engine: engineOf(engineId).name, status, reason, conditions, alternatives });
  };

  // Besoins de l'étude.
  if (objectives.has("describe") || !relational) needs.push("Décrire les variables étudiées");
  if (objectives.has("compare")) needs.push("Comparer des groupes");
  if (objectives.has("associate") || objectives.has("explain")) needs.push("Examiner une association entre variables");
  if (objectives.has("evaluate_effect")) needs.push("Évaluer un effet (exige un dispositif causal)");
  if (objectives.has("predict")) needs.push("Prédire (exige un modèle)");
  if (objectives.has("understand_qualitative")) needs.push("Comprendre un phénomène à partir de textes");
  if (objectives.has("diagnose")) needs.push("Diagnostiquer une organisation");
  if (objectives.has("reconcile")) needs.push("Rapprocher des montants");
  if (structure === "time_series" || structure === "panel") needs.push("Tenir compte de la dépendance temporelle");
  if (structure === "paired_repeated") needs.push("Comparer des mesures sur les mêmes unités");

  // 1. Compréhension de la recherche et préparation des données : toujours mobilisées.
  add("research-understanding", sheet.objectives.length || sheet.domain.value ? "ready" : "to_confirm", sheet.objectives.length ? "Analyse le sujet : concepts, variables, relations supposées et questions de clarification." : "Décrivez votre recherche pour que les concepts et objectifs soient repérés.");
  add("data-preparation", hasData ? "ready" : "to_confirm", hasData ? "Vérifie la qualité des données et relie chaque concept à la bonne question du fichier." : "Importez votre fichier de données.", hasData && sheet.preparation.status !== "verified" ? ["Confirmer l'état des données à l'étape « Vérification des données »."] : []);

  // 2. Statistiques descriptives.
  const closedVariables = sheet.variables.filter((v) => ["nominal", "ordinal", "quantitative_discrete", "quantitative_continuous", "geographic", "derived"].includes(v.nature.value)).length;
  if (!hasData) add("descriptive-statistics", "to_confirm", "Décrira les variables une fois le fichier importé.");
  else if (!closedVariables) add("descriptive-statistics", "excluded", "Le fichier ne contient que des textes libres ou des identifiants : rien à décrire statistiquement.", [], ["Analyse qualitative (prévue)."]);
  else if (source === "financial_statements") add("descriptive-statistics", "ready", "Présentation descriptive des montants par poste et par exercice, sans test statistique.", ["Les totaux et sous-totaux ne doivent pas être additionnés aux postes qu'ils résument."]);
  else if (structure === "time_series" || structure === "panel") add("descriptive-statistics", "ready", "Description de chaque série (minimum, maximum, moyenne, médiane), sans modéliser la dépendance temporelle.", ["Une moyenne sur des périodes successives ne décrit pas la tendance."]);
  else add("descriptive-statistics", "ready", "Effectifs, pourcentages et indicateurs de position pour les variables de la recherche, puis le profil des répondants.", ["Types des variables confirmés à l'étape « Vérification des données »."]);

  // 3. Statistiques inférentielles : seulement si l'objectif et la structure des données le justifient.
  let inferentialAllowed = false;
  let inferentialReason: string | null = null;
  const exclude = (reason: string, alternatives: string[]) => {
    inferentialReason = reason;
    add("inferential-statistics", "excluded", reason, [], alternatives);
  };
  if (!hasData) {
    inferentialReason = "Importez d'abord vos données.";
    add("inferential-statistics", relational ? "to_confirm" : "not_needed", relational ? "Des tests de relation pourront être proposés une fois les données importées et vérifiées." : "Aucun objectif de comparaison ou d'association : aucun test n'est imposé.");
  } else if (source === "financial_statements") exclude("Les lignes d'un état financier sont des postes comptables liés entre eux (totaux, sous-totaux, équilibre actif-passif), pas des observations indépendantes : un Chi², un test t ou une ANOVA n'y ont pas de sens.", ["Présentation descriptive des postes et de leur évolution (statistiques descriptives)."]);
  else if (source === "interviews_text" && closedVariables < 2) exclude("Des réponses textuelles ne se prêtent pas à un test statistique.", ["Description des questions fermées éventuelles."]);
  else if (structure === "time_series") exclude("Les observations successives d'une série temporelle dépendent les unes des autres : le Chi² et l'ANOVA classiques supposent des observations indépendantes et ne s'appliquent pas.", ["Description de chaque série (statistiques descriptives)."]);
  else if (structure === "panel") exclude("Les mêmes entités sont observées à plusieurs périodes : les tests pour observations indépendantes ne s'appliquent pas.", ["Description par période ou par entité (statistiques descriptives)."]);
  else if (structure === "paired_repeated") exclude("Les mesures portent sur les mêmes unités (avant/après, conditions répétées) : les tests pour groupes indépendants donneraient des conclusions fausses.", ["Description de chaque mesure (statistiques descriptives)."]);
  else if (structure === "mixed_undetermined" && sheet.structure.confidence === "low") {
    inferentialReason = `Structure des observations à préciser (${sheet.structure.justification}) : aucun test n'est proposé tant qu'elle n'est pas confirmée.`;
    add("inferential-statistics", "to_confirm", inferentialReason, ["Répondre à la question sur la structure des observations."]);
  } else if (!relational) {
    inferentialReason = "Votre recherche est descriptive ou exploratoire : aucune variable dépendante ni aucun test n'est imposé.";
    add("inferential-statistics", "not_needed", inferentialReason, [], ["Si vous souhaitez comparer des groupes ou examiner un lien, formulez-le dans vos objectifs ou hypothèses."]);
  } else {
    inferentialAllowed = true;
    const conditions = ["Observations indépendantes (une unité par ligne, interrogée une fois) — à confirmer avant le calcul.", "Variables de la relation reliées aux bonnes questions et de type confirmé.", "Effectifs suffisants (effectifs attendus, taille des groupes) — vérifiés au calcul."];
    if (structure === "grouped_hierarchical") conditions.push("Observations regroupées (équipes, services…) : l'indépendance entre membres d'un même groupe est à discuter.");
    if (objectives.has("evaluate_effect")) conditions.push("Le test montre une association, pas l'effet causal évoqué par votre formulation.");
    if (objectives.has("predict")) conditions.push("Une association ne constitue pas un modèle de prévision.");
    add("inferential-statistics", "ready", "Tests de relation entre les variables de votre question (Chi², Welch, ANOVA, corrélations), choisis selon les types de variables ; aucun test n'est lancé sans votre validation.", conditions);
  }

  // 4. Capacités prévues requises par l'étude : signalées avec les alternatives disponibles.
  const planned = (id: EngineId, why: string, alternatives: string[]) => add(id, "unavailable", `${why} Ce moteur n'est pas encore disponible dans ACADIA ; votre contexte de recherche est conservé pour l'utiliser dès qu'il le sera.`, engineOf(id).preconditions, alternatives);
  if (source === "financial_statements" || objectives.has("diagnose") && source !== "survey") planned("financial-statements", "Vos données sont des états financiers : leur analyse passe par des ratios et une lecture horizontale et verticale.", ["Statistiques descriptives des montants par poste."]);
  if (objectives.has("reconcile")) planned("reconciliation", "Votre objectif est un rapprochement de montants.", ["Statistiques descriptives des montants."]);
  if (structure === "time_series") planned("time-series", "Vos données forment une série temporelle.", ["Statistiques descriptives de chaque série."]);
  if (structure === "panel" || ((structure === "time_series" || source === "economic_time_series") && (objectives.has("explain") || objectives.has("predict")))) planned("econometrics", "Expliquer ou prévoir à partir de données temporelles ou de panel exige un modèle économétrique.", ["Statistiques descriptives."]);
  if (objectives.has("predict") && structure === "cross_sectional") planned("econometrics", "Prédire une variable exige un modèle (régression).", ["Tests d'association (inférentiel) pour repérer les liens, sans prévision."]);
  if (structure === "paired_repeated") planned("paired-tests", "Vos mesures portent sur les mêmes unités.", ["Statistiques descriptives de chaque mesure."]);
  if (source === "interviews_text" || objectives.has("understand_qualitative")) planned("qualitative-analysis", "Votre recherche vise à comprendre un phénomène à partir de discours ou de textes.", ["Description des questions fermées éventuelles."]);
  if (objectives.has("evaluate_effect")) planned("causal-evaluation", "Votre formulation évoque un effet ou un impact ; l'établir exige un dispositif d'évaluation.", inferentialAllowed ? ["Tests d'association (inférentiel), interprétés comme des associations."] : ["Statistiques descriptives."]);

  // 5. Moteurs explicitement demandés.
  for (const id of options.requested ?? []) {
    const existing = steps.find((s) => s.engineId === id);
    const engine = engineOf(id);
    if (existing) existing.requested = true;
    else if (engine.status === "planned") steps.push({ engineId: id, engine: engine.name, status: "unavailable", reason: `Vous avez demandé « ${engine.name} » : ce moteur n'est pas encore disponible dans ACADIA. Aucun calcul de remplacement n'est simulé ; votre contexte est conservé.`, conditions: engine.preconditions, alternatives: ["Statistiques descriptives", "Analyse statistique inférentielle (si vos données sont des observations indépendantes)"], requested: true });
    else steps.push({ engineId: id, engine: engine.name, status: "not_needed", reason: `Vous avez demandé « ${engine.name} », mais aucun besoin de votre étude ne le mobilise pour l'instant.`, conditions: [], alternatives: [], requested: true });
  }

  const specialty = specialtyOf(sheet.specialty.value);
  const ready = steps.filter((s) => s.status === "ready").map((s) => s.engine.toLowerCase());
  const missing = steps.filter((s) => s.status === "unavailable").map((s) => s.engine.toLowerCase());
  return {
    needs,
    steps,
    perspective: specialty ? specialty.perspective : null,
    inferentialAllowed,
    inferentialReason,
    questions: sheet.uncertainties,
    summary: `${hasData ? `Données : ${sheetLabel(sheet)}. ` : ""}Moteurs mobilisés : ${ready.join(", ") || "aucun pour l'instant"}.${missing.length ? ` Non disponibles : ${missing.join(", ")}.` : ""}`,
  };
}

function sheetLabel(sheet: ClassificationSheet): string {
  return `${sheet.source.value === "other" ? "type à préciser" : sheet.source.value === "survey" ? "questionnaire" : sheet.source.value.replace(/_/g, " ")}, ${STRUCTURE_LABELS[sheet.structure.value].toLowerCase()}`;
}

/**
 * Application du routage au plan détaillé du parcours : les analyses de relation inadmissibles pour ces
 * données deviennent non réalisables, avec l'explication de l'orchestrateur. Rien n'est ajouté.
 */
export function applyRouting(plan: AnalysisPlan, routing: Routing): AnalysisPlan {
  if (routing.inferentialAllowed) return plan;
  const reason = routing.inferentialReason ?? "Aucun test de relation n'est admissible pour ces données.";
  return {
    ...plan,
    items: plan.items.map((item) => (item.level === "relation" && item.feasible ? { ...item, feasible: false, blocker: `${reason} (orchestrateur ACADIA)` } : item)),
  };
}
