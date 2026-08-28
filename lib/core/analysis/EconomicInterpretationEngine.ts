// ============================================================
// ACADIA — ECONOMIC INTERPRETATION ENGINE (P9)
//
// Transforme les résultats déjà calculés par P6 (DescriptiveAnalysis),
// P7 (BivariateAnalysis) et P8 (EconometricModel) en lecture
// économique structurée. 100 % déterministe, zéro appel OpenAI
// (même règle que P6/P7/P8 : CALCUL = MOTEUR DÉTERMINISTE).
//
// RÈGLE ABSOLUE : ne jamais transformer p<0,05 en "hypothèse
// prouvée", une corrélation en "X cause Y", ou un coefficient
// significatif en "relation causale établie". Chaque fonction ici
// distingue explicitement association / significativité statistique
// / importance économique / soutien empirique — jamais une preuve.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { DescriptiveVariableResult } from "./DescriptiveAnalysisTypes";
import type { BivariateAnalysis } from "./BivariateAnalysisTypes";
import { DEFAULT_ALPHA as BIVARIATE_ALPHA } from "./BivariateAnalysisEngine";
import type { CoefficientRow, EconometricModel } from "./EconometricModelTypes";
import { formatPercentage, formatStat } from "./StatisticsMath";

import type {
  BivariateInterpretationResult,
  CoefficientInterpretation,
  DescriptiveInterpretationResult,
  DiagnosticsInterpretation,
  EconometricInterpretationResult,
} from "./EconomicInterpretationTypes";


// ============================================================
// P9.6 — VOCABULAIRE SEG CONTEXTUEL (jamais forcé)
// ============================================================

function normalize(value: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .trim();
}

const DOMAIN_VOCABULARIES: { keywords: string[]; terms: string[] }[] = [
  {
    keywords: ["economie", "economique", "economiques"],
    terms: ["incitations", "allocation des ressources", "productivité", "revenu", "coût", "investissement", "emploi", "efficacité"],
  },
  {
    keywords: ["gestion", "management"],
    terms: ["performance organisationnelle", "ressources humaines", "motivation", "gouvernance", "stratégie", "productivité"],
  },
  {
    keywords: ["finance", "financier", "financiere"],
    terms: ["rentabilité", "risque", "liquidité", "structure financière", "financement"],
  },
  {
    keywords: ["marketing"],
    terms: ["demande", "satisfaction", "fidélisation", "comportement du consommateur", "performance commerciale", "valeur client"],
  },
  {
    keywords: ["entrepreneuriat", "entrepreneurial", "entrepreneur"],
    terms: ["financement", "croissance", "survie de l'entreprise", "innovation", "accès au marché"],
  },
];

/** Renvoie [] si le domaine du projet ne correspond à aucun vocabulaire connu — jamais de vocabulaire inventé ou forcé. */
export function getDomainVocabulary(domain?: string): string[] {
  if (!domain) return [];
  const normalized = normalize(domain);
  const match = DOMAIN_VOCABULARIES.find((v) => v.keywords.some((k) => normalized.includes(k)));
  return match ? match.terms : [];
}


// ============================================================
// P9.1 — INTERPRÉTATION DESCRIPTIVE
//
// Réutilise directement `result.reading` (P6) — n'invente rien,
// ajoute uniquement une phrase de mise en contexte économique
// lorsqu'un vocabulaire de domaine est identifié.
// ============================================================

export function interpretDescriptiveResult(
  result: DescriptiveVariableResult,
  project: ResearchProject
): DescriptiveInterpretationResult {
  const statements: string[] = [];

  if (!result.analyzable || !result.reading) {
    statements.push("Résultat non disponible pour une lecture économique (voir les avertissements de l'analyse descriptive).");
  } else {
    statements.push(...result.reading.statements);

    const vocabulary = getDomainVocabulary(project.domain);
    if (vocabulary.length > 0) {
      statements.push(
        `Sur le plan économique/gestionnaire, ce constat peut être mis en lien avec des dimensions telles que : ${vocabulary.slice(0, 3).join(", ")}.`
      );
    }

    statements.push(result.reading.limitation);
  }

  return {
    columnId: result.columnId,
    label: result.label,
    block: { id: `interp:descriptive:${result.columnId}`, title: result.label, statements },
  };
}


// ============================================================
// P9.2 — INTERPRÉTATION BIVARIÉE
// ============================================================

