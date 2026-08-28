// ============================================================
// ACADIA — AUTHENTIFICATION DES ROUTES DE SUPERVISION (P16)
//
// Chaque route API de supervision doit dériver l'utilisateur
// depuis la session serveur — jamais depuis un id envoyé par le
// client (Partie 19 du sprint : "ne jamais faire confiance à un
// studentId/supervisorId envoyé par le frontend").
// ============================================================

import { cookies } from "next/headers";
import { verifySessionToken, SESSION_COOKIE_NAME } from "@/lib/auth/session";
import { findUserById } from "@/lib/auth/UserStore";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { StoredUser } from "@/lib/auth/AuthTypes";

export async function getSessionUser(): Promise<StoredUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  const session = verifySessionToken(token);
  if (!session) return null;
  return (await findUserById(session.userId)) ?? null;
}

export function unauthorized(message = "Authentification requise.") {
  return Response.json({ error: message }, { status: 401 });
}

export function forbidden(
  message = "Accès non autorisé.",
  audit?: { actorId?: string; entityType: string; entityId?: string }
) {
  if (audit) {
    void logAudit({
      actorId: audit.actorId,
      action: "ACCESS_DENIED",
      entityType: audit.entityType,
      entityId: audit.entityId,
      metadata: { reason: message },
    });
  }
  return Response.json({ error: message }, { status: 403 });
}

export function notFound(message = "Ressource introuvable.") {
  return Response.json({ error: message }, { status: 404 });
}
