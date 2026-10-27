/**
 * Démarche économétrique complète, dans l'ordre où un économètre la mène :
 * 1. ordre d'intégration de chaque variable (ADF) ;
 * 2. estimation MCO du modèle spécifié ;
 * 3. si toutes les variables sont I(1) : cointégration (Engle-Granger) et, si elle est établie, modèle à
 *    correction d'erreur (court terme / long terme) ;
 * 4. causalité au sens de Granger sur les variables rendues stationnaires ;
 * 5. diagnostics des résidus et orientations (ce qu'il faut faire ensuite, et pourquoi).
 */
import { isNum, type Values } from "./series";
import { assemble, estimate, starsOf, type Assembled, type CoefficientRow, type Estimation, type ModelSpec } from "./model";
import { readiness, type Readiness } from "./readiness";
import { engleGranger, fitDesign, granger, integrationOrder, type CointegrationResult, type GrangerResult, type IntegrationOrder } from "./timeseries";
import type { MacroDataset } from "./types";

export interface Orientation {
  tone: "ok" | "warning" | "info";
  title: string;
  text: string;
  /** Action proposée à l'étudiant (re-spécifier le modèle). */
  action?: "estimer_en_differences";
}

export interface EcmResult {
  rows: CoefficientRow[];
  n: number;
  r2: number | null;
  /** Coefficient de la force de rappel (résidu retardé) : attendu négatif et significatif. */
  lambda: number;
  lambdaP: number | null;
  valid: boolean;
}

export interface CausalityTest {
  cause: string;
  effect: string;
  result: GrangerResult;
  onDifferences: boolean;
}

export interface EconometricAnalysis {
  data: Assembled | null;
  readiness: Readiness;
  orders: Array<{ name: string; order: IntegrationOrder }>;
  estimation: Estimation | null;
  cointegration: CointegrationResult | null;
  ecm: EcmResult | null;
  causality: CausalityTest[];
  orientations: Orientation[];
  issues: string[];
}

const pct = (p: number | null) => (p === null ? "p n.d." : p < 0.001 ? "p < 0,001" : `p = ${p.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}`);
const diffOf = (v: Values): Values => v.map((x, i) => (i > 0 && isNum(x) && isNum(v[i - 1]) ? x - (v[i - 1] as number) : null));

