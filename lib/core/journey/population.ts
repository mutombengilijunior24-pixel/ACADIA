/**
 * Écarts entre la population ciblée (déclarée dans le cadre de la recherche) et les caractéristiques
 * observées dans l'échantillon. ACADIA signale ; il n'exclut jamais un répondant d'office.
 * Seules des règles explicites et vérifiables sont appliquées (aujourd'hui : le sexe).
 */
import { excludedRows } from "@/lib/core/data/preparation";
import { interpretCell } from "@/lib/core/data/cells";
import type { ImportedDataset, PreparationState } from "@/lib/core/data/types";
import { fold } from "@/lib/core/understanding/text";

import type { FileStructure } from "./structure";

export interface PopulationGap {
  rule: string;
  column: number;
  header: string;
  /** Ce que la population ciblée laisse attendre. */
  expected: string;
  /** Réponses hors du champ annoncé. */
  unexpected: Array<{ value: string; count: number }>;
  count: number;
  /** Indices des lignes du jeu de données (pour une exclusion explicite, réversible). */
  rows: number[];
  /** Numéros de ligne du fichier. */
  sourceRows: number[];
  message: string;
}

const clean = (label: string) => fold(label).replace(/^[^a-z0-9]+/, "").trim();
const FEMALE = /^(f|femme|femmes|feminin|feminine|fille|filles|female|woman|women)$/;
const MALE = /^(m|h|homme|hommes|masculin|garcon|garcons|male|man|men)$/;
const SEX_HEADER = /\b(sexe|genre)\b/;

export function populationGaps(input: { population: string; dataset: ImportedDataset; preparation: PreparationState; structure: FileStructure }): PopulationGap[] {
  const population = fold(input.population ?? "");
  if (!population.trim()) return [];
  const wantsFemale = /\b(femmes?|filles?|feminin\w*)\b/.test(population);
  const wantsMale = /\b(hommes?|garcons?|masculin\w*)\b/.test(population);
  if (wantsFemale === wantsMale) return [];
  const unit = input.structure.units.find((u) => u.kind !== "technical" && u.primaryColumn !== null && SEX_HEADER.test(fold(u.text)));
  if (!unit) return [];
  const column = unit.primaryColumn!;
  const excluded = excludedRows(input.preparation);
  const outside = wantsFemale ? MALE : FEMALE;
  const rows: number[] = [];
  const counts = new Map<string, number>();
  input.dataset.rows.forEach((row, index) => {
    if (excluded.has(index)) return;
    const cell = interpretCell(row[column]);
    if (cell.kind === "missing" || cell.kind === "empty_string" || cell.kind === "whitespace") return;
    const label = cell.label.trim();
    if (!outside.test(clean(label))) return;
    rows.push(index);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  });
  if (!rows.length) return [];
  const sourceRows = rows.map((r) => input.dataset.sourceRows[r]);
  const unexpected = [...counts.entries()].map(([value, count]) => ({ value, count }));
  const expected = wantsFemale ? "des femmes" : "des hommes";
  return [
    {
      rule: "population-sexe",
      column,
      header: unit.text,
      expected,
      unexpected,
      count: rows.length,
      rows,
      sourceRows,
      message: `La population ciblée est « ${input.population.trim()} », mais ${rows.length} répondant(s) ont répondu ${unexpected.map((u) => `« ${u.value} »`).join(" ou ")} à « ${unit.text} » (lignes ${sourceRows.slice(0, 15).join(", ")}${sourceRows.length > 15 ? "…" : ""}). Ils n'ont pas été exclus : vérifiez s'ils relèvent du champ de l'étude ; les résultats portent sur l'ensemble des répondants retenus.`,
    },
  ];
}
