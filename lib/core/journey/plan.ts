/**
 * Plan d'analyse personnalisé : part de la question de recherche, des relations envisagées et de
 * la cartographie confirmée — jamais de la seule compatibilité des types. Chaque analyse proposée
 * indique la question à laquelle elle répond, ses variables, ses colonnes, ses conditions et ses
 * limites. Aucun résultat n'est calculé ici (seul un contrôle préalable des effectifs est fait).
 */
import { statisticalTypeLabel } from "@/lib/core/data/preparation";
import type { ImportedDataset, PreparationState, VariableMetadata } from "@/lib/core/data/types";
import { METHOD_LABELS, pairObservations, selectMethods, type MethodId, type MethodOption } from "@/lib/core/analysis/inferential";
import type { UnderstandingReport } from "@/lib/core/understanding";

import type { InstrumentKind } from "./instrument";
import type { Cartography } from "./mapping";
import { ALIGNED, assessAlignment, type PlanAlignment } from "./alignment";
import type { FileStructure } from "./structure";

export type PlanLevel = "descriptive" | "relation";

/** Place d'une analyse dans le plan : descriptifs nécessaires, analyse principale, analyses facultatives. */
export type PlanTier = "descriptive" | "main" | "secondary";

export const TIER_LABELS: Record<PlanTier, string> = {
  descriptive: "Descriptif nécessaire",
  main: "Analyse principale",
  secondary: "Complémentaire (facultative)",
};

export type { PlanAlignment } from "./alignment";

/** Aperçu d'un tableau croisé AVANT le calcul : lignes, colonnes, effectifs. */
export interface CrossPreview {
  rowVariable: string;
  colVariable: string;
  rowLabels: string[];
  colLabels: string[];
  counts: number[][];
  n: number;
}

/** Choix explicites de l'utilisateur pour un tableau 2 × 2. */
export interface TwoByTwoChoice {
  /** Catégorie de référence de la variable en ligne (explicative). */
  rowReference: string;
  /** Issue étudiée (catégorie « événement ») de la variable en colonne (à expliquer). */
  outcomeEvent: string;
  /** Sens de lecture : groupe comparé − référence (par défaut) ou l'inverse. */
  direction: "comparison_vs_reference" | "reference_vs_comparison";
}

export interface PlanVariable {
  name: string;
  column: number;
  header: string;
  typeLabel: string;
  role: string;
}

export interface PlanItem {
  id: string;
  level: PlanLevel;
  tier: PlanTier;
  alignment: PlanAlignment;
  priority: 1 | 2 | 3;
  title: string;
  researchQuestion: string;
  variables: PlanVariable[];
  columns: number[];
  why: string;
  conditions: string[];
  limits: string[];
  expected: string;
  method?: MethodId;
  methodOptions?: MethodOption[];
  outcomeColumn?: number;
  explanatoryColumn?: number;
  hypotheses: string[];
  /** Tableau croisé prévisualisé (Chi²) ; catégories modifiables si 2 × 2. */
  preview?: CrossPreview;
  feasible: boolean;
  blocker?: string;
  /** Les tests de groupes et le Chi² supposent des observations indépendantes. */
  needsIndependence: boolean;
}

export interface AnalysisPlan {
  items: PlanItem[];
  /** C. Comment les résultats serviront à évaluer les hypothèses et à répondre à la problématique. */
  final: string[];
  missingForConclusion: string[];
  unavailable: string[];
}

export interface PlanDecisions {
  status: Record<string, "accepted" | "rejected">;
  method: Record<string, MethodId>;
  order: string[];
  /** Analyses dont le décalage question ↔ colonnes a été explicitement accepté par l'utilisateur. */
  mismatchConfirmed?: Record<string, boolean>;
  /** Catégories de référence et issue étudiée choisies pour les tableaux 2 × 2. */
  categories?: Record<string, TwoByTwoChoice>;
}

export const emptyPlanDecisions = (): PlanDecisions => ({ status: {}, method: {}, order: [], mismatchConfirmed: {}, categories: {} });

export const UNAVAILABLE_METHODS = [
  "Régression (simple ou multiple) et régression logistique",
  "Comparaisons post-hoc après une ANOVA, ANOVA de Welch",
  "Tests non paramétriques de Mann-Whitney et Kruskal-Wallis",
  "Tests pour mesures appariées ou répétées",
  "Test exact pour les tableaux plus grands que 2 × 2",
  "Alpha de Cronbach et analyse factorielle",
  "Analyse qualitative (codage thématique d'entretiens)",
];

