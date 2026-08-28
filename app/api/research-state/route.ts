// ============================================================
// ACADIA — ÉTAT DE RECHERCHE (P17)
//
// Remplace localStorage comme source de vérité (voir
// ACADIA_P17_PRODUCTION_ARCHITECTURE.md §4). GET renvoie l'état
// complet de l'utilisateur authentifié ; PUT synchronise (upsert
// uniquement) l'état reçu du client. ownerId toujours dérivé de la
// session — jamais du corps de la requête.
// ============================================================

import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { getResearchState, syncResearchState, type ResearchStateBundle } from "@/lib/server/research/ResearchStateService";

export const runtime = "nodejs";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const state = await getResearchState(user.id);
  return Response.json({ state }, { status: 200 });
}

export async function PUT(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  let body: Partial<ResearchStateBundle>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const bundle: ResearchStateBundle = {
    researches: body.researches ?? [],
    projects: body.projects ?? {},
    instruments: body.instruments ?? {},
    datasets: body.datasets ?? {},
    annotations: body.annotations ?? {},
    bibliography: body.bibliography ?? {},
    exportHistory: body.exportHistory ?? {},
    theoreticalFramework: body.theoreticalFramework ?? {},
  };

  const result = await syncResearchState(user.id, bundle);
  return Response.json({ ok: true, synced: result.synced }, { status: 200 });
}
