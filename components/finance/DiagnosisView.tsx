"use client";

import { useState } from "react";
import { AlertTriangle, ArrowRight, CheckCircle2, Lightbulb, Search } from "lucide-react";

import { TrendChart } from "@/components/charts/Charts";
import { buttonClass, Notice, Pill, Section, type Tone } from "@/components/data/ui";
import {
  bandsText,
  currencySuffix,
  DIAGNOSIS_METHOD,
  explainIndicator,
  FAMILY_LABELS,
  formatValue,
  LEVEL_LABELS,
  PARAM_LABELS,
  SECTOR_LABELS,
  SEVERITY_LABELS,
  type Diagnosis,
  type FamilyId,
  type FinanceComputation,
  type FinanceDossier,
  type IndicatorSeries,
  type Level,
  type Reflex,
  type Zone,
} from "@/lib/core/finance";

const LEVEL_STYLE: Record<Level, { box: string; badge: Tone }> = {
  saine: { box: "border-emerald-300 bg-emerald-50 text-emerald-950", badge: "green" },
  plutot_saine: { box: "border-teal-300 bg-teal-50 text-teal-950", badge: "blue" },
  fragile: { box: "border-amber-300 bg-amber-50 text-amber-950", badge: "yellow" },
  difficulte: { box: "border-rose-300 bg-rose-50 text-rose-950", badge: "red" },
  non_etabli: { box: "border-slate-300 bg-slate-50 text-slate-900", badge: "neutral" },
};

const ZONE_STYLE: Record<Zone, string> = { favorable: "bg-emerald-50 text-emerald-800", vigilance: "bg-amber-50 text-amber-900", defavorable: "bg-rose-50 text-rose-800" };
const ZONE_LABELS: Record<Zone, string> = { favorable: "favorable", vigilance: "à surveiller", defavorable: "défavorable" };

function ValueCell({ series, index }: { series: IndicatorSeries; index: number }) {
  const point = series.values[index];
  if (point.value === null) return <span className="whitespace-nowrap text-xs italic text-slate-500" title={point.reason}>non calculable</span>;
  return (
    <span className={`inline-block whitespace-nowrap rounded-md px-1.5 py-0.5 tabular-nums ${point.zone ? ZONE_STYLE[point.zone] : "text-slate-800"}`} title={point.zone ? ZONE_LABELS[point.zone] : undefined}>
      {formatValue(point.value, series.def.unit)}
    </span>
  );
}

/** « Comment ce chiffre est calculé » : formule, calcul chiffré par exercice et signification. */
export function CalculationDetail({ id, computation, dossier }: { id: string; computation: FinanceComputation; dossier: FinanceDossier }) {
  const e = explainIndicator(id, computation, dossier);
  if (!e) return null;
  return (
    <div className="space-y-1.5 rounded-lg border border-indigo-100 bg-white p-2 text-xs text-slate-700">
      <p className="font-semibold text-indigo-900">Comment ce chiffre est calculé : {e.label}</p>
      <p>
        <span className="font-semibold">Formule : </span>
        {e.formula}
      </p>
      {e.legend ? <p className="text-slate-500">Postes : {e.legend}.</p> : null}
      <ul className="space-y-1">
        {e.lines.map((l) => (
          <li key={l.exercise} className="tabular-nums">
            <span className="font-semibold">{l.exercise} : </span>
            {l.unavailable ? <span className="italic">non calculable — {l.unavailable}</span> : l.steps.join(" ; ")}
          </li>
        ))}
      </ul>
      <p className="font-semibold text-indigo-900">Ce que cela signifie</p>
      <ul className="list-disc space-y-0.5 pl-4">
        {e.meaning.map((m) => (
          <li key={m}>{m}</li>
        ))}
      </ul>
    </div>
  );
}