const CATEGORICAL = new Set(["nominal", "ordinal"]);

function describeExpected(type: string): string {
  if (CATEGORICAL.has(type)) return "Effectifs et pourcentages par modalité (mode, et médiane si l'ordre des modalités est connu).";
  if (type.startsWith("quantitative")) return "Effectif, moyenne, médiane, écart-type, minimum, maximum, quartiles et distribution.";
  return "Description adaptée au type confirmé.";
}

export function buildPlan(input: {
  report: UnderstandingReport;
  cartography: Cartography;
  structure: FileStructure;
  dataset: ImportedDataset;
  preparation: PreparationState;
  variables: VariableMetadata[];
  instrument: InstrumentKind | null;
  mainQuestion: string;
}): AnalysisPlan {
  const { report, cartography, structure, dataset, preparation, variables, instrument } = input;
  const metaOf = (column: number) => variables.find((v) => v.column === column);
  const unitOf = (id: string | null) => (id ? structure.units.find((u) => u.id === id) : undefined);
  const question = input.mainQuestion.trim() || report.mainQuestion?.text || `Comprendre « ${report.variables.map((v) => v.name).slice(0, 2).join(" » et « ")} »`;
  const planVar = (conceptName: string, column: number, role: string): PlanVariable => {
    const meta = metaOf(column);
    return { name: conceptName, column, header: structure.columns.find((c) => c.column === column)?.label ?? String(column), typeLabel: meta ? statisticalTypeLabel(meta.effectiveType) : "inconnu", role };
  };
  // Diagnostic structuré (et non un simple seuil lexical) : voir alignment.ts.
  const framing = [report.mainQuestion?.text ?? input.mainQuestion, report.generalObjective ?? "", ...report.specificObjectives].filter((t) => t.trim());
  const alignmentOf = (concepts: Array<{ key: string; name: string; unitId: string | null }>, hypotheses: string[], method?: MethodId): PlanAlignment =>
    assessAlignment({
      concepts: concepts.map((c) => ({ conceptKey: c.key, name: c.name, unitId: c.unitId, role: cartography.concepts.find((x) => x.conceptKey === c.key)?.roleLabel ?? "" })),
      cartography,
      structure,
      variables,
      method,
      hypotheses,
      framing,
    });
  const hypothesesFor = (keys: string[]) => report.hypotheses.filter((h) => keys.every((k) => h.concepts.includes(k))).map((h) => h.text);
  const items: PlanItem[] = [];
  const qualitativeInstrument = instrument === "interview_guide";

  // A. Descriptif des variables clés.
  for (const concept of cartography.concepts.filter((c) => c.unitId)) {
    const unit = unitOf(concept.unitId)!;
    const columns = unit.primaryColumn !== null ? [unit.primaryColumn] : unit.columns;
    const meta = unit.primaryColumn !== null ? metaOf(unit.primaryColumn) : undefined;
    const unusable = meta && (meta.effectiveType === "free_text" || meta.effectiveType === "identifier" || meta.effectiveType === "temporal");
    items.push({
      id: `desc:${concept.conceptKey}`,
      level: "descriptive",
      tier: "descriptive",
      alignment: alignmentOf([{ key: concept.conceptKey, name: concept.name, unitId: concept.unitId }], []),
      priority: 1,
      title: `Décrire « ${concept.name} »`,
      researchQuestion: question,
      variables: columns.map((c) => planVar(concept.name, c, concept.roleLabel)),
      columns,
      why: `Avant toute relation, il faut connaître la répartition des réponses à la question « ${unit.text} », qui mesure « ${concept.name} ».`,
      conditions: ["Type de la variable confirmé.", "Non-réponses déclarées (elles sont exclues des pourcentages)."],
      limits: unit.kind === "multi_choice" ? ["Question à choix multiples : chaque option est décrite séparément (une personne peut cocher plusieurs options)."] : [],
      expected: unit.kind === "multi_choice" ? "Pour chaque option : nombre et pourcentage de personnes l'ayant cochée." : describeExpected(meta?.effectiveType ?? ""),
      hypotheses: [],
      feasible: !unusable,
      blocker: unusable ? `« ${unit.text} » est de type ${statisticalTypeLabel(meta!.effectiveType)} : une description statistique n'est pas adaptée.` : undefined,
      needsIndependence: false,
    });
  }

  // B. Relations entre concepts, à partir des relations envisagées par la recherche.
  if (!qualitativeInstrument) {
    const mapped = (key: string) => cartography.concepts.find((c) => c.conceptKey === key && c.unitId);
    const relations = report.relations.filter((r) => r.status !== "rejected");
    const pairs: Array<{ outcomeKey: string; explanatoryKey: string; directed: boolean }> = relations.map((r) => ({ outcomeKey: r.to, explanatoryKey: r.from, directed: r.directed }));
    // Sans relation formulée mais avec une variable dépendante et une explicative identifiées.
    if (!pairs.length) {
      const dep = cartography.concepts.find((c) => c.role === "dependent" && c.unitId);
      for (const exp of cartography.concepts.filter((c) => c.role === "explanatory" && c.unitId)) if (dep) pairs.push({ outcomeKey: dep.conceptKey, explanatoryKey: exp.conceptKey, directed: true });
    }
    for (const pair of pairs) {
      const outcome = mapped(pair.outcomeKey);
      const explanatory = mapped(pair.explanatoryKey);
      const outcomeName = report.variables.find((v) => v.key === pair.outcomeKey)?.name ?? pair.outcomeKey;
      const explanatoryName = report.variables.find((v) => v.key === pair.explanatoryKey)?.name ?? pair.explanatoryKey;
      const id = `rel:${pair.explanatoryKey}>${pair.outcomeKey}`;
      // Analyse principale : la première relation issue de la question (ou du sujet) ; les autres sont facultatives.
      const tier: PlanTier = items.some((i) => i.tier === "main") ? "secondary" : "main";
      const base = {
        id,
        level: "relation" as const,
        tier,
        alignment: alignmentOf(
          [
            { key: pair.outcomeKey, name: outcomeName, unitId: outcome?.unitId ?? null },
            { key: pair.explanatoryKey, name: explanatoryName, unitId: explanatory?.unitId ?? null },
          ],
          hypothesesFor([pair.explanatoryKey, pair.outcomeKey]),
        ),
        priority: (tier === "main" ? 1 : 2) as 1 | 2,
        title: `Relation entre « ${explanatoryName} » et « ${outcomeName} »`,
        researchQuestion: question,
        hypotheses: hypothesesFor([pair.explanatoryKey, pair.outcomeKey]),
        why: `C'est la relation que pose votre recherche : l'analyse examine si les données sont compatibles avec une association entre « ${explanatoryName} » et « ${outcomeName} ».`,
        needsIndependence: false,
      };
      const outUnit = unitOf(outcome?.unitId ?? null);
      const expUnit = unitOf(explanatory?.unitId ?? null);
      if (!outUnit || !expUnit || outUnit.primaryColumn === null || expUnit.primaryColumn === null) {
        const missing = [!outUnit ? outcomeName : null, !expUnit ? explanatoryName : null].filter(Boolean);
        items.push({
          ...base,
          variables: [],
          columns: [],
          conditions: [],
          limits: [],
          expected: "—",
          feasible: false,
          blocker: missing.length
            ? `Aucune question du fichier n'est reliée à ${missing.map((m) => `« ${m} »`).join(" et ")} : la relation ne peut pas être analysée.`
            : "Une des variables est une question à choix multiples : chaque option devrait être analysée comme une variable oui/non, ce que le plan automatique ne fait pas encore.",
        });
        continue;
      }
      const outMeta = metaOf(outUnit.primaryColumn);
      const expMeta = metaOf(expUnit.primaryColumn);
      if (!outMeta || !expMeta) continue;
      const variablesUsed = [planVar(outcomeName, outUnit.primaryColumn, pair.directed ? "à expliquer" : "variable 1"), planVar(explanatoryName, expUnit.primaryColumn, pair.directed ? "explicative" : "variable 2")];
      const selection = selectMethods(dataset, preparation, outMeta, expMeta);
      if (selection.refused || !selection.options.length) {
        items.push({ ...base, variables: variablesUsed, columns: [outUnit.primaryColumn, expUnit.primaryColumn], conditions: [], limits: [], expected: "—", feasible: false, blocker: selection.refused ?? "Aucune méthode disponible pour ces types de variables." });
        continue;
      }
      const recommended = selection.options.find((o) => o.recommended) ?? selection.options[0];
      items.push({
        ...base,
        alignment: alignmentOf(
          [
            { key: pair.outcomeKey, name: outcomeName, unitId: outcome?.unitId ?? null },
            { key: pair.explanatoryKey, name: explanatoryName, unitId: explanatory?.unitId ?? null },
          ],
          base.hypotheses,
          recommended.method,
        ),
        preview: recommended.method === "chi_square" || selection.options.some((o) => o.method === "chi_square") ? crossPreview(dataset, preparation, outMeta, expMeta, explanatoryName, outcomeName) : undefined,
        variables: variablesUsed,
        columns: [outUnit.primaryColumn, expUnit.primaryColumn],
        method: recommended.method,
        methodOptions: selection.options,
        outcomeColumn: outUnit.primaryColumn,
        explanatoryColumn: expUnit.primaryColumn,
        conditions: conditionsFor(recommended.method, dataset, preparation, outMeta, expMeta),
        limits: ["Une association statistique ne démontre pas une causalité.", ...selection.notes],
        expected: expectedFor(recommended.method),
        why: `${base.why} Méthode proposée : ${METHOD_LABELS[recommended.method]}. ${recommended.why}`,
        feasible: true,
        needsIndependence: selection.needsIndependence && recommended.method !== "pearson" && recommended.method !== "spearman",
      });
    }
  }

  // Description du contexte (profil des répondants) : utile, mais secondaire.
  const contextUnits = cartography.units.filter((u) => u.role === "context" && u.unit.primaryColumn !== null).slice(0, 6);
  if (contextUnits.length) {
    items.push({
      id: "desc:context",
      level: "descriptive",
      tier: "secondary",
      alignment: ALIGNED,
      priority: 3,
      title: "Décrire le profil des répondants (questions de contexte)",
      researchQuestion: question,
      variables: contextUnits.map((u) => planVar(u.unit.text, u.unit.primaryColumn!, "contexte")),
      columns: contextUnits.map((u) => u.unit.primaryColumn!),
      why: "Présenter l'échantillon (qui a répondu) : ces questions décrivent les répondants mais ne répondent pas directement à la question de recherche.",
      conditions: ["Types des variables confirmés."],
      limits: ["Ces descriptions ne testent aucune hypothèse."],
      expected: "Effectifs et pourcentages (ou moyennes) pour chaque question de contexte.",
      hypotheses: [],
      feasible: true,
      needsIndependence: false,
    });
  }

  const relationItems = items.filter((i) => i.level === "relation");
  const final: string[] = [];
  for (const h of report.hypotheses) {
    const item = relationItems.find((i) => i.hypotheses.includes(h.text));
    final.push(
      item?.feasible
        ? `Hypothèse « ${h.text} » : examinée par « ${item.title} » (${METHOD_LABELS[item.method!]}). Le test portera sur l'hypothèse nulle d'absence de relation ; selon la p-value, les conditions d'application et la taille d'effet, les données pourront soutenir ou non l'hypothèse — sans jamais la prouver.`
        : `Hypothèse « ${h.text} » : ${item?.blocker ?? "aucune analyse du plan ne porte sur ses concepts"}.`,
    );
  }
  if (!report.hypotheses.length && relationItems.some((i) => i.feasible)) final.push("Aucune hypothèse formulée : les tests indiqueront si une association est compatible avec les données, en réponse à la question de recherche.");
  if (!relationItems.length) final.push(qualitativeInstrument ? "Instrument qualitatif (guide d'entretien) : les tests statistiques ne sont pas adaptés ; l'analyse thématique n'est pas encore disponible dans ACADIA." : "Aucune relation entre concepts n'est formulée : le plan se limite à la description des variables.");
  final.push("La conclusion finale reliera chaque résultat à la question de recherche, en distinguant ce que les données montrent, ce qu'elles ne permettent pas d'établir et les limites du dispositif.");

  const missingForConclusion = [
    ...cartography.concepts.filter((c) => c.status === "missing" && report.variables.find((v) => v.key === c.conceptKey)?.group === "central").map((c) => `Aucune question n'est reliée au concept central « ${c.name} ».`),
    ...(report.missingEssential.some((m) => m.field === "population") ? ["La population étudiée n'est pas précisée : la portée des conclusions restera floue."] : []),
    ...(dataset.rowCount < 30 ? [`Seulement ${dataset.rowCount} observations : les tests auront peu de puissance et des effectifs attendus faibles.`] : []),
  ];

  return { items, final, missingForConclusion, unavailable: UNAVAILABLE_METHODS };
}

