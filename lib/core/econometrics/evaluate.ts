/**
 * Des hypothèses aux modèles, puis aux verdicts.
 * - Chaque hypothèse relie une variable explicative à une variable expliquée, avec un signe attendu.
 * - Les hypothèses qui partagent la même variable expliquée forment un même modèle (une équation),
 *   complété par les variables de contrôle choisies par l'étudiant.
 * - Le verdict combine le signe et la significativité du coefficient, puis tient compte de la validité
 *   économétrique (stationnarité, cointégration, autocorrélation, taille de l'échantillon). On ne dit
 *   jamais « prouvée » ; une association n'est pas une causalité.
 */
import { CHAIN_VERDICT_LABELS, type ChainVerdict } from "@/lib/core/chain";
import { hashKey } from "@/lib/core/understanding/text";

import type { EconometricAnalysis } from "./analysis";
import { coefficientReading, lowerFirst, refKey, resolveVariable, transformedName, type CoefficientRow, type ModelSpec } from "./model";
import { INDICATIVE_BELOW } from "./readiness";
import type { MacroLink, Theory } from "./research";
import type { MacroDataset, Transform, VariableRef } from "./types";

export interface HypothesisMapping {
  dependent: VariableRef | null;
  independent: VariableRef | null;
  sign: 1 | -1 | null;
}
export type Mappings = Record<string, HypothesisMapping>;

export interface ModelSettings {
  transform: Transform;
  controls: VariableRef[];
}
export type ModelSettingsMap = Record<string, ModelSettings>;

export interface ModelGroup {
  key: string;
  label: string;
  spec: ModelSpec;
  rowIds: string[];
}

const sameRef = (a: VariableRef | null, b: VariableRef | null) => !!a && !!b && a.kind === b.kind && a.id === b.id;

/** Modèles à estimer : un par variable expliquée (au plus 3). */
export function buildModels(dataset: MacroDataset, links: MacroLink[], mappings: Mappings, settings: ModelSettingsMap): ModelGroup[] {
  const groups = new Map<string, ModelGroup>();
  for (const link of links) {
    const m = mappings[link.rowId];
    if (!m?.dependent || !m.independent || sameRef(m.dependent, m.independent)) continue;
    const key = refKey(m.dependent);
    const group = groups.get(key) ?? { key, label: "", spec: { dependent: m.dependent, regressors: [], transform: settings[key]?.transform ?? "niveau" }, rowIds: [] };
    if (!group.spec.regressors.some((r) => sameRef(r, m.independent))) group.spec.regressors.push(m.independent);
    group.rowIds.push(link.rowId);
    groups.set(key, group);
  }
  const out = [...groups.values()].slice(0, 3);
  out.forEach((g, i) => {
    for (const c of settings[g.key]?.controls ?? []) if (!sameRef(c, g.spec.dependent) && !g.spec.regressors.some((r) => sameRef(r, c))) g.spec.regressors.push(c);
    const dep = g.spec.dependent ? resolveVariable(dataset, g.spec.dependent) : null;
    g.label = `Modèle ${i + 1} : ${dep ? transformedName(dep.label, g.spec.transform) : "?"}`;
  });
  return out;
}

export const modelsKey = (models: ModelGroup[]) => hashKey(models.map((m) => [m.key, m.spec.transform, m.spec.regressors.map(refKey)]));

export interface HypothesisResult {
  rowId: string;
  index: number;
  statement: string;
  hypothesis: string | null;
  modelLabel: string | null;
  dependentName: string | null;
  independentName: string | null;
  expectedSign: 1 | -1 | null;
  theory: Theory | null;
  coefficient: CoefficientRow | null;
  verdict: ChainVerdict;
  verdictLabel: string;
  /** Ce qui rapproche de l'hypothèse. */
  supports: string[];
  /** Ce qui en éloigne ou limite la conclusion. */
  limits: string[];
  /** Lecture économétrique du coefficient. */
  reading: string | null;
  /** Lecture de court terme (modèle à correction d'erreur), si établi. */
  shortRun: string | null;
}

const p3 = (p: number | null) => (p === null ? "n.d." : p < 0.001 ? "p < 0,001" : `p = ${p.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}`);
const num = (v: number, d = 3) => v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const signWord = (s: 1 | -1 | null) => (s === 1 ? "positif" : s === -1 ? "négatif" : "non précisé");

const DOWNGRADE: Record<ChainVerdict, ChainVerdict> = { supported: "partially_supported", partially_supported: "partially_supported", not_supported: "not_supported", contrary: "contrary", inconclusive: "inconclusive", not_examined: "not_examined" };

