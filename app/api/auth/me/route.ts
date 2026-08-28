// ============================================================
// ACADIA — SESSION COURANTE (P13)
// ============================================================

import { cookies } from "next/headers";
import { findUserById } from "@/lib/auth/UserStore";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { toPublicUser } from "@/lib/auth/AuthTypes";

export const runtime = "nodejs";

export async function GET() {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) return Response.json({ user: null }, { status: 200 });

  const user = await findUserById(session.userId);
  if (!user) return Response.json({ user: null }, { status: 200 });

  return Response.json({ user: toPublicUser(user) }, { status: 200 });
}
