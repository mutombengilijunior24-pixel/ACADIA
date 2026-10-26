/**
 * Mise en forme des résultats pour l'export : classeur Excel (tableaux réutilisables) et
 * document de rapport (rendu en HTML imprimable et en Word), graphiques compris.
 * Aucune valeur n'est recalculée ici : on reprend les résultats des moteurs.
 */
import type { VariableDescriptive } from "@/lib/core/analysis/descriptiveStatistics";
import { fmt, type AnalysisReport } from "@/lib/core/analysis/inferential";
import type { Execution } from "@/lib/core/journey/execute";
import { OBJECTIVE_LABELS, VERDICT_LABELS, type Interpretation, type Paragraph } from "@/lib/core/journey/interpret";
import { UNKNOWN_WARNING } from "@/lib/core/journey/provenance";

import { renderHtml, type Block, type ReportDocument } from "./document";
import { specForDescriptive, specForReport } from "./chartSpecs";
import { DEFAULT_PALETTE } from "./palette";
import type { Cell, Sheet } from "./xlsx";

const round = (v: number | null | undefined, d = 4) => (v === null || v === undefined || Number.isNaN(v) ? null : Number.isFinite(v) ? Number(v.toFixed(d)) : v);
const today = () => new Date().toLocaleDateString("fr-FR");
const titleOf = (r: AnalysisReport) => `${r.variables.find((v) => v.role === "explanatory")?.header} → ${r.variables.find((v) => v.role === "outcome")?.header}`;
const ORIGIN_TAG: Record<Paragraph["origin"], string> = { calcul: "Calcul automatique", règles: "Règles ACADIA" };

/* ================================================================= */
/* Classeur Excel                                                      */
/* ================================================================= */

export function descriptiveSheets(results: VariableDescriptive[]): Sheet[] {
  const sheets: Sheet[] = [];
  const freq: Cell[][] = [["Variable", "Type", "Modalité", "Effectif", "% des valides", "% cumulé"]];
  const quant: Cell[][] = [["Variable", "n valides", "Manquantes", "Moyenne", "Médiane", "Écart-type (échantillon)", "Minimum", "Maximum", "Q1", "Q3", "Somme"]];
  for (const r of results) {
    if (r.kind === "quantitative") {
      quant.push([r.header, r.valid, r.missing, round(r.mean), round(r.median), round(r.sdSample), round(r.min), round(r.max), round(r.q1), round(r.q3), round(r.sum)]);
    } else {
      for (const f of r.frequencies) freq.push([r.header, r.kind === "ordinal" ? "ordinale" : "nominale", f.value, f.count, round(f.percent, 2), round(f.cumulativePercent, 2)]);
      freq.push([r.header, "", "Manquantes (hors pourcentages)", r.missing, null, null]);
      freq.push([]);
    }
  }
  if (freq.length > 1) sheets.push({ name: "Fréquences", rows: freq, widths: [44, 12, 34, 10, 14, 12], bold: [0] });
  if (quant.length > 1) sheets.push({ name: "Variables quantitatives", rows: quant, widths: [44, 10, 12, 12, 12, 22, 12, 12, 10, 10, 12], bold: [0] });
  return sheets;
}

