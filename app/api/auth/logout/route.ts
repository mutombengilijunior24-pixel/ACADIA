// ============================================================
// ACADIA — DÉCONNEXION (P13)
// ============================================================

import { cookies } from "next/headers";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { getSessionUser } from "@/lib/supervision/apiAuth";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSessionUser();

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);

  if (user) {
    await trackProductEvent({ userId: user.id, eventType: "AUTH_LOGOUT" });
  }

  return Response.json({ ok: true }, { status: 200 });
}
