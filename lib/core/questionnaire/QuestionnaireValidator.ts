import type {
  GeneratedQuestionnaire,
} from "./QuestionnaireTypes";

export interface QuestionnaireValidationResult {
  valid: boolean;
  score: number;
  errors: string[];
  warnings: string[];
}

export function validateQuestionnaire(
  questionnaire: GeneratedQuestionnaire
): QuestionnaireValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // ==========================
  // Vérifications générales
  // ==========================

  if (!questionnaire.title.trim()) {
    errors.push(
      "Le questionnaire ne possède pas de titre."
    );
  }

  if (questionnaire.sections.length === 0) {
    errors.push(
      "Aucune section n'a été générée."
    );
  }

  if (questionnaire.variables.length === 0) {
    errors.push(
      "Aucune variable de recherche n'a été identifiée."
    );
  }

  // ==========================
  // Questions
  // ==========================

  const questions =
    questionnaire.sections.flatMap(
      (section) => section.questions
    );

  if (questions.length === 0) {
    errors.push(
      "Aucune question n'a été générée."
    );
  }

  // ==========================
  // Vérification des IDs
  // ==========================

  const questionIds = new Set<string>();

  for (const question of questions) {
    if (questionIds.has(question.id)) {
      errors.push(
        `Identifiant de question dupliqué : ${question.id}`
      );
    }

    questionIds.add(question.id);

    // ==========================
    // Texte
    // ==========================

    if (!question.text.trim()) {
      errors.push(
        `La question ${question.number} ne possède pas de texte.`
      );
    }

    // ==========================
    // Modalités de réponse
    // ==========================

    if (
      question.type !== "text" &&
      question.type !== "long_text" &&
      (!question.options ||
        question.options.length === 0) &&
      (!question.scale ||
        question.scale.length === 0)
    ) {
      warnings.push(
        `La question ${question.number} ne possède aucune modalité de réponse.`
      );
    }

    // ==========================
    // Questions analytiques
    // ==========================

    if (
      question.type === "likert" &&
      !question.variable
    ) {
      warnings.push(
        `La question ${question.number} est une question Likert mais n'est rattachée à aucune variable.`
      );
    }

    if (
      question.variable &&
      !question.dimension
    ) {
      warnings.push(
        `La question ${question.number} est rattachée à une variable mais aucune dimension n'est précisée.`
      );
    }

    if (
      question.dimension &&
      !question.indicator
    ) {
      warnings.push(
        `La question ${question.number} possède une dimension mais aucun indicateur précis.`
      );
    }
  }

  // ==========================
  // Variables
  // ==========================

  const variableIndependent =
    questionnaire.variables.find(
      (variable) =>
        variable.role === "independent"
    );

  const variableDependent =
    questionnaire.variables.find(
      (variable) =>
        variable.role === "dependent"
    );

  if (!variableIndependent) {
    warnings.push(
      "La variable indépendante n'a pas été identifiée."
    );
  } else {
    if (
      variableIndependent.dimensions.length === 0
    ) {
      warnings.push(
        "La variable indépendante ne possède aucune dimension."
      );
    }

    if (
      variableIndependent.indicators.length === 0
    ) {
      warnings.push(
        "La variable indépendante ne possède aucun indicateur."
      );
    }
  }

  if (!variableDependent) {
    warnings.push(
      "La variable dépendante n'a pas été identifiée."
    );
  } else {
    if (
      variableDependent.dimensions.length === 0
    ) {
      warnings.push(
        "La variable dépendante ne possède aucune dimension."
      );
    }

    if (
      variableDependent.indicators.length === 0
    ) {
      warnings.push(
        "La variable dépendante ne possède aucun indicateur."
      );
    }
  }

  // ==========================
  // Cohérence des numéros
  // ==========================

  const numbers = questions.map(
    (question) => question.number
  );

  const uniqueNumbers =
    new Set(numbers);

  if (
    uniqueNumbers.size !== numbers.length
  ) {
    warnings.push(
      "Certains numéros de questions sont dupliqués."
    );
  }

  // ==========================
  // Score
  // ==========================

  const score = Math.max(
    0,
    Math.min(
      100,
      100 -
        errors.length * 20 -
        warnings.length * 5
    )
  );

  return {
    valid: errors.length === 0,
    score,
    errors,
    warnings,
  };
}