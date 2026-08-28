// ============================================================
// ACADIA — CANEVAS : MISE À JOUR (P16)
// ============================================================

import { getCanevasById, updateCanevas } from "@/lib/supervision/CanevasStore";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const canevas = await getCanevasById(id);
  if (!canevas || canevas.supervisorId !== user.id) return notFound();

  return Response.json({ canevas }, { status: 200 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "supervisor") return forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "Canevas" });

  const { id } = await context.params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const allowed = ["steps", "faculty", "department", "workTypes", "hypothesisRules", "isActive"] as const;
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in body) patch[key] = body[key];
  }

  const updated = await updateCanevas(id, user.id, patch);
  if (!updated) return notFound();

  return Response.json({ canevas: updated }, { status: 200 });
}
