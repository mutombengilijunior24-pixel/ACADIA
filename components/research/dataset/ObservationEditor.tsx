"use client";

import { useState } from "react";
import { X } from "lucide-react";
import type { Dataset, DatasetColumn } from "@/lib/core/dataset/DatasetTypes";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";

type ObservationValues = Dataset["rows"][number]["values"];

interface ObservationEditorProps {
  dataset: Dataset;
  onSave: (values: ObservationValues) => void;
  onCancel: () => void;
}

export default function ObservationEditor({ dataset, onSave, onCancel }: ObservationEditorProps) {
  const [values, setValues] = useState<ObservationValues>({});

  function setValue(columnId: string, value: ObservationValues[string]) {
    setValues((prev) => ({ ...prev, [columnId]: value }));
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-t-3xl bg-white p-6 shadow-xl sm:rounded-3xl">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">
              Nouvelle observation — saisie de démonstration
            </p>
            <h3 className="mt-1 text-lg font-bold text-acadia-navy">
              Observation #{String(dataset.rows.length + 1).padStart(3, "0")}
            </h3>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
            aria-label="Fermer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {dataset.columns.map((column) => (
            <ColumnField key={column.id} column={column} value={values[column.id]} onChange={(v) => setValue(column.id, v)} />
          ))}
        </div>

        <div className="mt-6 flex gap-3">
          <ResearchPrimaryButton onClick={() => onSave(values)}>Enregistrer</ResearchPrimaryButton>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-slate-200 px-6 py-2.5 text-sm font-semibold text-slate-600"
          >
            Annuler
          </button>
        </div>
      </div>
    </div>
  );
}


function ColumnField({
  column,
  value,
  onChange,
}: {
  column: DatasetColumn;
  value: ObservationValues[string];
  onChange: (value: ObservationValues[string]) => void;
}) {
  const label = (
    <label className="text-2xs font-bold uppercase tracking-wider text-slate-400">
      {column.name}
      <span className="ml-1 font-normal normal-case text-slate-400">— {column.label}</span>
      {column.required && <span className="ml-1 text-red-500">*</span>}
    </label>
  );

  if (column.dataType === "boolean") {
    return (
      <div>
        {label}
        <select
          value={typeof value === "boolean" ? (value ? "true" : "false") : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value === "true")}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-acadia-blue focus:outline-none"
        >
          <option value="">—</option>
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      </div>
    );
  }

  if (column.dataType === "single_choice" || column.dataType === "likert") {
    return (
      <div>
        {label}
        <select
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-acadia-blue focus:outline-none"
        >
          <option value="">—</option>
          {(column.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.label}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (column.dataType === "multiple_choice") {
    const selected = Array.isArray(value) ? value : [];
    return (
      <div>
        {label}
        <div className="mt-1.5 flex flex-wrap gap-2">
          {(column.options ?? []).map((opt) => {
            const checked = selected.includes(opt.label);
            return (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-full px-3 py-1 text-xs font-semibold ring-1 ${
                  checked ? "bg-acadia-blue-50 text-acadia-blue ring-acadia-blue" : "text-slate-500 ring-slate-200"
                }`}
              >
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={checked}
                  onChange={() =>
                    onChange(checked ? selected.filter((v) => v !== opt.label) : [...selected, opt.label])
                  }
                />
                {opt.label}
              </label>
            );
          })}
        </div>
      </div>
    );
  }

  if (column.dataType === "date") {
    return (
      <div>
        {label}
        <input
          type="date"
          value={typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-acadia-blue focus:outline-none"
        />
      </div>
    );
  }

  if (column.dataType === "integer" || column.dataType === "decimal") {
    return (
      <div>
        {label}
        <input
          type="number"
          value={typeof value === "number" ? value : typeof value === "string" ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-acadia-blue focus:outline-none"
        />
      </div>
    );
  }

  return (
    <div>
      {label}
      <input
        type="text"
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:border-acadia-blue focus:outline-none"
      />
    </div>
  );
}
