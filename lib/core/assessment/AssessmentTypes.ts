// ============================================================
// ACADIA — ACADEMIC ASSESSMENT : CONTRATS TYPESCRIPT (mission dédiée)
//
// Statuts en String côté Prisma (convention déjà établie dans tout ce
// schéma, voir prisma/schema.prisma) — ces unions TS sont la SEULE
// source de vérité sur les valeurs autorisées, validées à l'écriture
// par les services (lib/server/assessment/*).
// ============================================================

// ------------------------------------------------------------
// ASSIGNMENT
// ------------------------------------------------------------

export const ASSIGNMENT_TYPES = ["TP", "TD", "HOMEWORK", "QUIZ", "INTERROGATION", "EXAM"] as const;
export type AssignmentType = (typeof ASSIGNMENT_TYPES)[number];

/** Seul type réellement activé pour la création dans cette mission (mission §6) — les autres existent architecturalement mais sont refusés par AssignmentService.createAssignment(). */
export const ACTIVE_ASSIGNMENT_TYPES: readonly AssignmentType[] = ["TP"];

export const ASSIGNMENT_STATUSES = ["draft", "published", "closed", "archived"] as const;
export type AssignmentStatus = (typeof ASSIGNMENT_STATUSES)[number];

// ------------------------------------------------------------
// QUESTION
// ------------------------------------------------------------

export const QUESTION_TYPES = [
  "OPEN_TEXT",
  "SHORT_ANSWER",
  "NUMERIC",
  "MULTIPLE_CHOICE",
  "TRUE_FALSE",
  "CALCULATION",
] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

// ------------------------------------------------------------
// ASSESSMENT SUBMISSION (jamais "Submission" seul — voir audit :
// collision avec le modèle existant de supervision de mémoire)
// ------------------------------------------------------------

export const ASSESSMENT_SUBMISSION_STATUSES = ["draft", "submitted", "under_review", "graded", "returned"] as const;
export type AssessmentSubmissionStatus = (typeof ASSESSMENT_SUBMISSION_STATUSES)[number];

// ------------------------------------------------------------
// EVALUATION — AI proposes, teacher validates (mission §18)
// ------------------------------------------------------------

export const EVALUATION_STATUSES = [
  "ai_proposed",
  "human_review",
  "accepted",
  "modified",
  "rejected",
  "finalized",
] as const;
export type EvaluationStatus = (typeof EVALUATION_STATUSES)[number];

export type TeacherDecision = "accept" | "modify" | "reject";

// ------------------------------------------------------------
// FEEDBACK — l'origine ne doit jamais être ambiguë (mission §15)
// ------------------------------------------------------------

export const FEEDBACK_SOURCES = ["ai", "teacher"] as const;
export type FeedbackSource = (typeof FEEDBACK_SOURCES)[number];

// ------------------------------------------------------------
// SCORE RULES (mission §17) — 0 <= score <= maxScore, jamais négatif.
// Aucun barème fixe codé en dur : maxScore est TOUJOURS fourni par
// l'appelant (Question.maxScore / RubricCriterion.maxScore), jamais une
// constante "/10" ou "/5" ici.
// ------------------------------------------------------------

export class InvalidScoreError extends Error {}

export function assertValidScore(score: number, maxScore: number, context: string): void {
  if (!Number.isFinite(maxScore) || maxScore < 0) {
    throw new InvalidScoreError(`${context} : maxScore invalide (${maxScore}).`);
  }
  if (!Number.isFinite(score)) {
    throw new InvalidScoreError(`${context} : score invalide (${score}).`);
  }
  if (score < 0) {
    throw new InvalidScoreError(`${context} : score négatif interdit (${score}).`);
  }
  if (score > maxScore) {
    throw new InvalidScoreError(`${context} : score (${score}) supérieur à maxScore (${maxScore}).`);
  }
}

// ------------------------------------------------------------
// ERREURS D'AUTORISATION — même style que
// lib/server/billing/EntitlementService.ts (EntitlementRequiredError) :
// une classe d'erreur typée par domaine, traduite en 401/403 par la
// route appelante, jamais un throw générique.
// ------------------------------------------------------------

