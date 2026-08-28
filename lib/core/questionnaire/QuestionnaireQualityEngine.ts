import type { ResearchData } from "@/types/Research";

import type {
  GeneratedQuestionnaire,
  QuestionnaireQuestion,
} from "./QuestionnaireTypes";

import {
  buildQuestionnaireMatrix,
  QuestionnaireMatrix,
} from "./QuestionnaireMatrix";

/* =========================================================
   TYPES
========================================================= */

export interface ExpectedDimension {
  variable: string;
  role: "independent" | "dependent";
  dimension: string;
  indicators: string[];
}

export interface MissingCoverage {
  objective?: string;
  objectiveIndex?: number;

  variable?: string;
  dimension?: string;
  indicator?: string;

  reason: string;
}

export interface QuestionnaireQualityResult {
  matrix: QuestionnaireMatrix;

  expectedDimensions: ExpectedDimension[];

  missingCoverage: MissingCoverage[];

  duplicateQuestions: string[];

  weakQuestions: string[];

  score: number;

  complete: boolean;

  recommendations: string[];
}

/* =========================================================
   CONSTRUIRE LA STRUCTURE ATTENDUE
========================================================= */

function buildExpectedDimensions(
  matrix: QuestionnaireMatrix
): ExpectedDimension[] {
  const expected: ExpectedDimension[] = [];

  for (const variable of matrix.variables) {
    if (
      variable.role !==
        "independent" &&
      variable.role !==
        "dependent"
    ) {
      continue;
    }

    for (const dimension of variable.dimensions) {
      expected.push({
        variable:
          variable.name,

        role:
          variable.role,

        dimension:
          dimension.name,

        indicators:
          dimension.indicators.map(
            (indicator) =>
              indicator.name
          ),
      });
    }
  }

  return expected;
}

/* =========================================================
   CONTRÔLE DES DIMENSIONS
========================================================= */

function checkDimensions(
  expectedDimensions: ExpectedDimension[],
  questionnaire: GeneratedQuestionnaire
): MissingCoverage[] {
  const questions =
    questionnaire.sections.flatMap(
      (section) =>
        section.questions
    );

  const missing:
    MissingCoverage[] = [];

  for (const expected of expectedDimensions) {
    const variableQuestions =
      questions.filter(
        (question) =>
          question.variable ===
          expected.variable
      );

    if (
      variableQuestions.length ===
      0
    ) {
      missing.push({
        variable:
          expected.variable,

        dimension:
          expected.dimension,

        reason:
          `Aucune question n'est associée à la variable « ${expected.variable} ».`,
      });

      continue;
    }

    const dimensionQuestions =
      variableQuestions.filter(
        (question) =>
          question.dimension ===
          expected.dimension
      );

    if (
      dimensionQuestions.length ===
      0
    ) {
      missing.push({
        variable:
          expected.variable,

        dimension:
          expected.dimension,

        reason:
          `La dimension « ${expected.dimension} » n'est pas couverte par une question.`,
      });

      continue;
    }

    for (const indicator of expected.indicators) {
      const indicatorQuestions =
        dimensionQuestions.filter(
          (question) =>
            question.indicator ===
            indicator
        );

      /*
       * Une question qualitative peut
       * ne pas avoir d'indicateur explicite.
       * On ne la considère donc pas automatiquement
       * comme manquante.
       */

      if (
        indicatorQuestions.length ===
          0 &&
        questionnaire.researchType !==
          "qualitative"
      ) {
        missing.push({
          variable:
            expected.variable,

          dimension:
            expected.dimension,

          indicator,

          reason:
            `L'indicateur « ${indicator} » n'est pas directement couvert.`,
        });
      }
    }
  }

  return missing;
}

/* =========================================================
   CONTRÔLE DES OBJECTIFS
========================================================= */

function checkObjectives(
  research: ResearchData,
  questionnaire: GeneratedQuestionnaire
): MissingCoverage[] {
  const questions =
    questionnaire.sections.flatMap(
      (section) =>
        section.questions
    );

  const missing:
    MissingCoverage[] = [];

  const objectives =
    research.objectives ??
    [];

  objectives.forEach(
    (
      objective,
      index
    ) => {
      const related =
        questions.filter(
          (question) =>
            question.objectiveIndex ===
              index ||
            question.objective ===
              objective
        );

      if (
        related.length === 0
      ) {
        missing.push({
          objective,
          objectiveIndex:
            index,

          reason:
            `L'objectif « ${objective} » ne possède aucune question directement rattachée.`,
        });
      }
    }
  );

  return missing;
}

/* =========================================================
   QUESTIONS DUPLIQUÉES
========================================================= */

function findDuplicateQuestions(
  questionnaire: GeneratedQuestionnaire
): string[] {
  const questions =
    questionnaire.sections.flatMap(
      (section) =>
        section.questions
    );

  const duplicates:
    string[] = [];

  for (
    let i = 0;
    i < questions.length;
    i++
  ) {
    for (
      let j = i + 1;
      j < questions.length;
      j++
    ) {
      const first =
        normalizeQuestion(
          questions[i]
        );

      const second =
        normalizeQuestion(
          questions[j]
        );

      if (
        first &&
        first === second
      ) {
        duplicates.push(
          `Q${questions[i].number} et Q${questions[j].number}`
        );
      }
    }
  }

  return duplicates;
}

