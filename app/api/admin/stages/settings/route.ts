// ============================================================
// MNJ STAGE CONNECT — CRM : réglages modifiables par l'équipe
// (numéros Mobile Money de MNJ affichés aux étudiants). Administrateurs.
// ============================================================

import { z } from "zod";

import { momoAccountsSchema } from "@/lib/core/stages/momo";
import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { getMomoAccounts, setMomoAccounts, stageErrorResponse } from "@/lib/server/stages/StageService";

export const runtime = "nodejs";

export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  try {
    return Response.json({ momoAccounts: await getMomoAccounts() }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return stageErrorResponse(error);
  }
}

const schema = z.object({ momoAccounts: momoAccountsSchema });

export async function PUT(request: Request) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Réglages invalides." }, { status: 400 });
  try {
    return Response.json({ momoAccounts: await setMomoAccounts(guard.user.id, parsed.data.momoAccounts) }, { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
