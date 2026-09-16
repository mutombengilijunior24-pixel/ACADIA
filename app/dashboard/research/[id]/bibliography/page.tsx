"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Plus, Upload, Search, Download, Trash2, AlertTriangle } from "lucide-react";

const SOURCE_TYPES = [
  "JOURNAL_ARTICLE", "BOOK", "BOOK_CHAPTER", "THESIS", "DISSERTATION", "REPORT",
  "INSTITUTIONAL_REPORT", "GOVERNMENT_DOCUMENT", "LAW_OR_REGULATION", "CONFERENCE_PAPER",
  "DATASET", "WEBSITE", "WORKING_PAPER", "OTHER",
];

const VERIFICATION_STATUSES = ["VERIFIED", "INFERRED", "USER_PROVIDED", "AI_PROPOSED", "TO_VERIFY", "INVALID"];

const VERIFICATION_LABEL: Record<string, { label: string; className: string }> = {
  VERIFIED: { label: "Vérifiée", className: "bg-emerald-100 text-emerald-700" },
  INFERRED: { label: "Déduite", className: "bg-amber-100 text-amber-700" },
  USER_PROVIDED: { label: "Saisie manuellement", className: "bg-blue-100 text-blue-700" },
  AI_PROPOSED: { label: "Proposée par l'IA", className: "bg-violet-100 text-violet-700" },
  TO_VERIFY: { label: "À vérifier", className: "bg-amber-100 text-amber-700" },
  INVALID: { label: "Invalide", className: "bg-rose-100 text-rose-700" },
};

/** Explication de provenance TOUJOURS visible (mission §46) — jamais masquée. */
const PROVENANCE_EXPLANATION: Record<string, string> = {
  USER_ENTERED: "Cette référence a été saisie manuellement par vous.",
  USER_IMPORTED: "Cette référence provient d'un fichier que vous avez importé.",
  DOI_LOOKUP: "Cette référence a été identifiée à partir d'un DOI.",
  BIBTEX_IMPORT: "Cette référence provient de votre fichier BibTeX importé.",
  RIS_IMPORT: "Cette référence provient de votre fichier RIS importé.",
  AI_PROPOSED: "Cette référence a été proposée par l'IA et n'a pas encore été vérifiée.",
  SYSTEM_IMPORTED: "Cette référence a été importée automatiquement par le système.",
};

interface ReferenceRow {
  id: string;
  title: string;
  authors: string; // JSON string
  year: number | null;
  sourceType: string;
  verificationStatus: string;
  provenance: string;
  doi: string | null;
  url: string | null;
}

function authorsOf(row: ReferenceRow): string[] {
  try {
    return JSON.parse(row.authors) as string[];
  } catch {
    return [];
  }
}

