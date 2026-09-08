// ============================================================
// ACADIA — SURVEY : PAGE PUBLIQUE DU RÉPONDANT (lecture)
//
// Route publique, aucune authentification — accessible uniquement
// pour une enquête réellement "active" (jamais un brouillon, une
// enquête suspendue ou clôturée). Ne renvoie que ce qui est
// nécessaire pour répondre — jamais l'ownerId ni les statistiques.
// ============================================================

import { getSurveyByPublicId } from "@/lib/server/survey/SurveyStore";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ publicId: string }> }) {
  const { publicId } = await context.params;
  const survey = await getSurveyByPublicId(publicId);

  if (!survey) return Response.json({ error: "Enquête introuvable." }, { status: 404 });

  if (survey.status !== "active") {
    return Response.json(
      { error: survey.status === "closed" ? "Cette enquête est clôturée." : "Cette enquête n'est pas disponible actuellement." },
      { status: 410 }
    );
  }

  await trackProductEvent({ eventType: "PUBLIC_SURVEY_OPENED", projectId: survey.id });

  return Response.json(
    {
      survey: {
        id: survey.id,
        publicId: survey.publicId,
        title: survey.title,
        description: survey.description,
        institution: survey.institution,
        institutionLogoUrl: survey.institutionLogoUrl,
        isAnonymous: survey.isAnonymous,
        categories: survey.categories,
        questions: survey.questions,
      },
    },
    { status: 200 }
  );
}
