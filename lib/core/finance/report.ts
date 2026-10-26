/**
 * Rapport du moteur « Gestion financière » : document (Word, impression) organisé selon le plan du
 * chapitre de résultats, et classeur Excel (états validés, contrôles, indicateurs, hypothèses, graphiques).
 * Mêmes chiffres partout ; courbes natives modifiables dans Word et Excel.
 */
import type { ChartSpec } from "@/lib/core/export/chartSpecs";
import type { Block, ReportDocument } from "@/lib/core/export/document";
import type { Cell, Sheet } from "@/lib/core/export/xlsx";

import type { CheckResult } from "./checks";
import type { FinanceComputation } from "./compute";
import { DEMO_NOTICE } from "./demo";
import { DIAGNOSIS_METHOD, LEVEL_LABELS, type Diagnosis } from "./diagnosis";
import { explainIndicator } from "./explain";
import { buildDefenseKit, GLOSSARY } from "./pedagogy";
import { recommendationsFor } from "./research/chapter";
import { companyLabel } from "./research/proposals";
import { bandsText, currencySuffix, formatValue } from "./format";
import { INDICATOR_BY_ID } from "./indicators/catalogue";
import { FAMILY_LABELS } from "./indicators/types";
import type { Reflex } from "./reflexes";
import { CRITERION_STATUS_LABELS, type HypothesisResult } from "./research/evaluate";
import type { ChapterPlan } from "./research/chapter";
import type { FinanceReasoning } from "./research/interpret";
import { POSTES, SECTION_LABELS, type SectionId } from "./syscohada/chart";
import { FINANCE_PROVENANCE_LABELS, SECTOR_LABELS, type FinanceDossier, type FinanceProvenanceKind } from "./types";

export interface FinanceReportInput {
  dossier: FinanceDossier;
  computation: FinanceComputation;
  diagnosis: Diagnosis | null;
  reflexes: Reflex[];
  results: HypothesisResult[];
  reasoning: FinanceReasoning | null;
  chapter: ChapterPlan | null;
  checks: CheckResult[];
  provenance: { kind: FinanceProvenanceKind; description: string } | null;
  acceptedGaps: Record<string, string>;
  title: string;
  mainQuestion: string;
  isDemo: boolean;
}

const MAIN_SERIES = [
  { title: "Activité et résultats", ids: ["chiffre_affaires", "ebe", "resultat_net"] },
  { title: "Équilibre financier", ids: ["fr", "bfe", "tn"] },
];

function lineSpec(input: FinanceReportInput, title: string, ids: string[], palette: string[]): ChartSpec | null {
  const { computation, dossier } = input;
  if (computation.exercises.length < 2) return null;
  const series = ids
    .filter((id) => computation.series[id])
    .map((id, j) => ({ name: computation.series[id].def.label, values: computation.series[id].values.map((v) => v.value), color: palette[j % palette.length] }))
    .filter((s) => s.values.some((v) => v !== null));
  if (!series.length) return null;
  const units = new Set(ids.map((id) => INDICATOR_BY_ID[id]?.unit));
  const unit = [...units][0];
  // Pourcentages exprimés en points de 100 pour le lecteur.
  const scaled = unit === "pct" || unit === "points" ? series.map((s) => ({ ...s, values: s.values.map((v) => (v === null ? null : Math.round(v * 1000) / 10)) })) : series;
  return { kind: "line", title, categories: computation.exercises.map((e) => e.label), categoryName: "Exercice", series: scaled, valueName: unit === "montant" ? currencySuffix(dossier.company) : unit === "pct" ? "%" : unit === "jours" ? "jours" : "valeur" };
}

const indicatorRows = (input: FinanceReportInput, ids: string[]) =>
  ids
    .filter((id) => input.computation.series[id])
    .map((id) => {
      const s = input.computation.series[id];
      return [s.def.label, ...s.values.map((v) => (v.value === null ? `non calculable (${v.reason ?? "—"})` : formatValue(v.value, s.def.unit))), bandsText(s.def, s.bands) || "—"];
    });

