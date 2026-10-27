"use client";

import { useState } from "react";

import { TrendChart } from "@/components/charts/Charts";
import { buttonClass, Metric, Notice, Pill, Section } from "@/components/data/ui";
import { computeAggregates, describe, FAMILY_LABELS, FREQUENCY_LABELS, MIN_OBSERVATIONS, missingForAggregates, ROLE_BY_ID, trendWord, type AggregateDef, type MacroDataset } from "@/lib/core/econometrics";

const n2 = (v: number | null, d = 2) => (v === null ? "—" : v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));

/** Présentation organisée des données : vue d'ensemble, statistiques, évolutions, agrégats macroéconomiques. */
export function PresentationView({ dataset, seen, stale, onConfirm }: { dataset: MacroDataset; seen: boolean; stale: boolean; onConfirm: () => void }) {
  const [allCharts, setAllCharts] = useState(false);
  const aggregates = computeAggregates(dataset);
  const missing = missingForAggregates(dataset).slice(0, 6);
  const n = dataset.periods.length;
  const families = [...new Set(aggregates.map((a) => a.def.family))] as AggregateDef["family"][];
  const charted = allCharts ? dataset.series : dataset.series.slice(0, 4);

  return (
    <Section title="3. Présentation des données" description="Avant toute estimation : d'où viennent les données, sur quelle période, et comment ont évolué les variables. Cette présentation constitue la première section de votre chapitre.">
      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="Période" value={`${dataset.periods[0] ?? "?"} – ${dataset.periods[n - 1] ?? "?"}`} />
        <Metric label="Observations" value={n} hint={FREQUENCY_LABELS[dataset.frequency]} tone={n < MIN_OBSERVATIONS ? "warn" : undefined} />
        <Metric label="Séries" value={dataset.series.length} />
        <Metric label="Agrégats calculés" value={aggregates.length} />
      </div>
      <p className="mt-3 text-sm text-slate-700">
        {dataset.economy || "Économie à préciser"} · source : {dataset.source || "à préciser"}
        {dataset.fictitious ? " · données FICTIVES" : ""}
      </p>

      <h3 className="mt-6 text-base font-extrabold text-slate-900">Statistiques descriptives</h3>
      <div className="mt-2 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              {["Variable", "Moyenne", "Écart-type", "Minimum", "Maximum", "CV (%)", "Croissance annuelle moyenne", "Tendance"].map((h) => (
                <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataset.series.map((s) => {
              const d = describe(s.values);
              return (
                <tr key={s.id} className="border-t border-slate-100">
                  <th scope="row" className="px-3 py-2 text-left font-semibold text-slate-900">
                    {s.name}
                    <span className="block text-xs font-normal text-slate-500">
                      {s.unit || "unité à préciser"} · {ROLE_BY_ID[s.role]?.label}
                    </span>
                  </th>
                  <td className="px-3 py-2 tabular-nums">{n2(d.mean)}</td>
                  <td className="px-3 py-2 tabular-nums">{n2(d.sd)}</td>
                  <td className="px-3 py-2 tabular-nums">
                    {n2(d.min)} <span className="text-xs text-slate-500">({d.minIndex !== null ? dataset.periods[d.minIndex] : "—"})</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">
                    {n2(d.max)} <span className="text-xs text-slate-500">({d.maxIndex !== null ? dataset.periods[d.maxIndex] : "—"})</span>
                  </td>
                  <td className="px-3 py-2 tabular-nums">{n2(d.cv, 1)}</td>
                  <td className="px-3 py-2 tabular-nums">{d.tcam === null ? "—" : `${n2(d.tcam)} %`}</td>
                  <td className="px-3 py-2">{trendWord(d) ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <h3 className="mt-6 text-base font-extrabold text-slate-900">Évolution des séries</h3>
      <div className="mt-2 grid gap-4 lg:grid-cols-2">
        {charted.map((s) => (
          <TrendChart key={s.id} title={`${s.name}${s.unit ? ` (${s.unit})` : ""}`} categories={dataset.periods} series={[{ name: s.name, values: s.values }]} format={(v) => n2(v, Math.abs(v) < 100 ? 1 : 0)} />
        ))}
      </div>
      {dataset.series.length > 4 ? (
        <button type="button" className={`${buttonClass.ghost} mt-2`} onClick={() => setAllCharts((v) => !v)}>
          {allCharts ? "Afficher moins de graphiques" : `Afficher les ${dataset.series.length} séries`}
        </button>
      ) : null}

      <h3 className="mt-6 text-base font-extrabold text-slate-900">Agrégats et indicateurs macroéconomiques</h3>
      <p className="text-sm text-slate-600">Calculés à partir de vos séries, avec leur formule. Les ratios supposent la même monnaie et la même unité au numérateur et au dénominateur : vérifiez-le.</p>
      {aggregates.length ? (
        families.map((family) => (
          <div key={family} className="mt-3">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-indigo-700">{FAMILY_LABELS[family]}</p>
            <div className="mt-2 grid gap-3 md:grid-cols-2">
              {aggregates
                .filter((a) => a.def.family === family)
                .map((a) => {
                  const d = describe(a.values);
                  return (
                    <article key={a.def.id} className="rounded-2xl border border-slate-200 p-4">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <h4 className="font-bold text-slate-900">{a.def.label}</h4>
                        <Pill tone="blue">
                          Dernière valeur : {n2(d.last)} {a.def.unit}
                        </Pill>
                      </div>
                      <p className="mt-1 font-mono text-xs text-slate-600">{a.def.formula}</p>
                      <p className="mt-2 text-sm text-slate-700">
                        Moyenne {n2(d.mean)} {a.def.unit} · minimum {n2(d.min)} ({d.minIndex !== null ? dataset.periods[d.minIndex] : "—"}) · maximum {n2(d.max)} ({d.maxIndex !== null ? dataset.periods[d.maxIndex] : "—"})
                      </p>
                      <p className="mt-1 text-sm text-slate-600">{a.def.reading}</p>
                    </article>
                  );
                })}
            </div>
          </div>
        ))
      ) : (
        <Notice tone="info">Aucun agrégat n&apos;est calculable : indiquez le rôle de vos séries (PIB, IPC, M2…) à l&apos;étape précédente.</Notice>
      )}
      {missing.length ? (
        <p className="mt-3 text-sm text-slate-600">
          Pour aller plus loin, ajoutez : {missing.map((m) => `${m.missing.map((r) => ROLE_BY_ID[r].label).join(" + ")} (→ ${m.def.label})`).join(" ; ")}.
        </p>
      ) : null}

      {stale ? (
        <div className="mt-4">
          <Notice tone="stale">Vos séries ont changé depuis votre lecture : relisez la présentation puis confirmez.</Notice>
        </div>
      ) : null}
      <button type="button" className={`${buttonClass.primary} mt-5`} onClick={onConfirm}>
        {seen && !stale ? "Présentation lue — continuer" : "J'ai pris connaissance de la présentation de mes données"}
      </button>
    </Section>
  );
}