export default function BibliographyPage() {
  const params = useParams<{ id: string }>();
  const [items, setItems] = useState<ReferenceRow[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [verificationStatus, setVerificationStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showImportForm, setShowImportForm] = useState(false);
  const pageSize = 20;

  const load = useCallback(async () => {
    setItems(null);
    setError(null);
    try {
      const qs = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search.trim()) qs.set("search", search.trim());
      if (sourceType) qs.set("sourceType", sourceType);
      if (verificationStatus) qs.set("verificationStatus", verificationStatus);
      const res = await fetch(`/api/research/${params.id}/references?${qs.toString()}`);
      if (!res.ok) throw new Error("request_failed");
      const data = await res.json();
      setItems(data.items);
      setTotal(data.total);
    } catch {
      setError("Impossible de charger la bibliothèque.");
    }
  }, [params.id, page, search, sourceType, verificationStatus]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function handleDelete(id: string) {
    setError(null);
    try {
      const res = await fetch(`/api/research/${params.id}/references/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Suppression refusée.");
      }
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Suppression refusée.");
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <a href={`/dashboard/research/${params.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-acadia-blue">
          <ArrowLeft className="h-4 w-4" /> Retour au projet
        </a>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Traçabilité scientifique</p>
            <h1 className="mt-1 text-2xl font-bold text-acadia-navy sm:text-3xl">Bibliothèque</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setShowAddForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full bg-acadia-blue px-4 py-2 text-sm font-semibold text-white hover:bg-acadia-blue/90">
              <Plus className="h-4 w-4" /> Ajouter une référence
            </button>
            <button type="button" onClick={() => setShowImportForm((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <Upload className="h-4 w-4" /> Importer BibTeX/RIS
            </button>
            <ExportMenu projectId={params.id} />
          </div>
        </div>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        {showAddForm && <AddReferenceForm projectId={params.id} onDone={() => { setShowAddForm(false); load(); }} />}
        {showImportForm && <ImportForm projectId={params.id} onDone={() => { setShowImportForm(false); load(); }} />}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Rechercher (titre, auteur, DOI)"
                className="w-full rounded-full border border-slate-200 py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <select value={sourceType} onChange={(e) => { setSourceType(e.target.value); setPage(1); }} className="rounded-full border border-slate-200 px-3 py-2 text-sm">
              <option value="">Tous les types</option>
              {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={verificationStatus} onChange={(e) => { setVerificationStatus(e.target.value); setPage(1); }} className="rounded-full border border-slate-200 px-3 py-2 text-sm">
              <option value="">Tous les statuts</option>
              {VERIFICATION_STATUSES.map((s) => <option key={s} value={s}>{VERIFICATION_LABEL[s]?.label ?? s}</option>)}
            </select>
          </div>

          <div className="mt-4">
            {items === null && <p className="text-center text-sm text-slate-400">Chargement...</p>}
            {items !== null && items.length === 0 && <p className="py-8 text-center text-sm text-slate-500">Aucune référence pour l&apos;instant.</p>}
            {items !== null && items.length > 0 && (
              <div className="space-y-3">
                {items.map((ref) => {
                  const badge = VERIFICATION_LABEL[ref.verificationStatus] ?? { label: ref.verificationStatus, className: "bg-slate-100 text-slate-600" };
                  const authors = authorsOf(ref);
                  return (
                    <div key={ref.id} className="rounded-2xl border border-slate-100 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900">{authors.join(", ") || "Auteur inconnu"} — {ref.year ?? "s.d."}</p>
                          <p className="text-sm text-slate-600">{ref.title}</p>
                          <p className="mt-0.5 text-2xs text-slate-400">{ref.sourceType}{ref.doi ? ` · DOI ${ref.doi}` : ""}</p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <span className={`rounded-full px-2.5 py-1 text-2xs font-semibold uppercase tracking-wide ${badge.className}`}>{badge.label}</span>
                          <button type="button" onClick={() => handleDelete(ref.id)} className="rounded-full p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label="Supprimer">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                      <p className="mt-2 text-2xs italic text-slate-400">{PROVENANCE_EXPLANATION[ref.provenance] ?? "Provenance non précisée."}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {items !== null && total > pageSize && (
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
              <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="font-semibold text-acadia-blue disabled:text-slate-300">Précédent</button>
              <span className="text-slate-400">Page {page} / {Math.max(1, Math.ceil(total / pageSize))} · {total} référence(s)</span>
              <button type="button" disabled={page * pageSize >= total} onClick={() => setPage((p) => p + 1)} className="font-semibold text-acadia-blue disabled:text-slate-300">Suivant</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AddReferenceForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [title, setTitle] = useState("");
  const [authors, setAuthors] = useState("");
  const [year, setYear] = useState("");
  const [sourceType, setSourceType] = useState("JOURNAL_ARTICLE");
  const [doi, setDoi] = useState("");
  const [url, setUrl] = useState("");
  const [journal, setJournal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [duplicates, setDuplicates] = useState<{ referenceId: string; reason: string }[] | null>(null);

  async function submit() {
    setError(null);
    setDuplicates(null);
    try {
      const res = await fetch(`/api/research/${projectId}/references`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          authors: authors.split(",").map((a) => a.trim()).filter(Boolean),
          year: year ? Number(year) : null,
          sourceType,
          doi: doi || null,
          url: url || null,
          journal: journal || null,
          provenance: "USER_ENTERED",
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Ajout refusé.");
      }
      const data = await res.json();
      if (data.possibleDuplicates?.length > 0) {
        setDuplicates(data.possibleDuplicates);
        return;
      }
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ajout refusé.");
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="mb-1 text-sm text-amber-700">Certaines informations pourront rester &quot;à vérifier&quot; si vous ne les renseignez pas — c&apos;est normal, ACADIA n&apos;invente jamais une donnée manquante.</p>
      {error && <p className="mb-2 text-sm text-rose-600">{error}</p>}
      {duplicates && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{duplicates.length} référence(s) potentiellement identique(s) détectée(s). Ajoutez quand même si vous confirmez qu&apos;il ne s&apos;agit pas d&apos;un doublon.
            <button type="button" onClick={() => { setDuplicates(null); submit(); }} className="ml-2 font-semibold text-acadia-blue hover:underline">Confirmer l&apos;ajout</button>
          </span>
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre *" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
        <input value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="Auteurs (séparés par des virgules)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
        <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="Année" type="number" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <select value={sourceType} onChange={(e) => setSourceType(e.target.value)} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          {SOURCE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <input value={journal} onChange={(e) => setJournal(e.target.value)} placeholder="Revue / Éditeur" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input value={doi} onChange={(e) => setDoi(e.target.value)} placeholder="DOI" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
        <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL" className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2" />
      </div>
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={submit} disabled={!title.trim()} className="rounded-full bg-acadia-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Ajouter</button>
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">Annuler</button>
      </div>
    </div>
  );
}

function ImportForm({ projectId, onDone }: { projectId: string; onDone: () => void }) {
  const [format, setFormat] = useState<"bibtex" | "ris">("bibtex");
  const [text, setText] = useState("");
  const [result, setResult] = useState<{ created: unknown[]; errors: string[] } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch(`/api/research/${projectId}/references/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, text }),
      });
      const data = await res.json();
      setResult(data);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex gap-2">
        <select value={format} onChange={(e) => setFormat(e.target.value as "bibtex" | "ris")} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
          <option value="bibtex">BibTeX</option>
          <option value="ris">RIS</option>
        </select>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={8} placeholder="Collez le contenu BibTeX ou RIS ici..." className="mt-3 w-full rounded-lg border border-slate-200 p-3 font-mono text-xs" />
      {result && (
        <div className="mt-3 space-y-1 text-sm">
          <p className="font-semibold text-emerald-700">{result.created.length} référence(s) importée(s).</p>
          {result.errors.length > 0 && (
            <div className="text-rose-600">
              {result.errors.map((e, i) => <p key={i}>⚠️ {e}</p>)}
            </div>
          )}
        </div>
      )}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={submit} disabled={!text.trim() || busy} className="rounded-full bg-acadia-blue px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">Importer</button>
        <button type="button" onClick={onDone} className="rounded-full px-4 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-50">Fermer</button>
      </div>
    </div>
  );
}

function ExportMenu({ projectId }: { projectId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
        <Download className="h-4 w-4" /> Exporter
      </button>
      {open && (
        <div className="absolute right-0 z-10 mt-1.5 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
          <a href={`/api/research/${projectId}/bibliography/export/bibtex`} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>BibTeX</a>
          <a href={`/api/research/${projectId}/bibliography/export/csv`} className="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50" onClick={() => setOpen(false)}>CSV</a>
        </div>
      )}
    </div>
  );
}
