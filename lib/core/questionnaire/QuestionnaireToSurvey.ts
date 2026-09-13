// ============================================================
// ACADIA — CONVERSION QUESTIONNAIRE RECHERCHE → SURVEY (Bloc C, 11/09/2026)
//
// Convertit un GeneratedQuestionnaire déjà accepté par l'étudiant
// vers le format attendu par SurveyStore.createSurvey(), pour
// réutiliser tel quel tout le pipeline Survey existant (lien
// public, logo, collecte) — jamais un second système de
// publication. Ne modifie ni ne réinterprète le contenu des
// questions : seule la forme change.
// ============================================================

import type { ResearchProject } from "../research/ResearchTypes";
import type { GeneratedQuestionnaire, QuestionnaireQuestion } from "./QuestionnaireTypes";
import { researchTypeToSurveyType } from "./QuestionnaireSurveyMapping";

export interface SurveyPublishPayload {
  categories: { label: string; order: number }[];
  questions: {
    section?: string;
    order: number;
    type: string;
    text: string;
    required?: boolean;
    variable?: string;
    indicator?: string;
    options?: { label: string; value: string; order: number }[];
  }[];
  excludedCount: number;
}

function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function toSurveyOptions(question: QuestionnaireQuestion): { label: string; value: string; order: number }[] | undefined {
  const source = question.options ?? question.scale;
  if (!source || source.length === 0) return undefined;
  return source.map((o, i) => ({ label: o.label, value: o.value || slugify(o.label), order: i }));
}

export function toSurveyPayload(_project: ResearchProject, questionnaire: GeneratedQuestionnaire): SurveyPublishPayload {
  let order = 0;
  let excludedCount = 0;
  const questions: SurveyPublishPayload["questions"] = [];

  for (const section of questionnaire.sections) {
    for (const question of section.questions) {
      const surveyType = researchTypeToSurveyType(question.type);
      if (!surveyType) {
        excludedCount++;
        continue;
      }
      questions.push({
        section: section.title,
        order: order++,
        type: surveyType,
        text: question.text,
        required: question.required,
        variable: question.variable,
        indicator: question.indicator,
        options: toSurveyOptions(question),
      });
    }
  }

  return { categories: [], questions, excludedCount };
}
