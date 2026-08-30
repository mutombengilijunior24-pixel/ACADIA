// ============================================================
// ACADIA — SURVEY : DONNÉES PARTAGÉES POUR LES EXPORTS (P21)
//
// Une seule fonction de récupération des réponses individuelles,
// réutilisée par CSV, Excel et la feuille "Réponses" — jamais une
// deuxième requête réécrite pour chaque format. Respecte strictement
// les filtres actifs (jamais les données d'une autre enquête, jamais
// un export non filtré quand des filtres sont actifs). N'exporte
// jamais de donnée technique/sensible (id interne, ownerId,
// respondentKey, token) — uniquement ce qui concerne l'enquête et le
// répondant tel qu'il l'a lui-même renseigné.
// ============================================================

import { listSurveyResponses, type SurveyResponseFilters } from "./SurveyStore";
import { AGE_BUCKETS } from "@/lib/core/survey/SurveyAnalyticsEngine";
import { prisma } from "@/lib/server/db/prisma";
import type { Survey } from "@/lib/core/survey/SurveyTypes";

/** Filtres actifs communs à tous les endpoints d'export (P21) — mêmes paramètres que /stats et /crosstab. */
export function parseFiltersFromUrl(url: URL): SurveyResponseFilters {
  const ageBucketKey = url.searchParams.get("ageBucket") ?? undefined;
  const ageRange = ageBucketKey ? AGE_BUCKETS.find((b) => b.key === ageBucketKey) : undefined;
  return {
    institution: url.searchParams.get("institution") ?? undefined,
    faculty: url.searchParams.get("faculty") ?? undefined,
    level: url.searchParams.get("level") ?? undefined,
    categoryId: url.searchParams.get("categoryId") ?? undefined,
    ageMin: ageRange?.min,
    ageMax: ageRange?.max,
  };
}

/** Résumé lisible des filtres actifs, pour affichage avant export ("Export basé sur X répondants — UNILU, L2"). */
export function describeFilters(url: URL, survey: Survey): string {
  const parts: string[] = [];
  const institution = url.searchParams.get("institution");
  const faculty = url.searchParams.get("faculty");
  const level = url.searchParams.get("level");
  const categoryId = url.searchParams.get("categoryId");
  const ageBucketKey = url.searchParams.get("ageBucket");
  if (institution) parts.push(institution);
  if (faculty) parts.push(faculty);
  if (level) parts.push(level);
  if (categoryId) parts.push(survey.categories.find((c) => c.id === categoryId)?.label ?? "Catégorie");
  if (ageBucketKey) parts.push(AGE_BUCKETS.find((b) => b.key === ageBucketKey)?.label ?? ageBucketKey);
  return parts.length > 0 ? parts.join(", ") : "Ensemble des réponses";
}

export interface SurveyExportRow {
  index: number;
  date: string;
  categoryLabel?: string;
  institution?: string;
  faculty?: string;
  level?: string;
  age?: number;
  sex?: string;
  answersByQuestionId: Record<string, string>;
}

export async function gatherSurveyResponseRows(survey: Survey, filters: SurveyResponseFilters): Promise<SurveyExportRow[]> {
  const responses = await listSurveyResponses(survey.id, filters);
  const responseIds = responses.map((r) => r.id);
  const rawAnswers =
    responseIds.length > 0
      ? await prisma.surveyAnswer.findMany({ where: { responseId: { in: responseIds } }, include: { option: true } })
      : [];

  const byResponse = new Map<string, typeof rawAnswers>();
  for (const a of rawAnswers) {
    if (!byResponse.has(a.responseId)) byResponse.set(a.responseId, []);
    byResponse.get(a.responseId)!.push(a);
  }

  return responses.map((r, i) => {
    const forResponse = byResponse.get(r.id) ?? [];
    const byQuestion = new Map<string, string[]>();
    for (const a of forResponse) {
      const label = a.option?.label ?? a.valueText ?? "";
      if (!label) continue;
      if (!byQuestion.has(a.questionId)) byQuestion.set(a.questionId, []);
      byQuestion.get(a.questionId)!.push(label);
    }
    const answersByQuestionId: Record<string, string> = {};
    for (const q of survey.questions) {
      answersByQuestionId[q.id] = (byQuestion.get(q.id) ?? []).join("; ");
    }
    return {
      index: i + 1,
      date: r.completedAt ?? r.startedAt,
      categoryLabel: r.categoryLabel,
      institution: r.institution,
      faculty: r.faculty,
      level: r.level,
      age: r.age,
      sex: r.sex,
      answersByQuestionId,
    };
  });
}

export function exportColumnHeaders(survey: Survey): string[] {
  return ["N°", "Date", "Catégorie", "Institution", "Faculté / École", "Niveau d'étude", "Âge", "Sexe", ...survey.questions.map((q) => q.text)];
}

export function exportRowCells(survey: Survey, row: SurveyExportRow): string[] {
  return [
    String(row.index),
    row.date ? new Date(row.date).toLocaleString("fr-FR") : "",
    row.categoryLabel ?? "",
    row.institution ?? "",
    row.faculty ?? "",
    row.level ?? "",
    row.age !== undefined ? String(row.age) : "",
    row.sex ?? "",
    ...survey.questions.map((q) => row.answersByQuestionId[q.id] ?? ""),
  ];
}

function csvEscape(value: string): string {
  if (/[";\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Délimiteur point-virgule + BOM UTF-8 : convention Excel en environnement francophone. */
export function buildCsv(survey: Survey, rows: SurveyExportRow[]): string {
  const lines = [exportColumnHeaders(survey).map(csvEscape).join(";")];
  for (const row of rows) {
    lines.push(exportRowCells(survey, row).map(csvEscape).join(";"));
  }
  return "﻿" + lines.join("\r\n");
}

export function exportFileBaseName(surveyTitle: string): string {
  const slug = surveyTitle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "enquete";
}
