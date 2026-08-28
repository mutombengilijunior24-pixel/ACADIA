// ============================================================
// ACADIA — MARQUER UN MESSAGE COMME LU (P16)
// ============================================================

import { markMessageRead } from "@/lib/supervision/MessageStore";
import { getSessionUser, unauthorized, notFound } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function PATCH(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const updated = await markMessageRead(id, user.id);
  if (!updated) return notFound();

  return Response.json({ message: updated }, { status: 200 });
}
