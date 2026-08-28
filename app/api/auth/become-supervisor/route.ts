// ============================================================
// ACADIA — DEVENIR DIRECTEUR (P16)
//
// Auto-déclaration explicite : aucune vérification institutionnelle
// n'existe (voir ACADIA_P16_ARCHITECTURE.md §5). Un compte reste
// "student" par défaut ; ce n'est qu'un choix volontaire de
// l'utilisateur, jamais automatique.
// ============================================================

import { setUserRole } from "@/lib/auth/UserStore";
import { upsertSupervisorProfile } from "@/lib/supervision/SupervisorProfileStore";
import { toPublicUser } from "@/lib/auth/AuthTypes";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { logAudit } from "@/lib/server/audit/AuditLog";

export const runtime = "nodejs";

export async function POST() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const updated = await setUserRole(user.id, "supervisor");
  if (!updated) return Response.json({ error: "Utilisateur introuvable." }, { status: 404 });

  await upsertSupervisorProfile(user.id, {
    fullName: `${user.firstName} ${user.lastName ?? ""}`.trim(),
    isActive: true,
  });

  await logAudit({
    actorId: user.id,
    action: "ROLE_ASSIGNED",
    entityType: "User",
    entityId: user.id,
    metadata: { fromRole: user.role, toRole: "supervisor" },
  });

  return Response.json({ user: toPublicUser(updated) }, { status: 200 });
}
