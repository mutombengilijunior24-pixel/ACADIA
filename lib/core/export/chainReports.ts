/**
 * Rapport structuré par la chaîne de cohérence (Word / HTML imprimable / Excel) :
 * cadre et matrice de cohérence → Partie 1 descriptive → Partie 2 inférentielle → Partie 3 interprétation.
 * Aucune valeur n'est recalculée : on reprend les résultats des moteurs.
 */
import { fmt, fmtP } from "@/lib/core/analysis/inferential";
import { CHAIN_VERDICT_LABELS, readingOf, statementOf, type ChainInterpretation, type HypothesisAssessment, type ResearchChain } from "@/lib/core/chain";
import type { Execution } from "@/lib/core/journey/execute";
import type { Interpretation, Paragraph } from "@/lib/core/journey/interpret";
import { cleanHeader } from "@/lib/core/journey/structure";

import type { Block, ReportDocument } from "./document";
import { DEFAULT_PALETTE } from "./palette";
import { analysisBlocks, descriptiveBlocks, descriptiveSheets, inferentialSheets, type ReportContext } from "./reports";
import type { Cell, Sheet } from "./xlsx";

const ORIGIN_TAG: Record<Paragraph["origin"], string> = { calcul: "Calcul", règles: "Règles ACADIA" };
const today = () => new Date().toLocaleDateString("fr-FR");

export interface ChainReportInput {
  question: string;
  execution: Execution;
  interpretation: Interpretation;
  chain: ResearchChain;
  assessments: HypothesisAssessment[];
  chainInterpretation: ChainInterpretation;
  palette?: string[];
  context?: ReportContext;
}

const CONDITION_LABEL = { satisfied: "Réunies", fisher: "Test exact de Fisher", unreliable: "Non réunies (non concluant)" } as const;

/** Lignes de la matrice de cohérence (une par lien question → objectif → hypothèse). */
export function coherenceRows(chain: ResearchChain): string[][] {
  const name = (key: string) => chain.variables.find((v) => v.key === key)?.name ?? key;
  const questionsOf = (keys: string[]) =>
    chain.assignments
      .filter((a) => a.variableKey && keys.includes(a.variableKey))
      .map((a) => cleanHeader(a.text))
      .join(" ; ") || "—";
  return chain.rows.map((row) => [
    statementOf(chain, row.questionId)?.text ?? "—",
    statementOf(chain, row.objectiveId)?.text ?? "—",
    statementOf(chain, row.hypothesisId)?.text ?? (row.descriptive ? "Sans objet (objectif descriptif)" : "—"),
    row.independent.map(name).join(", ") || "—",
    row.dependent.map(name).join(", ") || "—",
    questionsOf(row.independent),
    questionsOf(row.dependent),
  ]);
}

const COHERENCE_HEAD = ["Question de recherche", "Objectif", "Hypothèse", "VI", "VD", "Questions qui mesurent la VI", "Questions qui mesurent la VD"];
const CROSSING_HEAD = ["Question (VI)", "Question (VD)", "Statistique", "p", "p ajustée (Holm)", "Intensité", "Conditions", "Lecture"];

function crossingRows(a: HypothesisAssessment, execution: Execution): Array<Array<string | number>> {
  const title = (unitId: string) => execution.items.find((e) => e.item.chain?.unitId === unitId)?.item.title ?? unitId;
  return a.crossings.map((c) => [
    title(c.ivUnitId),
    title(c.dvUnitId),
    c.statistic,
    c.p === null ? "—" : `${c.pSource === "fisher" ? "Fisher " : ""}${fmtP(c.p)}`,
    c.pAdjusted === null ? "—" : fmtP(c.pAdjusted),
    c.effect ? `${c.effect} (${c.magnitude})` : "—",
    CONDITION_LABEL[c.conditions],
    c.report ? (c.significant ? "Association significative" : c.reliable ? "Pas d'association significative" : "Non concluant") : (c.failure ?? "Non calculé"),
  ]);
}

