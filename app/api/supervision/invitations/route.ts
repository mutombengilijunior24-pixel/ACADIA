// ============================================================
// ACADIA — INVITATIONS (P16)
// ============================================================

import { listInvitationsBySupervisor, createInvitation } from "@/lib/supervision/InvitationStore";
import { hasSupervisionCapability } from "@/lib/core/entitlements/EntitlementEngine";
import { getSessionUser, unauthorized, forbidden } from "@/lib/supervision/apiAuth";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!hasSupervisionCapability(user.role, "canInviteStudent"))
    return forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "Invitation" });

  return Response.json({ invitations: await listInvitationsBySupervisor(user.id) }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!hasSupervisionCapability(user.role, "canInviteStudent"))
    return forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "Invitation" });

  const limit = rateLimiter.check(rateLimitKey("invitations", user.id), 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop d'invitations créées récemment. Réessayez plus tard." }, { status: 429 });
  }

  let body: { studentEmail?: string; researchId?: string } = {};
  try {
    body = await request.json();
  } catch {
    // corps optionnel
  }

  const invitation = await createInvitation({ supervisorId: user.id, studentEmail: body.studentEmail, researchId: body.researchId });
  return Response.json({ invitation }, { status: 201 });
}
