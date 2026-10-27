"use client";

import { useRef, useState } from "react";
import { FileSpreadsheet, Keyboard, Loader2, Plus, Sparkles, Trash2 } from "lucide-react";

import { buttonClass, inputClass, Notice, Pill, Section } from "@/components/data/ui";
import { importFile } from "@/lib/core/data/importer";
import { datasetFromTable, demoDataset, FREQUENCY_LABELS, MIN_OBSERVATIONS, ROLES, type Frequency, type MacroDataset, type MacroRole } from "@/lib/core/econometrics";

export type EconSource = "demo" | "manual" | "file";

const numberText = (v: number | null) => (v === null ? "" : String(v).replace(".", ","));
const parseNumber = (s: string): number | null => {
  const t = s.replace(/\s/g, "").replace(",", ".");
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};

/** Période suivante (année, trimestre ou mois). */
function nextPeriod(last: string | undefined, frequency: Frequency): string {
  if (!last) return String(new Date().getFullYear() - 5);
  if (frequency === "annuelle" && /^\d{4}$/.test(last)) return String(Number(last) + 1);
  const q = /^(\d{4})T([1-4])$/.exec(last);
  if (q) return Number(q[2]) === 4 ? `${Number(q[1]) + 1}T1` : `${q[1]}T${Number(q[2]) + 1}`;
  const m = /^(\d{4})-(\d{2})$/.exec(last);
  if (m) return Number(m[2]) === 12 ? `${Number(m[1]) + 1}-01` : `${m[1]}-${String(Number(m[2]) + 1).padStart(2, "0")}`;
  return "";
}

export const emptyEconDataset = (): MacroDataset => ({ title: "", economy: "", frequency: "annuelle", periods: [], series: [], source: "", fictitious: false });

function manualStart(): MacroDataset {
  const year = new Date().getFullYear();
  const periods = Array.from({ length: 6 }, (_, i) => String(year - 6 + i));
  return { ...emptyEconDataset(), periods, series: [{ id: "s1", name: "", unit: "", role: "autre", values: periods.map(() => null) }] };
}

