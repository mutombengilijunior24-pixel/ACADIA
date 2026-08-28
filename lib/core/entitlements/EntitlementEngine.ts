// ============================================================
// ACADIA — ENTITLEMENTS : MOTEUR (P14)
// ============================================================

import {
  PLANS,
  DEFAULT_PLAN_ID,
  FEATURE_CATALOG,
  type FeatureId,
  type PlanId,
  type Role,
  type SupervisionCapability,
} from "./EntitlementTypes";

export function getPlan(planId: PlanId = DEFAULT_PLAN_ID) {
  return PLANS[planId];
}

export function hasFeatureAccess(featureId: FeatureId, planId: PlanId = DEFAULT_PLAN_ID): boolean {
  return getPlan(planId).features.includes(featureId);
}

export function listFeatureAccess(planId: PlanId = DEFAULT_PLAN_ID) {
  const plan = getPlan(planId);
  return FEATURE_CATALOG.map((feature) => ({
    ...feature,
    included: plan.features.includes(feature.id),
  }));
}

// ------------------------------------------------------------
// P16 — capacités de supervision centralisées (Partie 28). Toutes
// réellement actives pour un rôle "supervisor" : aucun palier
// payant réel n'existe encore pour les restreindre davantage.
// ------------------------------------------------------------

export function hasSupervisionCapability(role: Role | undefined, capability: SupervisionCapability): boolean {
  if (role !== "supervisor") return false;
  // Toutes les capacités listées sont actives pour un directeur — aucun
  // palier payant réel n'existe encore pour en restreindre certaines.
  const allCapabilities: SupervisionCapability[] = [
    "canInviteStudent",
    "canReviewSubmission",
    "canUseSupervisorBrief",
    "canCompareVersions",
    "canExportFeedback",
  ];
  return allCapabilities.includes(capability);
}

