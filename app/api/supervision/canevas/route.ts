// ============================================================
// ACADIA — CANEVAS DE SUPERVISION (P16)
// ============================================================

import { listCanevasBySupervisor, createCanevas } from "@/lib/supervision/CanevasStore";
import { getSessionUser, unauthorized, forbidden } from "@/lib/supervision/apiAuth";
import type { CanevasStep, WorkType, HypothesisCountRule } from "@/lib/core/supervision/SupervisionTypes";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "supervisor") return forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "Canevas" });

  return Response.json({ canevas: await listCanevasBySupervisor(user.id) }, { status: 200 });
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (user.role !== "supervisor") return forbidden("Réservé aux comptes directeur.", { actorId: user.id, entityType: "Canevas" });

  let body: {
    academicYear?: string;
    faculty?: string;
    department?: string;
    workTypes?: WorkType[];
    steps?: Omit<CanevasStep, "id" | "status">[];
    hypothesisRules?: HypothesisCountRule[];
    activate?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  if (!body.academicYear || !body.steps || body.steps.length === 0) {
    return Response.json({ error: "Année académique et au moins une étape sont requises." }, { status: 400 });
  }

  const canevas = await createCanevas({
    supervisorId: user.id,
    academicYear: body.academicYear,
    faculty: body.faculty,
    department: body.department,
    workTypes: body.workTypes ?? [],
    steps: body.steps,
    hypothesisRules: body.hypothesisRules,
    activate: body.activate,
  });

  return Response.json({ canevas }, { status: 201 });
}
