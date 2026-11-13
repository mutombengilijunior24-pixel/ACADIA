// ============================================================
// ACADIA — ANNUAIRE DES DIRECTEURS : modifier une fiche (administration)
//
// PATCH : identité, notes internes, état du canevas, désactivation ou
// réactivation. Pas de suppression : le lien avec les projets est gardé.
// ============================================================

import { z } from "zod";

import { DIRECTOR_LOGIC_STATUSES } from "@/lib/core/directors/directors";
import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { directorErrorResponse, updateDirector } from "@/lib/server/directors/DirectorsService";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const optional = (max: number) => z.string().max(max).optional();

const patchSchema = z.object({
  fullName: z.string().trim().min(3, "Le nom complet du directeur est obligatoire.").max(160).optional(),
  academicTitle: optional(80),
  institution: optional(160),
  faculty: optional(160),
  department: optional(160),
  specialties: optional(400),
  notes: optional(8000),
  logicStatus: z.enum(DIRECTOR_LOGIC_STATUSES).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(request: Request, context: RouteContext) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const { id } = await context.params;
  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues[0]?.message ?? "Requête invalide." }, { status: 400 });
  if (!Object.keys(parsed.data).length) return Response.json({ error: "Requête vide." }, { status: 400 });
  try {
    return Response.json({ director: await updateDirector(gate.user.id, id, parsed.data) }, { status: 200 });
  } catch (error) {
    return directorErrorResponse(error);
  }
}
