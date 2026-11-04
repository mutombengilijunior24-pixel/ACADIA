"use client";

import { useState } from "react";
import { Download, Loader2, NotebookPen, Save, Sparkles } from "lucide-react";

import { buildDocx } from "@/lib/core/export/docx";
import { parseReportDraft, REPORT_PART_LABELS, usableDays, type ReportDraftParts } from "@/lib/core/stages/journal";
import { stageReportDocument } from "@/lib/core/stages/report";

import type { DossierJson } from "./types";

const PARTS = Object.keys(REPORT_PART_LABELS) as Array<keyof ReportDraftParts>;
const EMPTY: ReportDraftParts = { remerciements: "", introduction: "", bilan: "", conclusion: "" };

function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function request(url: string, init: RequestInit): Promise<{ application: DossierJson }> {
  let res = await fetch(url, init);
  if (res.status === 429) {
    await new Promise((r) => window.setTimeout(r, 1100));
    res = await fetch(url, init);
  }
  const data = (await res.json().catch(() => ({}))) as { application?: DossierJson; error?: string };
  if (!res.ok || !data.application) throw new Error(data.error ?? `Erreur ${res.status}`);
  return { application: data.application };
}

/** Rapport de stage : ACADIA rédige remerciements, introduction, bilan et conclusion ; l'étudiant relit, modifie, télécharge. */
export function ReportBuilder({ dossier, finished, onChange }: { dossier: DossierJson; finished: boolean; onChange: (d: DossierJson) => void }) {
  const saved = parseReportDraft(dossier.reportDraft ?? null);
  const [parts, setParts] = useState<ReportDraftParts>(saved ?? EMPTY);
  const [savedAt, setSavedAt] = useState(saved?.updatedAt ?? null);
  const [busy, setBusy] = useState<null | "generation" | "enregistrement">(null);
  const [error, setError] = useState<string | null>(null);
  const days = usableDays(dossier.attendance).length;

  // Parties régénérées ou enregistrées ailleurs : la version enregistrée fait foi.
  if (saved && saved.updatedAt !== savedAt) {
    setSavedAt(saved.updatedAt);
    setParts(saved);
  }
  const dirty = saved ? PARTS.some((k) => parts[k] !== saved[k]) : PARTS.some((k) => parts[k].trim());

  const run = async (kind: NonNullable<typeof busy>, task: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue : réessayez.");
    } finally {
      setBusy(null);
    }
  };

  const generate = () =>
    run("generation", async () => {
      const { application } = await request(`/api/stages/${dossier.id}/report-draft`, { method: "POST" });
      onChange(application);
    });
  const save = () =>
    run("enregistrement", async () => {
      const { application } = await request(`/api/stages/${dossier.id}/report-draft`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(parts) });
      onChange(application);
    });
  // Le Word reprend ce qui est à l'écran (même non encore enregistré).
  const word = () => {
    const draft = saved || PARTS.some((k) => parts[k].trim()) ? JSON.stringify({ ...parts, generatedAt: saved?.generatedAt ?? null, updatedAt: new Date().toISOString() }) : null;
    const doc = stageReportDocument({ ...dossier, reportDraft: draft }, dossier.today);
    download(buildDocx(doc), `rapport-de-stage-${dossier.lastName.toLowerCase()}-${dossier.today}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  };

  return (
    <div className="space-y-4 rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-4 sm:p-5" aria-label="Mon rapport de stage">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <p className="flex items-start gap-2 text-sm text-violet-950">
          <NotebookPen size={18} className="mt-0.5 shrink-0 text-violet-600" aria-hidden />
          <span>
            <span className="block font-black">Mon rapport de stage</span>
            {days} journée(s) décrite(s) dans votre journal. {finished ? "Votre stage est terminé : générez et relisez votre rapport." : "Votre rapport se construit au fil des jours : vous pouvez le générer à tout moment."}
          </span>
        </p>
        <button type="button" onClick={word} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700">
          <Download size={16} aria-hidden /> {finished ? "Mon rapport de stage (Word)" : "Projet de rapport (Word)"}
        </button>
      </div>

      <button type="button" disabled={!!busy || !days} onClick={() => void generate()} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 px-5 text-sm font-black text-white shadow-lg shadow-fuchsia-500/30 disabled:opacity-60">
        {busy === "generation" ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />} {saved?.generatedAt ? "Régénérer" : "Générer"} remerciements, introduction, bilan et conclusion
      </button>
      {!days ? <p className="text-xs text-slate-500">Décrivez au moins une journée dans votre journal pour générer votre rapport.</p> : null}

      {saved || dirty ? (
        <div className="space-y-3">
          {PARTS.map((k) => (
            <label key={k} className="block text-sm">
              <span className="mb-1 block font-bold text-slate-800">{REPORT_PART_LABELS[k]}</span>
              <textarea className="block min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:text-sm" value={parts[k]} onChange={(e) => setParts((p) => ({ ...p, [k]: e.target.value }))} aria-label={REPORT_PART_LABELS[k]} />
            </label>
          ))}
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" disabled={!!busy || !dirty} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-50">
              {busy === "enregistrement" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />} Enregistrer mes modifications
            </button>
            <span className="text-xs text-slate-500">Relisez : ces textes sont rédigés à partir de votre journal ; complétez-les avec vos mots.</span>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
