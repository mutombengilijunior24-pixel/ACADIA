"use client";

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";

const DATA_TYPE_LABELS: Record<string, string> = {
  text: "Texte",
  integer: "Entier",
  decimal: "Numérique",
  boolean: "Booléen",
  single_choice: "Choix unique",
  multiple_choice: "Choix multiples",
  likert: "Échelle de Likert",
  date: "Date",
};

const MEASUREMENT_LABELS: Record<string, string> = {
  nominal: "Nominal",
  ordinal: "Ordinal",
  interval: "Intervalle",
  ratio: "Ratio",
};

interface DatasetDictionaryProps {
  dataset: Dataset;
  project: ResearchProject;
}

export default function DatasetDictionary({ dataset, project }: DatasetDictionaryProps) {
  return (
    <div>
      <p className="mb-3 text-xs text-slate-400">
        Ce dictionnaire prépare l&apos;analyse — il ne réalise aucun calcul statistique.
      </p>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50">
            <tr>
              {["Nom", "Libellé", "Type", "Mesure", "Rôle", "Source", "Traçabilité"].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-slate-400"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {dataset.columns.map((column) => {
              const variable = column.variableId
                ? project.variables.find((v) => v.id === column.variableId)
                : undefined;
              const dimension = variable?.dimensions.find((d) => d.id === column.dimensionId);
              const indicator = dimension?.indicators.find((i) => i.id === column.indicatorId);

              return (
                <tr key={column.id} className="hover:bg-slate-50/60">
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-xs font-bold text-acadia-blue">
                    {column.name}
                  </td>
                  <td className="px-3 py-2 text-xs text-slate-700">{column.label}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                    {DATA_TYPE_LABELS[column.dataType] ?? column.dataType}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600">
                    {MEASUREMENT_LABELS[column.measurementLevel] ?? column.measurementLevel}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-500">
                    {column.role ?? "—"}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 font-mono text-2xs text-slate-400">
                    {column.sourceQuestionId ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-2xs text-slate-500">
                    {indicator
                      ? `${variable?.name} → ${dimension?.name} → ${indicator.name}`
                      : "Sans lien scientifique établi"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
