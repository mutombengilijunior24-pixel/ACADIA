// ============================================================
// ACADIA — NOTIFICATIONS (P16)
// ============================================================

import { listNotifications, markNotificationRead } from "@/lib/supervision/NotificationStore";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  return Response.json({ notifications: await listNotifications(user.id) }, { status: 200 });
}

export async function PATCH(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: { id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }
  if (!body.id) return Response.json({ error: "id requis." }, { status: 400 });

  const updated = await markNotificationRead(body.id, user.id);
  if (!updated) return Response.json({ error: "Notification introuvable." }, { status: 404 });

  return Response.json({ notification: updated }, { status: 200 });
}
