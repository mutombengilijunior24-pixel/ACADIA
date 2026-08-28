// ============================================================
// ACADIA — MON DIRECTEUR (P16, vue étudiant)
// ============================================================

import { listAssignmentsByStudent } from "@/lib/supervision/AssignmentStore";
import { getSupervisorProfile } from "@/lib/supervision/SupervisorProfileStore";
import { findUserById } from "@/lib/auth/UserStore";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const assignments = await listAssignmentsByStudent(user.id);
  if (assignments.length === 0) return Response.json({ supervisor: null }, { status: 200 });

  const assignment = assignments[0];
  const supervisorUser = await findUserById(assignment.supervisorId);
  const profile = await getSupervisorProfile(assignment.supervisorId);

  if (!supervisorUser) return Response.json({ supervisor: null }, { status: 200 });

  return Response.json(
    {
      supervisor: {
        id: supervisorUser.id,
        firstName: supervisorUser.firstName,
        lastName: supervisorUser.lastName ?? "",
        email: supervisorUser.email,
        profile: profile ?? null,
        researchId: assignment.researchId,
      },
    },
    { status: 200 }
  );
}
