// ============================================================
// MNJ STAGE CONNECT — mes dossiers (liste) et dépôt d'un dossier.
// userId toujours dérivé de la session serveur, jamais du corps.
// ============================================================

import { stageApplicationSchema } from "@/lib/core/stages/catalog";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { createApplication, listMine, stageErrorResponse } from "@/lib/server/stages/StageService";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  try {
    return Response.json({ applications: await listMine(user.id) }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return stageErrorResponse(error);
  }
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!rateLimiter.check(rateLimitKey("stage-create", user.id), 10, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop de tentatives : réessayez dans quelques minutes." }, { status: 429 });
  const parsed = stageApplicationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Dossier incomplet.", issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) }, { status: 400 });
  try {
    return Response.json({ application: await createApplication(user.id, parsed.data) }, { status: 201 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