/** Kit de soutenance (résumé oral, questions du jury, lexique) tiré des mêmes résultats. */
export function defenseOf(input: FinanceReportInput) {
  return buildDefenseKit({
    dossier: input.dossier,
    computation: input.computation,
    diagnosis: input.diagnosis,
    links: input.results.map((r) => r.link),
    results: input.results,
    reasoning: input.reasoning,
    checks: input.checks,
    provenance: input.provenance?.kind ?? null,
    acceptedGaps: Object.keys(input.acceptedGaps).length,
    company: companyLabel(input.dossier.company.name),
    mainQuestion: input.mainQuestion,
    recommendations: recommendationsFor(input.reflexes),
  });
}

/** « Comment ce chiffre a été obtenu, et ce qu'il signifie » : formule, calcul chiffré par exercice, lecture. */
function explanationBlocks(input: FinanceReportInput, ids: string[], explained: Set<string>): Block[] {
  const blocks: Block[] = [];
  for (const id of ids) {
    if (explained.has(id)) continue;
    const e = explainIndicator(id, input.computation, input.dossier);
    if (!e || e.lines.every((l) => l.unavailable)) continue;
    explained.add(id);
    blocks.push({ type: "p", text: e.label, bold: true });
    blocks.push({ type: "p", text: `Formule : ${e.formula}` });
    if (e.legend) blocks.push({ type: "meta", text: `Postes utilisés (codes SYSCOHADA) : ${e.legend}.` });
    blocks.push({ type: "bullets", items: e.lines.map((l) => `${l.exercise} : ${l.unavailable ? `non calculable — ${l.unavailable}` : l.steps.join(" ; ")}`) });
    blocks.push({ type: "p", text: "Ce que cela signifie :" }, { type: "bullets", items: e.meaning });
  }
  if (blocks.length) blocks.unshift({ type: "h3", text: "Comment ces chiffres ont été obtenus, et ce qu'ils signifient" });
  return blocks;
}