export class AssessmentForbiddenError extends Error {}
export class AssessmentNotFoundError extends Error {}
export class InvalidAssignmentStateError extends Error {}
export class InvalidSubmissionStateError extends Error {}

/** Course concurrente perdue (ex. deux éditions simultanées de la même question) — voir Question.@@unique([assignmentId, groupKey, version]), mission §16. Traduite en 409 par la route appelante. */
export class AssessmentConflictError extends Error {}

// ============================================================
// QUESTION CONTENT (mission Assignment Builder + TP Intelligence, §9/§10)
//
// Contenu structuré propre à chaque type de question OBJECTIVE —
// stocké dans Question.metadata (colonne JSON déjà existante depuis la
// Mission 3, AUCUNE migration nécessaire pour ce contrat). OPEN_TEXT/
// SHORT_ANSWER n'ont pas de contenu structuré : ils s'appuient sur
// expectedAnswer + Rubric (déjà couverts par la mission 3).
//
// CALCULATION (§10) reste volontairement préparatoire : aucun moteur de
// correction n'est construit ici — seule la structure permettant à un
// futur moteur de distinguer résultat/méthode/étapes/unité est définie.
// Une réponse différente du résultat attendu n'est JAMAIS automatiquement
// fausse — ce contrat ne sert qu'à donner des repères au futur correcteur.
// ============================================================

export interface MultipleChoiceOption {
  id: string;
  text: string;
}

export interface MultipleChoiceContent {
  kind: "MULTIPLE_CHOICE";
  options: MultipleChoiceOption[];
  correctOptionId: string;
  explanation?: string;
}

export interface TrueFalseContent {
  kind: "TRUE_FALSE";
  correctAnswer: boolean;
  explanation?: string;
}

export interface NumericContent {
  kind: "NUMERIC";
  exactValue: number;
  /** Marge d'erreur acceptée autour de exactValue — jamais une comparaison de chaîne exacte. */
  tolerance?: number;
  unit?: string;
}

/** Préparatoire uniquement (mission §10) — jamais consommé par un moteur de correction dans cette mission. */
export interface CalculationContent {
  kind: "CALCULATION";
  expectedResult?: number;
  unit?: string;
  expectedMethod?: string;
  expectedSteps?: string[];
}

export type QuestionContent = MultipleChoiceContent | TrueFalseContent | NumericContent | CalculationContent;

/** Types pour lesquels une structure Question.metadata est exigée à la publication (mission §11.H). OPEN_TEXT/SHORT_ANSWER/CALCULATION restent libres (CALCULATION : la structure est utile mais non obligatoire, voir §10 — jamais de blocage sur un contrat encore préparatoire). */
export const TYPES_REQUIRING_STRUCTURED_CONTENT: readonly QuestionType[] = ["MULTIPLE_CHOICE", "TRUE_FALSE", "NUMERIC"];

export class InvalidQuestionContentError extends Error {}

/** Valide qu'un contenu structuré correspond réellement à son type déclaré, avec des données exploitables (mission §11.H : "les types de questions possèdent les données nécessaires"). */
export function validateQuestionContent(type: QuestionType, content: unknown, maxScore: number): void {
  if (type === "MULTIPLE_CHOICE") {
    const c = content as Partial<MultipleChoiceContent> | undefined;
    if (!c || c.kind !== "MULTIPLE_CHOICE") {
      throw new InvalidQuestionContentError("Question MULTIPLE_CHOICE : contenu structuré manquant.");
    }
    if (!Array.isArray(c.options) || c.options.length < 2) {
      throw new InvalidQuestionContentError("Question MULTIPLE_CHOICE : au moins deux options sont requises.");
    }
    if (!c.correctOptionId || !c.options.some((o) => o.id === c.correctOptionId)) {
      throw new InvalidQuestionContentError("Question MULTIPLE_CHOICE : correctOptionId doit désigner une option existante.");
    }
  } else if (type === "TRUE_FALSE") {
    const c = content as Partial<TrueFalseContent> | undefined;
    if (!c || c.kind !== "TRUE_FALSE" || typeof c.correctAnswer !== "boolean") {
      throw new InvalidQuestionContentError("Question TRUE_FALSE : correctAnswer (booléen) est requis.");
    }
  } else if (type === "NUMERIC") {
    const c = content as Partial<NumericContent> | undefined;
    if (!c || c.kind !== "NUMERIC" || typeof c.exactValue !== "number" || !Number.isFinite(c.exactValue)) {
      throw new InvalidQuestionContentError("Question NUMERIC : exactValue (nombre) est requis.");
    }
    if (c.tolerance !== undefined && (typeof c.tolerance !== "number" || c.tolerance < 0)) {
      throw new InvalidQuestionContentError("Question NUMERIC : tolerance doit être un nombre positif ou absent.");
    }
  }
  void maxScore; // réservé — aucune règle croisée maxScore/contenu n'est exigée pour l'instant.
}