export function analyzeModel(dataset: MacroDataset, spec: ModelSpec): EconometricAnalysis {
  const data = assemble(dataset, spec);
  const params = spec.regressors.length + 1;
  const ready = readiness(data?.y.length ?? 0, params);
  const empty: EconometricAnalysis = { data, readiness: ready, orders: [], estimation: null, cointegration: null, ecm: null, causality: [], orientations: [], issues: data?.issues ?? [] };
  if (!data) return { ...empty, orientations: [{ tone: "info", title: "Modèle à spécifier", text: "Choisissez la variable expliquée et au moins une variable explicative." }] };
  if (ready.level === "bloque" || !ready.canEstimate) return { ...empty, orientations: ready.messages.map((text) => ({ tone: "warning" as const, title: "Données insuffisantes", text })) };

  // 1. Stationnarité des variables telles qu'elles entrent dans le modèle.
  const orders = ready.canTestStationarity
    ? [{ name: data.dependentName, order: integrationOrder(data.dependentSeries, data.dependentName) }, ...data.regressorSeries.map((s, j) => ({ name: data.regressorNames[j], order: integrationOrder(s, data.regressorNames[j]) }))]
    : [];

  // 2. Estimation.
  const estimation = estimate(data, spec.regressors);
  const orientations: Orientation[] = [];
  if (!estimation) return { ...empty, orders, orientations: [{ tone: "warning", title: "Estimation impossible", text: "Le modèle ne peut pas être estimé : deux variables explicatives sont parfaitement colinéaires ou une variable est constante sur la période. Retirez l'une d'elles." }] };

  // 3. Lecture de la stationnarité et cointégration.
  let cointegration: CointegrationResult | null = null;
  let ecm: EcmResult | null = null;
  const known = orders.filter((o) => o.order.order !== null);
  const allI0 = known.length === orders.length && orders.length > 0 && known.every((o) => o.order.order === 0);
  const allI1 = known.length === orders.length && orders.length > 0 && known.every((o) => o.order.order === 1);
  const anyI2 = known.some((o) => o.order.order === 2);
  const levels = spec.transform === "niveau" || spec.transform === "log";

  if (!ready.canTestStationarity) {
    orientations.push({ tone: "warning", title: "Stationnarité non testée", text: "Trop peu d'observations pour le test ADF : les tests t et F supposent des variables stationnaires ; présentez ces résultats comme indicatifs." });
  } else if (known.length < orders.length) {
    orientations.push({ tone: "info", title: "Stationnarité partiellement testée", text: "Le test ADF n'a pas pu être mené sur toutes les variables (série discontinue ou trop courte) : vérifiez vos séries." });
  } else if (allI0) {
    orientations.push({ tone: "ok", title: "Variables stationnaires", text: "Toutes les variables du modèle sont stationnaires (I(0)) : l'estimation par les MCO est valide du point de vue de la stationnarité, les tests t et F sont interprétables." });
  } else if (anyI2) {
    orientations.push({ tone: "warning", title: "Variable intégrée d'ordre 2", text: "Au moins une variable n'est pas stationnaire même en différence première : vérifiez la série (rupture, erreur de saisie) et traitez-la avec votre encadreur avant toute conclusion." });
  } else if (allI1 && levels) {
    cointegration = ready.canTestCointegration ? engleGranger(estimation.residuals, spec.regressors.length + 1) : { available: false, stat: null, critical: null, cointegrated: null, lags: 0, nobs: estimation.n, reason: "Trop peu d'observations pour tester la cointégration." };
    if (cointegration.cointegrated) {
      orientations.push({ tone: "ok", title: "Relation de long terme (cointégration)", text: `Les variables sont I(1) et cointégrées (Engle-Granger : statistique ${cointegration.stat?.toFixed(2)} < ${cointegration.critical?.p5.toFixed(2)} au seuil de 5 %) : l'équation estimée décrit une relation d'équilibre de long terme. La dynamique de court terme est donnée par le modèle à correction d'erreur.` });
      ecm = estimateEcm(data, estimation);
    } else {
      orientations.push({
        tone: "warning",
        title: "Risque de régression fallacieuse",
        text: cointegration.available
          ? `Les variables sont I(1) et ne sont pas cointégrées (statistique ${cointegration.stat?.toFixed(2)} ≥ ${cointegration.critical?.p5.toFixed(2)}) : la régression en niveau peut être fallacieuse (Granger et Newbold, 1974). Estimez le modèle en différences premières.`
          : `Les variables sont I(1) ; la cointégration n'a pas pu être testée (${cointegration.reason}) : par prudence, estimez le modèle en différences premières.`,
        action: "estimer_en_differences",
      });
    }
  } else if (levels) {
    orientations.push({ tone: "warning", title: "Ordres d'intégration différents", text: "Le modèle mélange des variables stationnaires et non stationnaires : l'approche ARDL (test des bornes de Pesaran, Shin et Smith, 2001) est indiquée ; à défaut, travaillez en différences premières.", action: "estimer_en_differences" });
  } else {
    orientations.push({ tone: "info", title: "Variables transformées", text: "Le modèle est estimé sur des variations : vérifiez dans le tableau de stationnarité que chaque variable transformée est bien stationnaire." });
  }

  // 4. Diagnostics des résidus.
  if (estimation.bg.pValue !== null && estimation.bg.pValue < 0.05) orientations.push({ tone: "warning", title: "Autocorrélation des erreurs", text: `Breusch-Godfrey : ${pct(estimation.bg.pValue)}, sous le seuil de 0,05. Les erreurs sont autocorrélées : les écarts-types sont biaisés. Ajoutez une dynamique (variable expliquée retardée) ou corrigez les écarts-types (Newey-West) avec votre encadreur.` });
  if (estimation.bp.pValue !== null && estimation.bp.pValue < 0.05) orientations.push({ tone: "warning", title: "Hétéroscédasticité", text: `Breusch-Pagan : ${pct(estimation.bp.pValue)}, sous le seuil de 0,05. La variance des erreurs n'est pas constante : les tests t sont moins fiables (écarts-types robustes de White conseillés).` });
  if (estimation.jb.pValue !== null && estimation.jb.pValue < 0.05) orientations.push({ tone: "info", title: "Non-normalité des résidus", text: `Jarque-Bera : ${pct(estimation.jb.pValue)}, sous le seuil de 0,05. Sur un petit échantillon, les tests t et F deviennent approximatifs : signalez-le.` });
  const highVif = estimation.vif.filter((v) => v.value !== null && v.value > 10);
  if (highVif.length) orientations.push({ tone: "warning", title: "Multicolinéarité", text: `VIF supérieur à 10 pour ${highVif.map((v) => v.name).join(", ")} : les effets individuels sont mal séparés ; envisagez de retirer une variable.` });
  if (estimation.r2 !== null && estimation.dw !== null && estimation.r2 > estimation.dw && levels && !allI0) orientations.push({ tone: "warning", title: "R² supérieur au Durbin-Watson", text: `R² = ${estimation.r2.toFixed(2)} > DW = ${estimation.dw.toFixed(2)} : selon la règle de Granger et Newbold, c'est le signe d'une possible régression fallacieuse.` });
  if (estimation.fP !== null && estimation.fP >= 0.05) orientations.push({ tone: "info", title: "Modèle globalement non significatif", text: `Test de Fisher : ${pct(estimation.fP)}, au-dessus du seuil de 0,05 : les variables explicatives, prises ensemble, n'expliquent pas significativement la variable expliquée.` });
  if (!orientations.some((o) => o.tone === "warning")) orientations.push({ tone: "ok", title: "Diagnostics satisfaisants", text: "Aucun problème majeur détecté dans les résidus (autocorrélation, hétéroscédasticité, multicolinéarité) aux seuils usuels." });

  // 5. Causalité au sens de Granger (variables stationnaires : différences si I(1)).
  const causality: CausalityTest[] = [];
  if (ready.canTestGranger) {
    const depOrder = orders[0]?.order.order;
    const yS = depOrder === 1 ? diffOf(data.dependentSeries) : data.dependentSeries;
    data.regressorSeries.forEach((x, j) => {
      const xOrder = orders[j + 1]?.order.order;
      const onDifferences = depOrder === 1 || xOrder === 1;
      const xs = onDifferences && xOrder === 1 ? diffOf(x) : x;
      const ys = onDifferences && depOrder === 1 ? yS : data.dependentSeries;
      causality.push({ cause: data.regressorNames[j], effect: data.dependentName, result: granger(ys, xs, 1), onDifferences });
    });
  }

  return { data, readiness: ready, orders, estimation, cointegration, ecm, causality, orientations: [...ready.messages.map((text) => ({ tone: "info" as const, title: "Taille de l'échantillon", text })), ...orientations], issues: data.issues };
}

