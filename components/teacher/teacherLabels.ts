// ============================================================
// ACADIA — VOCABULAIRE PARTAGÉ COCKPIT ENSEIGNANT (mission Teacher
// Workspace + Gradebook)
//
// Un seul lexique de libellés/couleurs pour tout le cockpit — évite de
// redéfinir la même table statut→libellé dans 6 pages différentes.
// Toujours un TEXTE en plus de la couleur (mission §10, accessibilité
// — jamais la couleur seule).
// ============================================================

export const ASSIGNMENT_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  draft: { label: "Brouillon", className: "bg-slate-100 text-slate-600" },
  published: { label: "Publié", className: "bg-emerald-100 text-emerald-700" },
  closed: { label: "Fermé", className: "bg-amber-100 text-amber-700" },
  archived: { label: "Archivé", className: "bg-slate-100 text-slate-500" },
};

export const SUBMISSION_STATUS_LABEL: Record<string, { label: string; className: string }> = {
  submitted: { label: "Soumis", className: "bg-blue-100 text-blue-700" },
  under_review: { label: "En revue", className: "bg-amber-100 text-amber-700" },
  graded: { label: "Corrigé", className: "bg-emerald-100 text-emerald-700" },
  returned: { label: "Retourné", className: "bg-slate-100 text-slate-600" },
};

export const PRIORITY_LABEL: Record<string, { label: string; emoji: string; className: string }> = {
  human_review_required: { label: "Revue humaine requise", emoji: "🔴", className: "bg-rose-50 text-rose-700" },
  ai_proposal_pending: { label: "Proposition ACADIA à vérifier", emoji: "🟠", className: "bg-amber-50 text-amber-700" },
  validated: { label: "Correction validée", emoji: "🟢", className: "bg-emerald-50 text-emerald-700" },
};

export const EVALUATION_STATUS_LABEL: Record<string, string> = {
  ai_proposed: "Proposition ACADIA (non vérifiée)",
  human_review: "En attente de revue",
  accepted: "Acceptée par l'enseignant",
  modified: "Modifiée par l'enseignant",
  rejected: "Rejetée par l'enseignant",
  finalized: "Finalisée",
};

export function formatScore(score: number | null, maxScore: number | null): string {
  if (score === null || maxScore === null) return "—";
  const rounded = Math.round(score * 100) / 100;
  return `${rounded} / ${maxScore}`;
}

export function formatDate(value: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
}

export function confidenceLabel(confidence: number | null): string {
  if (confidence === null) return "—";
  if (confidence < 0.2) return "Très faible";
  if (confidence < 0.4) return "Faible";
  if (confidence < 0.6) return "Moyenne";
  if (confidence < 0.8) return "Élevée";
  return "Très élevée";
}
