/**
 * Plan du chapitre de résultats, section par section, avec pour chacune ce qu'elle démontre, ce qu'il faut
 * y présenter et des paragraphes rédigés à partir des chiffres calculés (jamais inventés). L'étudiant
 * relit, complète et reformule ; les tournures restent prudentes (« est associé à », « compatible avec »).
 */
import { AGGREGATE_BY_ID, computeAggregates } from "./aggregates";
import type { EconometricAnalysis } from "./analysis";
import type { HypothesisResult, ModelGroup } from "./evaluate";
import { availableVariables, refKey, specLabel, transformedName } from "./model";
import { describe, trendWord } from "./series";
import { DETERMINISTIC_LABELS } from "./timeseries";
import { FREQUENCY_LABELS, type MacroDataset } from "./types";

export interface ChapterSection {
  id: string;
  title: string;
  /** Ce que la section démontre. */
  purpose: string;
  /** Ce qu'il faut présenter (tableaux, graphiques, tests). */
  contents: string[];
  /** Paragraphes rédigés à partir des résultats. */
  paragraphs: string[];
}

const num = (v: number | null, d = 2) => (v === null ? "n.d." : v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d }));
const pv = (p: number | null) => (p === null ? "n.d." : p < 0.001 ? "p < 0,001" : `p = ${p.toLocaleString("fr-FR", { maximumFractionDigits: 3 })}`);

/** Variables à mettre en avant : celles des modèles d'abord, puis quelques agrégats clés. */
export function keyVariables(dataset: MacroDataset, models: ModelGroup[]) {
  const all = availableVariables(dataset);
  const used = new Set(models.flatMap((m) => [m.spec.dependent, ...m.spec.regressors].filter(Boolean).map((r) => refKey(r!))));
  const inModels = all.filter((v) => used.has(refKey(v.ref)));
  const others = all.filter((v) => !used.has(refKey(v.ref)) && v.ref.kind === "aggregate").slice(0, Math.max(0, 6 - inModels.length));
  return [...inModels, ...others];
}

