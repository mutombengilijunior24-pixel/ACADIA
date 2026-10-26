/**
 * Plan d'analyse fondé sur la chaîne de cohérence :
 * 1. chaque question du questionnaire devient un tableau (et un graphique) — profil, VI, VD, autres ;
 * 2. pour chaque hypothèse (ou objectif relationnel), les questions qui mesurent la VI sont croisées avec
 *    celles qui mesurent la VD (Chi² en priorité pour des réponses qualitatives), dans une limite raisonnable.
 * Rien n'est calculé ici ; les moteurs existants exécutent le plan (journey/execute.ts).
 */
import { statisticalTypeLabel } from "@/lib/core/data/preparation";
import type { ImportedDataset, PreparationState, VariableMetadata } from "@/lib/core/data/types";
import { METHOD_LABELS, selectMethods } from "@/lib/core/analysis/inferential";
import type { UnderstandingReport } from "@/lib/core/understanding";

import { ALIGNED, assessAlignment, type PlanAlignment } from "../journey/alignment";
import type { InstrumentKind } from "../journey/instrument";
import type { Cartography } from "../journey/mapping";
import { conditionsFor, crossPreview, describeExpected, expectedFor, UNAVAILABLE_METHODS, type AnalysisPlan, type PlanItem, type PlanVariable } from "../journey/plan";
import { cleanHeader, type FileStructure, type QuestionUnit } from "../journey/structure";

import { QUESTION_SIDE_LABELS, statementOf, type QuestionAssignment, type QuestionSide, type ResearchChain } from "./chain";

/** Plafonds : au-delà, les croisements sont proposés mais non retenus par défaut (risque de résultats dus au hasard). */
export const CHAIN_LIMITS = { ivUnits: 4, dvUnits: 4, perHypothesis: 16, total: 40 };

const SIDE_ORDER: QuestionSide[] = ["profile", "independent", "dependent", "other"];
const UNUSABLE = new Set(["free_text", "identifier", "temporal"]);

