"use client";

import { useMemo, useRef, useState } from "react";
import { BookCheck, ClipboardCopy, FileText, Loader2, SearchCheck, Upload } from "lucide-react";

import { buttonClass, inputClass, Metric, Notice, Pill, Section, type Tone } from "@/components/data/ui";
import { ExportBar } from "@/components/export/ExportBar";
import {
  analyzeDocument,
  citationLabel,
  CONTEXT_LABELS,
  CONVENTION_LABELS,
  EXISTENCE_LABELS,
  finalBibliography,
  paragraphsFromText,
  readDocx,
  REFERENCE_KIND_LABELS,
  referenceReport,
  referenceSheets,
  runsText,
  SOURCE_LABELS,
  VERIFY_BATCH,
  type ContextVerdict,
  type Convention,
  type DocParagraph,
  type DocumentAnalysis,
  type ExistenceStatus,
  type ExistenceVerdict,
  type IssueSeverity,
  type ParsedReference,
  type TextRun,
} from "@/lib/core/references";

const SEVERITY: Record<IssueSeverity, { label: string; tone: Tone }> = { erreur: { label: "Erreur", tone: "red" }, a_verifier: { label: "À vérifier", tone: "yellow" }, conseil: { label: "Conseil", tone: "blue" } };
const STATUS_TONE: Record<ExistenceStatus, Tone> = { verifiee: "green", a_corriger: "yellow", introuvable: "neutral", suspecte: "red", non_verifiable: "neutral" };
const CONTEXT_TONE: Record<ContextVerdict["verdict"], Tone> = { fidele: "green", partiel: "yellow", non_fidele: "red", indeterminable: "neutral" };
const FIELD_LABELS: Record<string, string> = { titre: "Titre", auteurs: "Auteurs", annee: "Année", revue: "Revue", volume: "Volume", numero: "Numéro", pages: "Pages", doi: "DOI" };

/** Référence en APA, avec l'italique. */
function Apa({ runs }: { runs: TextRun[] }) {
  return (
    <>
      {runs.map((r, i) =>
        r.italic ? (
          <em key={i} className="italic">
            {r.text}
          </em>
        ) : (
          <span key={i}>{r.text}</span>
        ),
      )}
    </>
  );
}

/** Ce qui part au serveur : les métadonnées de la référence, jamais le mémoire. */
const payload = (r: ParsedReference) => ({ id: r.id, raw: r.raw.slice(0, 1500), authors: r.authors.slice(0, 40), year: r.year, yearSuffix: r.yearSuffix, noDate: r.noDate, title: r.title, container: r.container, publisher: r.publisher, place: r.place, edition: r.edition, volume: r.volume, issue: r.issue, pages: r.pages, doi: r.doi, url: r.url, isbn: r.isbn, kind: r.kind, uncertain: r.uncertain });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function postJson<T>(url: string, body: unknown): Promise<T> {
  for (let attempt = 0; ; attempt += 1) {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as T & { error?: string };
    if (res.status === 429 && attempt < 2) {
      await wait(2500);
      continue;
    }
    if (res.status === 401) throw new Error("Votre session a expiré : reconnectez-vous, puis relancez.");
    if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
    return data;
  }
}

