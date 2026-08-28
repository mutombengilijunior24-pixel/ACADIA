// ============================================================
// ACADIA — PROFIL ACADÉMIQUE DU DIRECTEUR (P16)
// ============================================================

import { getSupervisorProfile, upsertSupervisorProfile } from "@/lib/supervision/SupervisorProfileStore";
import { getSessionUser, unauthorized, forbidden } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "supervisor") return forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "SupervisorProfile" });

  const profile = (await getSupervisorProfile(user.id)) ?? null;
  return Response.json({ profile }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "supervisor") return forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "SupervisorProfile" });

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const allowedKeys = [
    "fullName",
    "academicTitle",
    "institution",
    "faculty",
    "department",
    "domain",
    "specialties",
    "activeAcademicYear",
    "isActive",
    "professionalEmail",
    "signature",
  ] as const;

  const patch: Record<string, unknown> = {};
  for (const key of allowedKeys) {
    if (key in body) patch[key] = body[key];
  }

  const profile = await upsertSupervisorProfile(user.id, patch);
  return Response.json({ profile }, { status: 200 });
}