export function financeDocument(input: FinanceReportInput, palette: string[]): ReportDocument {
  const { dossier, computation, diagnosis, reasoning, chapter, results } = input;
  const explained = new Set<string>();
  const defense = defenseOf(input);
  const labels = computation.exercises.map((e) => e.label);
  const period = labels.length > 1 ? `${labels[0]}–${labels.at(-1)}` : (labels[0] ?? "");
  const head = ["Indicateur", ...labels, "Repère usuel"];
  const blocks: Block[] = [{ type: "title", text: input.title || `Analyse financière — ${dossier.company.name}` }];
  if (input.isDemo) blocks.push({ type: "warn", text: DEMO_NOTICE });
  blocks.push({ type: "meta", text: `${dossier.company.name} · ${SECTOR_LABELS[dossier.company.sector]} · exercices ${period} · SYSCOHADA révisé · montants en ${currencySuffix(dossier.company)}` });
  blocks.push({ type: "meta", text: `Provenance déclarée : ${input.provenance ? FINANCE_PROVENANCE_LABELS[input.provenance.kind] : "non déclarée"}${input.provenance?.description ? ` — ${input.provenance.description}` : ""}. Calculs déterministes réalisés par ACADIA (sans IA) à partir des chiffres validés par l'étudiant.` });
  if (input.mainQuestion) blocks.push({ type: "p", text: `Question de recherche : ${input.mainQuestion}`, bold: true });
  blocks.push({ type: "h1", text: "L'essentiel à dire à l'oral" });
  blocks.push({ type: "meta", text: "Un résumé de votre travail, avec vos chiffres, à présenter devant le jury (à dire avec vos propres mots)." });
  blocks.push({ type: "bullets", items: defense.pitch });

  const charts = MAIN_SERIES.map((m) => lineSpec(input, m.title, m.ids, palette)).filter((c): c is ChartSpec => !!c);

  blocks.push({ type: "h1", text: chapter?.title ?? "Présentation, analyse et interprétation des résultats" });
  for (const section of chapter?.sections ?? []) {
    blocks.push({ type: "h2", text: section.title });
    blocks.push({ type: "meta", text: section.purpose });
    if (section.id === "presentation") {
      for (const sectionId of ["actif", "passif", "cr"] as SectionId[]) {
        const rows = POSTES.filter((p) => p.section === sectionId && p.kind === "total").map((p) => [`${p.label} (${p.code})`, ...computation.values.map((v) => (v[p.code].value === null ? "—" : formatValue(v[p.code].value, "montant")))]);
        blocks.push({ type: "h3", text: `${SECTION_LABELS[sectionId]} (totaux, ${currencySuffix(dossier.company)})` }, { type: "table", head: ["Poste", ...labels], rows });
      }
    } else if (section.id === "diagnostic" && diagnosis) {
      blocks.push({ type: "p", text: `Verdict d'ACADIA : ${diagnosis.headline}.`, bold: true });
      blocks.push({ type: "table", head: ["Dimension", ...labels], rows: diagnosis.latest.dimensions.map((d) => [d.label, ...diagnosis.byExercise.map((e) => LEVEL_LABELS[e.dimensions.find((x) => x.id === d.id)!.level])]) });
      blocks.push({ type: "bullets", items: diagnosis.reasons });
      blocks.push({ type: "table", head, rows: indicatorRows(input, section.indicators.filter((id) => INDICATOR_BY_ID[id]?.unit !== "montant")) });
      for (const chart of charts) blocks.push({ type: "chart", spec: chart });
      if (charts.length) blocks.push({ type: "meta", text: "Graphiques modifiables : si Word ouvre le document en « Mode protégé », cliquez sur « Activer la modification », puis clic droit sur un graphique → « Modifier les données »." });
      blocks.push(...explanationBlocks(input, section.indicators, explained));
    } else if (section.id.startsWith("concept:")) {
      blocks.push({ type: "table", head, rows: indicatorRows(input, section.indicators) });
      const first = section.indicators.find((id) => input.computation.series[id]);
      const chart = first ? lineSpec(input, `Évolution — ${INDICATOR_BY_ID[first].label}`, [first], palette.slice(2)) : null;
      if (chart) blocks.push({ type: "chart", spec: chart });
      blocks.push(...explanationBlocks(input, section.indicators, explained));
    } else if (section.id.startsWith("link:")) {
      const result = results.find((r) => `link:${r.link.rowId}` === section.id);
      const reading = reasoning?.readings.find((r) => `link:${r.rowId}` === section.id);
      if (result) blocks.push({ type: "table", head: ["Critère", "Statut", "Constat"], rows: result.results.map((r) => [r.criterion.label, CRITERION_STATUS_LABELS[r.status], r.observed]) });
      if (reading?.mechanism) blocks.push({ type: "p", text: `Mécanisme comptable : ${reading.mechanism}` });
      const mechanism = result?.results.find((r) => r.criterion.kind === "mechanism")?.criterion.mechanism;
      if (mechanism === "bfr_tresorerie") {
        const fr = computation.series.fr.values;
        const bf = computation.series.bf.values;
        const tn = computation.series.tn.values;
        blocks.push(
          { type: "p", text: "Vérification de l'identité « trésorerie nette = fonds de roulement − besoin de financement » :" },
          { type: "bullets", items: labels.map((l, i) => (fr[i].value === null || bf[i].value === null ? `${l} : non calculable` : `${l} : ${formatValue(fr[i].value, "montant")} − ${formatValue(bf[i].value, "montant")} = ${formatValue(fr[i].value! - bf[i].value!, "montant")} (trésorerie nette du bilan : ${formatValue(tn[i].value, "montant")})`)) },
        );
      }
      const criteriaIds = [...new Set(result?.results.flatMap((r) => r.criterion.indicators) ?? [])].filter((id) => id !== "tn" || mechanism !== "bfr_tresorerie");
      blocks.push(...explanationBlocks(input, [...criteriaIds, ...(mechanism === "levier" ? ["effet_levier"] : [])], explained));
      if (reading) blocks.push({ type: "p", text: `Conclusion : ${reading.conclusion}`, bold: true });
    } else if (section.id === "discussion" && reasoning) {
      if (reasoning.mainAnswer) blocks.push({ type: "p", text: reasoning.mainAnswer });
      blocks.push({ type: "bullets", items: reasoning.angles.map((a) => `${a.title} — ${a.text}`) });
      blocks.push({ type: "meta", text: "Pistes à vérifier dans votre revue de littérature : citez les auteurs d'après leurs publications originales." });
    } else if (section.id === "limites" && reasoning) {
      blocks.push({ type: "bullets", items: reasoning.limits });
    }
    const drafts = section.draft.filter((d) => !(section.id === "limites" && reasoning?.limits.includes(d)));
    if (drafts.length) blocks.push({ type: "h3", text: "Proposition de rédaction (à reformuler)" }, { type: "bullets", items: drafts });
  }

  blocks.push({ type: "h1", text: "Les réflexes du financier" });
  blocks.push({ type: "bullets", items: input.reflexes.map((r) => `${r.title} : ${r.text} (Où chercher : ${r.where})`) });

  blocks.push({ type: "h1", text: "Préparer la soutenance" });
  blocks.push({ type: "meta", text: "Questions que le jury peut poser, et réponses appuyées sur vos chiffres. Lisez-les, puis reformulez-les avec vos mots." });
  for (const q of defense.questions) blocks.push({ type: "p", text: q.question, bold: true }, { type: "p", text: q.answer });
  blocks.push({ type: "h2", text: "Lexique : les mots de l'analyse financière, en clair" }, { type: "table", head: ["Terme", "En clair"], rows: GLOSSARY.map((g) => [g.term, g.plain]) });

  blocks.push({ type: "h1", text: "Annexes" });
  blocks.push({ type: "h2", text: "Méthode du verdict" }, { type: "bullets", items: DIAGNOSIS_METHOD });
  const used = [...new Set((chapter?.sections ?? []).flatMap((s) => s.indicators))].filter((id) => INDICATOR_BY_ID[id]);
  blocks.push({ type: "h2", text: "Formules des indicateurs présentés" }, { type: "table", head: ["Indicateur", "Formule", "Repère usuel"], rows: used.map((id) => [INDICATOR_BY_ID[id].label, INDICATOR_BY_ID[id].formulaLabel, bandsText(INDICATOR_BY_ID[id], computation.series[id]?.bands ?? null) || "—"]) });
  const gaps = input.checks.filter((c) => c.status === "gap");
  blocks.push({ type: "h2", text: "Contrôles comptables" }, { type: "p", text: gaps.length ? `${gaps.length} point(s) signalé(s) ; écarts acceptés : ${Object.keys(input.acceptedGaps).length}.` : `Tous les contrôles sont conformes (${input.checks.length}).` });
  if (Object.keys(input.acceptedGaps).length) blocks.push({ type: "bullets", items: Object.entries(input.acceptedGaps).map(([k, v]) => `${input.checks.find((c) => c.key === k)?.label ?? k} : ${v}`) });
  blocks.push({ type: "warn", text: "Lecture d'ACADIA à partir des états fournis : ni un audit, ni un avis d'expert-comptable. Les repères sont des conventions usuelles, à discuter avec votre encadreur." });
  return { title: input.title || `Analyse financière — ${dossier.company.name}`, blocks };
}

