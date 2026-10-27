/**
 * Rapport du moteur « Économétrie et macroéconomie » : document Word organisé selon le plan du chapitre
 * (données de départ, statistiques, agrégats, stationnarité, estimation, validation, hypothèses,
 * soutenance) et classeur Excel. Mêmes chiffres partout ; courbes natives modifiables.
 */
import type { ChartSpec } from "@/lib/core/export/chartSpecs";
import type { Block, ReportDocument } from "@/lib/core/export/document";
import type { Cell, Sheet } from "@/lib/core/export/xlsx";

import { computeAggregates } from "./aggregates";
import type { EconometricAnalysis } from "./analysis";
import { keyVariables, type ChapterSection } from "./chapter";
import { DEMO_NOTICE } from "./demo";
import type { HypothesisResult, ModelGroup } from "./evaluate";
import { buildDefenseKit, FORMULAS, GLOSSARY } from "./pedagogy";
import { describe } from "./series";
import { FREQUENCY_LABELS, type MacroDataset } from "./types";

export interface EconReportInput {
  dataset: MacroDataset;
  models: ModelGroup[];
  analyses: Record<string, EconometricAnalysis>;
  results: HypothesisResult[];
  chapter: ChapterSection[];
  title: string;
  mainQuestion: string;
}

const PALETTE = ["#4f46e5", "#db2777", "#0891b2", "#ea580c", "#16a34a", "#7c3aed"];
const n2 = (v: number | null, d = 2) => (v === null ? "—" : v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pv = (p: number | null) => (p === null ? "—" : p < 0.001 ? "< 0,001" : p.toLocaleString("fr-FR", { maximumFractionDigits: 3 }));
const cell = (v: number | null) => (v === null ? null : Math.round(v * 1000) / 1000);

/** Courbes d'évolution des variables du modèle (une courbe par variable, pour garder des échelles lisibles). */
export function evolutionCharts(input: EconReportInput): ChartSpec[] {
  return keyVariables(input.dataset, input.models)
    .slice(0, 4)
    .map((v, i) => ({ kind: "line" as const, title: `Évolution — ${v.label}${input.dataset.fictitious ? " (données fictives)" : ""}`, categories: input.dataset.periods, categoryName: "Période", series: [{ name: v.label, values: v.values.map(cell), color: PALETTE[i % PALETTE.length] }], valueName: v.unit || "valeur" }));
}

function dataTable(input: EconReportInput): { head: string[]; rows: Array<Array<string | number>> } {
  const vars = keyVariables(input.dataset, input.models).slice(0, 7);
  return { head: ["Période", ...vars.map((v) => `${v.label} (${v.unit})`)], rows: input.dataset.periods.map((p, i) => [p, ...vars.map((v) => n2(v.values[i] ?? null))]) };
}

function statsTable(input: EconReportInput) {
  return {
    head: ["Variable", "Moyenne", "Écart-type", "Minimum", "Maximum", "CV (%)", "TCAM (%)"],
    rows: keyVariables(input.dataset, input.models).map((v) => {
      const s = describe(v.values);
      return [v.label, n2(s.mean), n2(s.sd), n2(s.min), n2(s.max), n2(s.cv, 1), v.ref.kind === "series" ? n2(s.tcam) : "—"];
    }),
  };
}

function adfTable(input: EconReportInput) {
  const rows = input.models.flatMap((m) =>
    (input.analyses[m.key]?.orders ?? []).map((o) => [
      o.name,
      n2(o.order.level.c.stat),
      n2(o.order.level.c.critical?.p5 ?? null),
      n2(o.order.level.ct.stat),
      n2(o.order.level.ct.critical?.p5 ?? null),
      n2(o.order.difference?.stat ?? null),
      o.order.order === null ? "indéterminé" : `I(${o.order.order})`,
    ]),
  );
  return { head: ["Variable", "ADF (constante)", "VC 5 %", "ADF (constante + tendance)", "VC 5 %", "ADF en différence", "Ordre d'intégration"], rows };
}

function coefTable(a: EconometricAnalysis) {
  const est = a.estimation!;
  return { head: ["Variable", "Coefficient", "Écart-type", "t de Student", "p-value", "Signif."], rows: [...est.rows.map((r) => [r.name, n2(r.beta, 4), n2(r.se, 4), n2(r.t, 3), pv(r.p), r.stars || "ns"]), ["R² / R² ajusté", n2(est.r2, 3), n2(est.adjR2, 3), "", "", ""], ["F de Fisher (p)", n2(est.f, 3), "", "", pv(est.fP), ""], ["Observations", String(est.n), "", "", "", ""]] };
}

function diagTable(a: EconometricAnalysis) {
  const est = a.estimation!;
  const rows: Array<Array<string | number>> = [
    ["Durbin-Watson", n2(est.dw, 3), "—", "Proche de 2 : pas d'autocorrélation d'ordre 1"],
    ["Breusch-Godfrey (ordre 1)", n2(est.bg.statistic, 3), pv(est.bg.pValue), est.bg.pValue !== null && est.bg.pValue < 0.05 ? "Autocorrélation détectée" : "Absence d'autocorrélation non rejetée"],
    ["Breusch-Pagan", n2(est.bp.statistic, 3), pv(est.bp.pValue), est.bp.pValue !== null && est.bp.pValue < 0.05 ? "Hétéroscédasticité détectée" : "Homoscédasticité non rejetée"],
    ["Jarque-Bera", n2(est.jb.statistic, 3), pv(est.jb.pValue), est.jb.pValue === null ? "Non réalisable" : est.jb.pValue < 0.05 ? "Normalité rejetée" : "Normalité non rejetée"],
    ...est.vif.map((v) => [`VIF — ${v.name}`, n2(v.value, 2), "—", (v.value ?? 0) > 10 ? "Multicolinéarité forte" : "Acceptable"]),
  ];
  if (a.cointegration) rows.push(["Cointégration (Engle-Granger)", n2(a.cointegration.stat, 3), `VC 5 % : ${n2(a.cointegration.critical?.p5 ?? null)}`, a.cointegration.available ? (a.cointegration.cointegrated ? "Cointégrées" : "Non cointégrées") : (a.cointegration.reason ?? "")]);
  if (a.ecm) rows.push(["Force de rappel (MCE)", n2(a.ecm.lambda, 3), pv(a.ecm.lambdaP), a.ecm.valid ? "Correction d'erreur significative" : "Non significative"]);
  for (const c of a.causality) rows.push([`Granger : ${c.cause} → ${c.effect}`, n2(c.result.f, 3), pv(c.result.pValue), c.result.reason ?? (c.result.pValue !== null && c.result.pValue < 0.05 ? "Précédence temporelle significative" : "Non significative")]);
  return { head: ["Test", "Statistique", "p-value", "Lecture"], rows };
}

export function econDocument(input: EconReportInput): ReportDocument {
  const { dataset } = input;
  const blocks: Block[] = [
    { type: "title", text: input.title || "Chapitre des résultats" },
    { type: "meta", text: `${dataset.economy || "Économie étudiée"} — ${dataset.periods[0] ?? "?"}-${dataset.periods[dataset.periods.length - 1] ?? "?"} — ${dataset.periods.length} observations ${FREQUENCY_LABELS[dataset.frequency].toLowerCase()}s — source : ${dataset.source || "à préciser"}` },
  ];
  if (dataset.fictitious) blocks.push({ type: "warn", text: DEMO_NOTICE });
  if (input.mainQuestion) blocks.push({ type: "p", text: `Question principale : ${input.mainQuestion}` });
  blocks.push({ type: "warn", text: "Calculs réalisés par ACADIA de façon déterministe (MCO, tests ADF, Engle-Granger, Breusch-Godfrey, Breusch-Pagan, Jarque-Bera). Les interprétations sont des propositions à relire et à valider avec votre encadreur ; une association statistique ne prouve pas une causalité." });
  const charts = evolutionCharts(input);
  for (const section of input.chapter) {
    blocks.push({ type: "h1", text: section.title });
    blocks.push({ type: "meta", text: `Ce que cette section démontre : ${section.purpose}` });
    if (section.id === "donnees") {
      blocks.push({ type: "h2", text: "Données de départ" }, { type: "table", ...dataTable(input) });
      blocks.push({ type: "h2", text: "Statistiques descriptives" }, { type: "table", ...statsTable(input) });
      for (const chart of charts) blocks.push({ type: "chart", spec: chart });
      if (charts.length) blocks.push({ type: "meta", text: "Graphiques modifiables : dans Word, « Activer la modification », puis clic droit sur un graphique → « Modifier les données »." });
    }
    if (section.id === "stationnarite" && adfTable(input).rows.length) blocks.push({ type: "table", ...adfTable(input) });
    if (section.id === "estimation") for (const m of input.models) if (input.analyses[m.key]?.estimation) blocks.push({ type: "h2", text: m.label }, { type: "table", ...coefTable(input.analyses[m.key]) });
    if (section.id === "validation") for (const m of input.models) if (input.analyses[m.key]?.estimation) blocks.push({ type: "h2", text: m.label }, { type: "table", ...diagTable(input.analyses[m.key]) });
    if (section.id === "interpretation" && input.results.length) blocks.push({ type: "table", head: ["Hypothèse", "Relation testée", "Signe attendu", "Coefficient (p)", "Verdict"], rows: input.results.map((r, i) => [`H${i + 1}`, `${r.independentName ?? "?"} → ${r.dependentName ?? "?"}`, r.expectedSign === 1 ? "+" : r.expectedSign === -1 ? "−" : "?", r.coefficient ? `${n2(r.coefficient.beta, 3)} (${pv(r.coefficient.p)})` : "—", r.verdictLabel]) });
    for (const p of section.paragraphs) blocks.push({ type: "p", text: p });
    blocks.push({ type: "bullets", items: section.contents.map((c) => `À présenter : ${c}`) });
  }
  const kit = buildDefenseKit(input.models, input.analyses, input.results, dataset.periods);
  blocks.push({ type: "h1", text: "L'essentiel à dire à l'oral" }, { type: "bullets", items: kit.pitch });
  blocks.push({ type: "h1", text: "Préparer la soutenance" });
  for (const q of kit.questions) blocks.push({ type: "p", text: q.question, bold: true }, { type: "p", text: q.answer });
  blocks.push({ type: "h2", text: "Formules à connaître" }, { type: "table", head: ["Notion", "Formule", "Ce qu'elle signifie"], rows: FORMULAS.map((f) => [f.name, f.formula, f.meaning]) });
  blocks.push({ type: "h1", text: "Lexique" }, { type: "table", head: ["Terme", "Définition"], rows: GLOSSARY.map((g) => [g.term, g.definition]) });
  return { title: input.title || "Chapitre des résultats", blocks };
}

export function econSheets(input: EconReportInput): Sheet[] {
  const { dataset } = input;
  const title = `${input.title || "Analyse économétrique"}${dataset.fictitious ? " — DONNÉES FICTIVES" : ""}`;
  const data: Cell[][] = [[title], ["Période", ...dataset.series.map((s) => `${s.name} (${s.unit})`)], ...dataset.periods.map((p, i) => [p, ...dataset.series.map((s) => cell(s.values[i] ?? null))])];
  const aggs = computeAggregates(dataset);
  const aggregates: Cell[][] = [[title], ["Période", ...aggs.map((a) => `${a.def.label} (${a.def.unit})`)], ...dataset.periods.map((p, i) => [p, ...aggs.map((a) => cell(a.values[i] ?? null))]), [], ["Agrégat", "Formule", "Lecture"], ...aggs.map((a) => [a.def.label, a.def.formula, a.def.reading])];
  const st = statsTable(input);
  const adf = adfTable(input);
  const sheets: Sheet[] = [
    { name: "Données", rows: data, titles: [0], bold: [1], widths: [10, ...dataset.series.map(() => 18)] },
    { name: "Statistiques", rows: [[title], st.head, ...st.rows], titles: [0], bold: [1], widths: [36, 12, 12, 12, 12, 10, 10] },
    { name: "Agrégats", rows: aggregates, titles: [0], bold: [1, dataset.periods.length + 3], widths: [30, ...aggs.map(() => 18)] },
    { name: "Stationnarité", rows: [[title], adf.head, ...adf.rows], titles: [0], bold: [1], widths: [40, 14, 10, 18, 10, 14, 16] },
  ];
  for (const m of input.models) {
    const a = input.analyses[m.key];
    if (!a?.estimation) continue;
    const ct = coefTable(a);
    const dt = diagTable(a);
    sheets.push({ name: `Estimation ${m.label.slice(0, 9)}`, rows: [[`${m.label} — ${a.estimation.equation}`], ct.head, ...ct.rows, [], ["Diagnostics"], dt.head, ...dt.rows], titles: [0], bold: [1, ct.rows.length + 4], widths: [44, 14, 14, 14, 12, 40] });
  }
  sheets.push({ name: "Hypothèses", rows: [[title], ["Hypothèse", "Relation", "Signe attendu", "Coefficient", "p-value", "Verdict", "Lecture", "Limites"], ...input.results.map((r) => [r.hypothesis, `${r.independentName ?? "?"} → ${r.dependentName ?? "?"}`, r.expectedSign === 1 ? "+" : r.expectedSign === -1 ? "−" : "?", r.coefficient ? cell(r.coefficient.beta) : null, r.coefficient ? pv(r.coefficient.p) : null, r.verdictLabel, r.reading, r.limits.join(" ")])], titles: [0], bold: [1], widths: [50, 40, 10, 12, 10, 34, 60, 60] });
  const kit = buildDefenseKit(input.models, input.analyses, input.results, dataset.periods);
  sheets.push({ name: "Soutenance", rows: [[title], ["L'essentiel à dire"], ...kit.pitch.map((p) => [p]), [], ["Question du jury", "Éléments de réponse"], ...kit.questions.map((q) => [q.question, q.answer]), [], ["Formule", "Expression", "Sens"], ...FORMULAS.map((f) => [f.name, f.formula, f.meaning])], titles: [0], bold: [1, kit.pitch.length + 3, kit.pitch.length + kit.questions.length + 5], widths: [50, 70, 60] });
  sheets.push({ name: "Lexique", rows: [["Lexique de l'économétrie"], ["Terme", "Définition"], ...GLOSSARY.map((g) => [g.term, g.definition])], titles: [0], bold: [1], widths: [32, 100] });
  return sheets;
}
