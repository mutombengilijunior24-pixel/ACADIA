import type { ResearchData } from "@/types/Research";

import type {
  GeneratedQuestionnaire,
  QuestionnaireQuestion,
} from "./QuestionnaireTypes";

export interface ObjectiveCoverage {
  objective: string;
  objectiveIndex: number;
  questionIds: string[];
  covered: boolean;
}

export interface QuestionnaireReasoningResult {
  objectiveCoverage: ObjectiveCoverage[];
  uncoveredObjectives: string[];
  coverageRate: number;
  orphanQuestions: string[];
  recommendations: string[];
}

export function analyzeObjectiveCoverage(
  research: ResearchData,
  questionnaire: GeneratedQuestionnaire
): ObjectiveCoverage[] {
  const objectives =
    research.objectives ?? [];

  const questions =
    questionnaire.sections.flatMap(
      (section) =>
        section.questions
    );

  return objectives.map(
    (objective, index) => {
      const questionIds =
        questions
          .filter(
            (question) =>
              question.objectiveIndex ===
                index ||
              question.objective ===
                objective
          )
          .map(
            (question) =>
              question.id
          );

      return {
        objective,
        objectiveIndex:
          index,
        questionIds,
        covered:
          questionIds.length > 0,
      };
    }
  );
}

export function findOrphanQuestions(
  questionnaire: GeneratedQuestionnaire
): string[] {
  const questions =
    questionnaire.sections.flatMap(
      (section) =>
        section.questions
    );

  return questions
    .filter((question) => {
      if (
        question.type === "text" ||
        question.type ===
          "long_text"
      ) {
        return false;
      }

      return (
        !question.variable &&
        !question.objective &&
        !question.methodologicalPurpose
      );
    })
    .map(
      (question) =>
        question.id
    );
}

export function reasonAboutQuestionnaire(
  research: ResearchData,
  questionnaire: GeneratedQuestionnaire
): QuestionnaireReasoningResult {
  const objectiveCoverage =
    analyzeObjectiveCoverage(
      research,
      questionnaire
    );

  const uncoveredObjectives =
    objectiveCoverage
      .filter(
        (item) =>
          !item.covered
      )
      .map(
        (item) =>
          item.objective
      );

  const orphanQuestions =
    findOrphanQuestions(
      questionnaire
    );

  const totalObjectives =
    objectiveCoverage.length;

  const coveredObjectives =
    objectiveCoverage.filter(
      (item) =>
        item.covered
    ).length;

  const coverageRate =
    totalObjectives === 0
      ? 100
      : Math.round(
          (coveredObjectives /
            totalObjectives) *
            100
        );

  const recommendations:
    string[] = [];

  if (
    uncoveredObjectives.length >
    0
  ) {
    recommendations.push(
      `${uncoveredObjectives.length} objectif(s) spécifique(s) ne sont pas suffisamment couverts par les questions.`
    );
  }

  if (
    orphanQuestions.length >
    0
  ) {
    recommendations.push(
      `${orphanQuestions.length} question(s) semblent ne pas avoir de rattachement méthodologique explicite.`
    );
  }

  if (
    coverageRate === 100 &&
    orphanQuestions.length ===
      0
  ) {
    recommendations.push(
      "Le questionnaire présente une couverture méthodologique cohérente des objectifs."
    );
  }

  if (
    !research.problem?.trim()
  ) {
    recommendations.push(
      "La problématique n'est pas renseignée. Une vérification de la cohérence problématique-objectifs serait recommandée."
    );
  }

  return {
    objectiveCoverage,
    uncoveredObjectives,
    coverageRate,
    orphanQuestions,
    recommendations,
  };
}

export function explainQuestion(
  question: QuestionnaireQuestion
): string {
  if (
    question.methodologicalPurpose
  ) {
    return question.methodologicalPurpose;
  }

  if (
    question.variable &&
    question.dimension &&
    question.indicator
  ) {
    return `Cette question mesure l'indicateur « ${question.indicator} », rattaché à la dimension « ${question.dimension} » de la variable « ${question.variable} ».`;
  }

  if (
    question.objective
  ) {
    return `Cette question contribue à l'objectif spécifique suivant : « ${question.objective} ».`;
  }

  return "Cette question contribue à la collecte des informations nécessaires à l'étude.";
}