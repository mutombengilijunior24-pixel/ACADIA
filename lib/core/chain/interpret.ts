/**
 * Interprétation rattachée à la chaîne de cohérence : chaque résultat est relié à son hypothèse, son
 * objectif et sa question de recherche (« ceci rapproche les données de l'hypothèse, ceci les en éloigne »).
 * Formulations déterministes ; aucune causalité, aucune hypothèse « prouvée ».
 */
import type { VariableDescriptive } from "@/lib/core/analysis/descriptiveStatistics";
import { fmt } from "@/lib/core/analysis/inferential";

import type { Execution } from "../journey/execute";
import type { Paragraph } from "../journey/interpret";
import { cleanHeader } from "../journey/structure";
import { CHAIN_VERDICT_LABELS, type HypothesisAssessment } from "./assess";
import { statementOf, type ResearchChain } from "./chain";

/** Lecture en une phrase d'un tableau descriptif. */
export function readingOf(result: VariableDescriptive, structural?: { values: string[]; count: number }): string {
  const header = cleanHeader(result.header);
  if (result.valid === 0) return `« ${header} » : aucune réponse valide.`;
  const base = structural ? `${result.valid} répondant(s) concerné(s) ; ${structural.count} « ${structural.values.join(" / ")} » hors calcul` : `${result.valid} réponse(s)`;
  if (result.kind === "quantitative") return `« ${header} » (${base}) : moyenne ${fmt(result.mean ?? NaN)}, médiane ${fmt(result.median ?? NaN)}, de ${fmt(result.min ?? NaN)} à ${fmt(result.max ?? NaN)}.`;
  const sorted = [...result.frequencies].sort((a, b) => b.count - a.count);
  const top = sorted[0];
  const second = sorted[1];
  const lead = top.percent > 50 ? `la majorité (${fmt(top.percent, 1)} %, ${top.count}/${result.valid}) répond « ${top.value} »` : `la réponse la plus fréquente est « ${top.value} » (${fmt(top.percent, 1)} %, ${top.count}/${result.valid})`;
  const next = second ? `, suivie de « ${second.value} » (${fmt(second.percent, 1)} %)` : "";
  const median = result.kind === "ordinal" && result.orderKnown && result.median ? ` ; réponse médiane : « ${result.median.lower === result.median.upper ? result.median.lower : `${result.median.lower} – ${result.median.upper}`} »` : "";
  return `« ${header} » (${base}) : ${lead}${next}${median}.`;
}

export interface ChainRowInterpretation {
  rowId: string;
  question: string | null;
  objective: string | null;
  hypothesis: string | null;
  kind: "descriptive" | "hypothesis";
  verdict: string | null;
  paragraphs: Paragraph[];
}

export interface ChainInterpretation {
  rows: ChainRowInterpretation[];
  mainAnswer: Paragraph[];
  limits: string[];
}

