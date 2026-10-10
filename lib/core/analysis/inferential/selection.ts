/**
 * Sélection des méthodes : relie les types confirmés des variables, la structure des données
 * et les caractéristiques observées (nombre de groupes, valeurs extrêmes) aux tests disponibles.
 * Plusieurs options peuvent être proposées ; une seule est recommandée, avec sa justification.
 */
import { confirmedStructure } from "@/lib/core/data/preparation";
import type { ImportedDataset, PreparationState, StatisticalType, VariableMetadata } from "@/lib/core/data/types";

import { categoriesOf, headerOf, ordinalOrder, pairObservations, type Encoding } from "./data";

export type MethodId = "chi_square" | "welch_t" | "anova" | "pearson" | "spearman";

export const METHOD_LABELS: Record<MethodId, string> = {
  chi_square: "Tableau croisé et test du Chi² d'indépendance",
  welch_t: "Test t de Welch (deux groupes indépendants)",
  anova: "ANOVA à un facteur (trois groupes ou plus)",
  pearson: "Corrélation de Pearson",
  spearman: "Corrélation de Spearman (rangs)",
};

export interface MethodOption {
  method: MethodId;
  recommended: boolean;
  why: string;
  /** Différence avec les autres options proposées. */
  difference?: string;
  encodings: { outcome: Encoding; explanatory: Encoding };
}

export interface MethodSelection {
  outcome: VariableMetadata;
  explanatory: VariableMetadata;
  options: MethodOption[];
  refused: string | null;
  notes: string[];
  /** Les tests de groupes exigent que l'utilisateur confirme l'indépendance des observations. */
  needsIndependence: boolean;
}

const QUANT: StatisticalType[] = ["quantitative_discrete", "quantitative_continuous"];
const CATEGORICAL: StatisticalType[] = ["nominal", "ordinal"];

const UNUSABLE: Partial<Record<StatisticalType, string>> = {
  identifier: "est un identifiant : ce n'est pas une mesure, il ne peut pas servir de variable d'analyse.",
  free_text: "est un texte libre : il relève de l'analyse qualitative, pas d'un test statistique.",
  temporal: "est une date : les analyses temporelles ne sont pas encore disponibles.",
  to_confirm: "a un type à confirmer : confirmez-le dans l'onglet Variables.",
  unclassified: "est vide ou non classée.",
};

function extremeCount(values: number[]): number {
  if (values.length < 4) return 0;
  const sorted = [...values].sort((x, y) => x - y);
  const q = (p: number) => {
    const h = (sorted.length - 1) * p;
    const lo = Math.floor(h);
    return sorted[lo] + (h - lo) * ((sorted[Math.min(lo + 1, sorted.length - 1)] ?? sorted[lo]) - sorted[lo]);
  };
  const iqr = q(0.75) - q(0.25);
  return values.filter((v) => v < q(0.25) - 3 * iqr || v > q(0.75) + 3 * iqr).length;
}

