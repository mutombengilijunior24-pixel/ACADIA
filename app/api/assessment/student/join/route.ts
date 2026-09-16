// ============================================================
// ACADIA — REJOINDRE UNE COHORTE PAR CODE (mission Student Enrollment)
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { joinCohortByCode } from "@/lib/server/assessment/EnrollmentService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

const bodySchema = z.object({ code: z.string().min(1).max(50) });

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Le code de classe est requis." }, { status: 400 });
  }

  try {
    const membership = await joinCohortByCode(user.id, parsed.data.code);
    return Response.json({ membership }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}
