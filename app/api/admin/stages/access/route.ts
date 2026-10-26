// ============================================================
// MNJ STAGE CONNECT — CRM : accès des facultés (lecture seule de leurs
// étudiants en stage académique et de leurs registres de présences).
// GET : accès existants + couples établissement/faculté présents dans
// les dossiers. POST : nouvel accès (lien montré une seule fois).
// ============================================================

import { z } from "zod";

import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { createFacultyAccess, facultyScopes, listFacultyAccesses, stageErrorResponse } from "@/lib/server/stages/StageService";

export const runtime = "nodejs";

export async function GET() {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  try {
    const [accesses, scopes] = await Promise.all([listFacultyAccesses(), facultyScopes()]);
    return Response.json({ accesses, scopes }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return stageErrorResponse(error);
  }
}

const schema = z.object({ university: z.string().trim().min(2).max(160), facultyName: z.string().trim().min(2).max(160), days: z.number().int().min(1).max(365).default(90) });

export async function POST(request: Request) {
  const guard = await requireAdmin();
  if ("response" in guard) return guard.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Requête invalide." }, { status: 400 });
  try {
    const { token, access } = await createFacultyAccess(guard.user.id, parsed.data);
    return Response.json({ path: `/stage/faculte/${token}`, access }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