export function interpretBivariateResult(
  analysis: BivariateAnalysis,
  project: ResearchProject
): BivariateInterpretationResult {
  if (analysis.status !== "ready") {
    return {
      analysisId: analysis.id,
      available: false,
      unavailableReason: "Aucun résultat bivarié disponible ou vérifié pour cette paire de variables.",
      block: { id: `interp:bivariate:${analysis.id}`, title: "Interprétation économique", statements: [] },
    };
  }

  const statements = [...analysis.interpretation];

  const vocabulary = getDomainVocabulary(project.domain);
  if (vocabulary.length > 0) {
    statements.push(
      `Dans le contexte de ce projet, cette association peut être lue au regard de notions telles que : ${vocabulary.slice(0, 3).join(", ")}.`
    );
  }

  let hypothesisNote: string | undefined;
  if (analysis.hypothesisLink) {
    const significant =
      (analysis.chiSquare?.pValue ?? null) !== null && analysis.chiSquare!.pValue! < BIVARIATE_ALPHA ||
      (analysis.pearson?.pValue ?? null) !== null && analysis.pearson!.pValue! < BIVARIATE_ALPHA ||
      (analysis.spearman?.pValue ?? null) !== null && analysis.spearman!.pValue! < BIVARIATE_ALPHA;

    hypothesisNote = significant
      ? `Ce résultat apporte un soutien empirique à l'hypothèse « ${analysis.hypothesisLink.statement} » — il ne s'agit pas d'une preuve de causalité ni d'une confirmation définitive.`
      : `Ce résultat n'apporte pas de soutien empirique suffisant à l'hypothèse « ${analysis.hypothesisLink.statement} » dans cet échantillon.`;
    statements.push(hypothesisNote);
  }

  return {
    analysisId: analysis.id,
    available: true,
    block: {
      id: `interp:bivariate:${analysis.id}`,
      title: `${analysis.variableX.label} × ${analysis.variableY.label}`,
      statements,
    },
    hypothesisNote,
  };
}


// ============================================================
// P9.3 — INTERPRÉTATION ÉCONOMÉTRIQUE (structure A-F)
// ============================================================

function buildEconomicMeaning(coefficient: CoefficientRow, model: EconometricModel, vocabulary: string[]): string {
  const direction = coefficient.coefficient >= 0 ? "positivement" : "négativement";
  let sentence = `Dans le contexte de ce projet, ce résultat suggère que « ${coefficient.label} » est ${direction} associée à « ${model.dependent.label} », un lien à examiner au regard du cadre théorique du projet.`;
  if (vocabulary.length > 0) {
    sentence += ` Ce type de résultat s'inscrit typiquement dans une réflexion autour de : ${vocabulary.slice(0, 2).join(" et ")}.`;
  }
  return sentence;
}

