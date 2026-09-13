// ============================================================
// ACADIA — LECTURE DES ENTITLEMENTS D'UN PROJET
// (mission Conversion + Pay-as-you-progress)
//
// GET ?projectId=... : liste ce qui est débloqué pour ce projet, plus
// le statut verrouillé/déverrouillé de CHAQUE clé du catalogue — le
// client n'a besoin que d'un seul appel pour rendre l'écran "Sujet ✓
// Compréhension ✓ ... Variables 🔒 ...".
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord } from "@/lib/server/research/ResearchStateService";
import { listEntitlements } from "@/lib/server/billing/EntitlementService";
import { ENTITLEMENT_KEYS, ENTITLEMENT_CATALOG, getEffectivePriceUsd, isBetaMode } from "@/lib/server/billing/PricingConfig";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const projectId = new URL(request.url).searchParams.get("projectId");
  if (!projectId) {
    return Response.json({ error: "projectId requis." }, { status: 400 });
  }

  const record = await getResearchProjectRecord(projectId);
  if (!record) return notFound();
  if (record.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: projectId });
  }

  const granted = await listEntitlements(user.id, projectId);
  const grantedKeys = new Set(granted.filter((e) => e.status === "active").map((e) => e.key));

  const stages = ENTITLEMENT_KEYS.map((key) => ({
    ...ENTITLEMENT_CATALOG[key],
    priceUsd: getEffectivePriceUsd(key),
    unlocked: grantedKeys.has(key),
  }));

  return Response.json({ betaMode: isBetaMode(), stages }, { status: 200 });
}