function conditionsFor(method: MethodId, dataset: ImportedDataset, preparation: PreparationState, outcome: VariableMetadata, explanatory: VariableMetadata): string[] {
  if (method === "chi_square") {
    const pair = pairObservations(dataset, preparation, { variable: outcome, encoding: "category" }, { variable: explanatory, encoding: "category" });
    const rows = [...new Set(pair.valuesB.map(String))];
    const cols = [...new Set(pair.valuesA.map(String))];
    const rowTotals = rows.map((r) => pair.valuesB.filter((v) => String(v) === r).length);
    const colTotals = cols.map((c) => pair.valuesA.filter((v) => String(v) === c).length);
    const expected = rowTotals.flatMap((r) => colTotals.map((c) => (r * c) / Math.max(1, pair.n)));
    const below5 = expected.filter((e) => e < 5).length;
    const list = [`${pair.n} observation(s) complète(s) ; tableau de ${rows.length} × ${cols.length} modalités.`, "Effectifs attendus : au plus 20 % des cases sous 5 et aucune sous 1 (règle de Cochran).", "Observations indépendantes (une ligne par répondant)."];
    if (below5 / Math.max(1, expected.length) > 0.2) {
      list.push(`Contrôle préalable : ${below5} case(s) sur ${expected.length} auraient un effectif attendu inférieur à 5. Le Chi² risque de ne pas être fiable ${rows.length === 2 && cols.length === 2 ? "(le test exact de Fisher sera alors fourni)" : "; regrouper des modalités peu fréquentes dans le fichier permettrait d'y remédier"}.`);
    }
    return list;
  }
  if (method === "welch_t" || method === "anova") return ["Groupes indépendants (chaque répondant dans un seul groupe).", "Au moins 2 observations par groupe ; idéalement 15 ou plus.", method === "anova" ? "Variances comparables entre groupes (test de Brown-Forsythe calculé)." : "Égalité des variances non requise (Welch)."];
  return ["Au moins 3 paires complètes ; idéalement 10 ou plus.", method === "pearson" ? "Relation à peu près linéaire, sans valeur extrême dominante." : "Relation monotone (Spearman, sur les rangs)."];
}

