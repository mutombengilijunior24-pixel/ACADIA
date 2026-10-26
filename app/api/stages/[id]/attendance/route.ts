// ============================================================
// MNJ STAGE CONNECT — présence du jour : signature de l'arrivée, puis
// clôture de la journée avec le compte rendu des activités. L'heure est
// toujours celle du serveur ; le navigateur n'envoie aucune date.
// ============================================================

import { z } from "zod";

import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { signAttendance, stageErrorResponse } from "@/lib/server/stages/StageService";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const schema = z.discriminatedUnion("action", [z.object({ action: z.literal("arrivee") }), z.object({ action: z.literal("depart"), activities: z.string().max(4000) })]);

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!rateLimiter.check(rateLimitKey("stage-attendance", user.id), 30, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de tentatives : réessayez dans quelques minutes." }, { status: 429 });
  const { id } = await context.params;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  try {
    return Response.json({ application: await signAttendance(user.id, id, parsed.data) }, { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
