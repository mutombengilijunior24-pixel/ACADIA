// ============================================================
// ACADIA — DOCUMENT FIGURE BUILDER (P12.14)
//
// Construit des figures numérotées à partir des mêmes données de
// répartition déjà utilisées par les tableaux (flatSort) — jamais
// une nouvelle donnée calculée. Les figures sont des graphiques
// vectoriels natifs (barres) construits directement par le
// moteur d'export (docx / react-pdf), jamais une capture d'écran.
// ============================================================

import type { FlatSortRow } from "@/lib/core/scientific-work/ScientificWorkTypes";
import type { DocumentFigureModel } from "./DocumentTypes";
import { DEFAULT_SOURCE_LABEL } from "./DocumentTypes";
import type { DocumentCounter } from "./DocumentTableBuilder";

function nextNumber(counter: DocumentCounter): number {
  counter.value += 1;
  return counter.value;
}

export function buildBarFigure(counter: DocumentCounter, id: string, variableLabel: string, rows: FlatSortRow[]): DocumentFigureModel {
  return {
    id,
    number: nextNumber(counter),
    title: `Répartition — ${variableLabel}`,
    kind: "bar",
    data: rows.map((r) => ({ label: r.modality, value: r.count })),
    source: DEFAULT_SOURCE_LABEL,
  };
}