// ============================================================
// STUDENT ANSWER CONTENT (mission Student Submission Engine, §11-§16)
//
// Ce que l'ÉTUDIANT transporte dans AssessmentAnswer.answerData — un
// contrat distinct de QuestionContent (ci-dessus, qui transporte ce que
// L'ENSEIGNANT a défini, y compris la bonne réponse). Ne JAMAIS
// confondre les deux : un AssessmentAnswer ne doit jamais contenir
// correctOptionId/correctAnswer/exactValue attendus — uniquement ce que
// l'étudiant a réellement soumis.
//
// OPEN_TEXT/SHORT_ANSWER n'ont pas de answerData structuré : ils
// utilisent AssessmentAnswer.answerText directement (déjà le champ
// prévu par le modèle Mission 3).
// ============================================================

export interface MultipleChoiceAnswerData {
  kind: "MULTIPLE_CHOICE";
  selectedOptionId: string;
}

export interface TrueFalseAnswerData {
  kind: "TRUE_FALSE";
  value: boolean;
}

export interface NumericAnswerData {
  kind: "NUMERIC";
  value: number;
}

/** Préparatoire (mission §16) — aucune correction n'est jamais déduite d'une différence de résultat. */
export interface CalculationAnswerData {
  kind: "CALCULATION";
  result?: number;
  formula?: string;
  steps?: string[];
  unit?: string;
  reasoning?: string;
}

export type StudentAnswerContent = MultipleChoiceAnswerData | TrueFalseAnswerData | NumericAnswerData | CalculationAnswerData;

export class InvalidAnswerError extends Error {}

const SHORT_ANSWER_MAX_LENGTH = 500;
const OPEN_TEXT_MAX_LENGTH = 20000;

export interface AnswerInput {
  answerText?: string;
  answerData?: unknown;
  attachmentRef?: string;
}

/**
 * Valide une réponse ÉTUDIANTE selon le type réel de la question
 * (mission §11-§16) — jamais de jugement sur la justesse (ça appartient
 * au futur moteur de correction, mission §12 : "NE PAS décider
 * maintenant si la réponse est correcte"), uniquement sur la FORME :
 * une réponse MULTIPLE_CHOICE doit désigner une option qui existe
 * réellement, une réponse TRUE_FALSE doit être un booléen strict
 * (jamais une chaîne quelconque, mission §14), une réponse NUMERIC doit
 * être un nombre fini.
 *
 * `questionContent` est le contenu structuré de la question (déjà
 * validé à la publication par QuestionService/AssignmentValidation) —
 * fourni par l'appelant pour ne jamais re-parser Question.metadata deux
 * fois inutilement.
 */
