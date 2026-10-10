"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";

import { PalettePicker } from "@/components/charts/PalettePicker";
import { buttonClass } from "@/components/data/ui";
import { chartsOf, renderHtml, type ReportDocument } from "@/lib/core/export/document";
import { buildDocx } from "@/lib/core/export/docx";
import { buildWorkbook, chartsSheet, type Sheet } from "@/lib/core/export/xlsx";
import { useChartPalette } from "@/lib/ui/chartTheme";

function download(content: BlobPart, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

const stamp = () => new Date().toISOString().slice(0, 10);

/**
 * Récupérer les résultats : classeur Excel et document Word avec des graphiques NATIFS
 * (survol, données modifiables), impression / PDF ; dans la palette choisie par l'utilisateur.
 */
export function ExportBar({ fileBase, sheets, document: buildDocument, title = "Récupérer les résultats" }: { fileBase: string; sheets: () => Sheet[]; document: (palette: string[]) => ReportDocument; title?: string }) {
  const palette = useChartPalette();
  const [error, setError] = useState<string | null>(null);
  const name = `${fileBase}-${stamp()}`;

  const run = (kind: "xlsx" | "docx") => {
    setError(null);
    try {
      const doc = buildDocument(palette);
      if (kind === "docx") {
        download(buildDocx(doc) as BlobPart, `${name}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      } else {
        const specs = chartsOf(doc);
        download(buildWorkbook([...sheets(), ...(specs.length ? [chartsSheet(specs)] : [])]) as BlobPart, `${name}.xlsx`, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      }
    } catch (e) {
      setError(`Le fichier n'a pas pu être préparé : ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  return (
    <div className="no-print rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-sky-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-indigo-900">
          <Download size={18} aria-hidden /> {title}
          <span className="font-normal text-indigo-700/80">— graphiques modifiables dans Word et Excel</span>
        </p>
        <div className="flex flex-wrap gap-2">
          <PalettePicker />
          <button type="button" className={buttonClass.secondary} onClick={() => run("xlsx")}>
            <FileSpreadsheet size={16} aria-hidden className="text-emerald-600" /> Tableaux Excel
          </button>
          <button type="button" className={buttonClass.secondary} onClick={() => run("docx")}>
            <FileText size={16} aria-hidden className="text-indigo-600" /> Rapport Word
          </button>
          <button
            type="button"
            className={buttonClass.secondary}
            onClick={() => {
              const url = URL.createObjectURL(new Blob([renderHtml(buildDocument(palette))], { type: "text/html" }));
              const win = window.open(url, "_blank");
              win?.addEventListener("load", () => win.print());
              window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
            }}
          >
            <Printer size={16} aria-hidden className="text-slate-600" /> Imprimer / PDF
          </button>
        </div>
      </div>
      {error ? (
        <p className="mt-2 text-sm text-rose-700" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
