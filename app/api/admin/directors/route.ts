// ============================================================
// ACADIA — ANNUAIRE DES DIRECTEURS (administration)
//
// GET : tous les directeurs (avec notes et nombre de projets) et les noms
// tapés par les étudiants hors annuaire. POST : un directeur, ou une liste
// collée ({ bulk }). requireAdmin() sur chaque appel ; écritures tracées.
// ============================================================

import { z } from "zod";

import { DIRECTOR_LOGIC_STATUSES, MAX_IMPORT_LINES } from "@/lib/core/directors/directors";
import { requireAdmin } from "@/lib/server/admin/adminAuth";
import {
  createDirector,
  directorErrorResponse,
  importDirectors,
  listAdminDirectors,
  listUnlistedNames,
} from "@/lib/server/directors/DirectorsService";

export const runtime = "nodejs";

const optional = (max: number) => z.string().max(max).optional();

const directorFieldsSchema = z.object({
  fullName: z.string().trim().min(3, "Le nom complet du directeur est obligatoire.").max(160),
  academicTitle: optional(80),
  institution: optional(160),
  faculty: optional(160),
  department: optional(160),
  specialties: optional(400),
  notes: optional(8000),
  logicStatus: z.enum(DIRECTOR_LOGIC_STATUSES).optional(),
});

const postSchema = z.union([
  z.object({ bulk: z.string().min(1, "La liste est vide.").max(MAX_IMPORT_LINES * 600) }),
  directorFieldsSchema,
]);

export async function GET() {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const [directors, unlisted] = await Promise.all([listAdminDirectors(), listUnlistedNames()]);
  return Response.json({ directors, unlisted }, { status: 200, headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  try {
    if ("bulk" in parsed.data) {
      return Response.json({ imported: await importDirectors(gate.user.id, parsed.data.bulk) }, { status: 200 });
    }
    return Response.json({ director: await createDirector(gate.user.id, parsed.data) }, { status: 201 });
  } catch (error) {
    return directorErrorResponse(error);
  }
}