export function inferentialSheets(reports: AnalysisReport[]): Sheet[] {
  if (!reports.length) return [];
  const summary: Cell[][] = [["Analyse", "Méthode", "Question", "Observations", "Statistique", "Valeur", "ddl", "p-value", "Taille d'effet", "Valeur de l'effet", "Ampleur", "Seuil α", "Significatif", "Conditions satisfaites", "Conclusion"]];
  const sheets: Sheet[] = [];
  reports.forEach((r, i) => {
    summary.push([titleOf(r), r.methodLabel, r.question, r.data.n, r.statistic.name, round(r.statistic.value), r.statistic.df, round(r.pValue, 6), r.effect?.name ?? "", round(r.effect?.value), r.effect?.magnitude ?? "", r.alpha, r.significant ? "oui" : "non", r.reliable ? "oui" : "non", r.conclusion]);
    const rows: Cell[][] = [];
    const bold: number[] = [];
    const titles: number[] = [];
    const title = (text: string) => {
      titles.push(rows.length);
      rows.push([text]);
    };
    const head = (cells: Cell[]) => {
      bold.push(rows.length);
      rows.push(cells);
    };
    title(`Analyse ${i + 1} : ${titleOf(r)}`);
    rows.push([r.methodLabel], []);
    head(["Résultats", "Valeur"]);
    rows.push(...r.results.map((row) => [row.label, row.value]), []);
    head(["Vérification du calcul", ""]);
    rows.push(...r.verification.map((row) => [row.label, row.value]));
    const d = r.detail;
    if (d.kind === "chi_square") {
      rows.push([]);
      title(`Effectifs observés (lignes : ${d.rowVariable} ; colonnes : ${d.colVariable})`);
      head(["", ...d.colLabels, "Total"]);
      d.rowLabels.forEach((label, ri) => rows.push([label, ...d.result.observed[ri], d.result.rowTotals[ri]]));
      rows.push(["Total", ...d.result.colTotals, d.result.n], []);
      title("Pourcentages en ligne");
      head(["", ...d.colLabels]);
      d.rowLabels.forEach((label, ri) => rows.push([label, ...d.result.observed[ri].map((o) => round((o / d.result.rowTotals[ri]) * 100, 2))]));
      rows.push([]);
      title("Effectifs attendus");
      head(["", ...d.colLabels]);
      d.rowLabels.forEach((label, ri) => rows.push([label, ...d.result.expected[ri].map((e) => round(e, 3))]));
    }
    if (d.kind === "welch_t" || d.kind === "anova") {
      rows.push([]);
      head(["Groupe", "n", "Moyenne", "Écart-type", "Médiane"]);
      for (const g of d.result.groups) rows.push([g.label, g.n, round(g.mean), round(g.sd), round(g.median)]);
    }
    rows.push([]);
    title("Interprétation (règles déterministes ACADIA)");
    rows.push(...r.interpretation.map((line) => [line]), []);
    title("Conclusion");
    rows.push([r.conclusion]);
    sheets.push({ name: `Test ${i + 1}`, rows, widths: [60, 18, 18, 18, 18, 18], bold, titles });
  });
  return [{ name: "Tests statistiques", rows: summary, widths: [40, 30, 40, 12, 10, 10, 8, 10, 18, 14, 12, 8, 12, 14, 80], bold: [0] }, ...sheets];
}

/** Contexte de l'étude transmis par l'orchestrateur : perspective d'interprétation et traçabilité. */
export interface ReportContext {
  perspective?: string | null;
  trace?: Array<[string, string]>;
}

export function journeySheets(input: { question: string; execution: Execution; interpretation: Interpretation; context?: ReportContext }): Sheet[] {
  const { question, execution, interpretation } = input;
  const rows: Cell[][] = [["Rapport ACADIA — parcours guidé"], ["Question de recherche : " + question], [interpretation.provenance.statement], ...(interpretation.provenance.warning ? [["⚠ " + interpretation.provenance.warning]] : []), ...(input.context?.perspective ? [["Perspective d'interprétation : " + input.context.perspective]] : []), []];
  const titles = [0];
  const block = (title: string, lines: Array<{ text: string; origin?: Paragraph["origin"] }>) => {
    titles.push(rows.length);
    rows.push([title]);
    for (const l of lines) rows.push([l.text, l.origin ? ORIGIN_TAG[l.origin] : ""]);
    rows.push([]);
  };
  if (interpretation.framework.problem) block("Cadre de la recherche", [interpretation.framework.problem]);
  if (interpretation.framework.objectives.length) block("Objectifs", interpretation.framework.objectives.map((o) => ({ text: `Objectif ${o.kind} : ${o.text} — ${OBJECTIVE_LABELS[o.status]}. ${o.detail}` })));
  block("A. Ce que montrent les données", interpretation.data);
  block("B. Ce que signifient les résultats", interpretation.meaning);
  block("C. Hypothèses", interpretation.hypotheses.map((h) => ({ text: `${h.text} — ${VERDICT_LABELS[h.verdict]}. ${h.detail}` })));
  block("D. Réponse à la question", interpretation.answer);
  block("E. Limites", interpretation.limits.map((text) => ({ text })));
  block("F. Conclusion", interpretation.conclusion);
  if (input.context?.trace?.length) {
    titles.push(rows.length);
    rows.push(["Traçabilité"], ...input.context.trace.map(([k, v]) => [k, v]), []);
  }
  const descriptive = execution.items.flatMap((e) => (e.kind === "descriptive" ? e.results : []));
  const reports = execution.items.flatMap((e) => (e.kind === "relation" && e.outcome.ok ? [e.outcome.report] : []));
  return [{ name: "Synthèse", rows, widths: [110, 20], titles }, ...descriptiveSheets(descriptive), ...inferentialSheets(reports)];
}

/* ================================================================= */
/* Document de rapport (HTML imprimable, Word)                         */
/* ================================================================= */

