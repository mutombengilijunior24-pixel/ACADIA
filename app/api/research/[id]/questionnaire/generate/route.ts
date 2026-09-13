// ============================================================
// ACADIA — GÉNÉRATION DU QUESTIONNAIRE (Bloc A, 11/09/2026)
//
// Réutilise generateInstrumentFromProject (moteur protégé,
// lib/core/questionnaire/QuestionnaireGenerationEngine.ts) sans le
// modifier pour construire la structure (sections/questions, une
// question par indicateur réel, traçabilité intacte). Ajoute
// ensuite un enrichissement IA (lib/core/questionnaire/
// QuestionnaireAIEnrichment.ts) qui ne fait que reformuler le texte/
// type de chaque question déjà décidée — jamais côté navigateur, la
// clé OpenAI ne pouvant pas y être exposée, d'où cette route.
//
// Aucune persistance ici : le client applique le résultat à son état
// local (contexts/ResearchContext.tsx) puis la synchronisation
// globale déjà en place (PUT /api/research-state) le persiste,
// exactement comme pour le reste de l'instrument.
// ============================================================

import { getSessionUser, unauthorized, notFound, forbidden } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord } from "@/lib/server/research/ResearchStateService";
import { generateInstrumentFromProject, analyzeInstrument } from "@/lib/core/questionnaire/QuestionnaireGenerationEngine";
import { enrichQuestionnaireWithAI } from "@/lib/core/questionnaire/QuestionnaireAIEnrichment";
import { addIdentificationSection } from "@/lib/core/questionnaire/QuestionnaireIdentificationSection";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { ensureEntitlement, EntitlementRequiredError } from "@/lib/server/billing/EntitlementService";
import { getCatalogEntry, getEffectivePriceUsd } from "@/lib/server/billing/PricingConfig";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const record = await getResearchProjectRecord(id);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  const limit = rateLimiter.check(rateLimitKey("questionnaire-generate", user.id), 10, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de générations récentes. Réessayez dans quelques minutes." }, { status: 429 });
  }

  // Mission Conversion + Pay-as-you-progress — "Questionnaire 🔒".
  try {
    await ensureEntitlement(user.id, id, "QUESTIONNAIRE");
  } catch (error) {
    if (error instanceof EntitlementRequiredError) {
      return Response.json(
        {
          error: "Cette étape nécessite de débloquer « Questionnaire / guide d'entretien ».",
          entitlementRequired: getCatalogEntry(error.key),
          priceUsd: getEffectivePriceUsd(error.key),
        },
        { status: 402 }
      );
    }
    throw error;
  }

  const project = record.project;
  const result = generateInstrumentFromProject(project);

  if (!result.questionnaire) {
    return Response.json(result, { status: 200 });
  }

  // Section fixe d'identification du répondant (sexe, âge, niveau
  // d'instruction, profession/secteur, zone) — ajoutée avant
  // l'enrichissement IA pour que ses questions (sans indicatorId)
  // soient naturellement ignorées par enrichQuestionnaireWithAI.
  const withIdentification = addIdentificationSection(result.questionnaire);

  const enrichedQuestionnaire = await enrichQuestionnaireWithAI(project, withIdentification, { userId: user.id });

  const { validation, matrix, quality } = analyzeInstrument(project, enrichedQuestionnaire);

  return Response.json(
    { ...result, questionnaire: enrichedQuestionnaire, validation, matrix, quality },
    { status: 200 }
  );
}
