// ============================================================
// ACADIA — DOCUMENT TABLE BUILDER (P12.13)
//
// Construit des tableaux numérotés à partir de données déjà
// calculées par P6/P11 (flatSort, confrontation des hypothèses...).
// Aucun chiffre n'est recalculé ici — uniquement mis en forme.
//
// Le compteur de numérotation est un objet local (jamais une
// variable de module) : plusieurs exports peuvent s'exécuter en
// parallèle côté serveur, un compteur partagé corromprait la
// numérotation d'un document avec celle d'un autre.
// ============================================================

import type { FlatSortRow, HypothesisConfrontationRow, HypothesisConfrontationStatus } from "@/lib/core/scientific-work/ScientificWorkTypes";
import type { DocumentTableModel } from "./DocumentTypes";
import { DEFAULT_SOURCE_LABEL } from "./DocumentTypes";

export interface DocumentCounter {
  value: number;
}

export function createDocumentCounter(): DocumentCounter {
  return { value: 0 };
}

function nextNumber(counter: DocumentCounter): number {
  counter.value += 1;
  return counter.value;
}

export function buildFlatSortTable(counter: DocumentCounter, id: string, variableLabel: string, rows: FlatSortRow[]): DocumentTableModel {
  return {
    id,
    number: nextNumber(counter),
    title: `Répartition — ${variableLabel}`,
    columns: ["Modalité", "Effectif", "Pourcentage"],
    rows: rows.map((r) => [r.modality, String(r.count), `${r.percentage.toFixed(1)} %`]),
    source: DEFAULT_SOURCE_LABEL,
  };
}

export const HYPOTHESIS_STATUS_LABELS: Record<HypothesisConfrontationStatus, string> = {
  to_examine: "À examiner",
  compatible: "Résultat compatible",
  not_compatible: "Résultat non compatible",
  inconclusive: "Inconclusif",
  not_applicable: "Non applicable",
};

export function buildHypothesisConfrontationTable(counter: DocumentCounter, rows: HypothesisConfrontationRow[]): DocumentTableModel | null {
  if (rows.length === 0) return null;
  return {
    id: "table-hypothesis-confrontation",
    number: nextNumber(counter),
    title: "Confrontation des hypothèses",
    columns: ["Hypothèse", "Variable(s)", "Test utilisé", "Résultat statistique", "Interprétation", "Statut"],
    rows: rows.map((h) => [
      h.statement,
      h.variableLabels.join(", ") || "—",
      h.testUsed,
      h.statisticalResult,
      h.interpretation,
      HYPOTHESIS_STATUS_LABELS[h.status],
    ]),
    source: DEFAULT_SOURCE_LABEL,
  };
}
