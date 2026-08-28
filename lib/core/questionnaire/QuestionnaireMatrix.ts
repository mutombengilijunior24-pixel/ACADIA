import type { ResearchData } from "@/types/Research";

import type {
  GeneratedQuestionnaire,
  QuestionnaireQuestion,
} from "./QuestionnaireTypes";

/* =========================================================
   TYPES DE LA MATRICE
========================================================= */

export interface MatrixQuestion {
  questionId: string;
  questionNumber: number;
  questionText: string;
  questionType: string;

  variable?: string;
  dimension?: string;
  indicator?: string;

  objective?: string;
  objectiveIndex?: number;

  methodologicalPurpose?: string;
  analysisHint?: string;
}

export interface MatrixIndicator {
  name: string;
  questions: MatrixQuestion[];
}

export interface MatrixDimension {
  name: string;
  indicators: MatrixIndicator[];
  questions: MatrixQuestion[];
}

export interface MatrixVariable {
  name: string;
  role: "independent" | "dependent" | "relationship";
  dimensions: MatrixDimension[];
  questions: MatrixQuestion[];
}

export interface MatrixObjective {
  objective: string;
  objectiveIndex: number;

  questions: MatrixQuestion[];

  variables: string[];

  covered: boolean;

  questionCount: number;
}

export interface QuestionnaireMatrix {
  objectives: MatrixObjective[];

  variables: MatrixVariable[];

  allQuestions: MatrixQuestion[];

  totalObjectives: number;
  coveredObjectives: number;

  totalVariables: number;
  totalDimensions: number;
  totalIndicators: number;

  totalQuestions: number;

  coverageRate: number;

  orphanQuestions: MatrixQuestion[];

  recommendations: string[];
}

/* =========================================================
   CONVERSION D'UNE QUESTION
========================================================= */

function convertQuestion(
  question: QuestionnaireQuestion
): MatrixQuestion {
  return {
    questionId: question.id,

    questionNumber:
      question.number,

    questionText:
      question.text,

    questionType:
      question.type,

    variable:
      question.variable,

    dimension:
      question.dimension,

    indicator:
      question.indicator,

    objective:
      question.objective,

    objectiveIndex:
      question.objectiveIndex,

    methodologicalPurpose:
      question.methodologicalPurpose,

    analysisHint:
      question.analysisHint,
  };
}

/* =========================================================
   RÉCUPÉRER TOUTES LES QUESTIONS
========================================================= */

function getAllQuestions(
  questionnaire: GeneratedQuestionnaire
): MatrixQuestion[] {
  return questionnaire.sections
    .flatMap(
      (section) =>
        section.questions
    )
    .map(convertQuestion);
}

/* =========================================================
   CONSTRUIRE LES VARIABLES
========================================================= */

function buildVariables(
  questions: MatrixQuestion[]
): MatrixVariable[] {
  const variableMap =
    new Map<string, MatrixVariable>();

  for (const question of questions) {
    if (!question.variable) {
      continue;
    }

    const variableName =
      question.variable;

    const role =
      variableName.includes("→")
        ? "relationship"
        : undefined;

    if (!variableMap.has(variableName)) {
      variableMap.set(
        variableName,
        {
          name: variableName,

          role:
            role ??
            "independent",

          dimensions: [],

          questions: [],
        }
      );
    }

    const variable =
      variableMap.get(
        variableName
      )!;

    variable.questions.push(
      question
    );

    if (!question.dimension) {
      continue;
    }

    let dimension =
      variable.dimensions.find(
        (item) =>
          item.name ===
          question.dimension
      );

    if (!dimension) {
      dimension = {
        name:
          question.dimension,

        indicators: [],

        questions: [],
      };

      variable.dimensions.push(
        dimension
      );
    }

    dimension.questions.push(
      question
    );

    if (!question.indicator) {
      continue;
    }

    let indicator =
      dimension.indicators.find(
        (item) =>
          item.name ===
          question.indicator
      );

    if (!indicator) {
      indicator = {
        name:
          question.indicator,

        questions: [],
      };

      dimension.indicators.push(
        indicator
      );
    }

    indicator.questions.push(
      question
    );
  }

  return Array.from(
    variableMap.values()
  );
}

/* =========================================================
   CONSTRUIRE LES OBJECTIFS
========================================================= */

function buildObjectives(
  research: ResearchData,
  questions: MatrixQuestion[]
): MatrixObjective[] {
  const objectives =
    research.objectives ??
    [];

  return objectives.map(
    (
      objective,
      index
    ) => {
      const objectiveQuestions =
        questions.filter(
          (question) =>
            question.objectiveIndex ===
              index ||
            question.objective ===
              objective
        );

      const variables = Array.from(
        new Set(
          objectiveQuestions
            .map(
              (question) =>
                question.variable
            )
            .filter(
              (
                variable
              ): variable is string =>
                Boolean(variable)
            )
        )
      );

      return {
        objective,

        objectiveIndex:
          index,

        questions:
          objectiveQuestions,

        variables,

        covered:
          objectiveQuestions.length >
          0,

        questionCount:
          objectiveQuestions.length,
      };
    }
  );
}

