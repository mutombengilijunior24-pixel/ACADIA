/**
 * Exécution des analyses VALIDÉES uniquement, avec les moteurs existants :
 * moteur descriptif (une seule passe pour toutes les variables concernées) et moteur inférentiel.
 */
import { computeDescriptiveStatistics, preparationKey, type SkippedVariable, type VariableDescriptive } from "@/lib/core/analysis/descriptiveStatistics";
import { multipleTestingNote, runAnalysis, type AnalysisOutcome, type MethodId } from "@/lib/core/analysis/inferential";
import type { ImportedDataset, PreparationState, VariableMetadata } from "@/lib/core/data/types";
import { interpretCell } from "@/lib/core/data/cells";
import { preparedColumn } from "@/lib/core/data/preparation";
import { hashKey } from "@/lib/core/understanding/text";

import { structuralPreparation } from "./consistency";

import { itemStatus, orderedItems, type AnalysisPlan, type PlanDecisions, type PlanItem } from "./plan";

export type ExecutedItem =
  | {
      item: PlanItem;
      kind: "descriptive";
      results: VariableDescriptive[];
      skipped: SkippedVariable[];
      /** Réponses structurelles (« Non concernée ») retirées du dénominateur, par colonne. */
      structural: Array<{ column: number; values: string[]; count: number }>;
      blocked?: string;
    }
  | { item: PlanItem; kind: "relation"; method: MethodId; outcome: AnalysisOutcome };

export interface Execution {
  key: string;
  /** Jeu de données (identifiant d'import) sur lequel les calculs ont été faits : jamais mélangé avec un autre. */
  datasetId: string;
  items: ExecutedItem[];
  multipleTesting: string | null;
  alpha: number;
}

export function methodOf(item: PlanItem, decisions: PlanDecisions): MethodId | undefined {
  return decisions.method[item.id] ?? item.method;
}

/** Empreinte de ce qui détermine les résultats : données préparées, analyses retenues et méthodes. */
export function executionKey(plan: AnalysisPlan, decisions: PlanDecisions, preparation: PreparationState, extra: unknown): string {
  const accepted = orderedItems(plan, decisions)
    .filter((i) => itemStatus(i, decisions) === "accepted")
    .map((i) => [i.id, i.columns, methodOf(i, decisions)]);
  return hashKey([preparationKey(preparation), accepted, extra]);
}

export function executePlan(input: {
  plan: AnalysisPlan;
  decisions: PlanDecisions;
  dataset: ImportedDataset;
  preparation: PreparationState;
  variables: VariableMetadata[];
  alpha: number;
  independenceConfirmed: boolean;
  key: string;
  /** Questions conditionnelles : valeurs structurelles à retirer du dénominateur, par colonne. */
  structural?: Record<number, string[]>;
}): Execution {
  const { plan, decisions, dataset, variables, alpha } = input;
  const structural = input.structural ?? {};
  // Préparation effective des calculs (les décisions de l'utilisateur et les valeurs brutes sont inchangées).
  const preparation = structuralPreparation(input.preparation, structural);
  const blockedReason = (item: PlanItem) =>
    item.alignment.status === "blocking" && !decisions.mismatchConfirmed?.[item.id]
      ? `Exécution bloquée : ${item.alignment.detail} Confirmez explicitement ce choix dans le plan d'analyse, ou corrigez la correspondance entre concepts et colonnes.`
      : null;
  const structuralCount = (column: number, values: string[]) => {
    const prepared = preparedColumn(dataset, input.preparation, column);
    return prepared.values.filter((v) => values.includes(interpretCell(v).label.trim())).length;
  };
  const accepted = orderedItems(plan, decisions).filter((i) => itemStatus(i, decisions) === "accepted" && i.feasible);
  const descriptiveColumns = new Set(accepted.filter((i) => i.level === "descriptive").flatMap((i) => i.columns));
  const descriptive = descriptiveColumns.size ? computeDescriptiveStatistics(dataset, preparation, variables.filter((v) => descriptiveColumns.has(v.column))) : null;

  const items: ExecutedItem[] = accepted.map((item) => {
    const blocked = blockedReason(item);
    if (item.level === "descriptive") {
      if (blocked) return { item, kind: "descriptive", results: [], skipped: [], structural: [], blocked };
      return {
        item,
        kind: "descriptive",
        structural: item.columns.filter((c) => structural[c]?.length).map((c) => ({ column: c, values: structural[c], count: structuralCount(c, structural[c]) })),
        results: descriptive?.results.filter((r) => item.columns.includes(r.column)) ?? [],
        skipped: descriptive?.skipped.filter((s) => item.columns.includes(s.column)) ?? [],
      };
    }
    const method = methodOf(item, decisions)!;
    if (blocked) return { item, kind: "relation", method, outcome: { ok: false, reason: blocked } };
    return {
      item,
      kind: "relation",
      method,
      outcome: runAnalysis(dataset, preparation, variables, {
        outcomeColumn: item.outcomeColumn!,
        explanatoryColumn: item.explanatoryColumn!,
        method,
        alpha,
        question: item.researchQuestion,
        researchHypothesis: item.hypotheses.join(" ; ") || undefined,
        independenceConfirmed: input.independenceConfirmed,
        categories: decisions.categories?.[item.id],
      }),
    };
  });
  const tests = items.filter((i) => i.kind === "relation" && i.outcome.ok).length;
  return { key: input.key, datasetId: input.preparation.datasetId, items, multipleTesting: multipleTestingNote(tests, alpha), alpha };
}
