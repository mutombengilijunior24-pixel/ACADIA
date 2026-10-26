// MNJ STAGE CONNECT — CRM : révocation d'un accès (faculté ou maître de stage). Effet immédiat.

import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { revokeAccess, stageErrorResponse } from "@/lib/server/stages/StageService";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ accessId: string }> };

export async function DELETE(_request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { accessId } = await context.params;
  try {
    await revokeAccess(guard.user.id, accessId);
    return new Response(null, { status: 204 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
