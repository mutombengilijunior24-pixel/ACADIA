// ============================================================
// ACADIA — QUESTIONNAIRE GENERATION ENGINE (P4)
//
// Pont entre l'opérationnalisation scientifique réelle
// (ResearchProject.variables[].dimensions[].indicators[],
// produite par A1/A2 + AIResearchAdapter — P2.1/P2.2) et
// l'instrument de collecte.
//
// IMPORTANT — pourquoi ce fichier existe :
// lib/core/questionnaire/QuestionnaireEngine.ts (existant,
// non modifié) génère déjà un questionnaire complet, mais en
// redevinant les variables/dimensions/indicateurs à partir du
// SEUL TITRE (regex + dictionnaire figé). C'est exactement ce
// que P4 interdit ("ACADIA ne doit pas générer un questionnaire
// générique à partir du titre"). Ce moteur-ci construit
// l'instrument à partir des VRAIES variables/dimensions/
// indicateurs déjà présentes dans le ResearchProject — une
// question par indicateur réel, jamais réinventé.
//
// Tout le reste de l'infrastructure existante est réutilisé
// SANS MODIFICATION : QuestionnaireTypes (GeneratedQuestionnaire,
// QuestionnaireSection, QuestionnaireQuestion), le validateur
// (QuestionnaireValidator), la matrice de couverture
// (QuestionnaireMatrix) et le moteur qualité
// (QuestionnaireQualityEngine) fonctionnent déjà génériquement
// sur ces types, quelle que soit la source des données.
//
// Aucun appel OpenAI ici — génération déterministe, comme le
// moteur existant. La formulation reste basée sur les noms et
// descriptions réels produits par A2, jamais inventée.
// ============================================================

import type {
  ResearchProject,
  ResearchVariable,
  ResearchDimension,
  ResearchIndicator,
} from "../research/ResearchTypes";

import type { ResearchData } from "@/types/Research";

import type {
  GeneratedQuestionnaire,
  QuestionnaireSection,
  QuestionnaireQuestion,
  QuestionnaireVariable,
  QuestionType,
  InterviewGuide,
  InterviewGuideTheme,
} from "./QuestionnaireTypes";

import {
  LIKERT_OPTIONS,
  FREQUENCY_OPTIONS,
  YES_NO_OPTIONS,
} from "./QuestionnaireEngine";

import { validateQuestionnaire } from "./QuestionnaireValidator";

import {
  buildQuestionnaireMatrix,
  type QuestionnaireMatrix,
} from "./QuestionnaireMatrix";

import {
  analyzeQuestionnaireQuality,
  type QuestionnaireQualityResult,
} from "./QuestionnaireQualityEngine";


// ============================================================
// UTILITAIRES
// ============================================================

function clean(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function normalize(value: string): string {
  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "");
}

function lowerFirst(value: string): string {
  return value ? value.charAt(0).toLowerCase() + value.slice(1) : value;
}


// ============================================================
// TYPE DE QUESTION SELON LA NATURE DE L'INDICATEUR
//
// Règle structurelle, déterministe — jamais "likert par
// défaut pour tout" : seuls les indicateurs qui ne
// correspondent à aucun motif reconnu retombent sur likert
// (le cas le plus courant pour la perception/satisfaction/
// qualité, qui constitue la majorité réelle des indicateurs
// produits par A2 sur les sujets SEG testés).
// ============================================================

