// ============================================================
// ACADIA — SECTION D'IDENTIFICATION DU RÉPONDANT (Bloc F, 11/09/2026)
//
// Ne modifie PAS QuestionnaireGenerationEngine.ts (moteur protégé).
// Prend en entrée un GeneratedQuestionnaire DÉJÀ construit par ce
// moteur (et déjà, le cas échéant, enrichi par QuestionnaireAIEnrichment)
// et lui ajoute, en tête, une section fixe et déterministe
// d'identification du répondant — sexe, âge, niveau d'instruction,
// profession/secteur, zone de résidence — présente dans les trois
// mémoires de référence fournis (partie I de chaque questionnaire
// d'enquête) mais absente du moteur de génération actuel.
//
// Aucun appel IA ici, aucune catégorie inventée pour une population
// précise : les deux questions les plus dépendantes du terrain
// (profession/secteur, zone de résidence) restent en texte libre
// plutôt que des listes de choix qui présumeraient d'un contexte
// non garanti par le projet. Ces questions n'ont pas d'indicatorId
// (comme les questions socio-démographiques déjà prévues par
// QuestionnaireTypes.ts) : elles n'entrent donc jamais dans le
// contrôle de couverture variables/indicateurs.
// ============================================================

import type {
  GeneratedQuestionnaire,
  QuestionnaireQuestion,
  QuestionnaireSection,
} from "./QuestionnaireTypes";

const IDENTIFICATION_SECTION_ID = "identification";

function buildIdentificationSection(): QuestionnaireSection {
  const questions: Omit<QuestionnaireQuestion, "id" | "number" | "order">[] = [
    {
      sectionId: IDENTIFICATION_SECTION_ID,
      type: "single_choice",
      text: "Quel est votre sexe ?",
      required: true,
      status: "proposed",
      options: [
        { label: "Homme", value: "homme" },
        { label: "Femme", value: "femme" },
        { label: "Préfère ne pas répondre", value: "non_precise" },
      ],
    },
    {
      sectionId: IDENTIFICATION_SECTION_ID,
      type: "single_choice",
      text: "Dans quelle tranche d'âge vous situez-vous ?",
      required: true,
      status: "proposed",
      options: [
        { label: "Moins de 25 ans", value: "moins_25" },
        { label: "25 – 34 ans", value: "25_34" },
        { label: "35 – 44 ans", value: "35_44" },
        { label: "45 – 54 ans", value: "45_54" },
        { label: "55 ans et plus", value: "55_plus" },
      ],
    },
    {
      sectionId: IDENTIFICATION_SECTION_ID,
      type: "single_choice",
      text: "Quel est votre niveau d'instruction ?",
      required: true,
      status: "proposed",
      options: [
        { label: "Primaire", value: "primaire" },
        { label: "Secondaire", value: "secondaire" },
        { label: "Graduat / Licence", value: "graduat_licence" },
        { label: "Master", value: "master" },
        { label: "Doctorat", value: "doctorat" },
        { label: "Autre", value: "autre" },
      ],
    },
    {
      sectionId: IDENTIFICATION_SECTION_ID,
      type: "text",
      text: "Quelle est votre profession ou votre secteur d'activité ?",
      required: false,
      status: "proposed",
    },
    {
      sectionId: IDENTIFICATION_SECTION_ID,
      type: "text",
      text: "Dans quelle commune, ville ou zone résidez-vous (ou exercez-vous) ?",
      required: false,
      status: "proposed",
    },
  ];

  return {
    id: IDENTIFICATION_SECTION_ID,
    title: "Identification du répondant",
    description:
      "Cette section permet de situer le profil des personnes interrogées (sexe, âge, niveau d'instruction, activité, zone), afin de mieux interpréter et contextualiser les résultats — elle ne fait pas partie de l'opérationnalisation scientifique du projet et ses réponses ne sont pas rattachées à un indicateur.",
    type: "profile",
    questions: questions as QuestionnaireQuestion[],
  };
}

/**
 * Ajoute la section d'identification en tête du questionnaire et
 * renumérote l'ensemble des questions (id/number/order) pour
 * conserver une numérotation continue et sans trou, comme le fait
 * le moteur protégé lui-même.
 *
 * Sans effet sur une recherche purement qualitative (aucune section
 * quantitative à préfixer — seul le guide d'entretien existe alors).
 */
export function addIdentificationSection(
  questionnaire: GeneratedQuestionnaire
): GeneratedQuestionnaire {
  if (questionnaire.sections.length === 0) {
    return questionnaire;
  }

  let counter = 1;
  const renumber = (question: QuestionnaireQuestion): QuestionnaireQuestion => {
    const numbered: QuestionnaireQuestion = {
      ...question,
      id: `Q${counter}`,
      number: counter,
      order: counter,
    };
    counter++;
    return numbered;
  };

  const identification = buildIdentificationSection();
  const renumberedIdentification: QuestionnaireSection = {
    ...identification,
    questions: identification.questions.map(renumber),
  };

  const renumberedSections: QuestionnaireSection[] = questionnaire.sections.map((section) => ({
    ...section,
    questions: section.questions.map(renumber),
  }));

  const sections = [renumberedIdentification, ...renumberedSections];
  const totalQuestions = sections.reduce((sum, section) => sum + section.questions.length, 0);

  return {
    ...questionnaire,
    sections,
    totalQuestions,
    estimatedDuration: Math.max(5, Math.ceil(totalQuestions * 0.4)),
    methodologyNotes: [
      ...questionnaire.methodologyNotes,
      "Une section d'identification du répondant a été ajoutée en tête du questionnaire (sexe, âge, niveau d'instruction, profession/secteur, zone de résidence) — questions sans indicateur associé, exclues du contrôle de couverture variables/indicateurs.",
    ],
  };
}
