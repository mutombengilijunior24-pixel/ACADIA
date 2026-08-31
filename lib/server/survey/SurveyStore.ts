// ============================================================
// ACADIA — MODULE SURVEY : ACCÈS DONNÉES (Prisma/PostgreSQL)
//
// Suit le même patron que lib/supervision/*Store.ts : fonctions
// asynchrones, toDomain() pour mapper les lignes Prisma vers les
// types de lib/core/survey/SurveyTypes.ts, aucun id client jamais
// fait confiance sans vérification serveur de propriété.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { withTransientRetry, isUniqueConstraintOn } from "@/lib/server/db/retryTransient";
import { randomBytes, randomUUID } from "node:crypto";
import type {
  Survey,
  SurveyCategory,
  SurveyOption,
  SurveyQuestion,
  SurveyListItem,
  SurveyResponseSummary,
  SurveyResponseDetail,
} from "@/lib/core/survey/SurveyTypes";

function parseJsonArray(value: string | null): string[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function toOption(row: { id: string; label: string; value: string; order: number }): SurveyOption {
  return { id: row.id, label: row.label, value: row.value, order: row.order };
}

function toQuestion(row: {
  id: string;
  section: string | null;
  order: number;
  type: string;
  text: string;
  required: boolean;
  variable: string | null;
  indicator: string | null;
  visibleForCategoryIds: string | null;
  options: { id: string; label: string; value: string; order: number }[];
}): SurveyQuestion {
  return {
    id: row.id,
    section: row.section ?? undefined,
    order: row.order,
    type: row.type as SurveyQuestion["type"],
    text: row.text,
    required: row.required,
    variable: row.variable ?? undefined,
    indicator: row.indicator ?? undefined,
    options: row.options.sort((a, b) => a.order - b.order).map(toOption),
    visibleForCategoryIds: parseJsonArray(row.visibleForCategoryIds),
  };
}

function toCategory(row: { id: string; label: string; order: number }): SurveyCategory {
  return { id: row.id, label: row.label, order: row.order };
}

const surveyInclude = {
  questions: { include: { options: true }, orderBy: { order: "asc" as const } },
  categories: { orderBy: { order: "asc" as const } },
};

type SurveyWithRelations = NonNullable<Awaited<ReturnType<typeof prisma.survey.findFirst<{ include: typeof surveyInclude }>>>>;

function toSurvey(row: SurveyWithRelations): Survey {
  return {
    id: row.id,
    ownerId: row.ownerId,
    title: row.title,
    description: row.description ?? undefined,
    objective: row.objective ?? undefined,
    problem: row.problem ?? undefined,
    targetAudience: row.targetAudience ?? undefined,
    institution: row.institution ?? undefined,
    institutionLogoUrl: row.institutionLogoDocumentId ? `/api/survey/logo/${row.institutionLogoDocumentId}` : undefined,
    status: row.status as Survey["status"],
    isAnonymous: row.isAnonymous,
    targetResponses: row.targetResponses ?? undefined,
    startDate: row.startDate?.toISOString(),
    endDate: row.endDate?.toISOString(),
    publicId: row.publicId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    questions: row.questions.map(toQuestion),
    categories: row.categories.map(toCategory),
  };
}

export async function listSurveysByOwner(ownerId: string): Promise<SurveyListItem[]> {
  const rows = await prisma.survey.findMany({
    where: { ownerId },
    orderBy: { updatedAt: "desc" },
    include: { _count: { select: { responses: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status as SurveyListItem["status"],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
    publicId: r.publicId ?? undefined,
    targetResponses: r.targetResponses ?? undefined,
    responseCount: r._count.responses,
  }));
}

export async function getSurveyById(id: string): Promise<Survey | null> {
  const row = await prisma.survey.findUnique({ where: { id }, include: surveyInclude });
  return row ? toSurvey(row) : null;
}

/**
 * Vérifie qu'un id de document est réellement référencé comme logo
 * d'une enquête avant de le servir publiquement — jamais un id de
 * document arbitraire (le stockage de documents est partagé avec
 * d'autres usages ACADIA, ex. exports Research).
 */
export async function isDocumentUsedAsSurveyLogo(documentId: string): Promise<boolean> {
  const row = await prisma.survey.findFirst({ where: { institutionLogoDocumentId: documentId }, select: { id: true } });
  return Boolean(row);
}

export async function getSurveyByPublicId(publicId: string): Promise<Survey | null> {
  const row = await withTransientRetry(() => prisma.survey.findUnique({ where: { publicId }, include: surveyInclude }));
  return row ? toSurvey(row) : null;
}

export async function createSurvey(input: {
  ownerId: string;
  title: string;
  description?: string;
  objective?: string;
  problem?: string;
  targetAudience?: string;
  institution?: string;
  institutionLogoDocumentId?: string;
  isAnonymous?: boolean;
  targetResponses?: number;
  startDate?: string;
  endDate?: string;
  categories: { label: string; order: number }[];
  questions: {
    section?: string;
    order: number;
    type: string;
    text: string;
    required?: boolean;
    variable?: string;
    indicator?: string;
    visibleForCategoryLabels?: string[];
    options?: { label: string; value: string; order: number }[];
  }[];
}): Promise<Survey> {
  const created = await prisma.survey.create({
    data: {
      ownerId: input.ownerId,
      title: input.title,
      description: input.description,
      objective: input.objective,
      problem: input.problem,
      targetAudience: input.targetAudience,
      institution: input.institution,
      institutionLogoDocumentId: input.institutionLogoDocumentId,
      isAnonymous: input.isAnonymous ?? false,
      targetResponses: input.targetResponses,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      endDate: input.endDate ? new Date(input.endDate) : undefined,
      categories: { create: input.categories },
    },
    include: surveyInclude,
  });

  // Les questions référencent les catégories par label (fourni par le
  // client au moment de la création) — on résout vers les ids réels
  // générés par Prisma avant de créer les questions. Deux createMany
  // (questions puis options) au lieu d'un create() séquentiel par
  // question : un aller-retour réseau par lot plutôt qu'un par question,
  // ce qui évite une latence cumulée proportionnelle au nombre de
  // questions générées.
  const categoryIdByLabel = new Map(created.categories.map((c) => [c.label, c.id]));

  const questionIds = input.questions.map(() => randomUUID());
  if (input.questions.length > 0) {
    await prisma.surveyQuestion.createMany({
      data: input.questions.map((q, i) => {
        const visibleForCategoryIds = (q.visibleForCategoryLabels ?? [])
          .map((label) => categoryIdByLabel.get(label))
          .filter((id): id is string => Boolean(id));
        return {
          id: questionIds[i],
          surveyId: created.id,
          section: q.section,
          order: q.order,
          type: q.type,
          text: q.text,
          required: q.required ?? true,
          variable: q.variable,
          indicator: q.indicator,
          visibleForCategoryIds: visibleForCategoryIds.length > 0 ? JSON.stringify(visibleForCategoryIds) : null,
        };
      }),
    });
  }

  const optionRows = input.questions.flatMap((q, i) =>
    (q.options ?? []).map((o) => ({ id: randomUUID(), questionId: questionIds[i], label: o.label, value: o.value, order: o.order }))
  );
  if (optionRows.length > 0) {
    await prisma.surveyOption.createMany({ data: optionRows });
  }

  await prisma.surveyEvent.create({ data: { surveyId: created.id, type: "created" } });

  const full = await prisma.survey.findUnique({ where: { id: created.id }, include: surveyInclude });
  return toSurvey(full!);
}

export async function updateSurveyMeta(
  id: string,
  patch: Partial<{
    title: string;
    description: string;
    objective: string;
    problem: string;
    targetAudience: string;
    institution: string;
    institutionLogoDocumentId: string | null;
    isAnonymous: boolean;
    targetResponses: number;
    startDate: string | null;
    endDate: string | null;
  }>
): Promise<Survey | null> {
  const data: Record<string, unknown> = { ...patch };
  if ("startDate" in patch) data.startDate = patch.startDate ? new Date(patch.startDate) : null;
  if ("endDate" in patch) data.endDate = patch.endDate ? new Date(patch.endDate) : null;

  const row = await prisma.survey.update({ where: { id }, data, include: surveyInclude }).catch(() => null);
  return row ? toSurvey(row) : null;
}

export async function replaceSurveyQuestions(
  surveyId: string,
  questions: {
    id?: string;
    section?: string;
    order: number;
    type: string;
    text: string;
    required?: boolean;
    variable?: string;
    indicator?: string;
    visibleForCategoryIds?: string[];
    options?: { label: string; value: string; order: number }[];
  }[]
): Promise<Survey | null> {
  // Remplacement complet transactionnel — plus simple et plus sûr qu'un
  // diff fin question par question pour un éditeur encore en construction ;
  // les réponses déjà collectées référencent les questions par id, donc
  // ce remplacement n'est utilisé qu'avant publication (voir la route API).
  // createMany par lot (questions puis options) plutôt qu'un create()
  // séquentiel par question, pour rester largement sous le délai par
  // défaut de la transaction interactive quel que soit le nombre de
  // questions.
  const questionIds = questions.map(() => randomUUID());
  await prisma.$transaction(async (tx) => {
    await tx.surveyQuestion.deleteMany({ where: { surveyId } });
    if (questions.length > 0) {
      await tx.surveyQuestion.createMany({
        data: questions.map((q, i) => ({
          id: questionIds[i],
          surveyId,
          section: q.section,
          order: q.order,
          type: q.type,
          text: q.text,
          required: q.required ?? true,
          variable: q.variable,
          indicator: q.indicator,
          visibleForCategoryIds: q.visibleForCategoryIds?.length ? JSON.stringify(q.visibleForCategoryIds) : null,
        })),
      });
    }
    const optionRows = questions.flatMap((q, i) =>
      (q.options ?? []).map((o) => ({ id: randomUUID(), questionId: questionIds[i], label: o.label, value: o.value, order: o.order }))
    );
    if (optionRows.length > 0) {
      await tx.surveyOption.createMany({ data: optionRows });
    }
  }, { timeout: 20000 });

  const row = await prisma.survey.findUnique({ where: { id: surveyId }, include: surveyInclude });
  return row ? toSurvey(row) : null;
}

export async function publishSurvey(id: string): Promise<Survey | null> {
  const existing = await prisma.survey.findUnique({ where: { id } });
  if (!existing) return null;

  const publicId = existing.publicId ?? randomBytes(5).toString("hex");
  const row = await prisma.survey.update({
    where: { id },
    data: { status: "active", publicId },
    include: surveyInclude,
  });
  await prisma.surveyEvent.create({ data: { surveyId: id, type: "published" } });
  return toSurvey(row);
}

export async function setSurveyStatus(id: string, status: "active" | "suspended" | "closed" | "draft"): Promise<Survey | null> {
  const row = await prisma.survey.update({ where: { id }, data: { status }, include: surveyInclude }).catch(() => null);
  if (row) await prisma.surveyEvent.create({ data: { surveyId: id, type: status } });
  return row ? toSurvey(row) : null;
}

// ------------------------------------------------------------
// RÉPONSES
// ------------------------------------------------------------

export async function submitSurveyResponse(input: {
  surveyId: string;
  categoryId?: string;
  institution?: string;
  faculty?: string;
  level?: string;
  age?: number;
  sex?: string;
  respondentKey?: string;
  answers: { questionId: string; optionId?: string; optionIds?: string[]; valueText?: string }[];
}): Promise<{ id: string; alreadySubmitted: boolean }> {
  // Fiabilisation de la collecte (P20.5) : deux protections combinées,
  // jamais un deuxième mécanisme de soumission.
  // 1) Retry contrôlé — uniquement sur erreur transitoire pooler/réseau
  //    (voir retryTransient.ts), jamais sur une erreur de validation.
  // 2) Contrainte d'unicité (surveyId, respondentKey) au niveau base de
  //    données (@@unique) — filet de sécurité atomique contre la
  //    situation où deux requêtes quasi simultanées (double clic,
  //    nouvelle tentative après une réponse perdue en réseau) passeraient
  //    toutes les deux la vérification applicative préalable
  //    (hasRespondentAlreadyAnswered, faite par l'appelant avant cet
  //    appel). En cas de violation, on renvoie la réponse déjà existante
  //    au lieu de créer un doublon ou de renvoyer une erreur : la
  //    soumission reste idempotente du point de vue du répondant.
  const result = await withTransientRetry(async () => {
    try {
      const created = await prisma.$transaction(async (tx) => {
        const createdResponse = await tx.surveyResponse.create({
          data: {
            surveyId: input.surveyId,
            categoryId: input.categoryId,
            institution: input.institution,
            faculty: input.faculty,
            level: input.level,
            age: input.age,
            sex: input.sex,
            respondentKey: input.respondentKey,
            status: "completed",
            completedAt: new Date(),
          },
        });

        // Un seul aller-retour pour toutes les réponses (plutôt qu'un create()
        // séquentiel par réponse) : évite de dépasser le délai par défaut de la
        // transaction interactive lorsque le questionnaire compte de nombreuses
        // questions.
        // Jamais une ligne de réponse vide enregistrée : une question à choix
        // multiple sans aucune option cochée (optionIds: []), ou une entrée
        // sans optionId ni valueText, ne produit aucune ligne — sinon le
        // dénominateur des fréquences (répondants distincts par question)
        // compterait des personnes n'ayant en réalité rien répondu.
        type AnswerRow = { responseId: string; questionId: string; optionId?: string; valueText?: string };
        const answerRows: AnswerRow[] = input.answers.flatMap((a): AnswerRow[] => {
          if (a.optionIds && a.optionIds.length > 0) {
            return a.optionIds.map((optionId) => ({ responseId: createdResponse.id, questionId: a.questionId, optionId }));
          }
          if (a.optionId || (a.valueText && a.valueText.trim().length > 0)) {
            return [{ responseId: createdResponse.id, questionId: a.questionId, optionId: a.optionId, valueText: a.valueText }];
          }
          return [];
        });
        if (answerRows.length > 0) {
          await tx.surveyAnswer.createMany({ data: answerRows });
        }

        return createdResponse;
      });
      return { id: created.id, alreadySubmitted: false };
    } catch (error) {
      if (input.respondentKey && isUniqueConstraintOn(error, ["surveyId", "respondentKey"])) {
        const existing = await prisma.surveyResponse.findFirst({
          where: { surveyId: input.surveyId, respondentKey: input.respondentKey },
          select: { id: true },
        });
        if (existing) return { id: existing.id, alreadySubmitted: true };
      }
      throw error;
    }
  });

  // Événement d'analytique interne uniquement (SurveyEvent) — jamais
  // laissé faire échouer une soumission dont la réponse réelle
  // (SurveyResponse) est déjà validée/committée ci-dessus : un
  // répondant ne doit jamais voir "échec" pour une réponse en réalité
  // bien enregistrée simplement parce que cette trace annexe a
  // rencontré, elle, une panne transitoire du pooler après coup. Trouvé
  // en test réel (P20.5) : sous forte concurrence, ce point précis
  // provoquait de faux échecs malgré une écriture réussie.
  if (!result.alreadySubmitted) {
    try {
      await prisma.surveyEvent.create({ data: { surveyId: input.surveyId, type: "response_received", metadata: JSON.stringify({ responseId: result.id }) } });
    } catch {
      // Volontairement ignoré — voir commentaire ci-dessus.
    }
  }

  return result;
}

export async function hasRespondentAlreadyAnswered(surveyId: string, respondentKey: string): Promise<boolean> {
  const existing = await prisma.surveyResponse.findFirst({ where: { surveyId, respondentKey }, select: { id: true } });
  return Boolean(existing);
}

export interface SurveyResponseFilters {
  categoryId?: string;
  institution?: string;
  faculty?: string;
  level?: string;
  status?: string;
  ageMin?: number;
  ageMax?: number;
  from?: string;
  to?: string;
}

export async function listSurveyResponses(surveyId: string, filters: SurveyResponseFilters = {}): Promise<SurveyResponseSummary[]> {
  const rows = await prisma.surveyResponse.findMany({
    where: {
      surveyId,
      categoryId: filters.categoryId,
      institution: filters.institution,
      faculty: filters.faculty,
      level: filters.level,
      status: filters.status,
      age: filters.ageMin !== undefined || filters.ageMax !== undefined ? { gte: filters.ageMin, lte: filters.ageMax } : undefined,
      startedAt: filters.from || filters.to ? { gte: filters.from ? new Date(filters.from) : undefined, lte: filters.to ? new Date(filters.to) : undefined } : undefined,
    },
    include: { category: true },
    orderBy: { startedAt: "desc" },
  });
  return rows.map((r) => ({
    id: r.id,
    categoryId: r.categoryId ?? undefined,
    categoryLabel: r.category?.label,
    institution: r.institution ?? undefined,
    faculty: r.faculty ?? undefined,
    level: r.level ?? undefined,
    age: r.age ?? undefined,
    sex: r.sex ?? undefined,
    status: r.status,
    startedAt: r.startedAt.toISOString(),
    completedAt: r.completedAt?.toISOString(),
  }));
}

export async function getSurveyResponseDetail(surveyId: string, responseId: string): Promise<SurveyResponseDetail | null> {
  const row = await prisma.surveyResponse.findFirst({
    where: { id: responseId, surveyId },
    include: {
      category: true,
      answers: { include: { question: true, option: true } },
    },
  });
  if (!row) return null;

  return {
    id: row.id,
    categoryId: row.categoryId ?? undefined,
    categoryLabel: row.category?.label,
    institution: row.institution ?? undefined,
    faculty: row.faculty ?? undefined,
    level: row.level ?? undefined,
    age: row.age ?? undefined,
    sex: row.sex ?? undefined,
    status: row.status,
    startedAt: row.startedAt.toISOString(),
    completedAt: row.completedAt?.toISOString(),
    answers: row.answers.map((a) => ({
      questionId: a.questionId,
      questionText: a.question.text,
      optionLabel: a.option?.label,
      valueText: a.valueText ?? undefined,
    })),
  };
}

function distinctNonNull(values: (string | null)[]): string[] {
  return values.filter((v): v is string => Boolean(v));
}

export async function getSurveyDistinctFilterValues(surveyId: string) {
  const institutionRows = await prisma.surveyResponse.findMany({ where: { surveyId, institution: { not: null } }, distinct: ["institution"], select: { institution: true } });
  const facultyRows = await prisma.surveyResponse.findMany({ where: { surveyId, faculty: { not: null } }, distinct: ["faculty"], select: { faculty: true } });
  const levelRows = await prisma.surveyResponse.findMany({ where: { surveyId, level: { not: null } }, distinct: ["level"], select: { level: true } });
  const categories = await prisma.surveyCategory.findMany({ where: { surveyId }, orderBy: { order: "asc" } });
  // Indépendant des filtres actuellement appliqués — sert uniquement à
  // décider si le sélecteur de tranche d'âge doit être affiché (jamais
  // un filtre pour une variable inexistante, mais sans le faire
  // disparaître à cause d'un autre filtre actif qui exclurait
  // temporairement toutes les réponses ayant un âge).
  const hasAge = (await prisma.surveyResponse.count({ where: { surveyId, age: { not: null } } })) > 0;

  return {
    institutions: distinctNonNull(institutionRows.map((i) => i.institution)),
    faculties: distinctNonNull(facultyRows.map((f) => f.faculty)),
    levels: distinctNonNull(levelRows.map((l) => l.level)),
    hasAge,
    categories: categories.map((c) => ({ id: c.id, label: c.label })),
  };
}
