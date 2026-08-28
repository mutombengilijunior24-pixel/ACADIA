"use client";

import { useState } from "react";
import type { CoverPageInfo, DocumentPreliminary, DocumentStyle } from "@/lib/core/export/DocumentTypes";
import { useResearch } from "@/contexts/ResearchContext";

const COVER_FIELDS: { key: keyof CoverPageInfo; label: string; blockId: string }[] = [
  { key: "institution", label: "Institution", blockId: "export:cover:institution" },
  { key: "faculty", label: "Faculté", blockId: "export:cover:faculty" },
  { key: "department", label: "Département", blockId: "export:cover:department" },
  { key: "degreeStatement", label: "Mention (ex. « Mémoire présenté en vue de... »)", blockId: "export:cover:degreeStatement" },
  { key: "author", label: "Auteur", blockId: "export:cover:author" },
  { key: "supervisor", label: "Directeur / encadreur", blockId: "export:cover:supervisor" },
  { key: "academicYear", label: "Année académique", blockId: "export:cover:academicYear" },
];

const PRELIMINARY_FIELDS: { key: keyof DocumentPreliminary; label: string; blockId: string }[] = [
  { key: "dedication", label: "Dédicace", blockId: "export:preliminary:dedication" },
  { key: "acknowledgements", label: "Remerciements", blockId: "export:preliminary:acknowledgements" },
  { key: "epigraph", label: "Épigraphe", blockId: "export:preliminary:epigraph" },
  { key: "abstract", label: "Résumé", blockId: "export:preliminary:abstract" },
  { key: "abstractEn", label: "Abstract", blockId: "export:preliminary:abstractEn" },
];

/**
 * P12.5/6/7 — Page de garde, pages préliminaires et style académique,
 * tous éditables par le chercheur. Persistance via le même mécanisme
 * d'annotations que P9/P10/P11 (sentinelles "export:*") — aucun
 * nouveau système de stockage.
 */
export default function ExportOptions({
  researchId,
  coverPage,
  preliminary,
  style,
  onStyleChange,
}: {
  researchId: string;
  coverPage: CoverPageInfo;
  preliminary: DocumentPreliminary;
  style: DocumentStyle;
  onStyleChange: (patch: Partial<DocumentStyle>) => void;
}) {
  const { setAnnotation } = useResearch();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  function commit(blockId: string, fallback: string) {
    const value = drafts[blockId];
    if (value === undefined || value === fallback) return;
    setAnnotation(researchId, blockId, { status: "edited", editedContent: value });
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Page de garde</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {COVER_FIELDS.map((f) => (
            <label key={f.blockId} className="text-xs font-semibold text-slate-500">
              {f.label}
              <input
                defaultValue={coverPage[f.key]}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [f.blockId]: e.target.value }))}
                onBlur={() => commit(f.blockId, coverPage[f.key])}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-normal text-acadia-navy"
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Pages préliminaires</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {PRELIMINARY_FIELDS.map((f) => (
            <label key={f.blockId} className="text-xs font-semibold text-slate-500">
              {f.label}
              <textarea
                defaultValue={preliminary[f.key]}
                rows={3}
                onChange={(e) => setDrafts((prev) => ({ ...prev, [f.blockId]: e.target.value }))}
                onBlur={() => commit(f.blockId, preliminary[f.key])}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-normal text-acadia-navy"
              />
            </label>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Style académique</p>
        <p className="mt-1 text-2xs text-slate-400">
          Ces paramètres sont des valeurs par défaut raisonnables, modifiables — jamais présentés comme une norme
          institutionnelle obligatoire.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="text-xs font-semibold text-slate-500">
            Taille de police (pt)
            <input
              type="number"
              min={9}
              max={14}
              defaultValue={style.fontSize}
              onBlur={(e) => onStyleChange({ fontSize: Number(e.target.value) || style.fontSize })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-normal text-acadia-navy"
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Interligne
            <input
              type="number"
              step={0.1}
              min={1}
              max={2.5}
              defaultValue={style.lineHeight}
              onBlur={(e) => onStyleChange({ lineHeight: Number(e.target.value) || style.lineHeight })}
              className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm font-normal text-acadia-navy"
            />
          </label>
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
            <input
              type="checkbox"
              defaultChecked={style.pageNumbering.enabled}
              onChange={(e) => onStyleChange({ pageNumbering: { ...style.pageNumbering, enabled: e.target.checked } })}
            />
            Numérotation des pages
          </label>
        </div>
      </div>
    </div>
  );
}
