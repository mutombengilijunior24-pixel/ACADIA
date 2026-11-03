/**
 * Rapport du vérificateur de références (Word, impression, Excel) : synthèse, contrôle de forme, existence
 * de chaque référence, contexte des citations contrôlées et bibliographie corrigée en APA 7 (italique et
 * retrait suspendu). Mêmes informations qu'à l'écran.
 */
import type { Block, ReportDocument } from "@/lib/core/export/document";
import type { Sheet } from "@/lib/core/export/xlsx";

import type { DocumentAnalysis } from "./analyze";
import { runsText } from "./apa7";
import { citationLabel } from "./citations";
import type { ContextVerdict } from "./context";
import { EXISTENCE_LABELS, SOURCE_LABELS, type ExistenceVerdict } from "./match";
import { CONVENTION_LABELS, REFERENCE_KIND_LABELS, type IssueSeverity, type TextRun } from "./types";

export interface ReferenceReportInput {
  analysis: DocumentAnalysis;
  verdicts: Record<string, ExistenceVerdict>;
  contexts: Record<string, ContextVerdict>;
  fileName: string | null;
}

const SEVERITY_LABELS: Record<IssueSeverity, string> = { erreur: "Erreur", a_verifier: "À vérifier", conseil: "Conseil" };

/** Bibliographie finale : la notice de la base quand la référence a été retrouvée, sinon la mise en forme APA. */
export function finalBibliography(input: Pick<ReferenceReportInput, "analysis" | "verdicts">): Array<{ referenceId: string; runs: TextRun[]; fromDatabase: boolean }> {
  return input.analysis.corrected.map((c) => {
    const v = input.verdicts[c.referenceId];
    return v?.corrected && (v.status === "verifiee" || v.status === "a_corriger") ? { referenceId: c.referenceId, runs: v.corrected, fromDatabase: true } : { referenceId: c.referenceId, runs: c.runs, fromDatabase: false };
  });
}

export function referenceReport(input: ReferenceReportInput): ReportDocument {
  const { analysis, verdicts, contexts } = input;
  const refs = analysis.references;
  const checked = refs.filter((r) => verdicts[r.id]);
  const count = (s: ExistenceVerdict["status"]) => checked.filter((r) => verdicts[r.id].status === s).length;
  const blocks: Block[] = [
    { type: "title", text: "Vérification des références" },
    { type: "meta", text: `${input.fileName ? `Document : ${input.fileName} · ` : ""}Convention : ${CONVENTION_LABELS[analysis.convention]} · Rapport ACADIA` },
    { type: "h1", text: "Synthèse" },
    {
      type: "table",
      head: ["Élément", "Nombre"],
      rows: [
        ["Citations repérées dans le texte", analysis.stats.citations],
        ["Références de la bibliographie", analysis.stats.references],
        ["Erreurs de forme", analysis.stats.errors],
        ["Points à vérifier", analysis.stats.toCheck],
        ["Conseils", analysis.stats.advice],
        ["Références vérifiées en ligne", checked.length],
        ...(checked.length ? (["verifiee", "a_corriger", "introuvable", "suspecte", "non_verifiable"] as const).map((s) => [`— ${EXISTENCE_LABELS[s]}`, count(s)] as [string, number]) : []),
      ],
    },
    { type: "warn", text: "Ce rapport aide à corriger les références ; il ne remplace pas la lecture des sources. Une référence « introuvable » ou « suspecte » n'est pas déclarée fausse : vérifiez-la dans la source d'origine." },
    { type: "h1", text: "1. Forme et cohérence (APA 7)" },
  ];
  if (analysis.issues.length) {
    blocks.push({ type: "table", head: ["Type", "Constat", "Proposition"], rows: analysis.issues.map((i) => [SEVERITY_LABELS[i.severity], i.message, i.fix ?? ""]) });
  } else blocks.push({ type: "p", text: "Aucun problème de forme détecté." });

  blocks.push({ type: "h1", text: "2. Existence des références" });
  if (checked.length) {
    blocks.push({
      type: "table",
      head: ["N°", "Référence", "Statut", "Constat"],
      rows: checked.map((r, i) => {
        const v = verdicts[r.id];
        return [i + 1, r.raw, v.label, [...v.reasons, ...v.differences.map((d) => `${d.field} : « ${d.student} » → « ${d.found} »`), v.consulted.length ? `Bases consultées : ${v.consulted.map((s) => SOURCE_LABELS[s]).join(", ")}` : ""].filter(Boolean).join(" ")];
      }),
    });
  } else blocks.push({ type: "p", text: "La vérification en ligne n'a pas été lancée." });

  const contextRows = analysis.citations.filter((c) => contexts[c.id]);
  if (contextRows.length) {
    blocks.push({ type: "h1", text: "3. Contexte des citations" });
    blocks.push({ type: "table", head: ["Citation", "Phrase", "Avis", "Explication et extrait du résumé"], rows: contextRows.map((c) => [citationLabel(c), c.sentence, contexts[c.id].label, `${contexts[c.id].explanation}${contexts[c.id].evidence ? ` — « ${contexts[c.id].evidence} »` : ""}`]) });
  }

  blocks.push({ type: "h1", text: `${contextRows.length ? 4 : 3}. Bibliographie corrigée (APA 7)` });
  blocks.push({ type: "meta", text: "Ordre alphabétique. Les références retrouvées sont présentées d'après la notice de la base bibliographique ; les autres d'après votre texte, mis en forme." });
  for (const b of finalBibliography(input)) blocks.push({ type: "rich", runs: b.runs, hanging: true });
  return { title: "Vérification des références", blocks };
}

export function referenceSheets(input: ReferenceReportInput): Sheet[] {
  const { analysis, verdicts } = input;
  const final = new Map(finalBibliography(input).map((b) => [b.referenceId, runsText(b.runs)]));
  return [
    {
      name: "Références",
      rows: [["N°", "Référence (votre texte)", "Type", "Statut", "Constat", "Référence corrigée (APA 7)"], ...analysis.references.map((r, i) => [i + 1, r.raw, REFERENCE_KIND_LABELS[r.kind], verdicts[r.id]?.label ?? "Non vérifiée en ligne", verdicts[r.id]?.reasons.join(" ") ?? "", final.get(r.id) ?? ""])],
      bold: [0],
      widths: [5, 60, 18, 22, 60, 60],
    },
    {
      name: "Forme",
      rows: [["Type", "Constat", "Proposition"], ...analysis.issues.map((i) => [SEVERITY_LABELS[i.severity], i.message, i.fix ?? ""])],
      bold: [0],
      widths: [12, 90, 50],
    },
  ];
}