export function interpretEconometricModel(
  model: EconometricModel,
  project: ResearchProject,
  alpha: number = 0.05
): EconometricInterpretationResult {
  if (model.status !== "ready") {
    return {
      modelId: model.id,
      available: false,
      unavailableReason: "Interprétation économétrique indisponible : le modèle doit d'abord être vérifié.",
      modelSummary: { id: `interp:econ:${model.id}:summary`, title: "Ce que montre le modèle", statements: [] },
      modelLimitations: { id: `interp:econ:${model.id}:limits`, title: "Ce que le modèle ne permet pas encore d'affirmer", statements: [] },
      coefficients: [],
      diagnostics: { vif: [], heteroscedasticity: "", normality: "", influentialObservations: [] },
      domainVocabulary: [],
    };
  }

  const vocabulary = getDomainVocabulary(project.domain);

  // -- P9.5 : ce que montre le modèle -----------------------------------
  const summaryStatements: string[] = [];
  summaryStatements.push(
    `Le modèle explique ${formatPercentage((model.r2 ?? 0) * 100)} de la variance observée de « ${model.dependent.label} » dans l'échantillon (R² = ${formatStat(model.r2)}, R² ajusté = ${formatStat(model.adjustedR2)}).`
  );
  if (model.fPValue !== null) {
    summaryStatements.push(
      model.fPValue < alpha
        ? "Le modèle dans son ensemble est statistiquement significatif : au moins une variable explicative apporte une information sur la variable expliquée."
        : "Le modèle dans son ensemble n'est pas statistiquement significatif à ce stade."
    );
  }
  const significantCoefficients = model.coefficients.filter((c) => c.significant);
  summaryStatements.push(
    significantCoefficients.length > 0
      ? `Les variables suivantes présentent une association statistiquement significative avec « ${model.dependent.label} » : ${significantCoefficients.map((c) => c.label).join(", ")}.`
      : "Aucune variable explicative incluse ne présente d'association statistiquement significative dans cet échantillon."
  );

  // -- P9.5 : ce que le modèle ne permet pas encore d'affirmer -----------
  const modelLimitStatements = [
    "Ce modèle ne permet pas d'établir automatiquement une relation causale entre les variables incluses.",
    "Les résultats ne sont pas automatiquement généralisables au-delà de l'échantillon observé.",
    "La validité externe et l'absence de biais de spécification ne sont pas garanties par ce seul modèle.",
    "Un mécanisme causal précis ne peut être établi sans cadre théorique et méthodologique complémentaire (voir la discussion scientifique).",
  ];

  // -- P9.3 : structure A-F par coefficient ------------------------------
  const coefficients: CoefficientInterpretation[] = model.coefficients.map((c) => {
    const statisticalResult = `β = ${formatStat(c.coefficient)}${c.pValue !== null ? `, p = ${formatStat(c.pValue, 3)}` : ""}`;

    const direction = c.coefficient >= 0 ? "une augmentation" : "une diminution";
    const interpretation = `Une augmentation d'une unité de « ${c.label} » est associée à ${direction} estimée de ${formatStat(Math.abs(c.coefficient))} unité(s) de « ${model.dependent.label} », toutes choses égales par ailleurs.`;

    const significance = c.significant
      ? `Le coefficient est statistiquement significatif au seuil de ${formatPercentage(alpha * 100, 0)}.`
      : `Le coefficient n'est pas statistiquement significatif au seuil de ${formatPercentage(alpha * 100, 0)} — la relation observée pourrait être due au hasard d'échantillonnage.`;

    const economicMeaning = buildEconomicMeaning(c, model, vocabulary);

    const economicImportanceNote = c.significant
      ? "La significativité statistique ne préjuge pas de l'importance économique ou managériale réelle de cet effet : son ampleur doit être appréciée au regard du contexte, de l'échelle de mesure et des enjeux du projet — aucun seuil universel d'importance économique n'est appliqué ici."
      : "L'absence de significativité statistique dans cet échantillon ne prouve pas l'absence totale d'effet dans la population.";

    let hypothesisNote: string | undefined;
    if (c.role === "principal" && model.hypothesisLinks.length > 0) {
      const hypothesis = model.hypothesisLinks[0];
      hypothesisNote = c.significant
        ? `Ce résultat apporte un soutien empirique à l'hypothèse « ${hypothesis.statement} ».`
        : `Ce résultat n'apporte pas de soutien empirique suffisant à l'hypothèse « ${hypothesis.statement} » dans cet échantillon.`;
    }

    return {
      id: `interp:econ:${model.id}:coef:${c.name}`,
      regressorName: c.name,
      label: c.label,
      role: c.role as "principal" | "control",
      statisticalResult,
      interpretation,
      significance,
      economicMeaning,
      economicImportanceNote,
      hypothesisNote,
    };
  });

  // -- P9.4 : diagnostics -------------------------------------------------
  const diagnostics: DiagnosticsInterpretation = {
    vif: (model.diagnostics?.vif ?? []).map((v) => {
      if (v.vif === null) return `${v.label} : VIF non calculable.`;
      const level = v.vif < 2 ? "faible" : v.vif < 5 ? "modéré" : "élevé";
      return `${v.label} : VIF = ${formatStat(v.vif)} (${level})${v.concern ? " — problème potentiel de multicolinéarité à examiner (pas nécessairement une variable à retirer)." : "."}`;
    }),
    heteroscedasticity: !model.diagnostics
      ? "Diagnostic non disponible."
      : model.diagnostics.heteroscedasticity.pValue === null
      ? "Test d'hétéroscédasticité non calculable dans cette configuration."
      : model.diagnostics.heteroscedasticity.pValue < alpha
      ? "Le test de Breusch-Pagan indique une possible hétéroscédasticité des résidus : la dispersion des erreurs pourrait varier selon les valeurs des régresseurs, ce qui peut affecter la fiabilité des erreurs standards et donc des tests de significativité."
      : "Le test de Breusch-Pagan ne détecte pas d'hétéroscédasticité significative des résidus dans cet échantillon.",
    normality: !model.diagnostics
      ? "Diagnostic non disponible."
      : model.diagnostics.normality.pValue === null
      ? "Test de normalité non calculable dans cette configuration (échantillon trop restreint)."
      : model.diagnostics.normality.pValue < alpha
      ? "Le test de Jarque-Bera indique un écart à la normalité des résidus, ce qui peut affecter la fiabilité des tests statistiques sur petits échantillons — sans invalider nécessairement le modèle."
      : "Le test de Jarque-Bera ne détecte pas d'écart significatif à la normalité des résidus.",
    influentialObservations: (model.diagnostics?.influentialObservations ?? []).map(
      (o) => `${o.respondentLabel} (distance de Cook = ${formatStat(o.cooksDistance)}) — cette observation mérite une vérification, jamais une suppression automatique.`
    ),
  };

  return {
    modelId: model.id,
    available: true,
    modelSummary: { id: `interp:econ:${model.id}:summary`, title: "Ce que montre le modèle", statements: summaryStatements },
    modelLimitations: { id: `interp:econ:${model.id}:limits`, title: "Ce que le modèle ne permet pas encore d'affirmer", statements: modelLimitStatements },
    coefficients,
    diagnostics,
    domainVocabulary: vocabulary,
  };
}