export function descriptiveBlocks(r: VariableDescriptive, palette: string[], structural?: { values: string[]; count: number }): Block[] {
  const blocks: Block[] = [{ type: "h3", text: r.header }];
  if (structural) blocks.push({ type: "meta", text: `Question conditionnelle : pourcentages calculés sur ${r.valid} répondant(s) éligible(s) ; ${structural.count} réponse(s) « ${structural.values.join(" / ")} » hors dénominateur.` });
  if (r.kind === "quantitative") {
    blocks.push({ type: "table", head: ["n valides", "Manquantes", "Moyenne", "Médiane", "Écart-type", "Min", "Max"], rows: [[r.valid, r.missing, r.mean ?? NaN, r.median ?? NaN, r.sdSample ?? NaN, r.min ?? NaN, r.max ?? NaN]] });
  } else {
    blocks.push({ type: "table", head: ["Modalité", "Effectif", "% des valides"], rows: [...r.frequencies.map((f) => [f.value, f.count, `${fmt(f.percent, 1)} %`]), ["Total valides", r.valid, "100 %"], ["Manquantes (hors %)", r.missing, ""]] });
  }
  const spec = specForDescriptive(r, palette);
  if (spec) blocks.push({ type: "chart", spec });
  return blocks;
}

const CHECK_STATUS = { ok: "Satisfaite", warning: "À vérifier", failed: "Non satisfaite" } as const;

export function analysisBlocks(r: AnalysisReport, index: number, withChart = true, palette: string[] = DEFAULT_PALETTE, compact = false): Block[] {
  const blocks: Block[] = [
    { type: "h2", text: `${index}. ${titleOf(r)}` },
    { type: "meta", text: `${r.methodLabel} — question : ${r.question} — ${r.data.n} observation(s) utilisée(s) ; seuil α = ${fmt(r.alpha)}.` },
  ];
  if (!r.reliable) blocks.push({ type: "warn", text: "Conditions d'application non satisfaites : résultat non fiable." });
  blocks.push({ type: "p", text: r.hypotheses.h0, bold: true }, { type: "p", text: r.hypotheses.h1 });
  blocks.push({ type: "table", head: ["Indicateur", "Valeur"], rows: r.results.map((x) => [x.label, x.value]) });
  const d = r.detail;
  if (d.kind === "chi_square") {
    blocks.push({ type: "meta", text: `Effectifs observés (lignes : ${d.rowVariable} ; colonnes : ${d.colVariable})` });
    blocks.push({ type: "table", head: ["", ...d.colLabels, "Total"], rows: [...d.rowLabels.map((l, i) => [l, ...d.result.observed[i], d.result.rowTotals[i]]), ["Total", ...d.result.colTotals, d.result.n]] });
    blocks.push({ type: "meta", text: "Pourcentages en ligne" });
    blocks.push({ type: "table", head: ["", ...d.colLabels], rows: d.rowLabels.map((l, i) => [l, ...d.result.observed[i].map((o) => `${fmt((o / d.result.rowTotals[i]) * 100, 1)} %`)]) });
  }
  if (d.kind === "welch_t" || d.kind === "anova") blocks.push({ type: "table", head: ["Groupe", "n", "Moyenne", "Écart-type"], rows: d.result.groups.map((g) => [g.label, g.n, g.mean, g.sd]) });
  const spec = withChart ? specForReport(r, palette) : null;
  if (spec) blocks.push({ type: "chart", spec });
  blocks.push({ type: "table", head: ["Condition d'application", "Statut", "Détail"], rows: r.checks.map((c) => [c.label, CHECK_STATUS[c.status], c.detail]) });
  if (compact) return blocks;
  blocks.push(...r.interpretation.map((line): Block => ({ type: "p", text: line })));
  blocks.push({ type: "p", text: `Conclusion. ${r.conclusion}`, bold: true });
  return blocks;
}

export function analysesDocument(title: string, reports: AnalysisReport[], note: string | null, palette: string[] = DEFAULT_PALETTE): ReportDocument {
  return {
    title,
    blocks: [
      { type: "title", text: title },
      { type: "meta", text: `Généré par ACADIA le ${today()}. Calculs déterministes, interprétation par règles (sans IA).` },
      { type: "warn", text: UNKNOWN_WARNING },
      ...(note ? [{ type: "warn" as const, text: note }] : []),
      ...reports.flatMap((r, i) => analysisBlocks(r, i + 1, true, palette)),
    ],
  };
}

export function descriptivesDocument(title: string, results: VariableDescriptive[], palette: string[] = DEFAULT_PALETTE): ReportDocument {
  return {
    title,
    blocks: [
      { type: "title", text: title },
      { type: "meta", text: `Généré par ACADIA le ${today()}. Pourcentages calculés sur les réponses valides ; non-réponses exclues.` },
      { type: "warn", text: UNKNOWN_WARNING },
      ...results.flatMap((r) => descriptiveBlocks(r, palette)),
    ],
  };
}

