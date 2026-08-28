// ============================================================
// ACADIA — CADRE THÉORIQUE (P13.2)
//
// ACADIA ne possédait aucun concept de cadre théorique avant ce
// sprint (confirmé par audit — voir ACADIA_P13_2_AUDIT.md). Ce
// fichier suit exactement le même patron que BibliographyReference
// (P11) : un contenu ajouté EXPLICITEMENT par le chercheur, jamais
// généré ou inventé par ACADIA. Vit dans ResearchContext (comme la
// bibliographie), pas dans ResearchTypes.ts — pour ne jamais
// toucher au contrat central du Research Core.
// ============================================================

export type TheoreticalFrameworkStatus = "none_registered" | "available";

export interface TheoreticalFrameworkEntry {
  id: string;
  /** Concept ou notion théorique mobilisé (ex. "Théorie du capital humain"). */
  concept: string;
  theoryName?: string;
  author?: string;
  year?: number;
  /** Résumé, par le chercheur, du mécanisme ou de l'apport théorique — jamais rédigé par ACADIA. */
  summary?: string;
  /** Lien optionnel vers une référence déjà enregistrée dans la bibliographie (P11). */
  bibliographyReferenceId?: string;
  /**
   * Lien optionnel (P15) vers une variable déjà opérationnalisée du
   * projet — permet d'afficher la chaîne réelle Théorie → Concept →
   * Variable. Jamais déduit automatiquement : uniquement choisi par
   * le chercheur parmi les variables déjà existantes.
   */
  variableId?: string;
  createdAt: string;
}

export function computeTheoreticalFrameworkStatus(entries: TheoreticalFrameworkEntry[]): TheoreticalFrameworkStatus {
  return entries.length > 0 ? "available" : "none_registered";
}

export const THEORY_TO_REGISTER = "Cadre théorique à préciser par le chercheur.";