export function selectMethods(dataset: ImportedDataset, preparation: PreparationState, outcome: VariableMetadata, explanatory: VariableMetadata): MethodSelection {
  const result: MethodSelection = { outcome, explanatory, options: [], refused: null, notes: [], needsIndependence: false };
  const refuse = (reason: string) => ({ ...result, refused: reason });

  if (outcome.column === explanatory.column) return refuse("Choisissez deux variables différentes.");
  for (const variable of [outcome, explanatory]) {
    const reason = UNUSABLE[variable.effectiveType];
    if (reason) return refuse(`« ${headerOf(variable)} » ${reason}`);
    if (!variable.analysisReady) return refuse(`« ${headerOf(variable)} » : son type n'est pas confirmé. Confirmez-le dans l'onglet Variables.`);
  }
  const structure = confirmedStructure(preparation);
  if (structure === "panel" || structure === "time_series") {
    return refuse("Vous avez confirmé une structure de panel ou de série temporelle : les mêmes unités sont observées plusieurs fois, les observations ne sont donc pas indépendantes. Les tests disponibles supposent des observations indépendantes ; les méthodes pour mesures répétées ne sont pas encore disponibles.");
  }

  const yQuant = QUANT.includes(outcome.effectiveType);
  const xQuant = QUANT.includes(explanatory.effectiveType);
  const yCat = CATEGORICAL.includes(outcome.effectiveType);
  const xCat = CATEGORICAL.includes(explanatory.effectiveType);
  const yOrd = outcome.effectiveType === "ordinal";
  const xOrd = explanatory.effectiveType === "ordinal";
  const orderKnown = (variable: VariableMetadata) => variable.effectiveType !== "ordinal" || ordinalOrder(dataset, preparation, variable) !== null;

  // --- Deux variables qualitatives -----------------------------------
  if (yCat && xCat) {
    const pair = pairObservations(dataset, preparation, { variable: outcome, encoding: "category" }, { variable: explanatory, encoding: "category" });
    const kY = categoriesOf(pair.valuesA).length;
    const kX = categoriesOf(pair.valuesB).length;
    if (kY < 2 || kX < 2) return refuse(`Une des variables n'a qu'une seule modalité observée parmi les ${pair.n} observations complètes : aucune association n'est mesurable.`);
    const bothOrdered = yOrd && xOrd && orderKnown(outcome) && orderKnown(explanatory);
    result.options.push({
      method: "chi_square",
      recommended: !bothOrdered,
      why: `Deux variables qualitatives (${kY} × ${kX} modalités) : le tableau croisé décrit leur répartition conjointe et le test du Chi² examine si elles sont indépendantes.`,
      difference: bothOrdered ? "Le Chi² ignore l'ordre des modalités : il détecte toute forme d'association, pas seulement une tendance croissante ou décroissante." : undefined,
      encodings: { outcome: "category", explanatory: "category" },
    });
    if (bothOrdered) {
      result.options.unshift({
        method: "spearman",
        recommended: true,
        why: "Deux variables ordinales dont l'ordre des modalités est connu : Spearman utilise cet ordre pour mesurer une tendance monotone (plus l'une est élevée, plus l'autre l'est — ou l'inverse).",
        difference: "Spearman résume l'association en un coefficient de tendance ; le Chi² détecte aussi des associations non monotones mais n'indique pas de sens.",
        encodings: { outcome: "rank", explanatory: "rank" },
      });
    }
    result.needsIndependence = true;
    return result;
  }

  // --- Deux variables quantitatives ----------------------------------
  if (yQuant && xQuant) {
    const pair = pairObservations(dataset, preparation, { variable: outcome, encoding: "number" }, { variable: explanatory, encoding: "number" });
    const extremes = extremeCount(pair.valuesA as number[]) + extremeCount(pair.valuesB as number[]);
    const preferSpearman = extremes > 0 || pair.n < 10;
    result.options.push(
      {
        method: "pearson",
        recommended: !preferSpearman,
        why: "Deux variables quantitatives : Pearson mesure l'intensité d'une association linéaire.",
        difference: "Pearson utilise les valeurs elles-mêmes : il est sensible aux valeurs extrêmes et ne capte que la part linéaire de la relation.",
        encodings: { outcome: "number", explanatory: "number" },
      },
      {
        method: "spearman",
        recommended: preferSpearman,
        why: preferSpearman
          ? `Recommandé ici car ${extremes > 0 ? `${extremes} valeur(s) très éloignée(s) ont été détectée(s)` : `seules ${pair.n} observations sont disponibles`} : Spearman, fondé sur les rangs, est moins sensible à ces situations.`
          : "Alternative fondée sur les rangs : mesure une association monotone, même non linéaire, et résiste mieux aux valeurs extrêmes.",
        difference: "Spearman travaille sur les rangs : il mesure une tendance monotone, sans supposer de relation linéaire.",
        encodings: { outcome: "rank", explanatory: "rank" },
      },
    );
    result.notes.push("Une corrélation est symétrique : la distinction entre variable à expliquer et variable explicative n'intervient pas dans le calcul.");
    return result;
  }

  // --- Une quantitative et une qualitative ---------------------------
  const quantitative = yQuant ? outcome : explanatory;
  const grouping = yQuant ? explanatory : outcome;
  if (!yQuant && !xQuant) return refuse("Combinaison de types non prise en charge.");
  if (!yQuant) {
    result.notes.push(`La variable à expliquer (« ${headerOf(outcome)} ») est qualitative et l'explicative quantitative : comparer « ${headerOf(explanatory)} » entre les modalités examine bien leur association, mais ne modélise pas la probabilité d'appartenir à une modalité (régression logistique, non disponible).`);
  }
  const pair = pairObservations(dataset, preparation, { variable: quantitative, encoding: "number" }, { variable: grouping, encoding: "category" });
  const groups = categoriesOf(pair.valuesB);
  const counts = groups.map((g) => pair.valuesB.filter((v) => String(v) === g).length);
  const k = groups.length;
  if (k < 2) return refuse(`« ${headerOf(grouping)} » n'a qu'une seule modalité parmi les observations complètes : aucune comparaison de groupes n'est possible.`);
  result.needsIndependence = true;
  const encodings = { outcome: (yQuant ? "number" : "category") as Encoding, explanatory: (yQuant ? "category" : "number") as Encoding };
  if (k === 2) {
    result.options.push({
      method: "welch_t",
      recommended: true,
      why: `Une variable quantitative (« ${headerOf(quantitative)} ») comparée entre deux groupes (${groups.map((g, i) => `« ${g} » : ${counts[i]}`).join(", ")}) : le test t de Welch compare les deux moyennes sans supposer des variances égales.`,
      encodings,
    });
  } else {
    result.options.push({
      method: "anova",
      recommended: true,
      why: `Une variable quantitative (« ${headerOf(quantitative)} ») comparée entre ${k} groupes : l'ANOVA à un facteur teste si toutes les moyennes sont égales. Répéter des tests t entre paires gonflerait le risque de faux positifs.`,
      difference: "L'ANOVA donne un résultat global : elle n'indique pas quels groupes diffèrent (comparaisons post-hoc non encore disponibles).",
      encodings,
    });
    if (k > 10) result.notes.push(`${k} groupes : un résultat global sur autant de modalités est difficile à interpréter ; envisagez de regrouper des modalités.`);
    const single = groups.filter((_, i) => counts[i] < 2);
    if (single.length) result.notes.push(`Modalité(s) avec moins de 2 observations (${single.map((g) => `« ${g} »`).join(", ")}) : le calcul sera refusé tant qu'elles ne sont pas regroupées ou exclues.`);
  }
  if (grouping.effectiveType === "ordinal" && orderKnown(grouping)) {
    result.options.push({
      method: "spearman",
      recommended: false,
      why: `« ${headerOf(grouping)} » est ordinale : Spearman peut aussi mesurer une tendance monotone entre ses modalités ordonnées et « ${headerOf(quantitative)} ».`,
      difference: `La comparaison de moyennes traite les modalités comme des groupes sans ordre ; Spearman exploite l'ordre et résume la relation en une tendance.`,
      encodings: { outcome: yQuant ? "number" : "rank", explanatory: yQuant ? "rank" : "number" },
    });
  }
  return result;
}
