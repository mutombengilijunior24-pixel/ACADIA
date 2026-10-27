// ============================================================
// MNJ STAGE CONNECT — CRM : fiche d'un dossier (administrateurs).
// GET : dossier complet (présences, liens d'accès). PATCH : faits du
// suivi (documents reçus, orientation, placement, dates, paiement au
// bureau, annulation / réactivation). L'étape n'est jamais envoyée :
// le serveur la recalcule à partir de ces faits. Chaque action est tracée.
// ============================================================

import { z } from "zod";

import { STAGE_OPTION_IDS, type StageOptionId } from "@/lib/core/stages/catalog";
import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { adminGet, adminUpdate, stageErrorResponse } from "@/lib/server/stages/StageService";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const text = (max: number) => z.string().max(max).optional();
const day = z.union([z.literal(""), z.string().regex(/^\d{4}-\d{2}-\d{2}$/)]).optional();

const patchSchema = z.object({
  adminNotes: text(4000),
  documentsReceived: z.array(z.string().max(200)).max(20).optional(),
  assignedCompany: text(160),
  companyAddress: text(240),
  tutorName: text(120),
  tutorRole: text(120),
  tutorPhone: text(40),
  tutorEmail: z.union([z.literal(""), z.string().trim().email("E-mail du maître de stage invalide.").max(160)]).optional(),
  startDate: day,
  endDate: day,
  paidAtOffice: z.literal(true).optional(),
  paidOptions: z.array(z.enum(STAGE_OPTION_IDS as [string, ...string[]])).min(1).max(STAGE_OPTION_IDS.length).optional(),
  paymentDecision: z.enum(["confirm", "reject"]).optional(),
  action: z.enum(["cancel", "reactivate"]).optional(),
});

export async function GET(_request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { id } = await context.params;
  try {
    return Response.json({ application: await adminGet(id) }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return stageErrorResponse(error);
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  if (!Object.keys(parsed.data).length) return Response.json({ error: "Requête vide." }, { status: 400 });
  try {
    return Response.json({ application: await adminUpdate(guard.user.id, id, { ...parsed.data, paidOptions: parsed.data.paidOptions as StageOptionId[] | undefined }) }, { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