/** Feuilles du classeur (la feuille « Graphiques » est ajoutée par l'export à partir du document). */
export function financeSheets(input: FinanceReportInput): Sheet[] {
  const { dossier, computation, diagnosis, reasoning, results } = input;
  const labels = computation.exercises.map((e) => e.label);
  const synthesis: Cell[][] = [[input.title || `Analyse financière — ${dossier.company.name}`]];
  const titles = [0];
  if (input.isDemo) synthesis.push([DEMO_NOTICE]);
  synthesis.push([`${dossier.company.name} · ${SECTOR_LABELS[dossier.company.sector]} · ${currencySuffix(dossier.company)} · SYSCOHADA révisé`], []);
  const block = (title: string, lines: string[]) => {
    titles.push(synthesis.length);
    synthesis.push([title], ...lines.map((l) => [l]), []);
  };
  if (diagnosis) block("L'état de l'entreprise", [diagnosis.headline, ...diagnosis.reasons]);
  if (reasoning) {
    reasoning.readings.forEach((r) => block(`${r.title} : ${r.statement}`, [r.verdictLabel, ...r.approaches.map((a) => `Rapproche : ${a}`), ...r.distances.map((d) => `Éloigne : ${d}`), ...(r.mechanism ? [r.mechanism] : []), r.conclusion]));
    if (reasoning.mainAnswer) block("Réponse à la question principale", [reasoning.mainAnswer]);
    block("Limites", reasoning.limits);
  }
  const states: Cell[][] = [["États financiers validés (" + currencySuffix(dossier.company) + ")"], ["Code", "Poste", "Section", ...labels]];
  for (const p of POSTES) states.push([p.code, p.label, SECTION_LABELS[p.section], ...computation.values.map((v) => v[p.code].value)]);
  const checks: Cell[][] = [["Contrôles comptables"], ["Contrôle", "Statut", "Gravité", "Explication", "Écart accepté"]];
  for (const c of input.checks) checks.push([c.label, c.status === "ok" ? "Conforme" : "Écart", c.severity === "blocking" ? "Bloquant" : "À vérifier", c.explanation, input.acceptedGaps[c.key] ?? ""]);
  const indicators: Cell[][] = [["Indicateurs (valeurs brutes : les pourcentages sont des proportions)"], ["Famille", "Indicateur", "Formule", "Unité", ...labels, "Repère usuel", "Statut", "Calcul détaillé (dernier exercice calculable)", "Ce que cela signifie"]];
  for (const s of Object.values(computation.series)) {
    const e = explainIndicator(s.def.id, computation, dossier);
    const line = e?.lines.filter((l) => !l.unavailable).at(-1);
    indicators.push([FAMILY_LABELS[s.def.family], s.def.label, s.def.formulaLabel, s.def.unit, ...s.values.map((v) => v.value), bandsText(s.def, s.bands), s.values.every((v) => v.value === null) ? `non calculable : ${s.values.find((v) => v.reason)?.reason ?? ""}` : "", line ? `${line.exercise} : ${line.steps.join(" ; ")}` : "", e?.meaning.slice(2).join(" ") ?? ""]);
  }
  const defense = defenseOf(input);
  const oral: Cell[][] = [["L'essentiel à dire à l'oral"], ...defense.pitch.map((p) => [p]), [], ["Questions probables du jury"]];
  const oralTitles = [0, oral.length - 1];
  for (const q of defense.questions) {
    oral.push([q.question], [q.answer], []);
    oralTitles.push(oral.length - 3);
  }
  const hyp: Cell[][] = [["Hypothèses et critères"], ["Énoncé", "Verdict", "Critère", "Statut", "Constat"]];
  for (const r of results) for (const c of r.results) hyp.push([r.link.statement, reasoning?.readings.find((x) => x.rowId === r.link.rowId)?.verdictLabel ?? "", c.criterion.label, CRITERION_STATUS_LABELS[c.status], c.observed]);
  return [
    { name: "Synthèse", rows: synthesis, titles, widths: [140] },
    { name: "États validés", rows: states, titles: [0], bold: [1], widths: [8, 60, 26, ...labels.map(() => 16)] },
    { name: "Contrôles", rows: checks, titles: [0], bold: [1], widths: [60, 12, 12, 80, 50] },
    { name: "Indicateurs", rows: indicators, titles: [0], bold: [1], widths: [30, 50, 60, 10, ...labels.map(() => 14), 40, 40, 110, 90] },
    { name: "Hypothèses", rows: hyp, titles: [0], bold: [1], widths: [60, 40, 60, 16, 90] },
    { name: "Soutenance", rows: oral, titles: oralTitles, widths: [160] },
    { name: "Lexique", rows: [["Lexique : les mots de l'analyse financière, en clair"], ["Terme", "En clair"], ...GLOSSARY.map((g) => [g.term, g.plain])], titles: [0], bold: [1], widths: [40, 120] },
  ];
}
