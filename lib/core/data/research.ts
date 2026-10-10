import type { GeneratedQuestionnaire, QuestionnaireQuestion } from "@/lib/core/questionnaire/QuestionnaireTypes";
import type { ProposalStatus, ResearchProject, ResearchVariable } from "@/lib/core/research/ResearchTypes";
import type { ResearchData } from "@/types/Research";

import type { ColumnMapping, ImportedColumn, Provenance, ResearchFact } from "./types";

/**
 * Liaison entre les colonnes observées et le contexte méthodologique de la recherche.
 * Règle : on distingue ce que le chercheur a fourni (explicit), ce qu'ACADIA a proposé sans
 * confirmation (proposed), et ce qui est inconnu. Rien n'est complété à la place du chercheur.
 */

const fromStatus = (status: ProposalStatus | undefined): Provenance =>
  status === "accepted" ? "explicit" : status === "proposed" || status === "draft" ? "proposed" : "unknown";

const PROVENANCE_NOTE: Record<Provenance, string | undefined> = {
  explicit: undefined,
  proposed: "Proposé par ACADIA, non confirmé par le chercheur.",
  inferred: "Déduit automatiquement.",
  unknown: "Information non disponible.",
};

const fact = (key: string, label: string, value: string | undefined, provenance: Provenance): ResearchFact => ({
  key,
  label,
  value: value?.trim() ? value.trim() : undefined,
  provenance: value?.trim() ? provenance : "unknown",
  note: PROVENANCE_NOTE[value?.trim() ? provenance : "unknown"],
});

const ROLE_LABELS: Record<ResearchVariable["role"], string> = {
  independent: "indépendante",
  dependent: "dépendante",
  mediating: "médiatrice",
  moderating: "modératrice",
  control: "de contrôle",
  descriptive: "descriptive",
};

export function summarizeResearch(input: {
  project?: ResearchProject | null;
  data?: ResearchData | null;
  questionnaire?: GeneratedQuestionnaire | null;
  sampleSize?: number | null;
}): ResearchFact[] {
  const { project, data, questionnaire } = input;
  const facts: ResearchFact[] = [];

  // Les champs saisis dans l'assistant de recherche sont fournis par le chercheur (explicit).
  facts.push(fact("title", "Sujet", data?.title || project?.title, "explicit"));
  facts.push(
    project?.problem?.statement
      ? fact("problem", "Problématique", project.problem.statement, fromStatus(project.problem.status))
      : fact("problem", "Problématique", data?.problem, "explicit"),
  );
  const question = project?.researchQuestions?.find((q) => q.type !== "secondary") ?? project?.researchQuestions?.[0];
  facts.push(fact("research_question", "Question de recherche", question?.text, fromStatus(question?.status)));
  const general = project?.objectives?.find((o) => o.role === "general");
  facts.push(general ? fact("general_objective", "Objectif général", general.text, fromStatus(general.status)) : fact("general_objective", "Objectif général", data?.objective, "explicit"));
  const specific = project?.objectives?.filter((o) => o.role === "specific") ?? [];
  const specificTexts = specific.length ? specific.map((o) => o.text) : (data?.objectives ?? []).filter((o) => o.trim());
  facts.push(
    fact(
      "specific_objectives",
      "Objectifs spécifiques",
      specificTexts.length ? specificTexts.join(" ; ") : undefined,
      specific.length ? (specific.every((o) => o.status === "accepted") ? "explicit" : "proposed") : "explicit",
    ),
  );
  const hypotheses = project?.hypotheses ?? [];
  facts.push(
    hypotheses.length
      ? fact("hypotheses", "Hypothèses", hypotheses.map((h) => h.statement).join(" ; "), hypotheses.every((h) => h.status === "accepted") ? "explicit" : "proposed")
      : { key: "hypotheses", label: "Hypothèses", provenance: "unknown", note: "Aucune hypothèse formulée (normal pour une étude descriptive ou exploratoire)." },
  );
  facts.push(fact("approach", "Approche méthodologique", data?.researchType || project?.researchType, "explicit"));
  facts.push(fact("population", "Population", data?.population, "explicit"));
  facts.push(fact("population_size", "Taille de la population", data?.populationSize ? String(data.populationSize) : undefined, "explicit"));
  facts.push(fact("sample_size", "Taille d'échantillon recommandée", input.sampleSize ? `${input.sampleSize} (formule de Yamane)` : undefined, "inferred"));
  facts.push(fact("instrument", "Instrument de collecte", questionnaire ? `Questionnaire ACADIA « ${questionnaire.title} » (${questionnaire.totalQuestions} questions)` : data?.collectionMethod, "explicit"));
  const variables = project?.variables ?? [];
  facts.push(
    variables.length
      ? fact(
          "variables",
          "Variables de recherche",
          variables.map((v) => `${v.name} (${ROLE_LABELS[v.role]})`).join(" ; "),
          variables.every((v) => v.status === "accepted") ? "explicit" : "proposed",
        )
      : { key: "variables", label: "Variables de recherche", provenance: "unknown", note: "Aucune variable de recherche définie." },
  );
  return facts;
}