function expectedFor(method: MethodId): string {
  switch (method) {
    case "chi_square":
      return "Tableau croisé (effectifs, pourcentages, effectifs attendus), χ², degrés de liberté, p-value, V de Cramér.";
    case "welch_t":
      return "Moyennes par groupe, différence et son intervalle de confiance, t, degrés de liberté, p-value, g de Hedges.";
    case "anova":
      return "Moyennes par groupe, tableau d'ANOVA, F, p-value, η².";
    default:
      return "Coefficient de corrélation, intervalle de confiance, p-value.";
  }
}

/** Ordre effectif des analyses (ordre de l'utilisateur, puis ordre proposé). */
export function orderedItems(plan: AnalysisPlan, decisions: PlanDecisions): PlanItem[] {
  const index = (id: string) => {
    const i = decisions.order.indexOf(id);
    return i === -1 ? decisions.order.length + plan.items.findIndex((x) => x.id === id) : i;
  };
  return [...plan.items].sort((a, b) => index(a.id) - index(b.id));
}

export function itemStatus(item: PlanItem, decisions: PlanDecisions): "accepted" | "rejected" {
  return decisions.status[item.id] ?? (item.feasible && !(item.level === "relation" && item.tier === "secondary") ? "accepted" : "rejected");
}

/** Tableau croisé des effectifs (lignes : explicative ; colonnes : à expliquer), pour l'aperçu avant calcul. */
function crossPreview(dataset: ImportedDataset, preparation: PreparationState, outcome: VariableMetadata, explanatory: VariableMetadata, rowVariable: string, colVariable: string): CrossPreview {
  const pair = pairObservations(dataset, preparation, { variable: outcome, encoding: "category" }, { variable: explanatory, encoding: "category" });
  const rowLabels = [...new Set(pair.valuesB.map(String))].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  const colLabels = [...new Set(pair.valuesA.map(String))].sort((a, b) => a.localeCompare(b, "fr", { numeric: true }));
  const counts = rowLabels.map((r) => colLabels.map((c) => pair.valuesA.filter((v, i) => String(v) === c && String(pair.valuesB[i]) === r).length));
  return { rowVariable, colVariable, rowLabels, colLabels, counts, n: pair.n };
}

/** Choix par défaut d'un 2 × 2 (affiché comme tel, modifiable) : 1re ligne en référence, 1re colonne comme issue. */
export function defaultTwoByTwo(preview: CrossPreview): TwoByTwoChoice {
  return { rowReference: preview.rowLabels[0], outcomeEvent: preview.colLabels[0], direction: "comparison_vs_reference" };
}
