// ============================================================
// ACADIA — BOÎTE DE RÉCEPTION (P16)
// ============================================================

import { listInboxForUser } from "@/lib/supervision/MessageStore";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  return Response.json({ messages: await listInboxForUser(user.id) }, { status: 200 });
}
