// ============================================================
// ACADIA — RATTACHEMENT DU COMPTE DIRECTEUR À SA FICHE (vue directeur)
//
// GET : rattachement actuel (demande / validé), noms encore libres, et
// nombre de projets d'étudiants concernés. POST { directorId } : demande
// de rattachement. DELETE : annulation. La validation est faite par
// l'administration ; ensuite, le canevas actif du directeur s'applique
// automatiquement aux étudiants qui l'ont choisi.
// ============================================================

import { z } from "zod";

import type { StoredUser } from "@/lib/auth/AuthTypes";
import { getSessionUser, unauthorized, forbidden } from "@/lib/supervision/apiAuth";
import { cancelMyDirectoryLink, directorErrorResponse, getMyDirectoryLink, requestDirectoryLink } from "@/lib/server/directors/DirectorsService";

export const runtime = "nodejs";

async function requireSupervisor(): Promise<{ response: Response } | { user: StoredUser }> {
  const user = await getSessionUser();
  if (!user) return { response: unauthorized() };
  if (user.role !== "supervisor") return { response: forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "Director" }) };
  return { user };
}

export async function GET() {
  const gate = await requireSupervisor();
  if ("response" in gate) return gate.response;
  return Response.json(await getMyDirectoryLink(gate.user.id), { status: 200, headers: { "Cache-Control": "private, no-store" } });
}

const postSchema = z.object({ directorId: z.string().min(1).max(64) });

export async function POST(request: Request) {
  const gate = await requireSupervisor();
  if ("response" in gate) return gate.response;
  const parsed = postSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Choisissez votre nom dans la liste." }, { status: 400 });
  try {
    return Response.json(await requestDirectoryLink(gate.user.id, parsed.data.directorId), { status: 200 });
  } catch (error) {
    return directorErrorResponse(error);
  }
}

export async function DELETE() {
  const gate = await requireSupervisor();
  if ("response" in gate) return gate.response;
  try {
    return Response.json(await cancelMyDirectoryLink(gate.user.id), { status: 200 });
  } catch (error) {
    return directorErrorResponse(error);
  }
}
