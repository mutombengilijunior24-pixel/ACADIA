"use client";

import { FileSpreadsheet, RefreshCw, Upload } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { displayRaw } from "@/lib/core/data/cells";
import { CANDIDATE_DELIMITERS, delimiterLabel } from "@/lib/core/data/csv";
import type { FileMeta, ImportFlowState } from "@/lib/core/data/flow";
import { DEFAULT_IMPORT_LIMITS, formatBytes } from "@/lib/core/data/limits";
import type { ImportOptions } from "@/lib/core/data/types";

import { IssueList, Pill, Section, buttonClass, inputClass } from "./ui";

const PREVIEW_ROWS = 15;

export function FileDropZone({ onFile }: { onFile: (file: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) onFile(file);
  };

  return (
    <Section
      title="Importer des données"
      description="Formats pris en charge : CSV (.csv, .txt, .tsv) et Excel (.xlsx). Le fichier est lu dans votre navigateur : il n'est ni envoyé à un serveur, ni transmis à une IA."
    >
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-4 py-10 text-center transition ${
          dragging ? "border-blue-500 bg-blue-50" : "border-slate-300 bg-slate-50"
        }`}
      >
        <Upload className="text-blue-600" size={32} aria-hidden />
        <p className="font-semibold text-slate-800">Déposez votre fichier ici</p>
        <p className="text-sm text-slate-500">ou</p>
        <button type="button" className={buttonClass.primary} onClick={() => input.current?.click()}>
          Choisir un fichier
        </button>
        <input
          ref={input}
          type="file"
          accept=".csv,.txt,.tsv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          aria-label="Fichier de données"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) onFile(file);
            event.target.value = "";
          }}
        />
        <p className="text-xs text-slate-500">
          Limites : {formatBytes(DEFAULT_IMPORT_LIMITS.maxFileBytes)}, {DEFAULT_IMPORT_LIMITS.maxRows.toLocaleString("fr-FR")} lignes, {DEFAULT_IMPORT_LIMITS.maxColumns.toLocaleString("fr-FR")} colonnes.
          Les formats SPSS, Stata, SAS, .xls et PDF ne sont pas pris en charge.
        </p>
      </div>
    </Section>
  );
}

export function PreviewStep({
  state,
  onOptions,
  onReplace,
  onConfirm,
}: {
  state: Extract<ImportFlowState, { step: "preview" | "reading" }>;
  onOptions: (options: ImportOptions) => void;
  onReplace: () => void;
  onConfirm: () => void;
}) {
  const reading = state.step === "reading";
  const result = state.step === "preview" ? state.result : null;
  const dataset = result?.ok ? result.dataset : null;
  const sheets = dataset?.xlsx?.availableSheets ?? (result && !result.ok ? result.sheets : undefined);
  const isCsv = /\.(csv|txt|tsv)$/i.test(state.file.name);
  const options = state.options;
  const set = (patch: Partial<ImportOptions>) => onOptions({ ...options, ...patch });

  return (
    <div className="space-y-5">
      <Section
        title="Vérifier la lecture"
        description="Contrôlez ce qu'ACADIA a réellement lu avant de confirmer. Rien n'est enregistré à ce stade."
        action={
          <button type="button" className={buttonClass.secondary} onClick={onReplace}>
            <RefreshCw size={16} aria-hidden /> Remplacer le fichier
          </button>
        }
      >
        <FileSummary file={state.file} format={dataset?.format} />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {isCsv ? (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Séparateur</span>
                <select
                  className={inputClass}
                  value={options.delimiter ?? ""}
                  disabled={reading}
                  onChange={(event) => set({ delimiter: event.target.value || undefined })}
                >
                  <option value="">Détection automatique{dataset?.csv ? ` (${delimiterLabel(dataset.csv.delimiter)})` : ""}</option>
                  {CANDIDATE_DELIMITERS.map((delimiter) => (
                    <option key={delimiter} value={delimiter}>
                      {delimiterLabel(delimiter)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-700">Encodage</span>
                <select
                  className={inputClass}
                  value={options.encoding ?? ""}
                  disabled={reading}
                  onChange={(event) => set({ encoding: (event.target.value || undefined) as ImportOptions["encoding"] })}
                >
                  <option value="">Automatique{dataset?.csv ? ` (${dataset.csv.encoding.toUpperCase()})` : ""}</option>
                  <option value="utf-8">UTF-8</option>
                  <option value="windows-1252">Windows-1252 (Excel Windows)</option>
                </select>
              </label>
            </>
          ) : null}
          {sheets && sheets.length > 0 ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-700">Feuille</span>
              <select className={inputClass} value={options.sheet ?? dataset?.xlsx?.sheetName ?? ""} disabled={reading} onChange={(event) => set({ sheet: event.target.value, headerRow: undefined })}>
                {sheets.map((sheet) => (
                  <option key={sheet.name} value={sheet.name}>
                    {sheet.name} ({sheet.rowCount} ligne{sheet.rowCount > 1 ? "s" : ""} non vide{sheet.rowCount > 1 ? "s" : ""})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Ligne d&apos;en-tête</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              className={inputClass}
              disabled={reading || options.noHeader}
              value={options.headerRow ?? dataset?.headerRow ?? ""}
              onChange={(event) => set({ headerRow: event.target.value ? Math.max(1, Number(event.target.value)) : undefined })}
            />
          </label>
          <label className="flex min-h-11 items-center gap-2 self-end text-sm text-slate-700">
            <input type="checkbox" className="h-5 w-5" checked={!!options.noHeader} disabled={reading} onChange={(event) => set({ noHeader: event.target.checked || undefined, headerRow: undefined })} />
            Le fichier n&apos;a pas de ligne d&apos;en-tête
          </label>
        </div>
      </Section>

      {reading ? (
        <p className="rounded-2xl bg-blue-50 p-4 text-sm font-medium text-blue-800" role="status">
          Lecture du fichier en cours…
        </p>
      ) : null}

      {result && !result.ok ? (
        <Section title="Lecture impossible" description="Le fichier n'a pas été importé. Corrigez le problème ou modifiez les options ci-dessus.">
          <IssueList issues={result.issues} />
        </Section>
      ) : null}

      {dataset ? (
        <Section
          title="Aperçu des données lues"
          description={`${dataset.rowCount.toLocaleString("fr-FR")} observation(s) × ${dataset.columnCount} colonne(s)${dataset.headerRow ? `, en-tête ligne ${dataset.headerRow}` : ", sans en-tête"}. Valeurs affichées telles qu'elles figurent dans le fichier.`}
          action={
            <button type="button" className={buttonClass.primary} onClick={onConfirm}>
              Confirmer l&apos;importation
            </button>
          }
        >
          <IssueList issues={dataset.issues} />
          <div className="mt-4 max-h-[60vh] overflow-auto rounded-2xl border border-slate-200">
            <table className="min-w-full border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold">Ligne</th>
                  {dataset.columns.map((column) => (
                    <th key={column.index} scope="col" className="max-w-[16rem] px-3 py-2 align-bottom font-semibold">
                      <span className="block truncate text-slate-800" title={column.originalHeader}>
                        {column.originalHeader.trim() || <em className="text-slate-400">(sans en-tête)</em>}
                      </span>
                      <span className="block truncate font-mono text-[11px] font-normal text-slate-500">{column.technicalName}</span>
                      {column.headerFlags.includes("duplicate") ? <Pill tone="yellow">en double</Pill> : null}
                      {column.headerFlags.includes("extra") ? <Pill tone="yellow">colonne en trop</Pill> : null}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.rows.slice(0, PREVIEW_ROWS).map((row, rowIndex) => (
                  <tr key={rowIndex} className="border-t border-slate-100">
                    <td className="px-3 py-1.5 font-mono text-xs text-slate-400">{dataset.sourceRows[rowIndex]}</td>
                    {row.map((value, columnIndex) => (
                      <td key={columnIndex} className="max-w-[16rem] truncate px-3 py-1.5 text-slate-800" title={displayRaw(value)}>
                        {value === null ? <span className="text-slate-300">∅</span> : displayRaw(value) === "" ? <span className="text-slate-300">«»</span> : displayRaw(value)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {dataset.rowCount > PREVIEW_ROWS ? `${PREVIEW_ROWS} premières lignes sur ${dataset.rowCount.toLocaleString("fr-FR")}. ` : ""}∅ = cellule absente ; «» = cellule vide.
          </p>
        </Section>
      ) : null}
    </div>
  );
}

export function FileSummary({ file, format }: { file: FileMeta; format?: "csv" | "xlsx" }) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl bg-slate-50 p-3">
      <FileSpreadsheet className="shrink-0 text-blue-600" size={28} aria-hidden />
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-900" title={file.name}>
          {file.name}
        </p>
        <p className="text-sm text-slate-500">
          {format ? format.toUpperCase() : "Format en cours d'identification"} · {formatBytes(file.size)}
        </p>
      </div>
    </div>
  );
}