export function validateAnswerForQuestion(
  type: QuestionType,
  input: AnswerInput,
  questionContent: QuestionContent | null
): void {
  if (type === "OPEN_TEXT") {
    if (!input.answerText?.trim() && !input.attachmentRef) {
      throw new InvalidAnswerError("Une réponse OPEN_TEXT doit contenir du texte ou une pièce jointe.");
    }
    if (input.answerText && input.answerText.length > OPEN_TEXT_MAX_LENGTH) {
      throw new InvalidAnswerError(`Réponse trop longue (max ${OPEN_TEXT_MAX_LENGTH} caractères).`);
    }
    return;
  }

  if (type === "SHORT_ANSWER") {
    if (!input.answerText?.trim() && !input.attachmentRef) {
      throw new InvalidAnswerError("Une réponse SHORT_ANSWER doit contenir du texte ou une pièce jointe.");
    }
    if (input.answerText && input.answerText.length > SHORT_ANSWER_MAX_LENGTH) {
      throw new InvalidAnswerError(`Réponse courte trop longue (max ${SHORT_ANSWER_MAX_LENGTH} caractères).`);
    }
    return;
  }

  if (type === "MULTIPLE_CHOICE") {
    const data = input.answerData as Partial<MultipleChoiceAnswerData> | undefined;
    if (!data || data.kind !== "MULTIPLE_CHOICE" || !data.selectedOptionId) {
      throw new InvalidAnswerError("Une réponse MULTIPLE_CHOICE doit désigner une option sélectionnée (selectedOptionId).");
    }
    if (!questionContent || questionContent.kind !== "MULTIPLE_CHOICE") {
      throw new InvalidAnswerError("Contenu de la question MULTIPLE_CHOICE introuvable — impossible de valider l'option.");
    }
    if (!questionContent.options.some((o) => o.id === data.selectedOptionId)) {
      throw new InvalidAnswerError("L'option sélectionnée n'existe pas pour cette question.");
    }
    return;
  }

  if (type === "TRUE_FALSE") {
    const data = input.answerData as Partial<TrueFalseAnswerData> | undefined;
    if (!data || data.kind !== "TRUE_FALSE" || typeof data.value !== "boolean") {
      throw new InvalidAnswerError("Une réponse TRUE_FALSE doit être un booléen strict (value: true|false).");
    }
    return;
  }

  if (type === "NUMERIC") {
    const data = input.answerData as Partial<NumericAnswerData> | undefined;
    if (!data || data.kind !== "NUMERIC" || typeof data.value !== "number" || !Number.isFinite(data.value)) {
      throw new InvalidAnswerError("Une réponse NUMERIC doit être un nombre fini (value: number).");
    }
    return;
  }

  if (type === "CALCULATION") {
    const data = input.answerData as Partial<CalculationAnswerData> | undefined;
    const hasSomeContent =
      (data && (data.result !== undefined || data.formula || data.steps?.length || data.reasoning)) || input.answerText;
    if (!data || data.kind !== "CALCULATION" || !hasSomeContent) {
      throw new InvalidAnswerError("Une réponse CALCULATION doit contenir au moins un résultat, une formule, des étapes ou un raisonnement.");
    }
  }
}

// ============================================================
// MACHINE D'ÉTAT — AssessmentSubmission (mission Student Submission
// Engine §21) — centralise ce qui était jusqu'ici vérifié de façon
// ad-hoc dans chaque fonction de SubmissionService/EvaluationService
// (Missions 3/4). Comportement inchangé, uniquement rendu explicite et
// auditable en un seul endroit — aucune IA, une simple table de
// transitions déterministe.
//
// "returned" n'a AUCUNE transition sortante ici : une resoumission ne
// mute jamais la ligne existante, elle crée une NOUVELLE ligne
// (version+1, status="draft") — voir SubmissionService.resubmitAfterReturn.
// ============================================================

export const ASSESSMENT_SUBMISSION_TRANSITIONS: Record<AssessmentSubmissionStatus, readonly AssessmentSubmissionStatus[]> = {
  draft: ["submitted"],
  submitted: ["under_review", "graded", "returned"],
  under_review: ["graded", "returned"],
  graded: ["returned"],
  returned: [],
};

export function canTransitionSubmissionStatus(from: AssessmentSubmissionStatus, to: AssessmentSubmissionStatus): boolean {
  return ASSESSMENT_SUBMISSION_TRANSITIONS[from]?.includes(to) ?? false;
}
