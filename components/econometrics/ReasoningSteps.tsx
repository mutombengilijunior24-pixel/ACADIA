"use client";

import { CheckCircle2, RefreshCw } from "lucide-react";

import { TrendChart } from "@/components/charts/Charts";
import { buttonClass, Notice, Pill, Section, type NoticeTone, type Tone } from "@/components/data/ui";
import { ExportBar } from "@/components/export/ExportBar";
import type { ChainVerdict } from "@/lib/core/chain";
import {
  DETERMINISTIC_LABELS,
  econDocument,
  econSheets,
  FORMULAS,
  GLOSSARY,
  READINESS_LABELS,
  specLabel,
  type AdfResult,
  type ChapterSection,
  type CoefficientRow,
  type DefenseKit,
  type EconometricAnalysis,
  type EconReportInput,
  type HypothesisResult,
  type IntegrationOrder,
  type MacroDataset,
  type ModelGroup,
  type Orientation,
  type Transform,
} from "@/lib/core/econometrics";

const VERDICT_TONE: Record<ChainVerdict, Tone> = { supported: "green", partially_supported: "yellow", not_supported: "neutral", contrary: "red", inconclusive: "neutral", not_examined: "neutral" };
const ORIENTATION_TONE: Record<Orientation["tone"], NoticeTone> = { ok: "success", warning: "warning", info: "info" };

