// ============================================================
// ACADIA — BARÈME D'UNE QUESTION (mission Assignment Builder + TP Intelligence)
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { setRubric, getRubric } from "@/lib/server/assessment/RubricService";
import { toAssessmentErrorResponse } from "@/lib/server/assessment/httpErrors";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const criterionSchema = z.object({
  name: z.string().min(1).max(300),
  description: z.string().max(2000).optional(),
  maxScore: z.number().min(0),
  expectedElements: z.array(z.string().max(500)).optional(),
  weight: z.number().min(0).optional(),
  order: z.number().int().min(0).optional(),
});

const bodySchema = z.object({ criteria: z.array(criterionSchema).min(1) });

export async function PUT(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Requête invalide." }, { status: 400 });
  }

  try {
    const rubric = await setRubric(user.id, id, parsed.data.criteria);
    return Response.json({ rubric }, { status: 200 });
  } catch (error) {
    return toAssessmentErrorResponse(error);
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const rubric = await getRubric(id);
  return Response.json({ rubric }, { status: 200 });
}
