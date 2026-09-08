// ============================================================
// ACADIA — SURVEY : SOUMISSION D'UNE RÉPONSE (public, non authentifié)
//
// Le frontend ne décide jamais seul qu'une réponse est enregistrée :
// cette route est la seule source de vérité. Protection anti-doublon
// via un cookie technique non identifiant (aucune donnée personnelle),
// rate limiting par IP, validation serveur complète (obligatoires,
// options réellement proposées par l'enquête).
// ============================================================

import { getSurveyByPublicId, submitSurveyResponse, hasRespondentAlreadyAnswered } from "@/lib/server/survey/SurveyStore";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import { prisma } from "@/lib/server/db/prisma";
import { withTransientRetry } from "@/lib/server/db/retryTransient";
import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";

export const runtime = "nodejs";

interface AnswerInput {
  questionId: string;
  optionId?: string;
  optionIds?: string[];
  valueText?: string;
}

export async function POST(request: Request, context: { params: Promise<{ publicId: string }> }) {
  try {
    return await handlePost(request, context);
  } catch (error) {
    // Panne persistante (au-delà du retry contrôlé) sur une lecture/écriture
    // — jamais une trace technique brute affichée au répondant, jamais un
    // succès prétendu : le frontend affiche son message générique et
    // conserve le brouillon pour un nouvel essai.
    console.error("ACADIA — SURVEY RESPONSE SUBMISSION ERROR:", error instanceof Error ? error.message : error);
    return Response.json({ error: "Nous n'avons pas pu enregistrer votre réponse." }, { status: 503 });
  }
}

async function handlePost(request: Request, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params;

  const ip = request.headers.get("x-forwarded-for") ?? "local";
  const limit = rateLimiter.check(rateLimitKey("survey-response", `${publicId}:${ip}`), 10, 10 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }

  // Lecture protégée par le même retry contrôlé que l'écriture (voir
  // SurveyStore.submitSurveyResponse) — une panne transitoire du pooler
  // sur cette simple lecture ne doit pas faire échouer toute la
  // soumission alors que rien n'a encore été écrit.
  const survey = await withTransientRetry(() => getSurveyByPublicId(publicId));
  if (!survey) return Response.json({ error: "Enquête introuvable." }, { status: 404 });
  if (survey.status !== "active") {
    return Response.json({ error: "Cette enquête n'accepte plus de réponses." }, { status: 410 });
  }

  let body: {
    categoryId?: string;
    institution?: string;
    faculty?: string;
    level?: string;
    age?: number;
    sex?: string;
    answers?: AnswerInput[];
    submissionKey?: string;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const answers = body.answers ?? [];
  const answersByQuestion = new Map(answers.map((a) => [a.questionId, a]));

  // Validation serveur : chaque question requise (et visible pour la
  // catégorie choisie) doit avoir une réponse ; toute option référencée
  // doit réellement appartenir à la question concernée.
  for (const q of survey.questions) {
    const visibleForAll = !q.visibleForCategoryIds || q.visibleForCategoryIds.length === 0;
    const visible = visibleForAll || (body.categoryId ? q.visibleForCategoryIds!.includes(body.categoryId) : false);
    if (!visible) continue;

    const answer = answersByQuestion.get(q.id);
    if (q.required && !answer) {
      return Response.json({ error: `Réponse manquante pour une question obligatoire.` }, { status: 400 });
    }
    if (answer?.optionId && !q.options.some((o) => o.id === answer.optionId)) {
      return Response.json({ error: "Option de réponse invalide." }, { status: 400 });
    }
    if (answer?.optionIds?.some((oid) => !q.options.some((o) => o.id === oid))) {
      return Response.json({ error: "Option de réponse invalide." }, { status: 400 });
    }
  }

  // Protection anti-doublon, en deux temps :
  // - le cookie technique httpOnly identifie un répondant qui a DÉJÀ
  //   complété cette enquête lors d'une visite précédente (persiste 1 an) ;
  // - à défaut de cookie, `submissionKey` (généré côté client dès le début
  //   du remplissage, voir app/s/[publicId]/page.tsx) identifie de façon
  //   stable UNE MÊME tentative de soumission à travers ses nouvelles
  //   tentatives (double clic, coupure réseau, réponse serveur perdue) —
  //   sans dépendre d'un aller-retour de cookie qui pourrait ne jamais
  //   atteindre le navigateur si la première réponse s'est perdue en
  //   route. La contrainte d'unicité (surveyId, respondentKey) côté base
  //   de données (voir SurveyStore.submitSurveyResponse) reste le filet
  //   de sécurité final contre toute course entre deux requêtes quasi
  //   simultanées portant la même clé.
  const cookieStore = await cookies();
  const cookieName = `acadia_survey_${publicId}`;
  let respondentKey = cookieStore.get(cookieName)?.value || body.submissionKey || undefined;
  if (respondentKey && (await withTransientRetry(() => hasRespondentAlreadyAnswered(survey.id, respondentKey!)))) {
    return Response.json({ error: "Une réponse a déjà été enregistrée depuis cet appareil pour cette enquête." }, { status: 409 });
  }
  if (!respondentKey) respondentKey = randomUUID();

  const created = await submitSurveyResponse({
    surveyId: survey.id,
    categoryId: body.categoryId,
    institution: body.institution,
    faculty: body.faculty,
    level: body.level,
    age: body.age,
    sex: body.sex,
    respondentKey,
    answers: answers.map((a) => ({ questionId: a.questionId, optionId: a.optionId, optionIds: a.optionIds, valueText: a.valueText })),
  });

  if (!created.alreadySubmitted) {
    // Compté AVANT l'écriture de l'audit ci-dessous : si le compte est
    // 0 à cet instant, la réponse qu'on vient d'accepter est bien la
    // première pour cette enquête — jalon produit distinct du simple
    // décompte de réponses (voir mission §2).
    const priorResponseCount = await prisma.auditLog.count({ where: { action: "SURVEY_RESPONSE_RECEIVED", entityId: survey.id } });

    await logAudit({ actorId: undefined, action: "SURVEY_RESPONSE_RECEIVED", entityType: "Survey", entityId: survey.id });

    // Le répondant anonyme n'a pas de userId — la réussite de CETTE
    // requête serveur EST le moment réel où sa participation se termine
    // (l'écran de confirmation ne s'affiche qu'après ce succès) : la
    // tracker ici évite un aller-retour client supplémentaire inutile
    // (mission §19) tout en restant fidèle au moment réel.
    await trackProductEvent({ eventType: "PUBLIC_SURVEY_COMPLETED", projectId: survey.id });

    if (priorResponseCount === 0) {
      await trackProductEvent({ userId: survey.ownerId, eventType: "FIRST_SURVEY_RESPONSE_RECEIVED", projectId: survey.id });
    }
  }

  const response = Response.json({ ok: true, responseId: created.id }, { status: 201 });
  cookieStore.set(cookieName, respondentKey, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return response;
}