/** Modèle à correction d'erreur (2e étape d'Engle-Granger) : ΔY_t = c + Σ b·ΔX_t + λ·ε_{t−1} + u_t. */
function estimateEcm(data: Assembled, longRun: Estimation): EcmResult | null {
  const resid = new Map<number, number>();
  longRun.periodIndexes.forEach((p, i) => resid.set(p, longRun.residuals[i]));
  const rows: number[][] = [];
  const target: number[] = [];
  const dy = diffOf(data.dependentSeries);
  const dxs = data.regressorSeries.map(diffOf);
  for (let t = 1; t < data.dependentSeries.length; t += 1) {
    const e = resid.get(t - 1);
    if (!isNum(dy[t]) || e === undefined || !dxs.every((d) => isNum(d[t]))) continue;
    rows.push([1, ...dxs.map((d) => d[t] as number), e]);
    target.push(dy[t] as number);
  }
  const fit = fitDesign(rows, target);
  if (!fit) return null;
  const names = ["Constante", ...data.regressorNames.map((n) => `Δ ${n}`), "Force de rappel ε(t−1)"];
  const out: CoefficientRow[] = fit.beta.map((beta, i) => ({ name: names[i], ref: null, beta, se: fit.se[i], t: fit.t[i], p: fit.p[i], ci: null, stars: starsOf(fit.p[i]) }));
  const lambda = fit.beta[fit.beta.length - 1];
  const lambdaP = fit.p[fit.p.length - 1];
  return { rows: out, n: fit.n, r2: fit.r2, lambda, lambdaP, valid: lambda < 0 && lambda > -2 && lambdaP !== null && lambdaP < 0.05 };
}