export function buildChainPlan(input: {
  chain: ResearchChain;
  report: UnderstandingReport;
  cartography: Cartography;
  structure: FileStructure;
  dataset: ImportedDataset;
  preparation: PreparationState;
  variables: VariableMetadata[];
  instrument: InstrumentKind | null;
  mainQuestion: string;
}): AnalysisPlan {
  const { chain, cartography, structure, dataset, preparation, variables, instrument } = input;
  const metaOf = (column: number) => variables.find((v) => v.column === column);
  const unitOf = (id: string) => structure.units.find((u) => u.id === id);
  const header = (column: number) => structure.columns.find((c) => c.column === column)?.label ?? String(column);
  const variableName = (key: string | null) => chain.variables.find((v) => v.key === key)?.name ?? "";
  const planVar = (name: string, column: number, role: string): PlanVariable => {
    const meta = metaOf(column);
    return { name, column, header: header(column), typeLabel: meta ? statisticalTypeLabel(meta.effectiveType) : "inconnu", role };
  };
  const mainQuestion = input.mainQuestion.trim() || input.report.mainQuestion?.text || "Question de recherche";
  const items: PlanItem[] = [];

  // 1. Chaque question du questionnaire : un tableau et un graphique.
  const ordered = [...chain.assignments].sort((a, b) => SIDE_ORDER.indexOf(a.side) - SIDE_ORDER.indexOf(b.side));
  for (const assignment of ordered) {
    const unit = unitOf(assignment.unitId);
    if (!unit || unit.kind === "technical") continue;
    const columns = unit.primaryColumn !== null ? [unit.primaryColumn] : unit.columns;
    const usable = columns.filter((c) => !UNUSABLE.has(metaOf(c)?.effectiveType ?? ""));
    const role = assignment.variableKey ? `${QUESTION_SIDE_LABELS[assignment.side]} « ${variableName(assignment.variableKey)} »` : QUESTION_SIDE_LABELS[assignment.side];
    const meta = unit.primaryColumn !== null ? metaOf(unit.primaryColumn) : undefined;
    items.push({
      id: `desc:unit:${unit.id}`,
      level: "descriptive",
      tier: "descriptive",
      alignment: ALIGNED,
      priority: assignment.side === "profile" || assignment.side === "other" ? 3 : 1,
      title: cleanHeader(unit.text),
      researchQuestion: mainQuestion,
      variables: usable.map((c) => planVar(assignment.variableKey ? variableName(assignment.variableKey) : cleanHeader(unit.text), c, role)),
      columns: usable,
      why: assignment.variableKey ? `Cette question mesure « ${variableName(assignment.variableKey)} » (${assignment.side === "dependent" ? "variable dépendante" : "variable indépendante"}) : sa répartition est le premier niveau de vérification.` : assignment.side === "profile" ? "Question de profil : elle décrit qui a répondu (présentation de l'échantillon)." : "Question du questionnaire non rattachée aux variables : elle est décrite pour être complet.",
      conditions: ["Type de la variable confirmé.", "Non-réponses exclues des pourcentages."],
      limits: unit.kind === "multi_choice" ? ["Question à choix multiples : chaque option est décrite séparément (une personne peut en cocher plusieurs)."] : usable.length < columns.length ? ["Réponses en texte libre : non décrites statistiquement (analyse qualitative non disponible)."] : [],
      expected: unit.kind === "multi_choice" ? "Pour chaque option : nombre et pourcentage de personnes l'ayant cochée." : describeExpected(meta?.effectiveType ?? ""),
      hypotheses: [],
      feasible: usable.length > 0,
      blocker: usable.length ? undefined : `« ${cleanHeader(unit.text)} » contient du texte libre ou des identifiants : une description statistique n'est pas adaptée.`,
      needsIndependence: false,
      chain: { group: assignment.side, variableKey: assignment.variableKey ?? undefined, unitId: unit.id },
    });
  }

  // 2. Croisements VI × VD pour chaque ligne relationnelle de la chaîne.
  const final: string[] = [];
  let total = 0;
  if (instrument !== "interview_guide") {
    const principal = (key: string) => cartography.concepts.find((c) => c.conceptKey === key)?.unitId ?? null;
    const unitsFor = (keys: string[], cap: number) =>
      chain.assignments
        .filter((a) => a.variableKey && keys.includes(a.variableKey))
        .map((a) => ({ a, unit: unitOf(a.unitId) }))
        .filter((x): x is { a: QuestionAssignment; unit: QuestionUnit } => !!x.unit && x.unit.primaryColumn !== null && x.unit.kind !== "multi_choice" && !UNUSABLE.has(metaOf(x.unit.primaryColumn)?.effectiveType ?? ""))
        .sort((x, y) => Number(principal(y.a.variableKey!) === y.unit.id) - Number(principal(x.a.variableKey!) === x.unit.id) || y.a.score - x.a.score)
        .slice(0, cap);
    const framing = [input.report.mainQuestion?.text ?? mainQuestion, input.report.generalObjective ?? "", ...input.report.specificObjectives].filter((t) => t.trim());

    for (const row of chain.rows) {
      if (row.descriptive || !row.independent.length || !row.dependent.length) {
        if (row.hypothesisId && !row.descriptive) final.push(`${label(row)} : VI ou VD non identifiée — précisez les variables de l'hypothèse pour la tester.`);
        continue;
      }
      const hypothesis = statementOf(chain, row.hypothesisId);
      const question = statementOf(chain, row.questionId);
      const ivUnits = unitsFor(row.independent, CHAIN_LIMITS.ivUnits);
      const dvUnits = unitsFor(row.dependent, CHAIN_LIMITS.dvUnits);
      if (!ivUnits.length || !dvUnits.length) {
        final.push(`${label(row)} : aucune question du questionnaire ne mesure ${!ivUnits.length ? `la VI « ${row.independent.map(variableName).join(" », « ")} »` : `la VD « ${row.dependent.map(variableName).join(" », « ")} »`} — rattachez-en une dans la matrice de cohérence.`);
        continue;
      }
      let inRow = 0;
      for (const iv of ivUnits)
        for (const dv of dvUnits) {
          const outMeta = metaOf(dv.unit.primaryColumn!);
          const expMeta = metaOf(iv.unit.primaryColumn!);
          if (!outMeta || !expMeta || outMeta.column === expMeta.column) continue;
          const ivName = variableName(iv.a.variableKey);
          const dvName = variableName(dv.a.variableKey);
          const isPrincipal = principal(iv.a.variableKey!) === iv.unit.id && principal(dv.a.variableKey!) === dv.unit.id;
          const withinLimits = inRow < CHAIN_LIMITS.perHypothesis && total < CHAIN_LIMITS.total;
          const base = {
            id: `cross:${row.hypothesisId ?? row.id}:${iv.unit.id}>${dv.unit.id}`,
            level: "relation" as const,
            tier: (withinLimits ? (isPrincipal ? "main" : "indicator") : "secondary") as PlanItem["tier"],
            priority: (isPrincipal ? 1 : 2) as 1 | 2,
            title: `${cleanHeader(iv.unit.text)} × ${cleanHeader(dv.unit.text)}`,
            researchQuestion: question?.text ?? mainQuestion,
            hypotheses: hypothesis ? [hypothesis.text] : [],
            why: `${hypothesis ? `Vérifie l'hypothèse « ${hypothesis.text} »` : `Répond à l'objectif « ${statementOf(chain, row.objectiveId)?.text ?? ""} »`} : la question « ${cleanHeader(iv.unit.text)} » (VI « ${ivName} ») est croisée avec « ${cleanHeader(dv.unit.text)} » (VD « ${dvName} »).`,
            needsIndependence: false,
            chain: { rowId: row.id, hypothesisId: row.hypothesisId ?? undefined, ivUnitId: iv.unit.id, dvUnitId: dv.unit.id },
            defaultStatus: (withinLimits ? "accepted" : "rejected") as "accepted" | "rejected",
          };
          const alignment: PlanAlignment = isPrincipal
            ? assessAlignment({
                concepts: [
                  { conceptKey: dv.a.variableKey!, name: dvName, unitId: dv.unit.id, role: "Variable dépendante" },
                  { conceptKey: iv.a.variableKey!, name: ivName, unitId: iv.unit.id, role: "Variable explicative" },
                ],
                cartography,
                structure,
                variables,
                hypotheses: base.hypotheses,
                framing,
              })
            : { status: "info", detail: "Questions rattachées aux variables par la matrice de cohérence.", signals: [{ code: "chain", level: "info", message: `« ${cleanHeader(iv.unit.text)} » mesure « ${ivName} » et « ${cleanHeader(dv.unit.text)} » mesure « ${dvName} » (matrice de cohérence).` }] };
          const variablesUsed = [planVar(dvName, dv.unit.primaryColumn!, "à expliquer (VD)"), planVar(ivName, iv.unit.primaryColumn!, "explicative (VI)")];
          const selection = selectMethods(dataset, preparation, outMeta, expMeta);
          if (selection.refused || !selection.options.length) {
            items.push({ ...base, alignment, variables: variablesUsed, columns: [outMeta.column, expMeta.column], conditions: [], limits: [], expected: "—", feasible: false, blocker: selection.refused ?? "Aucune méthode disponible pour ces types de variables." });
            continue;
          }
          // Réponses qualitatives : tableau croisé et Chi² en priorité (usage en sciences économiques et de gestion).
          const chosen = selection.options.find((o) => o.method === "chi_square") ?? selection.options.find((o) => o.recommended) ?? selection.options[0];
          items.push({
            ...base,
            alignment,
            variables: variablesUsed,
            columns: [outMeta.column, expMeta.column],
            method: chosen.method,
            methodOptions: selection.options,
            outcomeColumn: outMeta.column,
            explanatoryColumn: expMeta.column,
            preview: selection.options.some((o) => o.method === "chi_square") ? crossPreview(dataset, preparation, outMeta, expMeta, ivName, dvName) : undefined,
            conditions: conditionsFor(chosen.method, dataset, preparation, outMeta, expMeta),
            limits: [...(withinLimits ? [] : ["Au-delà du nombre de croisements conseillé : retenez-le seulement s'il est justifié."]), "Une association statistique ne démontre pas une causalité.", ...selection.notes],
            expected: expectedFor(chosen.method),
            feasible: true,
            needsIndependence: selection.needsIndependence && chosen.method !== "pearson" && chosen.method !== "spearman",
          });
          inRow += 1;
          total += 1;
        }
      const count = items.filter((i) => i.chain?.rowId === row.id && i.level === "relation").length;
      final.push(`${label(row)} : ${count} croisement(s) (${ivUnits.length} question(s) de la VI × ${dvUnits.length} question(s) de la VD) ; les p-values seront ajustées (méthode de Holm) sur les croisements retenus. Les données pourront soutenir ou non l'hypothèse, sans jamais la prouver.`);
    }
  }
  if (!items.some((i) => i.level === "relation")) final.push(instrument === "interview_guide" ? "Instrument qualitatif : les tests statistiques ne sont pas adaptés." : "Aucune hypothèse testable (VI et VD mesurées) : le plan se limite à l'interprétation descriptive.");
  final.push("L'interprétation reliera chaque résultat à son hypothèse, à son objectif et à sa question de recherche.");

  const missingForConclusion = [
    ...chain.variables.filter((v) => !chain.assignments.some((a) => a.variableKey === v.key)).map((v) => `Aucune question du questionnaire ne mesure « ${v.name} » (${v.side === "dependent" ? "VD" : "VI"}).`),
    ...(input.report.missingEssential.some((m) => m.field === "population") ? ["La population étudiée n'est pas précisée : la portée des conclusions restera floue."] : []),
    ...(dataset.rowCount < 30 ? [`Seulement ${dataset.rowCount} observations : les tests auront peu de puissance et des effectifs attendus faibles.`] : []),
  ];

  return { items, final, missingForConclusion, unavailable: UNAVAILABLE_METHODS };

  function label(row: ResearchChain["rows"][number]): string {
    const h = statementOf(chain, row.hypothesisId);
    if (h) return `Hypothèse ${h.index + 1} « ${h.text} »`;
    const o = statementOf(chain, row.objectiveId);
    return o ? `Objectif ${o.index + 1} « ${o.text} »` : `Ligne ${row.id}`;
  }
}

/** Libellé lisible de la méthode d'un croisement (pour les écrans et rapports). */
export const crossingMethodLabel = (item: PlanItem) => (item.method ? METHOD_LABELS[item.method] : "—");
