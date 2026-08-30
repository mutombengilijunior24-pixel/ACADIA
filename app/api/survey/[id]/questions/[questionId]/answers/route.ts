// ============================================================
// ACADIA — SURVEY : RÉPONSES D'UNE QUESTION OUVERTE (propriétaire uniquement)
//
// Pour une question ouverte (short_text/long_text), il n'existe pas de
// statistique fermée pertinente — cette route liste les réponses
// textuelles réelles, paginées et cherchables, jamais toutes chargées
// en mémoire côté client (voir P19.14/P19.16).
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById } from "@/lib/server/survey/SurveyStore";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

const PAGE_SIZE = 20;

export async function GET(request: Request, context: { params: Promise<{ id: string; questionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, questionId } = await context.params;
  const survey = await getSurveyById(id);
  if (!survey) return notFound();
  if (survey.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  const question = survey.questions.find((q) => q.id === questionId);
  if (!question) return notFound();

  const url = new URL(request.url);
  const search = url.searchParams.get("search")?.trim() ?? "";
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);

  const where = {
    questionId,
    valueText: search ? { contains: search, mode: "insensitive" as const } : { not: null },
  };

  const [total, rows] = await Promise.all([
    prisma.surveyAnswer.count({ where }),
    prisma.surveyAnswer.findMany({
      where,
      select: { id: true, valueText: true, createdAt: true, response: { select: { institution: true, faculty: true, category: { select: { label: true } } } } },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  return Response.json(
    {
      total,
      page,
      pageSize: PAGE_SIZE,
      answers: rows.map((r) => ({
        id: r.id,
        text: r.valueText,
        createdAt: r.createdAt.toISOString(),
        institution: r.response.institution ?? undefined,
        faculty: r.response.faculty ?? undefined,
        category: r.response.category?.label,
      })),
    },
    { status: 200 }
  );
}