export function journeyDocument(input: { question: string; execution: Execution; interpretation: Interpretation; title?: string; palette?: string[]; context?: ReportContext }): ReportDocument {
  const { question, execution, interpretation } = input;
  const palette = input.palette ?? DEFAULT_PALETTE;
  const paras = (items: Paragraph[]): Block[] => items.map((p) => ({ type: "p", text: p.text, tag: ORIGIN_TAG[p.origin] }));
  const descriptive = execution.items.flatMap((e) => (e.kind === "descriptive" ? e.results.map((r) => ({ r, structural: e.structural.find((x) => x.column === r.column) })) : []));
  const reports = execution.items.flatMap((e) => (e.kind === "relation" && e.outcome.ok ? [e.outcome.report] : []));
  const blocks: Block[] = [
    { type: "title", text: input.title ?? "Rapport d'analyse" },
    { type: "meta", text: `Question de recherche : ${question}` },
    { type: "meta", text: interpretation.provenance.statement },
    ...(interpretation.provenance.warning ? [{ type: "warn" as const, text: interpretation.provenance.warning }] : []),
    { type: "meta", text: `Généré par ACADIA le ${today()}. Calculs déterministes ; interprétation par règles, sans assistance IA.` },
    ...(input.context?.perspective ? [{ type: "meta" as const, text: `Perspective d'interprétation : ${input.context.perspective}` }] : []),
  ];
  if (interpretation.framework.problem || interpretation.framework.objectives.length) {
    blocks.push({ type: "h1", text: "Cadre de la recherche" });
    if (interpretation.framework.problem) blocks.push(...paras([interpretation.framework.problem]));
    if (interpretation.framework.objectives.length) blocks.push({ type: "table", head: ["Objectif", "Statut", "Analyses"], rows: interpretation.framework.objectives.map((o) => [`${o.kind === "général" ? "Général" : "Spécifique"} : ${o.text}`, OBJECTIVE_LABELS[o.status], o.detail]) });
  }
  blocks.push({ type: "h1", text: "A. Ce que montrent les données" }, ...paras(interpretation.data));
  // Graphiques des relations testées, au cœur du rapport.
  for (const r of reports) {
    const spec = specForReport(r, palette);
    if (spec) blocks.push({ type: "chart", spec });
  }
  blocks.push({ type: "h1", text: "B. Ce que signifient les résultats" }, ...paras(interpretation.meaning));
  blocks.push({ type: "h1", text: "C. Rapport avec les hypothèses" });
  blocks.push(interpretation.hypotheses.length ? { type: "table", head: ["Hypothèse", "Statut", "Détail"], rows: interpretation.hypotheses.map((h) => [h.text, VERDICT_LABELS[h.verdict], h.detail]) } : { type: "p", text: "Aucune hypothèse formulée." });
  blocks.push({ type: "h1", text: "D. Réponse à la question de recherche" }, ...paras(interpretation.answer));
  blocks.push({ type: "h1", text: "E. Limites" }, { type: "bullets", items: interpretation.limits });
  blocks.push({ type: "h1", text: "F. Conclusion" }, ...paras(interpretation.conclusion));
  blocks.push({ type: "h1", text: "Annexe 1 — Statistiques descriptives" }, ...(descriptive.length ? descriptive.flatMap(({ r, structural }) => descriptiveBlocks(r, palette, structural)) : [{ type: "p" as const, text: "Aucune." }]));
  if (input.context?.trace?.length) blocks.push({ type: "h1", text: "Traçabilité des résultats" }, { type: "table", head: ["Élément", "Valeur"], rows: input.context.trace });
  blocks.push({ type: "h1", text: "Annexe 2 — Tests statistiques" });
  if (execution.multipleTesting) blocks.push({ type: "warn", text: execution.multipleTesting });
  blocks.push(...(reports.length ? reports.flatMap((r, i) => analysisBlocks(r, i + 1, false, palette, true)) : [{ type: "p" as const, text: "Aucun." }]));
  return { title: "Rapport d'analyse — ACADIA", blocks };
}

/* Rendus HTML (impression / PDF). */
export const journeyHtml = (input: Parameters<typeof journeyDocument>[0]) => renderHtml(journeyDocument(input));
export const analysesHtml = (title: string, reports: AnalysisReport[], note: string | null, palette?: string[]) => renderHtml(analysesDocument(title, reports, note, palette));
export const descriptivesHtml = (title: string, results: VariableDescriptive[], palette?: string[]) => renderHtml(descriptivesDocument(title, results, palette));
