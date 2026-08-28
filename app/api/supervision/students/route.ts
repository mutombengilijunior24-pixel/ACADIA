// ============================================================
// ACADIA — MES ÉTUDIANTS (P16, vue directeur)
// ============================================================

import { listAssignmentsBySupervisor } from "@/lib/supervision/AssignmentStore";
import { listSubmissionsBySupervisor } from "@/lib/supervision/SubmissionStore";
import { findUserById } from "@/lib/auth/UserStore";
import { getSessionUser, unauthorized, forbidden } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "supervisor") return forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "Student" });

  const assignments = await listAssignmentsBySupervisor(user.id);
  const submissions = await listSubmissionsBySupervisor(user.id);

  const students = await Promise.all(
    assignments.map(async (assignment) => {
      const student = await findUserById(assignment.studentId);
      const studentSubmissions = submissions
        .filter((s) => s.studentId === assignment.studentId)
        .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

      const latest = studentSubmissions[0];

      return {
        assignmentId: assignment.id,
        studentId: assignment.studentId,
        firstName: student?.firstName ?? "Étudiant",
        lastName: student?.lastName ?? "",
        email: student?.email ?? "",
        researchId: assignment.researchId,
        latestSubmission: latest
          ? {
              id: latest.id,
              researchId: latest.researchId,
              researchTitle: latest.snapshot.project.title,
              version: latest.version,
              status: latest.status,
              submittedAt: latest.submittedAt,
            }
          : null,
        submissionCount: studentSubmissions.length,
      };
    })
  );

  return Response.json({ students }, { status: 200 });
}
