// ============================================================
// ACADIA — STOCKAGE TEMPORAIRE DE LA PREVIEW SANS COMPTE
// (10/09/2026 ; unifié sur A1 — mission Preview WOW)
//
// Solution minimale demandée explicitement par la mission d'origine :
// aucune nouvelle architecture de persistance pré-authentification,
// juste sessionStorage le temps du parcours landing → preview →
// inscription. Effacé après usage ; perdu en navigation privée ou
// changement d'appareil — limite assumée, pas un vrai système de
// sauvegarde.
//
// Mission Preview WOW — la preview appelle désormais A1 directement
// (understandResearchWithAI, depth="preview") : ce qui est stocké ici
// est donc AIResearchUnderstanding, le même contrat que le parcours
// authentifié complet, jamais un format narratif séparé.
// ============================================================

import type { AIResearchUnderstanding } from "@/lib/ai/openai/SubjectUnderstandingAI";
import type { PhenomenonContextItem } from "@/lib/ai/openai/PhenomenonContextAI";

// Sujet + résultat de la preview, écrit quand l'utilisateur clique
// "Utiliser cette proposition" dans la preview en surimpression sur
// la landing (voir components/landing/SubjectPreviewOverlay.tsx),
// relu après l'inscription pour créer le projet sans perte (voir
// app/dashboard/preview-resume/page.tsx).
export const PENDING_PREVIEW_KEY = "acadia_pending_preview";

export interface PendingPreview {
  subject: string;
  understanding: AIResearchUnderstanding;
  // Research Intelligence V2 — contexte réellement sourcé
  // (PhenomenonContextAI, recherche web) affiché dans la preview.
  // Auparavant jamais reporté ici : il était donc perdu à
  // l'inscription. Optionnel : absent si la recherche de contexte
  // n'a rien trouvé ou n'a pas eu le temps de répondre.
  contextItems?: PhenomenonContextItem[] | null;
}

export function readPendingPreview(): PendingPreview | null {
  try {
    const raw = sessionStorage.getItem(PENDING_PREVIEW_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingPreview;
    if (!parsed?.subject || !parsed?.understanding) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingPreview(): void {
  try {
    sessionStorage.removeItem(PENDING_PREVIEW_KEY);
  } catch {
    // ignore
  }
}