/* =========================================================
   QUESTIONS ORPHELINES
========================================================= */

function findOrphanQuestions(
  questions: MatrixQuestion[]
): MatrixQuestion[] {
  return questions.filter(
    (question) => {
      /*
       * Une question générale de profil,
       * d'introduction ou de commentaire
       * n'est pas considérée comme orpheline.
       */

      if (
        !question.variable &&
        !question.dimension &&
        !question.indicator &&
        !question.objective
      ) {
        return false;
      }

      /*
       * Une vraie question analytique
       * devrait avoir au moins un rattachement.
       */

      return (
        !question.variable &&
        !question.objective
      );
    }
  );
}

/* =========================================================
   RECOMMANDATIONS
========================================================= */

function buildRecommendations(
  objectives: MatrixObjective[],
  orphanQuestions: MatrixQuestion[],
  totalDimensions: number,
  totalIndicators: number
): string[] {
  const recommendations: string[] =
    [];

  const uncovered =
    objectives.filter(
      (objective) =>
        !objective.covered
    );

  if (
    uncovered.length > 0
  ) {
    recommendations.push(
      `${uncovered.length} objectif(s) spécifique(s) ne disposent actuellement d'aucune question directement rattachée.`
    );
  }

  if (
    orphanQuestions.length > 0
  ) {
    recommendations.push(
      `${orphanQuestions.length} question(s) nécessitent une vérification de leur rattachement méthodologique.`
    );
  }

  if (
    totalDimensions === 0
  ) {
    recommendations.push(
      "Aucune dimension méthodologique n'a encore été identifiée."
    );
  }

  if (
    totalIndicators === 0
  ) {
    recommendations.push(
      "Aucun indicateur méthodologique n'a encore été identifié."
    );
  }

  if (
    uncovered.length === 0 &&
    orphanQuestions.length === 0 &&
    totalDimensions > 0 &&
    totalIndicators > 0
  ) {
    recommendations.push(
      "La matrice méthodologique présente une structure cohérente."
    );
  }

  return recommendations;
}

/* =========================================================
   CONSTRUCTION DE LA MATRICE
========================================================= */

export function buildQuestionnaireMatrix(
  research: ResearchData,
  questionnaire: GeneratedQuestionnaire
): QuestionnaireMatrix {
  const allQuestions =
    getAllQuestions(
      questionnaire
    );

  const variables =
    buildVariables(
      allQuestions
    );

  const objectives =
    buildObjectives(
      research,
      allQuestions
    );

  const orphanQuestions =
    findOrphanQuestions(
      allQuestions
    );

  const totalObjectives =
    objectives.length;

  const coveredObjectives =
    objectives.filter(
      (objective) =>
        objective.covered
    ).length;

  const coverageRate =
    totalObjectives === 0
      ? 100
      : Math.round(
          (coveredObjectives /
            totalObjectives) *
            100
        );

  const totalDimensions =
    variables.reduce(
      (
        total,
        variable
      ) =>
        total +
        variable.dimensions
          .length,
      0
    );

  const totalIndicators =
    variables.reduce(
      (
        total,
        variable
      ) =>
        total +
        variable.dimensions.reduce(
          (
            dimensionTotal,
            dimension
          ) =>
            dimensionTotal +
            dimension.indicators
              .length,
          0
        ),
      0
    );

  const recommendations =
    buildRecommendations(
      objectives,
      orphanQuestions,
      totalDimensions,
      totalIndicators
    );

  return {
    objectives,

    variables,

    allQuestions,

    totalObjectives,

    coveredObjectives,

    totalVariables:
      variables.length,

    totalDimensions,

    totalIndicators,

    totalQuestions:
      allQuestions.length,

    coverageRate,

    orphanQuestions,

    recommendations,
  };
}

/* =========================================================
   RÉSUMÉ HUMAIN
========================================================= */

export function getMatrixSummary(
  matrix: QuestionnaireMatrix
): string[] {
  return [
    `${matrix.totalObjectives} objectif(s) spécifique(s) analysé(s).`,

    `${matrix.coveredObjectives} objectif(s) couvert(s).`,

    `${matrix.totalVariables} variable(s) structurée(s).`,

    `${matrix.totalDimensions} dimension(s) identifiée(s).`,

    `${matrix.totalIndicators} indicateur(s) identifié(s).`,

    `${matrix.totalQuestions} question(s) structurée(s).`,

    `Taux de couverture des objectifs : ${matrix.coverageRate} %.`,
  ];
}