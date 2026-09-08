// ============================================================
// ACADIA — FEEDBACK PRODUIT / BUG / DEMANDE DE FONCTIONNALITÉ
// (Bloc 2, 08/09/2026)
//
// Point d'entrée UNIQUE pour le widget de feedback (voir
// components/product/FeedbackWidget.tsx) — distinct de FeedbackEntry
// (évaluation académique superviseur → étudiant, jamais mélangée
// ici). Selon `type`, la soumission crée une ligne dans l'UNE des
// trois tables spécialisées (jamais les trois, jamais un quatrième
// système) :
//   - "problem"      -> BugReport (sévérité dérivée du niveau de
//                        blocage déclaré, jamais choisie librement
//                        par l'utilisateur)
//   - "suggestion"    -> FeatureRequest
//   - "question" / "satisfaction" -> ProductFeedback
//
// userId toujours dérivé de la session serveur, jamais du corps de la
// requête. Le contexte (page/projectId/step) est fourni par le
// client mais reste des identifiants/chemins courts — jamais un
// secret, jamais une réponse de questionnaire brute (voir mission §21).
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { prisma } from "@/lib/server/db/prisma";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

const CATEGORIES = ["UX", "SCIENTIFIC", "QUESTIONNAIRE", "DATA", "ANALYSIS", "PERFORMANCE", "TECHNICAL", "PAYMENT", "OTHER"] as const;

const bodySchema = z.object({
  type: z.enum(["problem", "suggestion", "question", "satisfaction"]),
  message: z.string().trim().min(1).max(4000),
  blockingLevel: z.enum(["can_continue", "hinders", "blocks"]).optional(),
  page: z.string().max(300).default("unknown"),
  projectId: z.string().max(120).optional(),
  step: z.string().max(120).optional(),
  category: z.enum(CATEGORIES).optional(),
});

function severityFromBlockingLevel(level: "can_continue" | "hinders" | "blocks" | undefined): "LOW" | "MEDIUM" | "HIGH" | "BLOCKER" {
  if (level === "blocks") return "BLOCKER";
  if (level === "hinders") return "HIGH";
  if (level === "can_continue") return "LOW";
  return "MEDIUM";
}

function truncateTitle(message: string): string {
  const firstLine = message.split("\n")[0].trim();
  return firstLine.length > 80 ? `${firstLine.slice(0, 77)}...` : firstLine || "Sans titre";
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const limit = rateLimiter.check(rateLimitKey("product-feedback", user.id), 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de retours envoyés récemment. Réessayez plus tard." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  const { type, message, blockingLevel, page, projectId, step, category } = parsed.data;

  if (type === "problem") {
    const bug = await prisma.bugReport.create({
      data: {
        userId: user.id,
        projectId,
        page,
        step,
        description: message,
        severity: severityFromBlockingLevel(blockingLevel),
        category,
      },
    });
    await trackProductEvent({ userId: user.id, eventType: "FEEDBACK_SUBMITTED", projectId, metadata: { type } });
    await trackProductEvent({ userId: user.id, eventType: "BUG_REPORTED", projectId, metadata: { severity: bug.severity } });
    return Response.json({ ok: true, message: "Merci. Votre retour a bien été enregistré." }, { status: 201 });
  }

  if (type === "suggestion") {
    await prisma.featureRequest.create({
      data: {
        userId: user.id,
        projectId,
        title: truncateTitle(message),
        description: message,
        page,
        category,
      },
    });
    await trackProductEvent({ userId: user.id, eventType: "FEEDBACK_SUBMITTED", projectId, metadata: { type } });
    await trackProductEvent({ userId: user.id, eventType: "FEATURE_REQUESTED", projectId });
    return Response.json({ ok: true, message: "Votre demande a été enregistrée." }, { status: 201 });
  }

  await prisma.productFeedback.create({
    data: {
      userId: user.id,
      projectId,
      type,
      message,
      page,
      step,
      category,
    },
  });
  await trackProductEvent({ userId: user.id, eventType: "FEEDBACK_SUBMITTED", projectId, metadata: { type } });
  return Response.json({ ok: true, message: "Merci. Votre retour a bien été enregistré." }, { status: 201 });
}