/** Étape « Mes séries » : source (fichier, saisie, démonstration), tableau modifiable, rôle et unité de chaque série. */
export function DataStep({ dataset, source, onSource, onChange, confirmed, stale, onConfirm }: { dataset: MacroDataset; source: EconSource | null; onSource: (source: EconSource, dataset: MacroDataset) => void; onChange: (dataset: MacroDataset) => void; confirmed: boolean; stale: boolean; onConfirm: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [importNotes, setImportNotes] = useState<string[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);

  const readFile = async (file: File) => {
    setBusy(true);
    setImportErrors([]);
    setImportNotes([]);
    try {
      const result = await importFile(file.name, new Uint8Array(await file.arrayBuffer()));
      if (!result.ok) {
        setImportErrors(result.issues.map((i) => i.message));
        return;
      }
      const parsed = datasetFromTable(result.dataset.columns.map((c) => c.originalHeader), result.dataset.rows, file.name);
      setImportNotes(parsed.notes);
      setImportErrors(parsed.errors);
      if (parsed.dataset) onSource("file", parsed.dataset);
    } catch {
      setImportErrors(["Le fichier n'a pas pu être lu."]);
    } finally {
      setBusy(false);
    }
  };

  const setSeries = (i: number, patch: Partial<MacroDataset["series"][number]>) => onChange({ ...dataset, series: dataset.series.map((s, j) => (j === i ? { ...s, ...patch } : s)) });
  const setValue = (i: number, p: number, text: string) => setSeries(i, { values: dataset.series[i].values.map((v, k) => (k === p ? parseNumber(text) : v)) });
  const filled = (p: number) => dataset.series.some((s) => s.values[p] !== null);
  const usablePeriods = dataset.periods.filter((_, p) => filled(p)).length;
  const missing = dataset.series.reduce((n, s) => n + s.values.filter((v) => v === null).length, 0);
  const unnamed = dataset.series.filter((s) => !s.name.trim()).length;
  const tooFew = usablePeriods < MIN_OBSERVATIONS;
  const blocked = !dataset.series.length || tooFew || unnamed > 0 || new Set(dataset.periods).size !== dataset.periods.length || dataset.periods.some((p) => !p.trim());

  return (
    <Section title="2. Mes séries temporelles" description="Les données d'une analyse économétrique sont des séries observées dans le temps (PIB, inflation, masse monétaire, taux de change…). Une ligne par période, une colonne par variable.">
      <div className="grid gap-3 md:grid-cols-3">
        <button type="button" onClick={() => fileRef.current?.click()} className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition hover:border-indigo-400 ${source === "file" ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200" : "border-slate-200 bg-white"}`}>
          <FileSpreadsheet size={22} className="text-indigo-600" aria-hidden />
          <span className="font-bold text-slate-900">Importer un fichier Excel ou CSV</span>
          <span className="text-sm text-slate-600">Années en lignes ou en colonnes (présentation des rapports de la BCC) : ACADIA s&apos;adapte. Le fichier reste dans votre navigateur.</span>
        </button>
        <button type="button" onClick={() => onSource("manual", manualStart())} className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition hover:border-indigo-400 ${source === "manual" ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200" : "border-slate-200 bg-white"}`}>
          <Keyboard size={22} className="text-indigo-600" aria-hidden />
          <span className="font-bold text-slate-900">Saisir mes séries</span>
          <span className="text-sm text-slate-600">À partir d&apos;un annuaire statistique, d&apos;un rapport de la Banque centrale ou de l&apos;INS.</span>
        </button>
        <button type="button" onClick={() => onSource("demo", demoDataset())} className={`flex flex-col gap-2 rounded-2xl border p-4 text-left transition hover:border-indigo-400 ${source === "demo" ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200" : "border-slate-200 bg-white"}`}>
          <Sparkles size={22} className="text-indigo-600" aria-hidden />
          <span className="font-bold text-slate-900">Données fictives de démonstration</span>
          <span className="text-sm text-slate-600">Une économie imaginaire sur 24 années, pour découvrir la démarche économétrique.</span>
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" aria-label="Fichier de séries temporelles" onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) void readFile(f);
        e.target.value = "";
      }} />
      {busy ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-slate-700" role="status">
          <Loader2 size={16} className="animate-spin" aria-hidden /> Lecture du fichier…
        </p>
      ) : null}
      {importErrors.length ? (
        <div className="mt-3">
          <Notice tone="error" title="Le fichier n'a pas pu être utilisé">
            {importErrors.join(" ")}
          </Notice>
        </div>
      ) : null}
      {importNotes.length ? (
        <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {importNotes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      ) : null}

      {source ? (
        <div className="mt-5 space-y-4">
          <div className="grid gap-3 md:grid-cols-4">
            <label className="text-sm font-semibold text-slate-800 md:col-span-2">
              Économie étudiée (pays, province, secteur)
              <input className={`${inputClass} mt-1`} value={dataset.economy} onChange={(e) => onChange({ ...dataset, economy: e.target.value })} placeholder="Ex. République démocratique du Congo" />
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Fréquence
              <select className={`${inputClass} mt-1`} value={dataset.frequency} onChange={(e) => onChange({ ...dataset, frequency: e.target.value as Frequency })}>
                {(Object.keys(FREQUENCY_LABELS) as Frequency[]).map((f) => (
                  <option key={f} value={f}>
                    {FREQUENCY_LABELS[f]}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-semibold text-slate-800">
              Source des données
              <input className={`${inputClass} mt-1`} value={dataset.source} onChange={(e) => onChange({ ...dataset, source: e.target.value })} placeholder="Ex. BCC, rapports annuels" />
            </label>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 align-bottom">
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-slate-50 px-2 py-2 text-left text-xs font-bold uppercase text-slate-500">
                    Période
                  </th>
                  {dataset.series.map((s, i) => (
                    <th key={s.id} scope="col" className="min-w-[11rem] px-2 py-2 text-left">
                      <input className={`${inputClass} text-xs font-bold`} value={s.name} onChange={(e) => setSeries(i, { name: e.target.value })} placeholder="Nom de la série" aria-label={`Nom de la série ${i + 1}`} />
                      <input className={`${inputClass} mt-1 text-xs`} value={s.unit} onChange={(e) => setSeries(i, { unit: e.target.value })} placeholder="Unité (ex. %, milliards de CDF)" aria-label={`Unité de la série ${i + 1}`} />
                      <select className={`${inputClass} mt-1 text-xs`} value={s.role} onChange={(e) => setSeries(i, { role: e.target.value as MacroRole })} aria-label={`Rôle de la série ${i + 1}`}>
                        {ROLES.map((r) => (
                          <option key={r.role} value={r.role}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-rose-700 hover:underline" onClick={() => onChange({ ...dataset, series: dataset.series.filter((_, j) => j !== i) })}>
                        <Trash2 size={12} aria-hidden /> Retirer
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dataset.periods.map((p, k) => (
                  <tr key={k} className="border-t border-slate-100">
                    <th scope="row" className="sticky left-0 z-10 bg-white px-2 py-1">
                      <input className={`${inputClass} w-24 text-xs font-semibold`} value={p} onChange={(e) => onChange({ ...dataset, periods: dataset.periods.map((x, j) => (j === k ? e.target.value.trim() : x)) })} aria-label={`Période ${k + 1}`} />
                    </th>
                    {dataset.series.map((s, i) => (
                      <td key={s.id} className="px-2 py-1">
                        <input className={`${inputClass} text-right text-xs tabular-nums`} defaultValue={numberText(s.values[k] ?? null)} key={`${s.id}-${k}-${s.values[k]}`} onBlur={(e) => setValue(i, k, e.target.value)} inputMode="decimal" aria-label={`${s.name || `Série ${i + 1}`}, ${p}`} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonClass.secondary} onClick={() => onChange({ ...dataset, periods: [...dataset.periods, nextPeriod(dataset.periods.at(-1), dataset.frequency)], series: dataset.series.map((s) => ({ ...s, values: [...s.values, null] })) })}>
              <Plus size={16} aria-hidden /> Ajouter une période
            </button>
            <button type="button" className={buttonClass.secondary} onClick={() => onChange({ ...dataset, series: [...dataset.series, { id: `s${Date.now().toString(36)}`, name: "", unit: "", role: "autre", values: dataset.periods.map(() => null) }] })} disabled={dataset.series.length >= 40}>
              <Plus size={16} aria-hidden /> Ajouter une série
            </button>
            {dataset.periods.length ? (
              <button type="button" className={buttonClass.ghost} onClick={() => onChange({ ...dataset, periods: dataset.periods.slice(0, -1), series: dataset.series.map((s) => ({ ...s, values: s.values.slice(0, -1) })) })}>
                Retirer la dernière période
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2 text-sm">
            <Pill tone={tooFew ? "red" : "green"}>
              {usablePeriods} période(s) renseignée(s) — minimum {MIN_OBSERVATIONS}
            </Pill>
            <Pill tone="blue">{dataset.series.length} série(s)</Pill>
            {missing ? <Pill tone="yellow">{missing} valeur(s) manquante(s)</Pill> : null}
            {dataset.fictitious ? <Pill tone="yellow">Données fictives</Pill> : null}
          </div>
          {tooFew ? (
            <Notice tone="warning" title={`Au moins ${MIN_OBSERVATIONS} périodes d'observation`}>
              Une analyse économétrique demande des observations sur plusieurs périodes : au moins {MIN_OBSERVATIONS} (par exemple 5 années) avant toute analyse approfondie. Au-delà, plus la série est longue, plus les tests sont fiables.
            </Notice>
          ) : null}
          {unnamed ? <Notice tone="warning">Donnez un nom à chaque série.</Notice> : null}
          {stale ? <Notice tone="stale">Vos séries ont changé depuis leur validation : vérifiez-les puis validez à nouveau.</Notice> : null}
          <button type="button" className={buttonClass.primary} disabled={blocked} onClick={onConfirm}>
            {confirmed && !stale ? "Séries validées — continuer" : "Valider mes séries et continuer"}
          </button>
        </div>
      ) : null}
    </Section>
  );
}
