// ============================================================
// MNJ STAGE CONNECT — CRM : lien du maître de stage pour un dossier
// placé (confirmation des présences). Le lien n'est renvoyé qu'une
// fois ; seule son empreinte est conservée. L'ancien lien est révoqué.
// ============================================================

import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { createTutorAccess, stageErrorResponse } from "@/lib/server/stages/StageService";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { id } = await context.params;
  try {
    const { token, access } = await createTutorAccess(guard.user.id, id);
    return Response.json({ path: `/stage/tuteur/${token}`, access }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