export function inferQuestionType(
  indicator: ResearchIndicator
): QuestionType {

  const text = normalize(
    `${indicator.name} ${indicator.description ?? ""}`
  );

  if (
    /(frequence|periodicite|regularite|nombre de|combien de fois)/.test(text)
  ) {
    return "frequency";
  }

  if (
    /(montant|cout|salaire|remuneration|prix|budget|chiffre d'affaires)/.test(text)
  ) {
    return "number";
  }

  if (
    /(pourcentage|taux|proportion de|ratio)/.test(text)
  ) {
    return "percentage";
  }

  if (
    /(depuis quand|date de|anciennete|duree de fonctionnement)/.test(text)
  ) {
    return "date";
  }

  if (
    /(existence|presence d'un|disponibilite d'un|acces effectif|obtention d'un)/.test(text)
  ) {
    return "yes_no";
  }

  return "likert";
}


// ============================================================
// FORMULATION DE LA QUESTION
//
// Déterministe, fondée sur le nom/la description réels de
// l'indicateur (produits par A2) — jamais inventée. Aucun
// appel IA dans cette version (P4 le permet mais ne l'exige
// pas : "l'IA PEUT être utilisée pour proposer la formulation").
// ============================================================

function buildQuestionText(
  type: QuestionType,
  variable: ResearchVariable,
  dimension: ResearchDimension,
  indicator: ResearchIndicator
): string {

  const base =
    clean(indicator.description) || indicator.name;

  switch (type) {

    case "frequency":
      return `À quelle fréquence constatez-vous la situation suivante : ${lowerFirst(base)} ?`;

    case "number":
      return `Quelle est la valeur correspondant à : ${lowerFirst(base)} ?`;

    case "percentage":
      return `Quel pourcentage estimez-vous pour : ${lowerFirst(base)} ?`;

    case "date":
      return `Depuis quand la situation suivante s'applique-t-elle : ${lowerFirst(base)} ?`;

    case "yes_no":
      return base.endsWith("?")
        ? base
        : `${base} — est-ce le cas actuellement ?`;

    case "likert":
    default:
      return `Dans quelle mesure êtes-vous d'accord avec l'affirmation suivante, concernant ${lowerFirst(dimension.name)} (${lowerFirst(variable.name)}) : « ${base} » ?`;
  }
}

function optionsForType(type: QuestionType) {
  switch (type) {
    case "frequency":
      return { scale: FREQUENCY_OPTIONS };
    case "yes_no":
      return { options: YES_NO_OPTIONS };
    case "likert":
      return { scale: LIKERT_OPTIONS };
    default:
      return {};
  }
}


// ============================================================
// QUESTION UNIQUE — UN INDICATEUR RÉEL = UNE QUESTION
// ============================================================

function buildQuestionFromIndicator(
  variable: ResearchVariable,
  dimension: ResearchDimension,
  indicator: ResearchIndicator,
  sectionId: string,
  number: number
): QuestionnaireQuestion {

  const type = inferQuestionType(indicator);

  return {
    id: `Q${number}`,

    number,

    order: number,

    sectionId,

    type,

    text: buildQuestionText(type, variable, dimension, indicator),

    required: true,

    // Traçabilité par nom (compat. QuestionnaireMatrix/
    // Validator/QualityEngine, qui matchent déjà sur ces
    // chaînes) ET par id réel (P4 — traçabilité véritable).
    variable: variable.name,
    dimension: dimension.name,
    indicator: indicator.name,

    variableId: variable.id,
    dimensionId: dimension.id,
    indicatorId: indicator.id,

    methodologicalPurpose:
      `Mesurer l'indicateur « ${indicator.name} » de la dimension « ${dimension.name} » de la variable « ${variable.name} ».`,

    analysisHint:
      type === "likert" || type === "frequency"
        ? "Analyse descriptive par fréquences et moyenne des réponses."
        : type === "number" || type === "percentage"
        ? "Analyse descriptive (moyenne, écart-type) après codification."
        : "Analyse descriptive par fréquences.",

    status: "proposed",

    ...optionsForType(type),
  };
}


// ============================================================
// SECTION QUANTITATIVE — UNE VARIABLE = UNE SECTION
//
// Une question par indicateur réel. Si une variable n'a
// aucune dimension/indicateur (opérationnalisation absente),
// aucune question n'est fabriquée pour elle — elle sera
// signalée par le contrôle de couverture, jamais comblée
// artificiellement.
// ============================================================

function buildVariableSection(
  variable: ResearchVariable,
  sectionIndex: number,
  startNumber: number
): QuestionnaireSection {

  const questions: QuestionnaireQuestion[] = [];
  let number = startNumber;

  for (const dimension of variable.dimensions ?? []) {
    for (const indicator of dimension.indicators ?? []) {
      questions.push(
        buildQuestionFromIndicator(
          variable,
          dimension,
          indicator,
          `section-${variable.id}`,
          number
        )
      );
      number++;
    }
  }

  const roleLabel: Record<string, string> = {
    independent: "Variable explicative",
    dependent: "Variable expliquée",
    mediating: "Variable médiatrice",
    moderating: "Variable modératrice",
    control: "Variable de contrôle",
    descriptive: "Variable descriptive",
  };

  return {
    id: `section-${variable.id}`,

    title: `Section ${String.fromCharCode(65 + sectionIndex)} — ${variable.name}`,

    description:
      `${roleLabel[variable.role] ?? "Variable"} : cette section mesure les dimensions et indicateurs de « ${variable.name} ».`,

    type:
      variable.role === "independent"
        ? "independent_variable"
        : variable.role === "dependent"
        ? "dependent_variable"
        : "complementary",

    questions,
  };
}


// ============================================================
// QUESTIONNAIRE QUANTITATIF / MIXTE (PARTIE QUANTITATIVE)
// ============================================================

function buildQuantitativeQuestionnaire(
  project: ResearchProject
): GeneratedQuestionnaire {

  const sections: QuestionnaireSection[] = [];
  let nextNumber = 1;

  project.variables.forEach((variable, index) => {
    const section = buildVariableSection(variable, index, nextNumber);

    if (section.questions.length > 0) {
      sections.push(section);
      nextNumber += section.questions.length;
    }
  });

  const questions = sections.flatMap((section) => section.questions);

  const variables: QuestionnaireVariable[] = project.variables.map((variable) => ({
    id: variable.id,
    name: variable.name,
    role: variable.role,
    dimensions: (variable.dimensions ?? []).map((d) => d.name),
    indicators: (variable.dimensions ?? []).flatMap((d) =>
      (d.indicators ?? []).map((i) => i.name)
    ),
  }));

  return {
    id: `instrument-${project.id}`,

    title: `Instrument de collecte — ${project.title}`,

    description:
      `Questionnaire construit à partir des variables, dimensions et indicateurs opérationnalisés pour « ${project.title} ».`,

    researchType:
      project.researchType === "mixed" ? "mixed" : "quantitative",

    variables,

    sections,

    totalQuestions: questions.length,

    estimatedDuration: Math.max(5, Math.ceil(questions.length * 0.4)),

    methodologyNotes: [
      `${variables.length} variable(s) opérationnalisée(s) utilisée(s) pour construire l'instrument.`,
      `${questions.length} question(s) générée(s), une par indicateur réel — aucune question générique.`,
    ],

    generatedAt: new Date().toISOString(),
  };
}


// ============================================================
// GUIDE D'ENTRETIEN QUALITATIF / MIXTE (PARTIE QUALITATIVE)
//
// Un thème par DIMENSION (pas par indicateur isolé — un
// entretien explore un thème). La question principale et les
// relances reprennent les noms réels des indicateurs de la
// dimension, jamais inventés.
// ============================================================

// ============================================================
// FORMULATION DU GUIDE D'ENTRETIEN — GABARITS NATURELS (A9)
//
// Un nom de dimension est le plus souvent un groupe nominal
// ("Croyance générale envers la formation"), jamais une phrase.
// L'ancien gabarit l'insérait tel quel après un verbe
// ("Pouvez-vous nous expliquer croyance générale...") — grammaticalement
// incorrect et mécanique. On l'introduit désormais comme un
// THÈME ("ce que vous pensez de ...", "votre expérience de ...")
// plutôt que comme un complément d'objet direct du verbe
// "expliquer". Toujours déterministe (aucun appel IA), fondé
// uniquement sur les noms réels des dimensions/indicateurs.
// ============================================================

function elideDe(word: string): string {
  return /^[aeiouhàâäéèêëïîôöùûü]/i.test(word) ? `d'${word}` : `de ${word}`;
}

const MAIN_QUESTION_TEMPLATES: Array<
  (topic: string, variableName: string) => string
> = [
  (topic, variableName) =>
    `Pouvez-vous nous expliquer ce que vous pensez ${elideDe(topic)}, en lien avec ${variableName} ?`,
  (topic, variableName) =>
    `Comment décririez-vous votre expérience concernant ${topic}, dans le cadre ${elideDe(variableName)} ?`,
  (topic, variableName) =>
    `Pouvez-vous nous parler ${elideDe(topic)}, pour ce qui concerne ${variableName} ?`,
];

const FOLLOW_UP_TEMPLATES: Array<(topic: string) => string> = [
  (topic) => `Pouvez-vous nous donner un exemple concret concernant ${topic} ?`,
  (topic) => `Que pouvez-vous nous dire à propos ${elideDe(topic)} ?`,
  (topic) => `Dans quelle mesure ${topic} joue-t-il un rôle selon vous ?`,
];

function buildInterviewGuide(
  project: ResearchProject
): InterviewGuide {

  const themes: InterviewGuideTheme[] = [];
  let themeNumber = 1;

  for (const variable of project.variables) {
    for (const dimension of variable.dimensions ?? []) {

      const indicatorNames = (dimension.indicators ?? []).map((i) => i.name);

      const topic = lowerFirst(dimension.description || dimension.name);
      const variableName = lowerFirst(variable.name);
      const mainTemplate =
        MAIN_QUESTION_TEMPLATES[themeNumber % MAIN_QUESTION_TEMPLATES.length];

      themes.push({
        id: `theme-${themeNumber}`,

        theme: `${dimension.name} (${variable.name})`,

        mainQuestion: mainTemplate(topic, variableName),

        followUps:
          indicatorNames.length > 0
            ? indicatorNames.map((name, index) => {
                const followTemplate =
                  FOLLOW_UP_TEMPLATES[
                    (themeNumber + index) % FOLLOW_UP_TEMPLATES.length
                  ];
                return followTemplate(lowerFirst(name));
              })
            : ["Pouvez-vous donner un exemple concret ?"],

        variableId: variable.id,
        dimensionId: dimension.id,

        status: "proposed",
      });

      themeNumber++;
    }
  }

  return {
    id: `interview-guide-${project.id}`,

    title: `Guide d'entretien — ${project.title}`,

    description:
      `Guide construit à partir des dimensions opérationnalisées pour « ${project.title} ». Chaque thème peut être approfondi librement par l'enquêteur.`,

    themes,

    generatedAt: new Date().toISOString(),
  };
}


// ============================================================
// RÉSULTAT COMPLET
// ============================================================

export interface QuestionnaireGenerationResult {
  mode: "quantitative" | "qualitative" | "mixed";

  questionnaire?: GeneratedQuestionnaire;

  interviewGuide?: InterviewGuide;

  validation?: ReturnType<typeof validateQuestionnaire>;

  matrix?: QuestionnaireMatrix;

  quality?: QuestionnaireQualityResult;

  warnings: string[];
}


/**
 * Adaptateur minimal : QuestionnaireMatrix/QualityEngine
 * attendent un `ResearchData` (Wizard) pour lire uniquement
 * `objectives: string[]`. On ne reconstruit pas un faux
 * ResearchData complet — seul le champ réellement lu est
 * fourni, à partir des objectifs déjà présents dans le
 * ResearchProject (P2.1/P2.4), pour réutiliser ces moteurs
 * sans les modifier.
 */
function toObjectivesShim(project: ResearchProject): ResearchData {
  return {
    objectives: project.objectives
      .filter((o) => o.role === "specific")
      .map((o) => o.text),
  } as ResearchData;
}


/**
 * Analyse un instrument DÉJÀ EXISTANT (généré puis
 * éventuellement modifié par le chercheur) sans le
 * régénérer — indispensable pour recalculer couverture/
 * validation après une modification humaine ou après un
 * rechargement, sans jamais écraser silencieusement une
 * modification déjà acceptée.
 */
export function analyzeInstrument(
  project: ResearchProject,
  questionnaire: GeneratedQuestionnaire
) {
  const validation = validateQuestionnaire(questionnaire);
  const researchShim = toObjectivesShim(project);
  const matrix = buildQuestionnaireMatrix(researchShim, questionnaire);
  const quality = analyzeQuestionnaireQuality(researchShim, questionnaire);

  return { validation, matrix, quality };
}


export function generateInstrumentFromProject(
  project: ResearchProject
): QuestionnaireGenerationResult {

  const approach = project.methodology?.approach;
  const warnings: string[] = [];

  if (project.variables.length === 0) {
    warnings.push(
      "Aucune variable opérationnalisée n'est disponible : aucun instrument n'a pu être généré."
    );
  }

  // ----------------------------------------------------------
  // QUALITATIF — guide d'entretien uniquement, jamais de
  // questionnaire Likert forcé.
  // ----------------------------------------------------------

  if (approach === "qualitative") {
    return {
      mode: "qualitative",
      interviewGuide: buildInterviewGuide(project),
      warnings,
    };
  }

  const questionnaire = buildQuantitativeQuestionnaire(project);
  const { validation, matrix, quality } = analyzeInstrument(project, questionnaire);

  // ----------------------------------------------------------
  // MIXTE — partie quantitative + guide d'entretien séparé.
  // ----------------------------------------------------------

  if (approach === "mixed") {
    return {
      mode: "mixed",
      questionnaire,
      interviewGuide: buildInterviewGuide(project),
      validation,
      matrix,
      quality,
      warnings,
    };
  }

  return {
    mode: "quantitative",
    questionnaire,
    validation,
    matrix,
    quality,
    warnings,
  };
}