function IndicatorTable({ list, computation, dossier }: { list: IndicatorSeries[]; computation: FinanceComputation; dossier: FinanceDossier }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="overflow-x-auto rounded-xl ring-1 ring-slate-200">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            <th scope="col" className="min-w-[14rem] px-3 py-2 text-left font-semibold">
              Indicateur
            </th>
            {computation.exercises.map((e) => (
              <th key={e.id} scope="col" className="px-2 py-2 text-right font-semibold">
                {e.label}
              </th>
            ))}
            <th scope="col" className="min-w-[10rem] px-3 py-2 text-left font-semibold">
              Repère usuel
            </th>
          </tr>
        </thead>
        <tbody>
          {list.map((s) => {
            const unavailable = s.values.every((v) => v.value === null);
            return (
              <tr key={s.def.id} className="border-t border-slate-100 align-top">
                <th scope="row" className="px-3 py-2 text-left font-normal">
                  <button type="button" className="text-left font-medium text-slate-900 underline-offset-2 hover:underline" onClick={() => setOpen(open === s.def.id ? null : s.def.id)} aria-expanded={open === s.def.id}>
                    {s.def.label}
                  </button>
                  <span className="block text-xs text-slate-500">{s.def.formulaLabel}</span>
                  {unavailable ? <span className="block text-xs italic text-slate-500">Non calculable : {s.values.find((v) => v.reason)?.reason}</span> : null}
                  {open === s.def.id ? (
                    <div className="mt-2 space-y-2">
                      <CalculationDetail id={s.def.id} computation={computation} dossier={dossier} />
                      {s.def.norms ? <p className="text-xs text-slate-500">{s.def.norms.note}</p> : null}
                    </div>
                  ) : null}
                </th>
                {s.values.map((_, i) => (
                  <td key={i} className="px-2 py-2 text-right">
                    <ValueCell series={s} index={i} />
                  </td>
                ))}
                <td className="px-3 py-2 text-xs text-slate-600">{bandsText(s.def, s.bands) || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function ReflexCard({ reflex }: { reflex: Reflex }) {
  const Icon = reflex.severity === "critique" ? AlertTriangle : reflex.severity === "important" ? Search : Lightbulb;
  const tone = reflex.severity === "critique" ? "border-rose-200 bg-rose-50" : reflex.severity === "important" ? "border-amber-200 bg-amber-50" : "border-sky-200 bg-sky-50";
  return (
    <li className={`flex gap-3 rounded-xl border p-3 text-sm ${tone}`}>
      <Icon size={18} className="mt-0.5 shrink-0 text-slate-700" aria-hidden />
      <div className="min-w-0">
        <p className="font-semibold text-slate-900">
          <span className="mr-2 text-xs font-bold uppercase tracking-wide text-slate-600">{SEVERITY_LABELS[reflex.severity]}</span>
          {reflex.title}
        </p>
        <p className="mt-0.5 text-slate-800">{reflex.text}</p>
        <p className="mt-1 text-xs text-slate-600">
          <span className="font-semibold">Où chercher : </span>
          {reflex.where}
        </p>
      </div>
    </li>
  );
}

const DIMENSION_FAMILIES: Record<string, FamilyId[]> = { liquidite: ["liquidite"], solvabilite: ["solvabilite"], rentabilite: ["rentabilite"], activite: ["activite"], equilibre: ["equilibre"] };

/** Étape « L'état de l'entreprise » : le préambule d'ACADIA avant le sujet de recherche. */
export function DiagnosisView({ computation, diagnosis, reflexes, dossier, seen, stale, onConfirm }: { computation: FinanceComputation; diagnosis: Diagnosis; reflexes: Reflex[]; dossier: FinanceDossier; seen: boolean; stale: boolean; onConfirm: () => void }) {
  const [allReflexes, setAllReflexes] = useState(false);
  const { latest } = diagnosis;
  const labels = computation.exercises.map((e) => e.label);
  const series = computation.series;
  const values = (id: string) => series[id].values.map((v) => v.value);
  const money = (v: number) => formatValue(v, "montant");
  const shownReflexes = allReflexes ? reflexes : reflexes.slice(0, 8);
  const families = Object.keys(FAMILY_LABELS) as FamilyId[];
  const company = dossier.company.name || "l'entreprise";
  return (
    <div className="space-y-5">
      {stale ? (
        <Notice tone="stale" title="Chiffres modifiés depuis votre lecture">
          L&apos;état de l&apos;entreprise a été recalculé avec vos nouveaux chiffres : relisez-le, puis confirmez à nouveau.
        </Notice>
      ) : null}
      <Section title="3. L'état de l'entreprise" description={`Lecture d'ACADIA à partir des états que vous avez validés (${labels.join(", ")} ; ${currencySuffix(dossier.company)} ; secteur : ${SECTOR_LABELS[dossier.company.sector].toLowerCase()}). Ni un audit, ni un avis d'expert-comptable : un premier diagnostic pour entrer dans votre sujet.`}>
        <div className={`rounded-2xl border-2 p-4 sm:p-5 ${LEVEL_STYLE[latest.level].box}`} role="status" aria-label="Verdict global">
          <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-80">Verdict global · {company}</p>
          <p className="mt-1 text-2xl font-extrabold leading-tight sm:text-3xl">{diagnosis.headline}</p>
          {diagnosis.byExercise.length > 1 ? (
            <p className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              {diagnosis.byExercise.map((e, i) => (
                <span key={e.label} className="inline-flex items-center gap-2">
                  {i > 0 ? <ArrowRight size={14} aria-hidden /> : null}
                  <Pill tone={LEVEL_STYLE[e.level].badge}>
                    {e.label} : {LEVEL_LABELS[e.level]}
                  </Pill>
                </span>
              ))}
            </p>
          ) : null}
          {diagnosis.reasons.length ? (
            <div className="mt-4">
              <p className="text-sm font-semibold">Parce que :</p>
              <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {diagnosis.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        {reflexes.some((r) => r.severity === "critique") ? (
          <ul className="mt-4 space-y-2" aria-label="Alertes">
            {reflexes
              .filter((r) => r.severity === "critique")
              .slice(0, 3)
              .map((r) => (
                <ReflexCard key={r.id} reflex={r} />
              ))}
          </ul>
        ) : null}
      </Section>

      <Section title={`Les cinq dimensions en ${latest.label}`} description="Chaque dimension reçoit un verdict, avec les indicateurs qui l'expliquent. Touchez un indicateur pour sa définition.">
        <div className="grid gap-3 lg:grid-cols-2">
          {latest.dimensions.map((d) => (
            <article key={d.id} className={`rounded-2xl border p-4 ${LEVEL_STYLE[d.level].box}`} aria-label={`${d.label} : ${LEVEL_LABELS[d.level]}`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-bold">{d.label}</h3>
                <Pill tone={LEVEL_STYLE[d.level].badge}>{LEVEL_LABELS[d.level]}</Pill>
              </div>
              {diagnosis.byExercise.length > 1 ? (
                <p className="mt-1 text-xs opacity-80">
                  {diagnosis.byExercise.map((e) => `${e.label} : ${LEVEL_LABELS[e.dimensions.find((x) => x.id === d.id)!.level].toLowerCase()}`).join(" · ")}
                </p>
              ) : null}
              <ul className="mt-2 list-disc space-y-1 pl-5 text-sm leading-relaxed">
                {d.reasons.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <details className="mt-2 text-sm">
                <summary className="cursor-pointer font-medium">Indicateurs de la dimension</summary>
                <div className="mt-2 bg-white/60">
                  <IndicatorTable list={Object.values(series).filter((s) => s.def.dimension === d.id || (DIMENSION_FAMILIES[d.id].includes(s.def.family) && s.def.direction !== "neutral" && s.def.unit !== "montant" && s.values.some((v) => v.value !== null)))} computation={computation} dossier={dossier} />
                </div>
              </details>
            </article>
          ))}
        </div>
      </Section>

      {labels.length > 1 ? (
        <Section title="Évolution" description={`Montants en ${currencySuffix(dossier.company)}.`}>
          <div className="grid gap-3 lg:grid-cols-2">
            <TrendChart title="Activité et résultats" categories={labels} series={[{ name: "Chiffre d'affaires", values: values("chiffre_affaires") }, { name: "EBE", values: values("ebe") }, { name: "Résultat net", values: values("resultat_net") }]} format={money} />
            <TrendChart title="Équilibre financier" categories={labels} series={[{ name: "Fonds de roulement", values: values("fr") }, { name: "Besoin de financement d'exploitation", values: values("bfe") }, { name: "Trésorerie nette", values: values("tn") }]} format={money} note="Trésorerie nette = fonds de roulement − besoin de financement global." />
          </div>
        </Section>
      ) : null}

      <Section title="Les réflexes du financier" description="Ce qu'un analyste expérimenté vérifierait en premier en découvrant ces états : des pistes à vérifier dans les documents de l'entreprise, jamais des conclusions.">
        {reflexes.length ? (
          <>
            <ul className="space-y-2">
              {shownReflexes.map((r) => (
                <ReflexCard key={r.id} reflex={r} />
              ))}
            </ul>
            {reflexes.length > 8 ? (
              <button type="button" className={`${buttonClass.ghost} mt-2`} onClick={() => setAllReflexes((v) => !v)}>
                {allReflexes ? "Voir moins" : `Voir tous les réflexes (${reflexes.length})`}
              </button>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-slate-600">Aucun signal particulier dans ces états.</p>
        )}
      </Section>

      <Section title="Tous les indicateurs" description={`${Object.keys(series).length} indicateurs de gestion financière, calculés pour chaque exercice ; un indicateur non calculable l'est avec sa raison (jamais de valeur inventée).`}>
        <div className="space-y-2">
          {families.map((family) => {
            const list = Object.values(series).filter((s) => s.def.family === family);
            const computed = list.filter((s) => s.values.some((v) => v.value !== null)).length;
            return (
              <details key={family} className="rounded-xl ring-1 ring-slate-200">
                <summary className="cursor-pointer rounded-xl px-4 py-3 font-semibold text-slate-900 hover:bg-slate-50">
                  {FAMILY_LABELS[family]}{" "}
                  <span className="font-normal text-slate-500">
                    ({computed} / {list.length} calculables)
                  </span>
                </summary>
                <div className="px-3 pb-3">
                  <IndicatorTable list={list} computation={computation} dossier={dossier} />
                </div>
              </details>
            );
          })}
        </div>
        <details className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
          <summary className="cursor-pointer font-semibold text-slate-900">Comment ACADIA forme son verdict</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {DIAGNOSIS_METHOD.map((m) => (
              <li key={m}>{m}</li>
            ))}
            <li>
              Paramètres : {PARAM_LABELS.tva} {formatValue(computation.params.tva, "pct")} ; {PARAM_LABELS.taux_is} {formatValue(computation.params.taux_is, "pct")} ; {PARAM_LABELS.jours}.
            </li>
            <li>Les repères sont des conventions usuelles de l&apos;analyse financière, à discuter avec votre encadreur : ce ne sont pas des normes.</li>
          </ul>
        </details>
      </Section>

      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonClass.primary} onClick={onConfirm}>
          <CheckCircle2 size={18} aria-hidden /> {seen ? "Continuer : mon sujet de recherche" : "J'ai pris connaissance de l'état de l'entreprise — continuer"}
        </button>
      </div>
    </div>
  );
}
