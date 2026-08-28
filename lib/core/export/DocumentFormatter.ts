// ============================================================
// ACADIA — DOCUMENT FORMATTER (P12)
//
// Petites fonctions de mise en forme neutres, partagées par les
// deux moteurs d'export (DOCX/PDF) et par DocumentBuilder. Aucune
// logique scientifique — uniquement de la résolution de texte déjà
// calculé (édition humaine P9/P10/P11 prioritaire sur le texte
// généré, jamais l'inverse) et de la mise en forme de libellés.
// ============================================================

import type { WorkContentBlock } from "@/lib/core/scientific-work/ScientificWorkTypes";

export interface AnnotationLike {
  status: string;
  editedContent?: string;
}

export type AnnotationMap = Record<string, AnnotationLike>;

/**
 * Résout le texte réellement affiché pour un bloc donné : l'édition
 * humaine persistée (annotations) prend toujours le pas sur le texte
 * généré — jamais l'inverse. Même règle que AnnotatedBlock (P9/P10/P11).
 */
export function resolveBlockParagraphs(annotations: AnnotationMap | undefined, block: WorkContentBlock): string[] {
  const edited = annotations?.[block.id]?.editedContent;
  const text = edited ?? block.statements.join("\n\n");
  return text
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function resolveNamedTextParagraphs(annotations: AnnotationMap | undefined, id: string, statements: string[]): string[] {
  const edited = annotations?.[id]?.editedContent;
  const text = edited ?? statements.join("\n\n");
  return text
    .split("\n\n")
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}

export function romanChapterLabel(index: number, title: string): string {
  const romans = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];
  return `CHAPITRE ${romans[index] ?? String(index + 1)} — ${title.toUpperCase()}`;
}