export function interpretChain(chain: ResearchChain, execution: Execution, assessments: HypothesisAssessment[], mainQuestion: string): ChainInterpretation {
  const variableName = (key: string) => chain.variables.find((v) => v.key === key)?.name ?? key;
  const descriptive = execution.items.flatMap((e) => (e.kind === "descriptive" ? e.results.map((r) => ({ r, unitId: e.item.chain?.unitId, structural: e.structural.find((s) => s.column === r.column) })) : []));
  const unitsOf = (keys: string[]) => chain.assignments.filter((a) => a.variableKey && keys.includes(a.variableKey)).map((a) => a.unitId);
  const rows: ChainRowInterpretation[] = [];
  const limits = new Set<string>();

  for (const row of chain.rows) {
    const q = statementOf(chain, row.questionId);
    const o = statementOf(chain, row.objectiveId);
    const h = statementOf(chain, row.hypothesisId);
    const chainText = [q ? `la question de recherche ${q.index + 1} « ${q.text} »` : null, o ? `l'objectif ${o.index + 1} « ${o.text} »` : null].filter(Boolean).join(", qui se rattache à ");
    const paragraphs: Paragraph[] = [];
    const assessment = assessments.find((a) => a.rowId === row.id);
    if (assessment && assessment.crossings.length) {
      const iv = row.independent.map(variableName).join(" », « ");
      const dv = row.dependent.map(variableName).join(" », « ");
      paragraphs.push({ origin: "règles", text: `${chainText ? `Pour ${chainText}, ` : ""}${h ? `la réponse provisoire est l'hypothèse ${h.index + 1} « ${h.text} ».` : "aucune hypothèse n'est formulée ; l'objectif est examiné par les croisements suivants."} ACADIA a croisé les questions qui mesurent « ${iv} » (VI) avec celles qui mesurent « ${dv} » (VD) : ${assessment.crossings.length} croisement(s), dont ${assessment.tests} interprétable(s).` });
      if (assessment.supporting.length) paragraphs.push({ origin: "calcul", text: `Ce qui rapproche les données de l'hypothèse : ${assessment.supporting.join(" ; ")}` });
      if (assessment.opposing.length) paragraphs.push({ origin: "calcul", text: `Ce qui l'en éloigne ou reste incertain : ${assessment.opposing.join(" ; ")}` });
      paragraphs.push({
        origin: "règles",
        text: `Conclusion pour ${h ? `l'hypothèse ${h.index + 1}` : "cet objectif"} : ${CHAIN_VERDICT_LABELS[assessment.verdict].toLowerCase()} au seuil α = ${fmt(assessment.alpha)}${assessment.tests > 1 ? `, après ajustement de Holm sur ${assessment.tests} tests` : ""}. Une association statistique ne démontre pas que « ${iv} » cause « ${dv} ».`,
      });
      if (assessment.confidence === "low") limits.add(`${assessment.label} : conclusion fragile (petits effectifs, conditions non réunies ou nombreux croisements).`);
      if (assessment.tests > 1) limits.add(`${assessment.label} : ${assessment.tests} tests sur la même hypothèse ; p-values ajustées par la méthode de Holm (seuil de Bonferroni indicatif : ${fmt(assessment.bonferroni ?? assessment.alpha, 4)}).`);
      rows.push({ rowId: row.id, question: q?.text ?? null, objective: o?.text ?? null, hypothesis: h?.text ?? null, kind: "hypothesis", verdict: CHAIN_VERDICT_LABELS[assessment.verdict], paragraphs });
      continue;
    }
    // Objectif descriptif (ou hypothèse non testable) : la statistique descriptive répond.
    const keys = [...row.independent, ...row.dependent];
    const results = descriptive.filter((d) => d.unitId && unitsOf(keys).includes(d.unitId));
    if (results.length) {
      paragraphs.push({ origin: "règles", text: `${chainText ? `Pour ${chainText}, ` : ""}la réponse vient de la statistique descriptive des questions qui mesurent « ${keys.map(variableName).join(" », « ")} ».` });
      for (const d of results.slice(0, 6)) paragraphs.push({ origin: "calcul", text: readingOf(d.r, d.structural) });
    } else {
      paragraphs.push({ origin: "règles", text: `${chainText ? `Pour ${chainText}, ` : ""}aucune analyse réalisée ne permet de répondre : ${h ? "l'hypothèse n'a pas pu être testée (variables non mesurées ou non identifiées)" : "aucune question du questionnaire n'est rattachée à ses variables"}.` });
      limits.add(`${o ? `Objectif ${o.index + 1}` : h ? `Hypothèse ${h.index + 1}` : "Une ligne de la chaîne"} non couvert par les analyses.`);
    }
    rows.push({ rowId: row.id, question: q?.text ?? null, objective: o?.text ?? null, hypothesis: h?.text ?? null, kind: "descriptive", verdict: h ? CHAIN_VERDICT_LABELS.not_examined : null, paragraphs });
  }

  const tested = assessments.filter((a) => a.verdict !== "not_examined");
  const mainAnswer: Paragraph[] = [
    {
      origin: "règles",
      text: tested.length
        ? `À la question « ${mainQuestion} » : ${tested.map((a) => `${a.label.toLowerCase()} — ${CHAIN_VERDICT_LABELS[a.verdict].toLowerCase()}`).join(" ; ")}. Ces résultats décrivent l'échantillon étudié ; ils n'établissent aucune relation de cause à effet.`
        : `À la question « ${mainQuestion} » : aucune hypothèse n'a pu être testée ; les résultats sont descriptifs.`,
    },
  ];
  return { rows, mainAnswer, limits: [...limits] };
}
