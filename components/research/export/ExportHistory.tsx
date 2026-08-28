"use client";

import { FileDown } from "lucide-react";
import type { ExportHistoryEntry } from "@/lib/core/export/DocumentTypes";

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} Ko`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} Mo`;
}

/**
 * P12 — Historique des exports effectivement produits (jamais une
 * entrée générée automatiquement) : trace de ce que le chercheur a
 * réellement téléchargé, persisté via la même architecture
 * localStorage que le reste de l'application.
 */
export default function ExportHistory({ entries }: { entries: ExportHistoryEntry[] }) {
  if (entries.length === 0) {
    return <p className="text-sm text-slate-500">Aucun export encore effectué pour ce projet.</p>;
  }

  const sorted = [...entries].sort((a, b) => new Date(b.generatedAt).getTime() - new Date(a.generatedAt).getTime());

  return (
    <div className="space-y-2">
      {sorted.map((entry) => (
        <div key={entry.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5">
          <FileDown className="h-4 w-4 shrink-0 text-acadia-blue" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-acadia-navy">
              {entry.fileName} <span className="text-2xs font-normal text-slate-400">({entry.format.toUpperCase()})</span>
            </p>
            <p className="text-2xs text-slate-400">
              {new Date(entry.generatedAt).toLocaleString("fr-FR")} — {formatSize(entry.sizeBytes)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