export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function tokens(text: string): Set<string> {
  return new Set(normalizeText(text).split(" ").filter((token) => token.length >= 3));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / (a.size + b.size - intersection);
}

export function allQuestions(questionnaire: GeneratedQuestionnaire): QuestionnaireQuestion[] {
  return questionnaire.sections.flatMap((section) => section.questions);
}

function findResearchVariable(project: ResearchProject | null | undefined, name: string | undefined): ResearchVariable | undefined {
  if (!project || !name) return undefined;
  const target = normalizeText(name);
  return project.variables.find((variable) => normalizeText(variable.name) === target);
}

export function mappingFromQuestion(
  column: number,
  question: QuestionnaireQuestion,
  source: ColumnMapping["source"],
  confidence: ColumnMapping["confidence"],
  reasons: string[],
  project?: ResearchProject | null,
): ColumnMapping {
  const scale = question.scale ?? question.options;
  return {
    column,
    questionId: question.id,
    questionNumber: question.number,
    questionText: question.text,
    questionType: question.type,
    variable: question.variable,
    researchVariableId: findResearchVariable(project, question.variable)?.id,
    dimension: question.dimension,
    indicator: question.indicator,
    expectedValues: scale?.map((option) => ({ value: option.value, label: option.label })),
    source,
    confidence,
    confirmed: source === "user",
    reasons,
  };
}

/**
 * Correspondances proposées entre colonnes et questions. Jamais confirmées automatiquement ;
 * une question n'est proposée que pour une seule colonne (meilleure correspondance).
 * Le nom d'une colonne n'est pas présumé être un code de variable ACADIA.
 */
export function proposeMappings(
  columns: ImportedColumn[],
  questionnaire: GeneratedQuestionnaire | null | undefined,
  project?: ResearchProject | null,
): ColumnMapping[] {
  if (!questionnaire) return [];
  const questions = allQuestions(questionnaire);
  const candidates: Array<{ column: number; question: QuestionnaireQuestion; score: number; mapping: ColumnMapping }> = [];

  for (const column of columns) {
    const header = column.originalHeader;
    const normalized = normalizeText(header);
    if (!normalized) continue;
    const code = /^(?:q|question)\s*0*(\d+)\b/.exec(normalized);
    const headerTokens = tokens(header);

    for (const question of questions) {
      const questionNormalized = normalizeText(question.text);
      if (normalized === questionNormalized) {
        candidates.push({ column: column.index, question, score: 3, mapping: mappingFromQuestion(column.index, question, "auto_exact_text", "high", ["L'en-tête reprend exactement le texte de la question."], project) });
        continue;
      }
      if (code && Number(code[1]) === question.number) {
        candidates.push({
          column: column.index,
          question,
          score: 2,
          mapping: mappingFromQuestion(column.index, question, "auto_question_code", "medium", [`L'en-tête « ${header.trim()} » évoque la question n° ${question.number} ; la numérotation du fichier peut différer : à confirmer.`], project),
        });
        continue;
      }
      const similarity = jaccard(headerTokens, tokens(question.text));
      if (similarity >= 0.6) {
        candidates.push({
          column: column.index,
          question,
          score: similarity,
          mapping: mappingFromQuestion(column.index, question, "auto_similar_text", "low", [`L'en-tête ressemble au texte de la question (${Math.round(similarity * 100)} % de mots communs) : à confirmer.`], project),
        });
      }
    }
  }

  candidates.sort((a, b) => b.score - a.score);
  const usedColumns = new Set<number>();
  const usedQuestions = new Set<string>();
  const result: ColumnMapping[] = [];
  for (const candidate of candidates) {
    if (usedColumns.has(candidate.column) || usedQuestions.has(candidate.question.id)) continue;
    usedColumns.add(candidate.column);
    usedQuestions.add(candidate.question.id);
    result.push(candidate.mapping);
  }
  return result.sort((a, b) => a.column - b.column);
}

export { ROLE_LABELS as RESEARCH_ROLE_LABELS };