const n = (v: number | null | undefined, d = 3) => (v === null || v === undefined ? "—" : v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pv = (p: number | null | undefined) => (p === null || p === undefined ? "—" : p < 0.001 ? "< 0,001" : p.toLocaleString("fr-FR", { minimumFractionDigits: 3, maximumFractionDigits: 3 }));
const pEq = (p: number | null | undefined) => (p === null || p === undefined ? "p n.d." : p < 0.001 ? "p < 0,001" : `p = ${pv(p)}`);
const ORDER_LABEL = (o: IntegrationOrder["order"]) => (o === 0 ? "I(0) : stationnaire" : o === 1 ? "I(1) : stationnaire en différence" : o === 2 ? "I(2) ou plus" : "indéterminé");

function adfDecision(r: AdfResult) {
  if (r.stat === null) return r.reason ?? "Test non réalisé";
  if (r.stationary) return `H0 rejetée au seuil de ${r.level} : stationnaire`;
  if (r.level === "10 %") return "H0 rejetée seulement à 10 % : non stationnaire au seuil de 5 %";
  return "H0 non rejetée : non stationnaire";
}

function Table({ caption, head, rows }: { caption: string; head: string[]; rows: Array<Array<React.ReactNode>> }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200">
      <table className="min-w-full text-sm">
        <caption className="bg-slate-50 px-3 py-2 text-left text-xs font-bold uppercase tracking-wide text-slate-600">{caption}</caption>
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-slate-100 align-top">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? "font-semibold text-slate-900" : "tabular-nums text-slate-700"}`}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const coefRows = (rows: CoefficientRow[]) => rows.map((r) => [r.name, `${n(r.beta)} ${r.stars}`, n(r.se), n(r.t, 2), pv(r.p), r.ci ? `[${n(r.ci[0])} ; ${n(r.ci[1])}]` : "—"]);

/** Démarche complète d'un modèle : stationnarité, estimation, validation, long terme et court terme. */
function ModelAnalysis({ group, analysis, onReestimate }: { group: ModelGroup; analysis: EconometricAnalysis; onReestimate: (transform: Transform) => void }) {
  const est = analysis.estimation;
  const ready = analysis.readiness;
  return (
    <article className="space-y-4 rounded-2xl border border-indigo-200 p-4" aria-label={group.label}>
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-extrabold text-slate-900">{group.label}</h3>
        <Pill tone="blue">{specLabel(group.spec.transform)}</Pill>
        <Pill tone={ready.level === "complet" ? "green" : ready.level === "bloque" ? "red" : "yellow"}>
          {READINESS_LABELS[ready.level]} · {ready.observations} obs.
        </Pill>
      </div>

      <div className="space-y-2" aria-label="Orientations">
        {analysis.orientations.map((o) => (
          <Notice
            key={o.title + o.text}
            tone={ORIENTATION_TONE[o.tone]}
            title={o.title}
            action={
              o.action === "estimer_en_differences" && group.spec.transform !== "diff" ? (
                <button type="button" className={buttonClass.secondary} onClick={() => onReestimate("diff")}>
                  <RefreshCw size={14} aria-hidden /> Ré-estimer en différences premières
                </button>
              ) : undefined
            }
          >
            {o.text}
          </Notice>
        ))}
        {analysis.issues.map((i) => (
          <Notice key={i} tone="info">
            {i}
          </Notice>
        ))}
      </div>

      {analysis.orders.length ? (
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900">1. Stationnarité des séries (test ADF)</h4>
          <p className="text-sm text-slate-600">H0 : la série a une racine unitaire (non stationnaire). On la rejette lorsque la statistique ADF est inférieure à la valeur critique de MacKinnon (2010). Retards choisis par le critère d&apos;Akaike.</p>
          <Table
            caption="Test de Dickey-Fuller augmenté"
            head={["Variable", "Spécification", "Retards", "Stat. ADF", "VC 1 %", "VC 5 %", "VC 10 %", "Décision"]}
            rows={analysis.orders.flatMap(({ name, order }) =>
              [
                { label: name, r: order.level.c },
                { label: "", r: order.level.ct },
                ...(order.difference ? [{ label: `Δ ${name}`, r: order.difference }] : []),
              ].map(({ label, r }) => [label, DETERMINISTIC_LABELS[r.deterministic], r.stat === null ? "—" : r.lags, n(r.stat, 2), n(r.critical?.p1, 2), n(r.critical?.p5, 2), n(r.critical?.p10, 2), adfDecision(r)]),
            )}
          />
          <ul className="space-y-1 text-sm text-slate-700">
            {analysis.orders.map(({ name, order }) => (
              <li key={name}>
                <span className="font-semibold">{name}</span> — {ORDER_LABEL(order.order)}. {order.summary}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {est ? (
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900">2. Estimation par les moindres carrés ordinaires</h4>
          <p className="rounded-xl bg-slate-50 p-3 font-mono text-sm text-slate-800">{est.equation}</p>
          <Table caption={`Coefficients estimés (${est.n} observations, ${est.periods[0]}–${est.periods.at(-1)})`} head={["Variable", "Coefficient", "Écart-type", "t de Student", "p-value", "IC à 95 %"]} rows={coefRows(est.rows)} />
          <p className="text-xs text-slate-500">*** significatif à 1 %, ** à 5 %, * à 10 %.</p>
          <div className="grid gap-2 text-sm sm:grid-cols-4">
            <p className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              R² : <span className="font-bold">{n(est.r2)}</span>
            </p>
            <p className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              R² ajusté : <span className="font-bold">{n(est.adjR2)}</span>
            </p>
            <p className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              F de Fisher : <span className="font-bold">{n(est.f, 2)}</span> ({pEq(est.fP)})
            </p>
            <p className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              Durbin-Watson : <span className="font-bold">{n(est.dw, 2)}</span>
            </p>
          </div>
          <TrendChart
            title={`Valeurs observées et ajustées — ${est.dependentName}`}
            categories={est.periods}
            series={[
              { name: "Observée", values: est.observed },
              { name: "Ajustée par le modèle", values: est.fitted },
            ]}
            format={(v) => n(v, Math.abs(v) < 100 ? 1 : 0)}
          />

          <h4 className="pt-2 font-bold text-slate-900">3. Validation du modèle (tests sur les résidus)</h4>
          <Table
            caption="Tests de validation"
            head={["Test", "Hypothèse nulle", "Statistique", "p-value", "Conclusion au seuil de 5 %"]}
            rows={[
              ["Breusch-Godfrey (ordre 1)", "Pas d'autocorrélation des erreurs", n(est.bg.statistic, 2), pv(est.bg.pValue), est.bg.pValue === null ? "—" : est.bg.pValue < 0.05 ? "Autocorrélation détectée" : "Absence d'autocorrélation non rejetée"],
              ["Breusch-Pagan", "Homoscédasticité des erreurs", n(est.bp.statistic, 2), pv(est.bp.pValue), est.bp.pValue === null ? "—" : est.bp.pValue < 0.05 ? "Hétéroscédasticité détectée" : "Homoscédasticité non rejetée"],
              ["Jarque-Bera", "Normalité des résidus", n(est.jb.statistic, 2), pv(est.jb.pValue), est.jb.pValue === null ? "—" : est.jb.pValue < 0.05 ? "Normalité rejetée" : "Normalité non rejetée"],
              ...est.vif.map((v) => [`VIF — ${v.name}`, "Pas de multicolinéarité forte", n(v.value, 2), "—", v.value === null ? "—" : v.value > 10 ? "Multicolinéarité forte (VIF > 10)" : "Acceptable (VIF ≤ 10)"]),
            ]}
          />
        </div>
      ) : null}

      {analysis.cointegration ? (
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900">4. Relation de long terme : cointégration (Engle-Granger)</h4>
          {analysis.cointegration.available ? (
            <p className="text-sm text-slate-700">
              Test ADF sur les résidus de l&apos;équation de long terme : statistique {n(analysis.cointegration.stat, 2)}, valeur critique à 5 % {n(analysis.cointegration.critical?.p5, 2)} ({analysis.cointegration.nobs} obs., {analysis.cointegration.lags} retard(s)).{" "}
              <span className="font-semibold">{analysis.cointegration.cointegrated ? "Les résidus sont stationnaires : les variables sont cointégrées." : "La stationnarité des résidus n'est pas établie : pas de cointégration au seuil de 5 %."}</span>
            </p>
          ) : (
            <p className="text-sm text-slate-600">{analysis.cointegration.reason}</p>
          )}
        </div>
      ) : null}

      {analysis.ecm ? (
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900">5. Dynamique de court terme : modèle à correction d&apos;erreur</h4>
          <Table caption={`Modèle à correction d'erreur (${analysis.ecm.n} observations)`} head={["Variable", "Coefficient", "Écart-type", "t de Student", "p-value", "IC à 95 %"]} rows={coefRows(analysis.ecm.rows)} />
          <p className="text-sm text-slate-700">
            Force de rappel : {n(analysis.ecm.lambda)} ({pEq(analysis.ecm.lambdaP)}).{" "}
            {analysis.ecm.valid ? `Négative et significative : environ ${n(Math.abs(analysis.ecm.lambda) * 100, 0)} % d'un écart à l'équilibre de long terme est corrigé à chaque période.` : "Elle n'est pas à la fois négative et significative : le mécanisme de correction d'erreur n'est pas validé."}
          </p>
        </div>
      ) : null}

      {analysis.causality.length ? (
        <div className="space-y-2">
          <h4 className="font-bold text-slate-900">{analysis.ecm ? "6" : analysis.cointegration ? "5" : "4"}. Causalité au sens de Granger</h4>
          <Table
            caption="Test de causalité de Granger"
            head={["Sens testé", "Retards", "F", "p-value", "Conclusion"]}
            rows={analysis.causality.map((c) => [`${c.cause} → ${c.effect}${c.onDifferences ? " (en différences)" : ""}`, c.result.lags, n(c.result.f, 2), pv(c.result.pValue), c.result.pValue === null ? (c.result.reason ?? "—") : c.result.pValue < 0.05 ? "Précédence temporelle établie" : "Pas de précédence établie"])}
          />
          <p className="text-xs text-slate-500">La causalité au sens de Granger signifie que les valeurs passées d&apos;une variable améliorent la prévision de l&apos;autre : c&apos;est une précédence temporelle, pas une preuve de causalité économique.</p>
        </div>
      ) : null}
    </article>
  );
}

/** Étape « Le raisonnement économétrique » : démarche par modèle, puis verdict sur chaque hypothèse. */
export function ReasoningView({ dataset, models, analyses, results, seen, stale, onReestimate, onConfirm }: { dataset: MacroDataset; models: ModelGroup[]; analyses: Record<string, EconometricAnalysis>; results: HypothesisResult[]; seen: boolean; stale: boolean; onReestimate: (modelKey: string, transform: Transform) => void; onConfirm: () => void }) {
  return (
    <div className="space-y-5">
      <Section title="5. Le raisonnement économétrique" description="Dans l'ordre où un économètre mène l'analyse : stationnarité des séries, estimation, tests de validation, puis relation de long terme et dynamique de court terme. Chaque étape dit ce qu'il faut en conclure et ce qu'il faut faire ensuite.">
        {dataset.fictitious ? <Notice tone="warning">Données FICTIVES : ces résultats illustrent la démarche et ne décrivent aucune économie réelle.</Notice> : null}
        <div className="mt-3 space-y-5">
          {models.map((g) => (analyses[g.key] ? <ModelAnalysis key={g.key} group={g} analysis={analyses[g.key]} onReestimate={(t) => onReestimate(g.key, t)} /> : null))}
        </div>
      </Section>

      <Section title="Verdict sur mes hypothèses" description="Le verdict combine le signe et la significativité du coefficient, puis la validité économétrique du modèle. ACADIA ne dit jamais « prouvée » : une association statistique, même solide, n'établit pas à elle seule une causalité.">
        <ol className="space-y-3">
          {results.map((r, i) => (
            <li key={r.rowId} className="rounded-2xl border border-slate-200 p-4" aria-label={`Verdict de l'hypothèse ${i + 1}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-slate-900">H{i + 1}.</span>
                <span className="min-w-0 flex-1 text-slate-900">{r.hypothesis}</span>
                <Pill tone={VERDICT_TONE[r.verdict]}>{r.verdictLabel}</Pill>
              </div>
              {r.modelLabel ? (
                <p className="mt-1 text-xs text-slate-500">
                  {r.modelLabel} · {r.independentName} → {r.dependentName} · signe attendu {r.expectedSign === 1 ? "positif" : r.expectedSign === -1 ? "négatif" : "non précisé"}
                </p>
              ) : null}
              {r.reading ? <p className="mt-2 rounded-xl bg-indigo-50 p-3 text-sm text-indigo-950">{r.reading}</p> : null}
              {r.shortRun ? <p className="mt-2 text-sm text-slate-700">{r.shortRun}</p> : null}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {r.supports.length ? (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">Ce qui rapproche de l&apos;hypothèse</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {r.supports.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {r.limits.length ? (
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-amber-700">Ce qui en éloigne ou limite la conclusion</p>
                    <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-slate-700">
                      {r.limits.map((s) => (
                        <li key={s}>{s}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
              {r.theory ? (
                <p className="mt-2 text-xs text-slate-500">
                  Cadre théorique : {r.theory.name} ({r.theory.references}).
                </p>
              ) : null}
            </li>
          ))}
        </ol>
        {stale ? (
          <div className="mt-4">
            <Notice tone="stale">Le modèle ou les données ont changé depuis votre lecture : relisez le raisonnement puis confirmez.</Notice>
          </div>
        ) : null}
        <button type="button" className={`${buttonClass.primary} mt-5`} onClick={onConfirm}>
          {seen && !stale ? "Raisonnement lu — voir le chapitre" : "J'ai lu le raisonnement : préparer mon chapitre"}
        </button>
      </Section>
    </div>
  );
}

/** Étape « Mon chapitre de résultats » : plan section par section, soutenance, exports. */
export function ChapterView({ chapter, defense, report, done, stale, onDone, fileBase }: { chapter: ChapterSection[]; defense: DefenseKit; report: EconReportInput; done: boolean; stale: boolean; onDone: () => void; fileBase: string }) {
  return (
    <div className="space-y-5">
      {stale ? <Notice tone="stale" title="Résultats modifiés depuis votre plan">Le plan et le rapport ont été mis à jour : relisez-les, puis retenez à nouveau le plan.</Notice> : null}
      <Section
        title="6. Mon chapitre de résultats"
        description="Le plan du chapitre, section par section : ce que chaque section démontre, les tableaux et graphiques à y présenter et une proposition de rédaction chiffrée, à relire et à reformuler avec vos mots."
        action={done ? <Pill tone="green">Plan retenu</Pill> : <Pill tone="neutral">Proposé</Pill>}
      >
        <ol className="space-y-3">
          {chapter.map((s) => (
            <li key={s.id} className="rounded-2xl ring-1 ring-slate-200">
              <details open={s.id === "donnees"} className="p-4">
                <summary className="cursor-pointer">
                  <span className="font-bold text-slate-900">{s.title}</span>
                  <span className="mt-1 block text-sm text-slate-600">{s.purpose}</span>
                </summary>
                {s.contents.length ? (
                  <>
                    <p className="mt-3 text-sm font-semibold text-slate-800">À présenter</p>
                    <ul className="list-disc pl-5 text-sm text-slate-700">
                      {s.contents.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  </>
                ) : null}
                {s.paragraphs.length ? (
                  <>
                    <p className="mt-3 text-sm font-semibold text-slate-800">Proposition de rédaction (à reformuler)</p>
                    <div className="space-y-2 text-sm leading-relaxed text-slate-700">
                      {s.paragraphs.map((p) => (
                        <p key={p}>{p}</p>
                      ))}
                    </div>
                  </>
                ) : null}
              </details>
            </li>
          ))}
        </ol>
        <button type="button" className={`${buttonClass.primary} mt-4`} onClick={onDone}>
          <CheckCircle2 size={18} aria-hidden /> {done && !stale ? "Plan retenu" : "Retenir ce plan"}
        </button>
      </Section>

      <Section title="Préparer ma soutenance" description="L'essentiel à dire à l'oral, les questions probables du jury avec des réponses appuyées sur vos résultats, les formules utilisées et un lexique. Ces éléments figurent aussi dans le rapport Word.">
        <div className="space-y-4">
          <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50 p-4" aria-label="L'essentiel à dire à l'oral">
            <p className="text-sm font-bold text-indigo-950">L&apos;essentiel à dire à l&apos;oral</p>
            <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-slate-800">
              {defense.pitch.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ol>
          </div>
          <div>
            <p className="text-sm font-bold text-slate-900">Les questions probables du jury</p>
            <ul className="mt-2 space-y-2">
              {defense.questions.map((q) => (
                <li key={q.question}>
                  <details className="rounded-xl ring-1 ring-slate-200">
                    <summary className="cursor-pointer rounded-xl px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-50">{q.question}</summary>
                    <p className="px-3 pb-3 text-sm leading-relaxed text-slate-700">{q.answer}</p>
                  </details>
                </li>
              ))}
            </ul>
          </div>
          <details className="rounded-xl bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-900">Les formules utilisées ({FORMULAS.length})</summary>
            <dl className="mt-2 space-y-2">
              {FORMULAS.map((f) => (
                <div key={f.name}>
                  <dt className="font-semibold text-slate-900">{f.name}</dt>
                  <dd className="font-mono text-xs text-slate-700">{f.formula}</dd>
                  <dd className="text-slate-700">{f.meaning}</dd>
                </div>
              ))}
            </dl>
          </details>
          <details className="rounded-xl bg-slate-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-slate-900">Lexique : les mots de l&apos;économétrie, en clair ({GLOSSARY.length})</summary>
            <dl className="mt-2 space-y-2">
              {GLOSSARY.map((g) => (
                <div key={g.term}>
                  <dt className="font-semibold text-slate-900">{g.term}</dt>
                  <dd className="text-slate-700">{g.definition}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      </Section>
      <ExportBar title="Télécharger mon rapport" fileBase={fileBase} sheets={() => econSheets(report)} document={() => econDocument(report)} />
    </div>
  );
}
