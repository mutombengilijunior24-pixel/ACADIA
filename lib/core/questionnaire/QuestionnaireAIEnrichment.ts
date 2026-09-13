// ============================================================
// ACADIA — ENRICHISSEMENT IA DU QUESTIONNAIRE (Bloc A, 11/09/2026)
//
// Ne modifie PAS QuestionnaireGenerationEngine.ts (moteur protégé,
// déterministe, structure/traçabilité inchangées). Prend en entrée
// un GeneratedQuestionnaire DÉJÀ construit par ce moteur et
// reformule uniquement le texte/type/options de chaque question,
// via lib/ai/openai/ResearchQuestionnaireAI.ts — jamais côté
// navigateur (voir lib/ai/openai/client.ts).
//
// Sécurité de repli : si l'appel IA échoue, ou si un indicateur
// n'est pas revenu dans la réponse, la question déterministe
// d'origine (produite par le moteur protégé) est conservée telle
// quelle — jamais de questionnaire cassé ou incomplet.
// ============================================================

import type { ResearchProject } from "../research/ResearchTypes";
import type { GeneratedQuestionnaire, QuestionnaireQuestion, QuestionnaireOption } from "./QuestionnaireTypes";
import { LIKERT_OPTIONS, FREQUENCY_OPTIONS, YES_NO_OPTIONS } from "./QuestionnaireEngine";
import {
  formulateQuestionnaireQuestions,
  type AIQuestionnaireItem,
  type AIQuestionnaireFormulation,
  type AIQuestionType,
} from "@/lib/ai/openai/ResearchQuestionnaireAI";

function slugify(label: string): string {
  return label
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function optionsForFormulation(formulation: AIQuestionnaireFormulation): { options?: QuestionnaireOption[]; scale?: QuestionnaireOption[] } {
  switch (formulation.type) {
    case "frequency":
      return { scale: FREQUENCY_OPTIONS };
    case "yes_no":
      return { options: YES_NO_OPTIONS };
    case "likert":
      return { scale: LIKERT_OPTIONS };
    case "single_choice":
    case "multiple_choice":
      return {
        options: formulation.options.map((o) => ({ label: o.label, value: slugify(o.label) })),
      };
    default:
      return {};
  }
}

function mapType(type: AIQuestionType): QuestionnaireQuestion["type"] {
  return type;
}

export async function enrichQuestionnaireWithAI(
  project: ResearchProject,
  questionnaire: GeneratedQuestionnaire,
  tracking: { userId?: string | null } = {}
): Promise<GeneratedQuestionnaire> {
  const questions = questionnaire.sections.flatMap((s) => s.questions);
  const eligible = questions.filter((q) => q.indicatorId);

  if (eligible.length === 0) {
    return questionnaire;
  }

  // Corrélation par q.id (ex. "Q7", numéroté séquentiellement par le
  // moteur, garanti unique dans tout le questionnaire) — jamais par
  // indicatorId : ce dernier est renuméroté "indicator-1", "indicator-2"...
  // À L'INTÉRIEUR de chaque dimension par le moteur protégé, donc
  // identique pour des indicateurs totalement différents d'une
  // dimension à l'autre. L'utiliser comme clé fusionnerait à tort la
  // formulation de plusieurs indicateurs distincts.
  const items: AIQuestionnaireItem[] = eligible.map((q) => ({
    questionId: q.id,
    variableName: q.variable ?? "",
    variableRole: project.variables.find((v) => v.id === q.variableId)?.role ?? "",
    dimensionName: q.dimension ?? "",
    indicatorName: q.indicator ?? "",
    indicatorDescription:
      project.variables
        .find((v) => v.id === q.variableId)
        ?.dimensions?.find((d) => d.id === q.dimensionId)
        ?.indicators?.find((i) => i.id === q.indicatorId)?.description,
  }));

  const mainQuestion = project.researchQuestions.find((rq) => rq.type === "main")?.text;

  let formulations: AIQuestionnaireFormulation[];
  try {
    formulations = await formulateQuestionnaireQuestions(
      {
        projectTitle: project.title,
        domain: project.domain,
        researchQuestion: mainQuestion,
        population: project.understanding?.population,
        location: project.location,
      },
      items,
      { userId: tracking.userId, projectId: project.id }
    );
  } catch (error) {
    console.error("[ACADIA] Formulation IA du questionnaire indisponible, repli sur les questions déterministes :", error);
    return questionnaire;
  }

  const byQuestionId = new Map(formulations.map((f) => [f.questionId, f]));

  const enrichedSections = questionnaire.sections.map((section) => ({
    ...section,
    questions: section.questions.map((question): QuestionnaireQuestion => {
      const formulation = byQuestionId.get(question.id);
      if (!formulation) {
        return question;
      }

      const { options, scale } = optionsForFormulation(formulation);

      return {
        ...question,
        type: mapType(formulation.type),
        text: formulation.text,
        options,
        scale,
      };
    }),
  }));

  return {
    ...questionnaire,
    sections: enrichedSections,
  };
}
