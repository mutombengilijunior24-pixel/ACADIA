// ============================================================
// ACADIA — ACCEPTATION D'UNE INVITATION (P16)
// ============================================================

import { findInvitationByCode, markInvitationAccepted } from "@/lib/supervision/InvitationStore";
import { createAssignment } from "@/lib/supervision/AssignmentStore";
import { createNotification } from "@/lib/supervision/NotificationStore";
import { createMessage } from "@/lib/supervision/MessageStore";
import { findUserById } from "@/lib/auth/UserStore";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const limit = rateLimiter.check(rateLimitKey("invitations-accept", user.id), 15, 10 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop de tentatives. Réessayez dans quelques minutes." }, { status: 429 });
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const code = (body.code ?? "").trim();
  if (!code) return Response.json({ error: "Code d'invitation manquant." }, { status: 400 });

  const invitation = await findInvitationByCode(code);
  if (!invitation) return Response.json({ error: "Invitation introuvable." }, { status: 404 });
  if (invitation.status !== "pending") {
    return Response.json({ error: "Cette invitation n'est plus valide (déjà utilisée, expirée ou révoquée)." }, { status: 409 });
  }
  if (new Date(invitation.expiresAt).getTime() < Date.now()) {
    return Response.json({ error: "Cette invitation a expiré." }, { status: 410 });
  }

  const accepted = await markInvitationAccepted(code, user.id);
  if (!accepted) return Response.json({ error: "Impossible d'accepter cette invitation." }, { status: 409 });

  const assignment = await createAssignment({
    studentId: user.id,
    supervisorId: invitation.supervisorId,
    researchId: invitation.researchId,
  });

  const supervisor = await findUserById(invitation.supervisorId);

  await createNotification({
    userId: invitation.supervisorId,
    type: "supervisor_invitation",
    title: "Invitation acceptée",
    body: `${user.firstName} a accepté votre invitation d'encadrement.`,
  });

  await createMessage({
    senderId: invitation.supervisorId,
    recipientId: user.id,
    subject: "Bienvenue dans votre espace de supervision",
    body: `${supervisor?.firstName ?? "Votre directeur"} est maintenant votre directeur de recherche sur ACADIA.`,
    type: "system",
    priority: "normal",
  });

  return Response.json({ assignment, supervisor: supervisor ? { id: supervisor.id, firstName: supervisor.firstName, lastName: supervisor.lastName, email: supervisor.email } : null }, { status: 200 });
}
