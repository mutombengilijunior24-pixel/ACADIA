// ============================================================
// MNJ STAGE CONNECT — confirmation des présences par le maître de stage,
// via son lien personnel (sans compte). Limité en débit ; un jeton
// invalide, expiré ou révoqué reçoit toujours la même réponse.
// ============================================================

import { z } from "zod";

import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { stageErrorResponse, tutorConfirm } from "@/lib/server/stages/StageService";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ token: string }> };

const schema = z.object({ days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(400) });

export async function POST(request: Request, context: RouteContext) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inconnu";
  if (!rateLimiter.check(rateLimitKey("stage-tutor", ip), 60, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de tentatives : réessayez plus tard." }, { status: 429 });
  const { token } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  try {
    const confirmed = await tutorConfirm(token, parsed.data.days);
    if (confirmed === null) return Response.json({ error: "Ce lien n'est plus valide. Demandez-en un nouveau à MNJ Stage Connect." }, { status: 404 });
    return Response.json({ confirmed }, { status: 200, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
