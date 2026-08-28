// ============================================================
// ACADIA — BRIEF DIRECTEUR (P16)
// ============================================================

import { getSubmissionById } from "@/lib/supervision/SubmissionStore";
import { getBriefForSubmission, saveBrief } from "@/lib/supervision/BriefStore";
import { buildSupervisorBrief } from "@/lib/core/supervision/SupervisorBriefEngine";
import { hasSupervisionCapability } from "@/lib/core/entitlements/EntitlementEngine";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!hasSupervisionCapability(user.role, "canUseSupervisorBrief"))
    return forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "Submission" });

  const { id } = await context.params;
  const submission = await getSubmissionById(id);
  if (!submission) return notFound();
  if (submission.supervisorId !== user.id)
    return forbidden("Vous n'êtes pas le directeur de cette soumission.", { actorId: user.id, entityType: "Submission", entityId: id });

  const url = new URL(request.url);
  const forceRegenerate = url.searchParams.get("regenerate") === "1";

  const existing = forceRegenerate ? undefined : await getBriefForSubmission(id);
  if (existing) return Response.json({ brief: existing }, { status: 200 });

  const generated = buildSupervisorBrief(
    id,
    submission.snapshot.project,
    submission.snapshot.theoreticalFramework,
    submission.snapshot.instrument
  );
  const saved = await saveBrief(generated);

  return Response.json({ brief: saved }, { status: 200 });
}
