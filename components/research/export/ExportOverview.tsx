"use client";

import { useMemo, useState } from "react";
import { FileText, Loader2 } from "lucide-react";
import { useResearch, type InstrumentRecord } from "@/contexts/ResearchContext";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";
import { buildScientificWork } from "@/lib/core/scientific-work/ScientificWorkEngine";
import type { AnnotationMap } from "@/lib/core/scientific-work/ScientificWorkEngine";
import { buildScientificDiscussion } from "@/lib/core/analysis/ScientificDiscussionEngine";
import type { ScientificWorkType } from "@/lib/core/scientific-work/ScientificWorkTypes";
import { SCIENTIFIC_WORK_TYPE_LABELS } from "@/lib/core/scientific-work/ScientificWorkTypes";
import { buildDocumentModel } from "@/lib/core/export/DocumentBuilder";
import { validateDocumentForExport } from "@/lib/core/export/DocumentValidationEngine";
import type { DocumentStyle, ExportFormat } from "@/lib/core/export/DocumentTypes";
import { DEFAULT_DOCUMENT_STYLE } from "@/lib/core/export/DocumentTypes";
import ExportReadiness from "./ExportReadiness";
import ExportOptions from "./ExportOptions";
import ExportHistory from "./ExportHistory";
import DocumentPreview from "./DocumentPreview";
import GuidanceVideo from "@/components/shared/GuidanceVideo";

// ============================================================
// P12 — DOCUMENT SCIENTIFIQUE FINAL (export DOCX / PDF)
//
// Bloc de MISE EN PAGE uniquement : compile le ScientificWork (P11,
// déjà validé) + la Discussion (P10) en un document académique.
// Aucune logique scientifique n'est exécutée ici. Le type de travail
// provient exclusivement de P11 — jamais choisi ici séparément.
// ============================================================

type Tab = "apercu" | "options" | "historique";

export default function ExportOverview({
  project,
  dataset,
  instrument,
}: {
  project: ResearchProject;
  dataset?: Dataset;
  instrument?: InstrumentRecord;
}) {
  const { annotations, bibliography, exportHistory, addExportHistoryEntry } = useResearch();
  const [tab, setTab] = useState<Tab>("apercu");
  const [styleOverride, setStyleOverride] = useState<Partial<DocumentStyle>>({});
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const researchId = project.id;
  const forResearch = annotations[researchId] as AnnotationMap | undefined;
  const referencesForResearch = useMemo(() => bibliography[researchId] ?? [], [bibliography, researchId]);
  const historyForResearch = exportHistory[researchId] ?? [];

  const storedType = forResearch?.["work:meta:type"]?.editedContent as ScientificWorkType | undefined;
  const type: ScientificWorkType = storedType && SCIENTIFIC_WORK_TYPE_LABELS[storedType] ? storedType : "CUSTOM";
  const workTypeExplicit = Boolean(storedType && SCIENTIFIC_WORK_TYPE_LABELS[storedType]);

  const work = useMemo(
    () => buildScientificWork(project, type, dataset, instrument, forResearch, referencesForResearch),
    [project, type, dataset, instrument, forResearch, referencesForResearch]
  );

  const discussion = useMemo(() => buildScientificDiscussion(project, dataset, null), [project, dataset]);

  const style: DocumentStyle = useMemo(() => ({ ...DEFAULT_DOCUMENT_STYLE, ...styleOverride }), [styleOverride]);

  const documentModel = useMemo(
    () => buildDocumentModel({ project, work, discussion, annotations: forResearch, style: styleOverride, workTypeExplicit }),
    [project, work, discussion, forResearch, styleOverride, workTypeExplicit]
  );

  const readiness = useMemo(() => validateDocumentForExport(documentModel), [documentModel]);

  async function handleExport(format: ExportFormat) {
    setExportError(null);
    setExporting(format);
    try {
      const res = await fetch(`/api/export/${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(documentModel),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setExportError(
          body?.message ?? `Échec de l'export ${format.toUpperCase()} (statut ${res.status}).`
        );
        return;
      }
      const blob = await res.blob();
      const extension = format === "docx" ? "docx" : "pdf";
      const fileName = `${project.title.replace(/[<>:"/\\|?*]/g, "").slice(0, 80).trim() || "document"}.${extension}`;

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      addExportHistoryEntry(researchId, {
        id: `export-${researchId}-${Date.now()}`,
        format,
        workType: work.type,
        generatedAt: new Date().toISOString(),
        fileName,
        sizeBytes: blob.size,
      });
    } catch {
      setExportError(`Une erreur est survenue pendant l'export ${format.toUpperCase()}.`);
    } finally {
      setExporting(null);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
        <FileText className="h-3.5 w-3.5" /> Document scientifique final
      </p>
      <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
        <h2 className="text-lg font-bold text-acadia-navy">{project.title}</h2>
        <GuidanceVideo title="Comment finaliser mon travail ?" triggerLabel="Comment finaliser ?" />
      </div>
      <p className="mt-1 text-xs italic text-slate-400">ACADIA met en page — le chercheur vérifie avant de partager.</p>
      <p className="mt-2 text-xs text-slate-500">Type de document : {documentModel.workTypeLabel}</p>

      <div className="mt-4">
        <ExportReadiness readiness={readiness} />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!readiness.documentExportable || exporting !== null}
          onClick={() => handleExport("docx")}
          className="inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-4 py-2 text-xs font-bold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting === "docx" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Exporter en DOCX
        </button>
        <button
          type="button"
          disabled={!readiness.documentExportable || exporting !== null}
          onClick={() => handleExport("pdf")}
          className="inline-flex items-center gap-2 rounded-xl border border-acadia-blue px-4 py-2 text-xs font-bold text-acadia-blue hover:bg-acadia-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {exporting === "pdf" && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Exporter en PDF
        </button>
      </div>
      {exportError && <p className="mt-2 text-xs text-red-600">{exportError}</p>}

      <div className="mt-5 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
        {(
          [
            ["apercu", "Aperçu du document"],
            ["options", "Options de mise en page"],
            ["historique", "Historique des exports"],
          ] as [Tab, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === id ? "bg-acadia-blue text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "apercu" && <DocumentPreview model={documentModel} />}
        {tab === "options" && (
          <ExportOptions
            researchId={researchId}
            coverPage={documentModel.coverPage}
            preliminary={documentModel.preliminary}
            style={style}
            onStyleChange={(patch) => setStyleOverride((prev) => ({ ...prev, ...patch }))}
          />
        )}
        {tab === "historique" && <ExportHistory entries={historyForResearch} />}
      </div>
    </section>
  );
}
