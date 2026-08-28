"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";

type ObservationValues = Dataset["rows"][number]["values"];

interface DatasetTableProps {
  dataset: Dataset;
  onUpdateValue: (rowId: string, columnId: string, value: ObservationValues[string]) => void;
  onDeleteObservation: (rowId: string) => void;
}

function formatValue(value: ObservationValues[string]): string {
  if (value === null || value === undefined || value === "") return "—";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  return String(value);
}

export default function DatasetTable({ dataset, onUpdateValue, onDeleteObservation }: DatasetTableProps) {
  const [editingCell, setEditingCell] = useState<{ rowId: string; columnId: string } | null>(null);
  const [draft, setDraft] = useState("");
  const [confirmingRowId, setConfirmingRowId] = useState<string | null>(null);

  if (dataset.rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">
        Aucune observation saisie. Utilisez « + Ajouter une observation » pour commencer.
      </p>
    );
  }

  function commitEdit(rowId: string, columnId: string) {
    onUpdateValue(rowId, columnId, draft);
    setEditingCell(null);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            <th className="whitespace-nowrap px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-slate-400">
              ID
            </th>
            {dataset.columns.map((column) => (
              <th
                key={column.id}
                className="whitespace-nowrap px-3 py-2 text-left text-2xs font-bold uppercase tracking-wider text-slate-400"
                title={column.label}
              >
                {column.name}
              </th>
            ))}
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {dataset.rows.map((row, index) => (
            <tr key={row.id} className="hover:bg-slate-50/60">
              <td className="whitespace-nowrap px-3 py-2 font-mono text-2xs text-slate-400">
                {String(index + 1).padStart(3, "0")}
              </td>
              {dataset.columns.map((column) => {
                const isEditing = editingCell?.rowId === row.id && editingCell?.columnId === column.id;
                return (
                  <td key={column.id} className="whitespace-nowrap px-3 py-2 text-slate-700">
                    {isEditing ? (
                      <input
                        autoFocus
                        value={draft}
                        onChange={(e) => setDraft(e.target.value)}
                        onBlur={() => commitEdit(row.id, column.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit(row.id, column.id);
                          if (e.key === "Escape") setEditingCell(null);
                        }}
                        className="w-24 rounded-md border border-acadia-blue px-1.5 py-1 text-xs focus:outline-none"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCell({ rowId: row.id, columnId: column.id });
                          setDraft(formatValue(row.values[column.id]) === "—" ? "" : formatValue(row.values[column.id]));
                        }}
                        className="rounded-md px-1.5 py-1 text-xs hover:bg-acadia-blue-50"
                      >
                        {formatValue(row.values[column.id])}
                      </button>
                    )}
                  </td>
                );
              })}
              <td className="whitespace-nowrap px-3 py-2 text-right">
                {confirmingRowId === row.id ? (
                  <span className="inline-flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        onDeleteObservation(row.id);
                        setConfirmingRowId(null);
                      }}
                      className="rounded-md bg-red-600 px-2 py-1 text-2xs font-semibold text-white hover:bg-red-700"
                    >
                      Confirmer
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingRowId(null)}
                      className="rounded-md border border-slate-200 px-2 py-1 text-2xs font-semibold text-slate-600"
                    >
                      Annuler
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingRowId(row.id)}
                    className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    aria-label="Supprimer cette observation"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
