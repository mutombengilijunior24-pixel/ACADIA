// ============================================================
// ACADIA — ENTITLEMENTS : TYPES (P14)
//
// Remplace le vocabulaire « crédits IA » (jamais réel — voir
// audit P14) par une architecture User → Role → Plan →
// Entitlements → FeatureAccess. Aucun prix, aucun paiement réel
// ou simulé n'est introduit ici : un seul plan existe réellement
// aujourd'hui (`free`), et il inclut toutes les fonctionnalités
// déjà construites. L'architecture existe pour permettre une
// vraie tarification plus tard, sans qu'aucune valeur inventée
// ne soit affichée avant qu'elle n'existe réellement.
// ============================================================

// P16 — unifie ce qui était un doublon conceptuel avec `UserRole`
// (lib/auth/AuthTypes.ts) constaté à l'audit : `Role` n'est plus
// qu'un alias, jamais une seconde définition qui pourrait diverger.
import type { UserRole } from "@/lib/auth/AuthTypes";
export type Role = UserRole;

// ------------------------------------------------------------
// P15/P16 — "premium", "supervisor", "supervisor_pro" et
// "institutional" restent des plans CONCEPTUELS : aucun prix n'est
// fixé (monthlyPriceUsd: null), aucun paiement ni crédit n'existe,
// et aucun compte réel ne peut y être assigné aujourd'hui
// (DEFAULT_PLAN_ID reste "free" pour tous). Ils posent uniquement
// la structure prévue par le sprint pour une monétisation future,
// sans inventer de tarification.
// ------------------------------------------------------------

export type PlanId = "free" | "premium" | "supervisor" | "supervisor_pro" | "institutional";

export type FeatureId =
  | "research_wizard"
  | "questionnaire_generation"
  | "dataset_analysis"
  | "econometric_modeling"
  | "scientific_work_export"
  | "docx_pdf_export";

// ------------------------------------------------------------
// P16 — capacités liées à la supervision, centralisées ici plutôt
// que dispersées dans chaque route/composant (Partie 28 du sprint).
// Toutes réellement actives dès qu'un compte a le rôle "supervisor"
// (aucun palier payant réel n'existe encore pour les restreindre).
// ------------------------------------------------------------

export type SupervisionCapability =
  | "canInviteStudent"
  | "canReviewSubmission"
  | "canUseSupervisorBrief"
  | "canCompareVersions"
  | "canExportFeedback";

export interface FeatureDescriptor {
  id: FeatureId;
  label: string;
  description: string;
}

export interface Plan {
  id: PlanId;
  label: string;
  /** null = aucun prix réel n'existe encore pour ACADIA */
  monthlyPriceUsd: number | null;
  features: FeatureId[];
  /** true = plan conceptuel (P15), pas encore assignable à un compte réel. */
  conceptual?: boolean;
}

export const FEATURE_CATALOG: FeatureDescriptor[] = [
  {
    id: "research_wizard",
    label: "Assistant de structuration de recherche",
    description: "Problématique, objectifs, variables, hypothèses, cadre théorique.",
  },
  {
    id: "questionnaire_generation",
    label: "Génération d'instrument de collecte",
    description: "Questionnaire ou guide d'entretien à partir des variables opérationnalisées.",
  },
  {
    id: "dataset_analysis",
    label: "Analyse de données",
    description: "Statistiques descriptives et bivariées sur vos données saisies.",
  },
  {
    id: "econometric_modeling",
    label: "Modélisation économétrique",
    description: "Régression et interprétation économique des résultats.",
  },
  {
    id: "scientific_work_export",
    label: "Document scientifique final",
    description: "Structuration IMRAD complète du travail de recherche.",
  },
  {
    id: "docx_pdf_export",
    label: "Export DOCX / PDF",
    description: "Génération du document final au format Word ou PDF.",
  },
];

// ------------------------------------------------------------
// Un seul plan réel aujourd'hui : gratuit, tout inclus.
// Aucun plan payant n'existe — en ajouter un ici sans prix réel
// serait une invention interdite par la règle scientifique du
// projet appliquée au produit.
// ------------------------------------------------------------

export const PLANS: Record<PlanId, Plan> = {
  free: {
    id: "free",
    label: "ACADIA Gratuit",
    monthlyPriceUsd: null,
    features: FEATURE_CATALOG.map((f) => f.id),
  },
  premium: {
    id: "premium",
    label: "ACADIA Premium (à venir)",
    monthlyPriceUsd: null,
    features: FEATURE_CATALOG.map((f) => f.id),
    conceptual: true,
  },
  supervisor: {
    id: "supervisor",
    label: "ACADIA Superviseur (à venir)",
    monthlyPriceUsd: null,
    features: FEATURE_CATALOG.map((f) => f.id),
    conceptual: true,
  },
  supervisor_pro: {
    id: "supervisor_pro",
    label: "ACADIA Superviseur Pro (à venir)",
    monthlyPriceUsd: null,
    features: FEATURE_CATALOG.map((f) => f.id),
    conceptual: true,
  },
  institutional: {
    id: "institutional",
    label: "ACADIA Institutionnel (à venir)",
    monthlyPriceUsd: null,
    features: FEATURE_CATALOG.map((f) => f.id),
    conceptual: true,
  },
};

export const DEFAULT_PLAN_ID: PlanId = "free";
export const DEFAULT_ROLE: Role = "student";