export function buildChapter(dataset: MacroDataset, models: ModelGroup[], analyses: Record<string, EconometricAnalysis>, results: HypothesisResult[]): ChapterSection[] {
  const n = dataset.periods.length;
  const first = dataset.periods[0] ?? "?";
  const last = dataset.periods[n - 1] ?? "?";
  const keys = keyVariables(dataset, models);
  const sections: ChapterSection[] = [];

  // Section 1 — Présentation des données.
  const describeParas = keys.map((v) => {
    const s = describe(v.values);
    if (!s.n) return `${v.label} : aucune valeur disponible.`;
    const minP = s.minIndex !== null ? dataset.periods[s.minIndex] : "?";
    const maxP = s.maxIndex !== null ? dataset.periods[s.maxIndex] : "?";
    const trend = trendWord(s);
    return `${v.label} : en moyenne ${num(s.mean)} ${v.unit} sur la période (écart-type ${num(s.sd)}), avec un minimum de ${num(s.min)} en ${minP} et un maximum de ${num(s.max)} en ${maxP}${trend ? ` ; tendance d'ensemble à la ${trend}` : ""}${s.tcam !== null && v.ref.kind === "series" ? `, soit un taux de croissance annuel moyen de ${num(s.tcam)} %` : ""}.`;
  });
  sections.push({
    id: "donnees",
    title: "Section 1. Présentation des données",
    purpose: "Situer le lecteur : d'où viennent les données, sur quelle période, et comment ont évolué les principales variables avant toute estimation.",
    contents: ["Sources, période et fréquence des données", "Tableau des données de départ", "Statistiques descriptives (moyenne, écart-type, minimum, maximum, croissance moyenne)", "Graphiques d'évolution des variables du modèle", "Agrégats macroéconomiques clés et leur lecture"],
    paragraphs: [
      `Économie étudiée : ${dataset.economy || "à préciser"}. Les données couvrent la période ${first}-${last}, soit ${n} observations ${FREQUENCY_LABELS[dataset.frequency].toLowerCase()}s. Source : ${dataset.source || "à préciser"}.${dataset.fictitious ? " Ces données sont FICTIVES (démonstration)." : ""}`,
      ...describeParas,
      ...computeAggregates(dataset)
        .filter((a) => keys.some((k) => k.ref.kind === "aggregate" && k.ref.id === a.def.id))
        .map((a) => `${a.def.label} (${a.def.formula}) : ${a.def.reading}`),
    ],
  });

  // Section 2 — Stationnarité.
  const orderParas = models.flatMap((m) => analyses[m.key]?.orders.map((o) => o.order.summary) ?? []);
  const anyOrder = models.flatMap((m) => analyses[m.key]?.orders ?? [])[0];
  sections.push({
    id: "stationnarite",
    title: "Section 2. Étude de la stationnarité des séries",
    purpose: "Vérifier que les variables ont une moyenne et une variance stables dans le temps : sans cela, une régression peut faire apparaître une relation qui n'existe pas (régression fallacieuse).",
    contents: ["Rappel du test de Dickey-Fuller augmenté (ADF) et de ses hypothèses (H0 : racine unitaire)", "Tableau : statistique ADF, valeurs critiques à 1 %, 5 % et 10 %, décision, ordre d'intégration", "Conclusion sur l'ordre d'intégration de chaque variable"],
    paragraphs: orderParas.length
      ? [
          `Le test de Dickey-Fuller augmenté (ADF) a été appliqué à chaque variable du modèle, ${anyOrder ? `${DETERMINISTIC_LABELS.c} puis ${DETERMINISTIC_LABELS.ct}` : ""}, le nombre de retards étant choisi par le critère d'information d'Akaike. L'hypothèse nulle est la présence d'une racine unitaire (série non stationnaire) ; elle est rejetée lorsque la statistique ADF est inférieure à la valeur critique de MacKinnon au seuil de 5 %.`,
          ...orderParas,
        ]
      : ["Le test de stationnarité n'a pas pu être réalisé (trop peu d'observations) : signalez-le comme une limite de l'étude."],
  });

  // Section 3 — Spécification et estimation ; Section 4 — Validation.
  const estimParas: string[] = [];
  const validParas: string[] = [];
  for (const m of models) {
    const a = analyses[m.key];
    const est = a?.estimation;
    const all = availableVariables(dataset);
    const dep = all.find((v) => m.spec.dependent && refKey(v.ref) === refKey(m.spec.dependent));
    const regs = m.spec.regressors.map((r) => all.find((v) => refKey(v.ref) === refKey(r))).filter(Boolean);
    const theo = `${dep ? transformedName(dep.label, m.spec.transform) : "Y"}(t) = β0 ${regs.map((r, i) => `+ β${i + 1}·${transformedName(r!.label, m.spec.transform)}(t)`).join(" ")} + ε(t)`;
    estimParas.push(`${m.label} — ${specLabel(m.spec.transform)}. Équation théorique : ${theo}.`);
    if (!est) {
      estimParas.push(`Le modèle n'a pas pu être estimé : ${a?.orientations.map((o) => o.text).join(" ") || "données insuffisantes."}`);
      continue;
    }
    estimParas.push(`Estimé par les moindres carrés ordinaires sur ${est.n} observations (${est.periods[0]}-${est.periods[est.periods.length - 1]}), le modèle s'écrit : ${est.equation}.`);
    estimParas.push(`Le coefficient de détermination R² vaut ${num(est.r2, 3)} (R² ajusté : ${num(est.adjR2, 3)}) : les variables explicatives rendent compte de ${num((est.r2 ?? 0) * 100, 1)} % de la variabilité de ${est.dependentName}. Le test de Fisher (F = ${num(est.f)}, ${pv(est.fP)}) ${est.fP !== null && est.fP < 0.05 ? "indique que le modèle est globalement significatif" : "ne permet pas de conclure à la significativité globale du modèle"}.`);
    for (const r of est.rows.slice(1)) estimParas.push(`${r.name} : coefficient ${num(r.beta, 3)}, écart-type ${num(r.se, 3)}, t de Student ${num(r.t)}, ${pv(r.p)} ${r.stars ? `(${r.stars})` : "(non significatif)"}.`);
    validParas.push(
      `${m.label} — Durbin-Watson : DW = ${num(est.dw)} ; Breusch-Godfrey (ordre 1) : LM = ${num(est.bg.statistic)}, ${pv(est.bg.pValue)} — ${est.bg.pValue !== null && est.bg.pValue < 0.05 ? "autocorrélation des erreurs détectée" : "absence d'autocorrélation d'ordre 1 non rejetée"}.`,
      `Breusch-Pagan : LM = ${num(est.bp.statistic)}, ${pv(est.bp.pValue)} — ${est.bp.pValue !== null && est.bp.pValue < 0.05 ? "hétéroscédasticité détectée" : "homoscédasticité non rejetée"}. Jarque-Bera : JB = ${num(est.jb.statistic)}, ${pv(est.jb.pValue)} — ${est.jb.pValue === null ? "test non réalisable (moins de 8 observations)" : est.jb.pValue < 0.05 ? "normalité des résidus rejetée" : "normalité des résidus non rejetée"}.`,
    );
    if (est.vif.some((v) => v.value !== null)) validParas.push(`Multicolinéarité (VIF) : ${est.vif.map((v) => `${v.name} ${num(v.value)}`).join(" ; ")} ${est.vif.some((v) => (v.value ?? 0) > 10) ? "— au moins un VIF dépasse 10." : "— tous inférieurs au seuil usuel de 10."}`);
    if (a.cointegration) validParas.push(a.cointegration.available ? `Cointégration (Engle-Granger) : statistique ADF des résidus ${num(a.cointegration.stat)} pour une valeur critique de ${num(a.cointegration.critical?.p5 ?? null)} à 5 % — ${a.cointegration.cointegrated ? "les variables sont cointégrées (relation de long terme)" : "absence de cointégration"}.` : `Cointégration : ${a.cointegration.reason}`);
    if (a.ecm) validParas.push(`Modèle à correction d'erreur : force de rappel ${num(a.ecm.lambda, 3)} (${pv(a.ecm.lambdaP)}) — ${a.ecm.valid ? "négative et significative : les écarts à l'équilibre de long terme se résorbent progressivement" : "le mécanisme de correction n'est pas significatif"}.`);
  }
  sections.push({
    id: "estimation",
    title: "Section 3. Spécification et estimation du modèle",
    purpose: "Présenter le modèle retenu, justifié par la théorie économique, et les coefficients estimés.",
    contents: ["Équation théorique et justification des variables (théorie économique)", "Méthode d'estimation (MCO) et période", "Tableau des résultats : coefficients, écarts-types, t de Student, p-values, R², R² ajusté, F"],
    paragraphs: estimParas.length ? estimParas : ["Aucun modèle n'est encore spécifié."],
  });
  sections.push({
    id: "validation",
    title: "Section 4. Validation du modèle (tests de diagnostic)",
    purpose: "Montrer que les hypothèses des MCO sont respectées (ou dire honnêtement lesquelles ne le sont pas), condition pour interpréter les coefficients.",
    contents: ["Autocorrélation des erreurs (Durbin-Watson, Breusch-Godfrey)", "Hétéroscédasticité (Breusch-Pagan)", "Normalité des résidus (Jarque-Bera)", "Multicolinéarité (VIF)", "Cointégration et modèle à correction d'erreur, si les variables sont I(1)"],
    paragraphs: validParas.length ? validParas : ["Les tests de diagnostic seront disponibles une fois le modèle estimé."],
  });

  // Section 5 — Interprétation et hypothèses.
  sections.push({
    id: "interpretation",
    title: "Section 5. Interprétation économique et vérification des hypothèses",
    purpose: "Traduire les coefficients en langage économique, les confronter à la théorie et statuer sur chaque hypothèse.",
    contents: ["Lecture économique de chaque coefficient (sens, ampleur, élasticité)", "Confrontation à la théorie et aux travaux antérieurs", "Verdict sur chaque hypothèse, avec ses limites"],
    paragraphs: results.flatMap((r, i) => [
      `Hypothèse ${i + 1} : « ${r.hypothesis} » — ${r.verdictLabel}.`,
      ...(r.reading ? [r.reading] : []),
      ...r.supports,
      ...r.limits,
      ...(r.shortRun ? [r.shortRun] : []),
    ]),
  });

  // Conclusion partielle.
  const counts = (v: string) => results.filter((r) => r.verdict === v).length;
  sections.push({
    id: "conclusion",
    title: "Conclusion partielle",
    purpose: "Résumer ce que les estimations permettent d'affirmer, ce qu'elles ne permettent pas d'affirmer, et annoncer la discussion.",
    contents: ["Rappel des principaux résultats", "Verdict d'ensemble sur les hypothèses", "Limites (taille de l'échantillon, qualité des données, tests non réalisables) et pistes"],
    paragraphs: [
      `Sur ${results.length} hypothèse(s), ${counts("supported")} est (sont) compatible(s) avec les données, ${counts("partially_supported")} partiellement compatible(s), ${counts("not_supported")} non soutenue(s), ${counts("contrary")} de sens contraire et ${counts("inconclusive") + counts("not_examined")} non concluante(s) ou non examinée(s).`,
      `Ces résultats décrivent des associations statistiques sur ${n} observations ; ils ne constituent pas, à eux seuls, la preuve d'une causalité économique.`,
    ],
  });
  return sections;
}

export { AGGREGATE_BY_ID };
