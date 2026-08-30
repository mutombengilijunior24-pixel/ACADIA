// ============================================================
// ACADIA — MODULE SURVEY : TYPES DE DOMAINE
//
// Module additif, indépendant du système Research. Aucune
// institution codée en dur — UNILU n'est qu'une donnée de
// démonstration comme une autre.
// ============================================================

export type SurveyStatus = "draft" | "active" | "suspended" | "closed";

export type SurveyQuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multiple_choice"
  | "scale"
  | "boolean"
  | "number"
  | "age"
  | "date"
  | "institution"
  | "faculty"
  | "level"
  | "category";

export interface SurveyOption {
  id: string;
  label: string;
  value: string;
  order: number;
}

export interface SurveyQuestion {
  id: string;
  section?: string;
  order: number;
  type: SurveyQuestionType;
  text: string;
  required: boolean;
  variable?: string;
  indicator?: string;
  options: SurveyOption[];
  /** Vide/absent = visible pour toutes les catégories de répondants. */
  visibleForCategoryIds?: string[];
}

export interface SurveyCategory {
  id: string;
  label: string;
  order: number;
}

export interface Survey {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  objective?: string;
  problem?: string;
  targetAudience?: string;
  institution?: string;
  institutionLogoUrl?: string;
  status: SurveyStatus;
  isAnonymous: boolean;
  targetResponses?: number;
  startDate?: string;
  endDate?: string;
  publicId?: string;
  createdAt: string;
  updatedAt: string;
  questions: SurveyQuestion[];
  categories: SurveyCategory[];
}

export interface SurveyListItem {
  id: string;
  title: string;
  status: SurveyStatus;
  createdAt: string;
  updatedAt: string;
  publicId?: string;
  targetResponses?: number;
  responseCount: number;
}

export interface SurveyAnswerInput {
  questionId: string;
  optionId?: string;
  optionIds?: string[]; // choix multiple
  valueText?: string;
}

export interface SurveyResponseInput {
  categoryId?: string;
  institution?: string;
  faculty?: string;
  level?: string;
  age?: number;
  sex?: string;
  answers: SurveyAnswerInput[];
}

export interface SurveyResponseSummary {
  id: string;
  categoryId?: string;
  categoryLabel?: string;
  institution?: string;
  faculty?: string;
  level?: string;
  age?: number;
  sex?: string;
  status: string;
  startedAt: string;
  completedAt?: string;
}

export interface SurveyResponseDetail extends SurveyResponseSummary {
  answers: { questionId: string; questionText: string; optionLabel?: string; valueText?: string }[];
}

export interface SurveyStats {
  totalResponses: number;
  completedResponses: number;
  todayResponses: number;
  last24hResponses: number;
  targetResponses?: number;
  percentOfTarget?: number;
  lastResponseAt?: string;
  /** Voir SurveyAnalyticsEngine.computeCompletionRate — jamais une valeur inventée, undefined si non calculable. */
  completionRate?: number;
}

export interface SurveyQuestionFrequency {
  questionId: string;
  questionText: string;
  type: SurveyQuestionType;
  /** Nombre de répondants distincts ayant répondu à cette question (dénominateur des pourcentages). */
  respondentCount: number;
  /** Une entrée par option (choix) ou par valeur distincte rencontrée (texte/nombre). */
  distribution: { label: string; count: number; percent: number }[];
  /** Uniquement pour les types numériques (number/age/scale). */
  average?: number;
  median?: number;
}
