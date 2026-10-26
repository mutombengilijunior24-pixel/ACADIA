// ============================================================
// MNJ STAGE CONNECT — CRM : liste de tous les dossiers (administrateurs).
// « ?purpose=export » trace l'export Excel dans le journal d'audit.
// ============================================================

import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { adminList, stageErrorResponse } from "@/lib/server/stages/StageService";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  try {
    const rows = await adminList();
    if (new URL(request.url).searchParams.get("purpose") === "export") await logAudit({ actorId: guard.user.id, action: "STAGE_EXPORTED", entityType: "StageApplication", metadata: { count: rows.length } });
    return Response.json({ applications: rows }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
