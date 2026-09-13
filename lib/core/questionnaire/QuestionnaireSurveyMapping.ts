// ============================================================
// ACADIA — CORRESPONDANCE DE TYPES RESEARCH ↔ SURVEY (Bloc C/D, 11/09/2026)
//
// Deux modèles de questionnaire coexistent dans le repo : celui de
// l'espace recherche (QuestionnaireTypes.ts, avec traçabilité
// variable/dimension/indicateur) et celui du module Survey
// (SurveyTypes.ts, mature, avec lien public/logo/collecte). Ce
// fichier centralise la correspondance de vocabulaire entre les
// deux, réutilisé à la fois par la publication (Bloc C) et l'import
// (Bloc D) — jamais dupliqué.
//
// "conditional" (Research) n'a aucun équivalent Survey — la
// publication exclut ces questions plutôt que de les aplatir en
// question simple, ce qui changerait leur sens. Voir
// QuestionnaireToSurvey.ts.
// ============================================================

import type { QuestionType } from "./QuestionnaireTypes";

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

const RESEARCH_TO_SURVEY: Record<Exclude<QuestionType, "conditional">, SurveyQuestionType> = {
  single_choice: "single_choice",
  multiple_choice: "multiple_choice",
  likert: "scale",
  yes_no: "boolean",
  number: "number",
  text: "short_text",
  long_text: "long_text",
  frequency: "scale",
  importance: "scale",
  date: "date",
  percentage: "number",
};

const SURVEY_TO_RESEARCH: Record<SurveyQuestionType, QuestionType> = {
  short_text: "text",
  long_text: "long_text",
  single_choice: "single_choice",
  multiple_choice: "multiple_choice",
  scale: "likert",
  boolean: "yes_no",
  number: "number",
  age: "number",
  date: "date",
  institution: "text",
  faculty: "text",
  level: "text",
  category: "single_choice",
};

/** `undefined` pour "conditional", qui n'a pas d'équivalent Survey. */
export function researchTypeToSurveyType(type: QuestionType): SurveyQuestionType | undefined {
  if (type === "conditional") return undefined;
  return RESEARCH_TO_SURVEY[type];
}

export function surveyTypeToResearchType(type: SurveyQuestionType): QuestionType {
  return SURVEY_TO_RESEARCH[type] ?? "text";
}