function normalizeQuestion(
  question: QuestionnaireQuestion
): string {
  return question.text
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      ""
    )
    .replace(
      /[^a-z0-9\s]/g,
      ""
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim();
}

/* =========================================================
   QUESTIONS FAIBLES
========================================================= */

function findWeakQuestions(
  questionnaire: GeneratedQuestionnaire
): string[] {
  const questions =
    questionnaire.sections.flatMap(
      (section) =>
        section.questions
    );

  const weak:
    string[] = [];

  for (const question of questions) {
    const text =
      question.text.trim();

    if (
      text.length < 15
    ) {
      weak.push(
        `Q${question.number} : question trop courte ou insuffisamment précise.`
      );

      continue;
    }

    /*
     * Une question analytique devrait
     * normalement posséder au moins
     * un rattachement méthodologique.
     */

    if (
      question.type !==
        "text" &&
      question.type !==
        "long_text" &&
      !question.variable &&
      !question.objective
    ) {
      weak.push(
        `Q${question.number} : rattachement méthodologique insuffisant.`
      );
    }
  }

  return weak;
}

/* =========================================================
   RECOMMANDATIONS
========================================================= */

function buildRecommendations(
  missingCoverage: MissingCoverage[],
  duplicateQuestions: string[],
  weakQuestions: string[],
  matrix: QuestionnaireMatrix
): string[] {
  const recommendations:
    string[] = [];

  if (
    missingCoverage.length >
    0
  ) {
    recommendations.push(
      `${missingCoverage.length} élément(s) méthodologique(s) nécessitent une couverture supplémentaire.`
    );
  }

  if (
    duplicateQuestions.length >
    0
  ) {
    recommendations.push(
      `${duplicateQuestions.length} doublon(s) potentiel(s) ont été détectés.`
    );
  }

  if (
    weakQuestions.length >
    0
  ) {
    recommendations.push(
      `${weakQuestions.length} question(s) méritent une révision de formulation ou de rattachement.`
    );
  }

  if (
    matrix.coverageRate <
    100
  ) {
    recommendations.push(
      "La couverture des objectifs spécifiques doit être améliorée avant de considérer le questionnaire comme final."
    );
  }

  if (
    missingCoverage.length ===
      0 &&
    duplicateQuestions.length ===
      0 &&
    weakQuestions.length ===
      0 &&
    matrix.coverageRate === 100
  ) {
    recommendations.push(
      "Le questionnaire satisfait actuellement les contrôles méthodologiques principaux d'ACADIA."
    );
  }

  return recommendations;
}

/* =========================================================
   SCORE
========================================================= */

function calculateQualityScore(
  matrix: QuestionnaireMatrix,
  missingCoverage: MissingCoverage[],
  duplicateQuestions: string[],
  weakQuestions: string[]
): number {
  let score = 100;

  /*
   * Couverture des objectifs
   */

  if (
    matrix.coverageRate <
    100
  ) {
    score -= Math.min(
      25,
      100 -
        matrix.coverageRate
    );
  }

  /*
   * Éléments manquants
   */

  score -= Math.min(
    25,
    missingCoverage.length *
      3
  );

  /*
   * Doublons
   */

  score -= Math.min(
    15,
    duplicateQuestions.length *
      5
  );

  /*
   * Questions faibles
   */

  score -= Math.min(
    15,
    weakQuestions.length *
      2
  );

  return Math.max(
    0,
    Math.min(
      100,
      Math.round(score)
    )
  );
}

/* =========================================================
   ANALYSE QUALITÉ COMPLÈTE
========================================================= */

export function analyzeQuestionnaireQuality(
  research: ResearchData,
  questionnaire: GeneratedQuestionnaire
): QuestionnaireQualityResult {
  /*
   * 1. Construire la matrice
   */

  const matrix =
    buildQuestionnaireMatrix(
      research,
      questionnaire
    );

  /*
   * 2. Structure attendue
   */

  const expectedDimensions =
    buildExpectedDimensions(
      matrix
    );

  /*
   * 3. Dimensions / indicateurs
   */

  const dimensionProblems =
    checkDimensions(
      expectedDimensions,
      questionnaire
    );

  /*
   * 4. Objectifs
   */

  const objectiveProblems =
    checkObjectives(
      research,
      questionnaire
    );

  /*
   * 5. Fusion
   */

  const missingCoverage = [
    ...dimensionProblems,
    ...objectiveProblems,
  ];

  /*
   * 6. Doublons
   */

  const duplicateQuestions =
    findDuplicateQuestions(
      questionnaire
    );

  /*
   * 7. Questions faibles
   */

  const weakQuestions =
    findWeakQuestions(
      questionnaire
    );

  /*
   * 8. Score
   */

  const score =
    calculateQualityScore(
      matrix,
      missingCoverage,
      duplicateQuestions,
      weakQuestions
    );

  /*
   * 9. Recommandations
   */

  const recommendations =
    buildRecommendations(
      missingCoverage,
      duplicateQuestions,
      weakQuestions,
      matrix
    );

  /*
   * 10. État final
   */

  const complete =
    score >= 90 &&
    missingCoverage.length ===
      0 &&
    duplicateQuestions.length ===
      0;

  return {
    matrix,

    expectedDimensions,

    missingCoverage,

    duplicateQuestions,

    weakQuestions,

    score,

    complete,

    recommendations,
  };
}