/**
 * Traçabilité d'un résultat : source, provenance déclarée, version du jeu de données en mémoire,
 * décisions de préparation, variables, moteurs exécutés, paramètres, plan validé et limites.
 */
import { METHOD_LABELS } from "@/lib/core/analysis/inferential";
import type { PreparationState } from "@/lib/core/data/types";
import type { Execution } from "@/lib/core/journey/execute";
import { provenanceStatement, UNDECLARED, type DataProvenance } from "@/lib/core/journey/provenance";

import { SOURCE_LABELS, STRUCTURE_LABELS, UNIT_LABELS, type ClassificationSheet } from "./classification";
import type { Routing } from "./orchestrator";
import { specialtyOf } from "./taxonomy";
import { datasetVersion } from "./view";

export interface ResultTrace {
  datasetId: string;
  fileName: string | null;
  datasetVersion: string;
  provenance: string;
  classification: string;
  perspective: string | null;
  preparation: string[];
  variables: string[];
  engines: string[];
  parameters: string[];
  planKey: string | null;
  limits: string[];
}

export function buildTrace(input: { execution: Execution; preparation: PreparationState; sheet: ClassificationSheet; routing: Routing; provenance: DataProvenance | null; planKey: string | null; independence: boolean }): ResultTrace {
  const { execution, preparation, sheet } = input;
  const relations = execution.items.filter((e) => e.kind === "relation");
  const specialty = specialtyOf(sheet.specialty.value);
  const ops = preparation.operations.map((op) => {
    switch (op.type) {
      case "declare_missing_codes":
        return `Codes de non-réponse déclarés (colonne ${op.column + 1}) : ${op.values.join(", ")}`;
      case "exclude_rows":
        return `${op.rows.length} ligne(s) exclue(s) : ${op.reason}`;
      case "set_statistical_type":
        return `Type confirmé (colonne ${op.column + 1}) : ${op.statisticalType}`;
      default:
        return `Décision « ${op.type} »`;
    }
  });
  const variables = [...new Set(execution.items.flatMap((e) => e.item.variables.map((v) => `${v.name} ← ${v.header} (${v.typeLabel})`)))];
  return {
    datasetId: execution.datasetId,
    fileName: sheet.fileName,
    datasetVersion: datasetVersion(preparation),
    provenance: provenanceStatement(input.provenance ?? UNDECLARED),
    classification: `${SOURCE_LABELS[sheet.source.value]} · ${UNIT_LABELS[sheet.unit.value]} · ${STRUCTURE_LABELS[sheet.structure.value]}${sheet.source.confirmed && sheet.structure.confirmed ? " (confirmé par vous)" : " (détecté ou déduit)"}`,
    perspective: specialty ? `${specialty.label} — ${specialty.perspective}` : null,
    preparation: ops.length ? ops : ["Aucune décision de préparation (données utilisées telles qu'importées)."],
    variables,
    engines: [
      ...(execution.items.some((e) => e.kind === "descriptive") ? ["Statistiques descriptives"] : []),
      ...(relations.length ? [`Analyse statistique inférentielle : ${[...new Set(relations.map((e) => (e.kind === "relation" && e.method ? METHOD_LABELS[e.method] : "")))].filter(Boolean).join(", ")}`] : []),
    ],
    parameters: [`Seuil α = ${String(execution.alpha).replace(".", ",")}`, `Indépendance des observations confirmée : ${input.independence ? "oui" : "non"}`],
    planKey: input.planKey,
    limits: input.routing.steps.filter((s) => s.status === "unavailable" || s.status === "excluded").map((s) => `${s.engine} : ${s.reason}`),
  };
}

/** Lignes prêtes à l'export (Word, Excel). */
export function traceLines(trace: ResultTrace): Array<[string, string]> {
  return [
    ["Fichier", `${trace.fileName ?? "—"} (identifiant ${trace.datasetId})`],
    ["Version des données en mémoire", trace.datasetVersion],
    ["Provenance", trace.provenance],
    ["Classification des données", trace.classification],
    ...(trace.perspective ? ([["Perspective d'interprétation", trace.perspective]] as Array<[string, string]>) : []),
    ["Décisions de préparation", trace.preparation.join(" ; ")],
    ["Variables utilisées", trace.variables.join(" ; ")],
    ["Moteurs exécutés", trace.engines.join(" ; ")],
    ["Paramètres", trace.parameters.join(" ; ")],
    ["Plan validé (empreinte)", trace.planKey ?? "—"],
    ...(trace.limits.length ? ([["Capacités non mobilisées", trace.limits.join(" ; ")]] as Array<[string, string]>) : []),
  ];
}