export function chainJourneyDocument(input: ChainReportInput): ReportDocument {
  const { question, execution, interpretation, chain, assessments, chainInterpretation } = input;
  const palette = input.palette ?? DEFAULT_PALETTE;
  const paras = (items: Paragraph[]): Block[] => items.map((p) => ({ type: "p", text: p.text, tag: ORIGIN_TAG[p.origin] }));
  const blocks: Block[] = [
    { type: "title", text: "Rapport d'interprétation des données" },
    { type: "meta", text: `Question de recherche : ${question}` },
    { type: "meta", text: interpretation.provenance.statement },
    ...(interpretation.provenance.warning ? [{ type: "warn" as const, text: interpretation.provenance.warning }] : []),
    { type: "meta", text: `Généré par ACADIA le ${today()}. Calculs déterministes ; interprétation par règles, sans assistance IA.` },
    ...(input.context?.perspective ? [{ type: "meta" as const, text: `Perspective d'interprétation : ${input.context.perspective}` }] : []),
  ];

  // Cadre et matrice de cohérence.
  blocks.push({ type: "h1", text: "Cadre de la recherche et matrice de cohérence" });
  if (chain.problem.trim()) blocks.push({ type: "p", text: `Problème de départ : ${chain.problem}` });
  blocks.push({ type: "table", head: COHERENCE_HEAD, rows: coherenceRows(chain) });

  // Partie 1 — descriptive : chaque question → un tableau → un graphique.
  blocks.push({ type: "h1", text: "Partie 1 — Interprétation descriptive" }, { type: "meta", text: "Chaque question du questionnaire est présentée sous forme de tableau, puis de graphique, avec sa lecture. Pourcentages calculés sur les réponses valides." });
  const groups: Array<{ title: string; match: (g: Execution["items"][number]) => boolean }> = [
    { title: "Profil des répondants", match: (e) => e.item.chain?.group === "profile" },
    ...chain.variables.filter((v) => v.side === "independent").map((v) => ({ title: `Variable indépendante — ${v.name}`, match: (e: Execution["items"][number]) => e.item.chain?.variableKey === v.key })),
    ...chain.variables.filter((v) => v.side === "dependent").map((v) => ({ title: `Variable dépendante — ${v.name}`, match: (e: Execution["items"][number]) => e.item.chain?.variableKey === v.key })),
    { title: "Autres questions", match: (e) => e.item.chain?.group === "other" },
  ];
  for (const group of groups) {
    const items = execution.items.filter((e) => e.kind === "descriptive" && group.match(e));
    if (!items.length) continue;
    blocks.push({ type: "h2", text: group.title });
    for (const e of items) {
      if (e.kind !== "descriptive") continue;
      for (const r of e.results) {
        const structural = e.structural.find((s) => s.column === r.column);
        blocks.push(...descriptiveBlocks({ ...r, header: cleanHeader(r.header) }, palette, structural), { type: "p", text: `Lecture : ${readingOf(r, structural)}` });
      }
    }
  }

  // Partie 2 — inférentielle : par hypothèse, croisements VI × VD.
  blocks.push({ type: "h1", text: "Partie 2 — Statistique inférentielle" });
  if (!assessments.length) blocks.push({ type: "p", text: "Aucune hypothèse avec une VI et une VD mesurées : pas de test de relation." });
  for (const a of assessments) {
    const h = statementOf(chain, a.hypothesisId);
    blocks.push({ type: "h2", text: `${a.label}${h ? ` — ${h.text}` : ""}` });
    blocks.push({ type: "meta", text: `Verdict : ${CHAIN_VERDICT_LABELS[a.verdict]} (α = ${fmt(a.alpha)}). ${a.significant} association(s) significative(s) sur ${a.tests} croisement(s) interprétable(s)${a.tests > 1 ? ` ; p-values ajustées par la méthode de Holm (seuil de Bonferroni indicatif : ${fmt(a.bonferroni ?? a.alpha, 4)})` : ""}.` });
    blocks.push({ type: "table", head: CROSSING_HEAD, rows: crossingRows(a, execution) });
    a.crossings.forEach((c, i) => {
      if (c.report) blocks.push(...analysisBlocks(c.report, i + 1, true, palette, true));
    });
  }

  // Partie 3 — interprétation rattachée.
  blocks.push({ type: "h1", text: "Partie 3 — Interprétation" });
  chainInterpretation.rows.forEach((row, i) => {
    blocks.push({ type: "h2", text: `Lien ${i + 1}${row.verdict ? ` — ${row.verdict}` : ""}` });
    if (row.question) blocks.push({ type: "meta", text: `Question : ${row.question}` });
    if (row.objective) blocks.push({ type: "meta", text: `Objectif : ${row.objective}` });
    if (row.hypothesis) blocks.push({ type: "meta", text: `Hypothèse : ${row.hypothesis}` });
    blocks.push(...paras(row.paragraphs));
  });
  blocks.push({ type: "h2", text: "Réponse à la question principale" }, ...paras(chainInterpretation.mainAnswer));
  blocks.push({ type: "h1", text: "Limites" }, { type: "bullets", items: [...new Set([...chainInterpretation.limits, ...interpretation.limits])] });
  if (input.context?.trace?.length) blocks.push({ type: "h1", text: "Traçabilité des résultats" }, { type: "table", head: ["Élément", "Valeur"], rows: input.context.trace });
  return { title: "Rapport d'interprétation — ACADIA", blocks };
}