export default function ReferenceChecker() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<"word" | "texte">("word");
  const [convention, setConvention] = useState<Convention>("apa_fr");
  const [pasted, setPasted] = useState("");
  const [source, setSource] = useState<{ paragraphs: DocParagraph[]; footnotes: DocParagraph[]; fromWord: boolean; fileName: string | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [verdicts, setVerdicts] = useState<Record<string, ExistenceVerdict>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [contexts, setContexts] = useState<Record<string, ContextVerdict>>({});
  const [contextBusy, setContextBusy] = useState<string | null>(null);
  const [contextErrors, setContextErrors] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<IssueSeverity | "tout">("tout");
  const [copied, setCopied] = useState(false);

  const analysis: DocumentAnalysis | null = useMemo(() => (source ? analyzeDocument({ paragraphs: source.paragraphs, footnotes: source.footnotes, convention, fromWord: source.fromWord, bibliographyOnly: !source.fromWord }) : null), [source, convention]);

  const reset = () => {
    setVerdicts({});
    setContexts({});
    setContextErrors({});
    setVerifyError(null);
    setProgress(null);
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    reset();
    try {
      if (!/\.docx$/i.test(file.name)) throw new Error("Choisissez un document Word au format .docx (Fichier > Enregistrer sous > Document Word).");
      if (file.size > 25 * 1024 * 1024) throw new Error("Ce fichier dépasse 25 Mo.");
      const doc = readDocx(new Uint8Array(await file.arrayBuffer()));
      setSource({ ...doc, fromWord: true, fileName: file.name });
    } catch (e) {
      setSource(null);
      setError(e instanceof Error ? e.message : "Le fichier n'a pas pu être lu.");
    }
  };

  const onPaste = () => {
    setError(null);
    reset();
    if (pasted.trim().length < 20) return setError("Collez au moins une référence complète.");
    setSource({ paragraphs: paragraphsFromText(pasted), footnotes: [], fromWord: false, fileName: null });
  };

  const verify = async () => {
    if (!analysis) return;
    setVerifyError(null);
    const refs = analysis.references;
    setProgress({ done: 0, total: refs.length });
    try {
      for (let i = 0; i < refs.length; i += VERIFY_BATCH) {
        const batch = refs.slice(i, i + VERIFY_BATCH);
        const { results } = await postJson<{ results: ExistenceVerdict[] }>("/api/references/verify", { convention, references: batch.map(payload) });
        setVerdicts((v) => ({ ...v, ...Object.fromEntries(results.map((r) => [r.referenceId, r])) }));
        setProgress({ done: Math.min(refs.length, i + batch.length), total: refs.length });
      }
    } catch (e) {
      setVerifyError(e instanceof Error ? e.message : "La vérification a été interrompue.");
    } finally {
      setProgress((p) => (p && p.done >= p.total ? null : p));
    }
  };

  const checkContext = async (citationId: string, sentence: string, ref: ParsedReference) => {
    setContextBusy(citationId);
    setContextErrors((e) => ({ ...e, [citationId]: "" }));
    try {
      const { context } = await postJson<{ context: ContextVerdict }>("/api/references/context", { sentence: sentence.slice(0, 1500), reference: payload(ref) });
      setContexts((c) => ({ ...c, [citationId]: context }));
    } catch (e) {
      setContextErrors((x) => ({ ...x, [citationId]: e instanceof Error ? e.message : "Contrôle impossible." }));
    } finally {
      setContextBusy(null);
    }
  };

  const bibliography = analysis ? finalBibliography({ analysis, verdicts }) : [];
  const copyBibliography = async () => {
    const plain = bibliography.map((b) => runsText(b.runs)).join("\n");
    const html = bibliography.map((b) => `<p style="margin-left:2.2em;text-indent:-2.2em">${b.runs.map((r) => (r.italic ? `<i>${escapeHtml(r.text)}</i>` : escapeHtml(r.text))).join("")}</p>`).join("");
    try {
      // Avec l'italique quand le navigateur le permet (collage dans Word).
      await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([html], { type: "text/html" }), "text/plain": new Blob([plain], { type: "text/plain" }) })]);
    } catch {
      await navigator.clipboard.writeText(plain).catch(() => undefined);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const refById = (id: string | null) => analysis?.references.find((r) => r.id === id) ?? null;
  const checkedCount = Object.keys(verdicts).length;
  const issues = analysis ? analysis.issues.filter((i) => filter === "tout" || i.severity === filter) : [];
  const contextCandidates = analysis
    ? analysis.links
        .map((l) => ({ link: l, citation: analysis.citations.find((c) => c.id === l.citationId)!, ref: refById(l.referenceId) }))
        .filter((x) => x.ref && verdicts[x.ref.id]?.match && (verdicts[x.ref.id].status === "verifiee" || verdicts[x.ref.id].status === "a_corriger"))
    : [];

  return (
    <div className="space-y-5">
      <header className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-indigo-900 to-violet-700 px-5 py-5 text-white shadow-lg sm:px-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-violet-200">Vérificateur de références</p>
        <h1 className="relative mt-1 text-xl font-extrabold leading-tight sm:text-3xl">Mes références existent-elles, et sont-elles bien citées ?</h1>
        <p className="relative mt-2 max-w-3xl text-sm leading-relaxed text-indigo-100">Trois contrôles : la forme APA 7 et la cohérence entre le texte et la bibliographie ; l&apos;existence de chaque référence dans les grandes bases bibliographiques ouvertes ; et, à la demande, la fidélité de vos citations au texte cité.</p>
        <p className="relative mt-3 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-white/25">Votre mémoire est lu dans votre navigateur : seules les références sont envoyées aux bases bibliographiques.</p>
      </header>

      <Section title="1. Mon document" description="Importez votre mémoire en Word (.docx) pour contrôler aussi les citations du texte, ou collez seulement votre bibliographie.">
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Source">
          <button type="button" role="tab" aria-selected={mode === "word"} className={mode === "word" ? buttonClass.secondary : buttonClass.ghost} onClick={() => setMode("word")}>
            <Upload size={16} aria-hidden /> Importer mon mémoire (Word)
          </button>
          <button type="button" role="tab" aria-selected={mode === "texte"} className={mode === "texte" ? buttonClass.secondary : buttonClass.ghost} onClick={() => setMode("texte")}>
            <FileText size={16} aria-hidden /> Coller ma bibliographie
          </button>
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-[1fr_280px]">
          {mode === "word" ? (
            <div>
              <button type="button" onClick={() => fileRef.current?.click()} className="flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-indigo-200 bg-indigo-50/40 p-6 text-center transition hover:border-indigo-400">
                <Upload size={24} className="text-indigo-600" aria-hidden />
                <span className="font-semibold text-slate-900">{source?.fileName ?? "Choisir mon mémoire (.docx)"}</span>
                <span className="text-xs text-slate-600">Le texte, la bibliographie et les notes de bas de page sont lus ; l&apos;italique aussi.</span>
              </button>
              <input ref={fileRef} type="file" accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" aria-label="Mémoire au format Word" onChange={(e) => void onFile(e.target.files?.[0])} />
            </div>
          ) : (
            <div>
              <textarea className={`${inputClass} min-h-48 py-2 font-mono text-xs`} value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder={"Une référence par ligne, par exemple :\nKotler, P. et Keller, K. L. (2016). Marketing management (15e éd.). Pearson.\nKEYNES, J. M., Théorie générale de l'emploi, de l'intérêt et de la monnaie, Payot, Paris, 1936."} aria-label="Bibliographie collée" />
              <button type="button" className={`${buttonClass.primary} mt-2`} onClick={onPaste}>
                Analyser ma bibliographie
              </button>
            </div>
          )}
          <label className="text-sm font-semibold text-slate-800">
            Convention
            <select className={`${inputClass} mt-1`} value={convention} onChange={(e) => (setConvention(e.target.value as Convention), reset())} aria-label="Convention bibliographique">
              {(Object.keys(CONVENTION_LABELS) as Convention[]).map((c) => (
                <option key={c} value={c}>
                  {CONVENTION_LABELS[c]}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs font-normal text-slate-500">Si votre directeur impose une autre présentation, suivez-la : ce contrôle porte sur l&apos;APA 7.</span>
          </label>
        </div>
        {error ? (
          <div className="mt-3">
            <Notice tone="error">{error}</Notice>
          </div>
        ) : null}
      </Section>

      {analysis ? (
        <>
          <div className="grid gap-3 sm:grid-cols-5">
            <Metric label="Citations dans le texte" value={analysis.stats.citations} hint={analysis.hasBody ? undefined : "texte non fourni"} />
            <Metric label="Références" value={analysis.stats.references} />
            <Metric label="Erreurs" value={analysis.stats.errors} tone={analysis.stats.errors ? "warn" : undefined} />
            <Metric label="À vérifier" value={analysis.stats.toCheck} />
            <Metric label="Conseils" value={analysis.stats.advice} />
          </div>
          {!analysis.references.length ? <Notice tone="warning" title="Aucune référence lue">ACADIA n&apos;a pas trouvé de bibliographie à contrôler. Dans un mémoire, placez-la sous un titre « Bibliographie » ou « Références ».</Notice> : null}

          <Section title="2. Forme et cohérence (APA 7)" description="Sans internet ni IA : citations et bibliographie se répondent-elles, et la présentation suit-elle l'APA 7 ?" action={<Pill tone={analysis.stats.errors ? "red" : "green"}>{analysis.stats.errors ? `${analysis.stats.errors} erreur(s)` : "Aucune erreur"}</Pill>}>
            <div className="mb-3 flex flex-wrap gap-2" role="tablist" aria-label="Filtrer les constats">
              {(["tout", "erreur", "a_verifier", "conseil"] as const).map((f) => (
                <button key={f} type="button" role="tab" aria-selected={filter === f} className={filter === f ? buttonClass.secondary : buttonClass.ghost} onClick={() => setFilter(f)}>
                  {f === "tout" ? `Tout (${analysis.issues.length})` : `${SEVERITY[f].label} (${analysis.issues.filter((i) => i.severity === f).length})`}
                </button>
              ))}
            </div>
            {issues.length ? (
              <ul className="space-y-2">
                {issues.slice(0, 150).map((issue, i) => (
                  <li key={`${issue.code}-${i}`} className="rounded-xl p-3 text-sm ring-1 ring-slate-200">
                    <div className="flex flex-wrap items-start gap-2">
                      <Pill tone={SEVERITY[issue.severity].tone}>{SEVERITY[issue.severity].label}</Pill>
                      <span className="min-w-0 flex-1 text-slate-800">{issue.message}</span>
                    </div>
                    {issue.fix ? <p className="mt-1 pl-1 text-xs text-slate-600">Proposition : <span className="font-medium text-slate-800">{issue.fix}</span></p> : null}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-slate-600">Aucun constat dans cette catégorie.</p>
            )}
          </Section>

          <Section
            title="3. Existence des références"
            description="Chaque référence est cherchée dans Crossref, OpenAlex, HAL, Open Library et Google Books. Aucune IA : une référence n'est jamais déclarée « fausse », au pire « suspecte », avec les raisons."
            action={
              <button type="button" className={buttonClass.primary} disabled={!analysis.references.length || !!progress} onClick={() => void verify()}>
                {progress ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <SearchCheck size={16} aria-hidden />} {checkedCount ? "Relancer la vérification" : `Vérifier les ${analysis.references.length} références`}
              </button>
            }
          >
            {progress ? (
              <div className="mb-3" role="status" aria-label="Progression de la vérification">
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${(progress.done / Math.max(1, progress.total)) * 100}%` }} />
                </div>
                <p className="mt-1 text-xs text-slate-600">
                  {progress.done} / {progress.total} références vérifiées…
                </p>
              </div>
            ) : null}
            {verifyError ? (
              <div className="mb-3">
                <Notice tone="error">{verifyError}</Notice>
              </div>
            ) : null}
            {checkedCount ? (
              <ol className="space-y-3">
                {analysis.references
                  .filter((r) => verdicts[r.id])
                  .map((r) => {
                    const v = verdicts[r.id];
                    return (
                      <li key={r.id} className="rounded-2xl border border-slate-200 p-4" aria-label={`Référence ${r.index + 1}`}>
                        <div className="flex flex-wrap items-start gap-2">
                          <Pill tone={STATUS_TONE[v.status]}>{EXISTENCE_LABELS[v.status]}</Pill>
                          <span className="text-xs text-slate-500">{REFERENCE_KIND_LABELS[r.kind]}</span>
                        </div>
                        <p className="mt-2 text-sm text-slate-800">{r.raw}</p>
                        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
                          {v.reasons.map((reason) => (
                            <li key={reason}>{reason}</li>
                          ))}
                        </ul>
                        {v.differences.length ? (
                          <div className="mt-2 overflow-x-auto rounded-xl border border-slate-200">
                            <table className="min-w-full text-xs">
                              <thead className="bg-slate-50 text-left text-slate-500">
                                <tr>
                                  <th scope="col" className="px-3 py-1.5">Élément</th>
                                  <th scope="col" className="px-3 py-1.5">Votre référence</th>
                                  <th scope="col" className="px-3 py-1.5">Notice de la base</th>
                                </tr>
                              </thead>
                              <tbody>
                                {v.differences.map((d) => (
                                  <tr key={d.field} className="border-t border-slate-100">
                                    <td className="px-3 py-1.5 font-semibold">{FIELD_LABELS[d.field]}</td>
                                    <td className="px-3 py-1.5 text-rose-700">{d.student}</td>
                                    <td className="px-3 py-1.5 text-emerald-700">{d.found}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        ) : null}
                        {v.corrected ? (
                          <p className="mt-2 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-950">
                            <span className="font-semibold">Référence APA 7 : </span>
                            <Apa runs={v.corrected} />
                          </p>
                        ) : null}
                        <p className="mt-2 text-xs text-slate-500">
                          {v.consulted.length ? `Bases consultées : ${v.consulted.map((s) => SOURCE_LABELS[s]).join(", ")}` : "Aucune base consultée pour ce type de document."}
                          {v.match?.doi ? (
                            <>
                              {" · "}
                              <a className="text-indigo-700 underline" href={`https://doi.org/${v.match.doi}`} target="_blank" rel="noreferrer noopener">
                                ouvrir la notice
                              </a>
                            </>
                          ) : v.match?.url ? (
                            <>
                              {" · "}
                              <a className="text-indigo-700 underline" href={v.match.url} target="_blank" rel="noreferrer noopener">
                                ouvrir la notice
                              </a>
                            </>
                          ) : null}
                        </p>
                      </li>
                    );
                  })}
              </ol>
            ) : !progress ? (
              <p className="text-sm text-slate-600">Lancez la vérification : quelques secondes par référence. Une référence déjà vérifiée par un autre utilisateur répond tout de suite.</p>
            ) : null}
          </Section>

          {analysis.hasBody ? (
            <Section title="4. Contexte des citations" description="À la demande : ACADIA récupère le résumé réel du texte cité et vérifie que votre phrase lui est fidèle. Sans résumé disponible, il le dit et ne suppose rien.">
              {contextCandidates.length ? (
                <ul className="space-y-3">
                  {contextCandidates.slice(0, 40).map(({ citation, ref }) => {
                    const c = contexts[citation.id];
                    return (
                      <li key={citation.id} className="rounded-2xl border border-slate-200 p-4" aria-label={`Citation ${citationLabel(citation)}`}>
                        <p className="text-sm text-slate-800">
                          <span className="font-semibold">{citationLabel(citation)}</span> — « {citation.sentence} »
                        </p>
                        {c ? (
                          <div className="mt-2 space-y-1 text-sm">
                            <Pill tone={CONTEXT_TONE[c.verdict]}>{CONTEXT_LABELS[c.verdict]}</Pill>
                            <p className="text-slate-700">{c.explanation}</p>
                            {c.evidence ? <p className="rounded-lg bg-slate-50 p-2 text-xs italic text-slate-600">Extrait du résumé : « {c.evidence} »</p> : null}
                          </div>
                        ) : (
                          <button type="button" className={`${buttonClass.secondary} mt-2`} disabled={contextBusy !== null} onClick={() => void checkContext(citation.id, citation.sentence, ref!)}>
                            {contextBusy === citation.id ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <BookCheck size={16} aria-hidden />} Contrôler le contexte
                          </button>
                        )}
                        {contextErrors[citation.id] ? <p className="mt-1 text-xs text-rose-700">{contextErrors[citation.id]}</p> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="text-sm text-slate-600">Le contrôle du contexte est proposé pour les citations dont la référence a été retrouvée en ligne : lancez d&apos;abord la vérification de l&apos;existence.</p>
              )}
            </Section>
          ) : null}

          <Section
            title={`${analysis.hasBody ? 5 : 4}. Ma bibliographie corrigée (APA 7)`}
            description="Par ordre alphabétique. Les références retrouvées sont présentées d'après la notice de la base ; les autres d'après votre texte. Relisez-la avant de la coller dans votre mémoire."
            action={
              <button type="button" className={buttonClass.secondary} onClick={() => void copyBibliography()}>
                <ClipboardCopy size={16} aria-hidden /> {copied ? "Copiée" : "Copier (avec l'italique)"}
              </button>
            }
          >
            <ol className="space-y-2 text-sm leading-relaxed text-slate-900">
              {bibliography.map((b) => (
                <li key={b.referenceId} className="pl-8 -indent-8">
                  <Apa runs={b.runs} />
                  {b.fromDatabase ? <span className="ml-2 align-middle text-[10px] font-semibold uppercase tracking-wide text-emerald-700">notice vérifiée</span> : null}
                </li>
              ))}
            </ol>
          </Section>

          <ExportBar title="Télécharger le rapport de vérification" fileBase="acadia-verification-references" sheets={() => referenceSheets({ analysis, verdicts, contexts, fileName: source?.fileName ?? null })} document={() => referenceReport({ analysis, verdicts, contexts, fileName: source?.fileName ?? null })} />
        </>
      ) : null}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