export function evaluateHypotheses(dataset: MacroDataset, links: MacroLink[], mappings: Mappings, models: ModelGroup[], analyses: Record<string, EconometricAnalysis>): HypothesisResult[] {
  return links
    .filter((l) => l.hypothesis)
    .map((link) => {
      const m = mappings[link.rowId];
      const model = models.find((g) => g.rowIds.includes(link.rowId)) ?? null;
      const analysis = model ? analyses[model.key] : undefined;
      const dep = m?.dependent ? resolveVariable(dataset, m.dependent) : null;
      const ind = m?.independent ? resolveVariable(dataset, m.independent) : null;
      const transform = model?.spec.transform ?? "niveau";
      const base = {
        rowId: link.rowId,
        index: link.index,
        statement: link.statement,
        hypothesis: link.hypothesis,
        modelLabel: model?.label ?? null,
        dependentName: dep ? transformedName(dep.label, transform) : null,
        independentName: ind ? transformedName(ind.label, transform) : null,
        expectedSign: m?.sign ?? link.expectedSign,
        theory: link.theory,
        coefficient: null as CoefficientRow | null,
        supports: [] as string[],
        limits: [] as string[],
        reading: null as string | null,
        shortRun: null as string | null,
      };
      const done = (verdict: ChainVerdict, extra: Partial<typeof base> = {}): HypothesisResult => ({ ...base, ...extra, verdict, verdictLabel: CHAIN_VERDICT_LABELS[verdict] });
      if (!m?.dependent || !m.independent || !model) return done("not_examined", { limits: ["Associez une variable expliquée et une variable explicative à cette hypothèse."] });
      if (!analysis?.estimation) return done("inconclusive", { limits: analysis?.orientations.filter((o) => o.tone === "warning").map((o) => o.text) ?? ["Le modèle n'a pas pu être estimé."] });
      const est = analysis.estimation;
      const row = est.rows.find((r) => sameRef(r.ref, m.independent)) ?? null;
      if (!row) return done("not_examined", { limits: ["La variable explicative n'entre pas dans le modèle estimé."] });
      const s = base.expectedSign;
      const observed: 1 | -1 = row.beta >= 0 ? 1 : -1;
      const matches = s === null || observed === s;
      const supports: string[] = [];
      const limits: string[] = [];
      let verdict: ChainVerdict;
      if (row.p !== null && row.p < 0.05) verdict = matches ? "supported" : "contrary";
      else if (row.p !== null && row.p < 0.1 && matches) verdict = "partially_supported";
      else verdict = "not_supported";
      const coefText = `Coefficient de ${row.name} : ${row.beta >= 0 ? "+" : "−"}${num(Math.abs(row.beta))} (${p3(row.p)})`;
      if (verdict === "supported") supports.push(`${coefText}, significatif au seuil de 5 % et de signe ${signWord(observed)}${s === null ? "" : ", conforme au signe attendu"}.`);
      else if (verdict === "partially_supported") supports.push(`${coefText} : de signe ${signWord(observed)} conforme, mais significatif seulement au seuil de 10 %.`);
      else if (verdict === "contrary") limits.push(`${coefText} : significatif mais de signe ${signWord(observed)}, contraire au signe attendu (${signWord(s)}).`);
      else limits.push(`${coefText} : non significatif au seuil de 10 % ; les données ne permettent pas d'établir l'effet attendu.`);
      if (link.theory && verdict === "supported") supports.push(`Résultat compatible avec : ${link.theory.name} (${link.theory.references}).`);
      if (est.r2 !== null) (est.r2 >= 0.5 ? supports : limits).push(`Le modèle explique ${num(est.r2 * 100, 1)} % de la variance de ${est.dependentName} (R²).`);

      // Validité économétrique.
      const titles = new Set(analysis.orientations.map((o) => o.title));
      if (titles.has("Risque de régression fallacieuse") && (verdict === "supported" || verdict === "partially_supported")) {
        verdict = "inconclusive";
        limits.push("Les variables sont non stationnaires et non cointégrées : la relation estimée en niveau peut être fallacieuse ; ré-estimez le modèle en différences premières.");
      }
      if (titles.has("Ordres d'intégration différents") || titles.has("Variable intégrée d'ordre 2")) {
        verdict = DOWNGRADE[verdict];
        limits.push("Les variables n'ont pas le même ordre d'intégration : le résultat doit être confirmé par une méthode adaptée (ARDL ou différences).");
      }
      if (titles.has("Autocorrélation des erreurs") || titles.has("Hétéroscédasticité")) {
        verdict = DOWNGRADE[verdict];
        limits.push("Les erreurs ne vérifient pas toutes les hypothèses des MCO (autocorrélation ou hétéroscédasticité) : la significativité est à confirmer avec des écarts-types corrigés.");
      }
      if (est.n < INDICATIVE_BELOW) {
        verdict = DOWNGRADE[verdict];
        limits.push(`Seulement ${est.n} observations : résultat indicatif.`);
      }
      if (analysis.cointegration?.cointegrated) supports.push("Les variables sont cointégrées : le coefficient décrit une relation d'équilibre de long terme.");
      const causal = analysis.causality.find((c) => c.cause === row.name);
      if (causal?.result.pValue !== null && causal?.result.pValue !== undefined) {
        (causal.result.pValue < 0.05 ? supports : limits).push(`Causalité au sens de Granger de ${causal.cause} vers ${causal.effect} : ${p3(causal.result.pValue)}${causal.result.pValue < 0.05 ? " (les valeurs passées améliorent la prévision ; précédence temporelle, pas une preuve de causalité)" : " (pas de précédence temporelle établie)"}.`);
      }
      const depV = resolveVariable(dataset, m.dependent);
      const indV = resolveVariable(dataset, m.independent);
      const reading = depV && indV ? coefficientReading(row, lowerFirst(depV.label), lowerFirst(indV.label), transform, depV.unit, indV.unit) : null;
      let shortRun: string | null = null;
      if (analysis.ecm) {
        const sr = analysis.ecm.rows.find((r) => r.name === `Δ ${row.name}`);
        if (sr) shortRun = `À court terme (modèle à correction d'erreur), le coefficient de Δ ${row.name} vaut ${sr.beta >= 0 ? "+" : "−"}${num(Math.abs(sr.beta))} (${p3(sr.p)}) ; la force de rappel vaut ${num(analysis.ecm.lambda)} (${p3(analysis.ecm.lambdaP)})${analysis.ecm.valid ? `, soit environ ${num(Math.abs(analysis.ecm.lambda) * 100, 0)} % d'un écart à l'équilibre corrigé à chaque période` : ", sans mécanisme de correction significatif"}.`;
      }
      return done(verdict, { coefficient: row, supports, limits, reading, shortRun });
    });
}