export function chainJourneySheets(input: ChainReportInput): Sheet[] {
  const { question, execution, interpretation, chain, assessments, chainInterpretation } = input;
  const synthesis: Cell[][] = [["Rapport ACADIA — interprétation des données"], ["Question de recherche : " + question], [interpretation.provenance.statement], ...(interpretation.provenance.warning ? [["⚠ " + interpretation.provenance.warning]] : []), []];
  const titles = [0];
  const block = (title: string, lines: string[]) => {
    titles.push(synthesis.length);
    synthesis.push([title], ...lines.map((l) => [l]), []);
  };
  block("Verdicts par hypothèse", assessments.map((a) => `${a.label}${statementOf(chain, a.hypothesisId) ? ` (${statementOf(chain, a.hypothesisId)!.text})` : ""} : ${CHAIN_VERDICT_LABELS[a.verdict]} — ${a.significant}/${a.tests} croisement(s) significatif(s)`));
  chainInterpretation.rows.forEach((row, i) => block(`Lien ${i + 1}${row.verdict ? ` — ${row.verdict}` : ""}`, row.paragraphs.map((p) => p.text)));
  block("Réponse à la question principale", chainInterpretation.mainAnswer.map((p) => p.text));
  block("Limites", [...new Set([...chainInterpretation.limits, ...interpretation.limits])]);
  if (input.context?.trace?.length) {
    titles.push(synthesis.length);
    synthesis.push(["Traçabilité"], ...input.context.trace.map(([k, v]) => [k, v]), []);
  }
  const coherence: Cell[][] = [COHERENCE_HEAD, ...coherenceRows(chain)];
  const crossings: Cell[][] = [["Hypothèse", ...CROSSING_HEAD]];
  for (const a of assessments) for (const row of crossingRows(a, execution)) crossings.push([a.label, ...row]);
  const descriptive = execution.items.flatMap((e) => (e.kind === "descriptive" ? e.results.map((r) => ({ ...r, header: cleanHeader(r.header) })) : []));
  const reports = execution.items.flatMap((e) => (e.kind === "relation" && e.outcome.ok ? [e.outcome.report] : []));
  return [
    { name: "Synthèse", rows: synthesis, widths: [110, 30], titles },
    { name: "Matrice de cohérence", rows: coherence, widths: [40, 40, 40, 22, 22, 40, 40], bold: [0] },
    ...descriptiveSheets(descriptive),
    ...(assessments.length ? [{ name: "Croisements", rows: crossings, widths: [14, 36, 36, 26, 14, 14, 22, 22, 28], bold: [0] }] : []),
    ...inferentialSheets(reports),
  ];
}
