// ============================================================
// ACADIA — SCIENTIFIC DISCUSSION ENGINE (P10)
//
// Distinct de EconomicInterpretationEngine (P9) : P9 lit les
// résultats, P10 les met en perspective (hypothèse, théorie,
// littérature, limites, implications). 100 % déterministe, zéro
// appel OpenAI.
//
// AUCUNE théorie, AUCUN auteur, AUCUNE référence bibliographique
// n'est inventée — ResearchProject ne contient actuellement aucun
// champ théorie/littérature (audit confirmé), donc ces sections
// affichent systématiquement leur état "non renseigné" plutôt que
// d'halluciner un contenu.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";
import { buildDescriptiveAnalysis } from "./DescriptiveAnalysisEngine";
import type { EconometricModel } from "./EconometricModelTypes";
import { formatStat } from "./StatisticsMath";
import { getDomainVocabulary } from "./EconomicInterpretationEngine";

import type {
  DiscussionSection,
  LimitationItem,
  ResultDiscussion,
  ScientificDiscussion,
} from "./ScientificDiscussionTypes";


const THEORY_UNAVAILABLE_STATEMENT =
  "Le cadre théorique n'est pas suffisamment renseigné pour produire une confrontation théorique fiable.";

const LITERATURE_UNAVAILABLE_STATEMENT =
  "Comparaison avec la littérature : à compléter. Aucune référence bibliographique structurée n'est encore enregistrée pour ce projet — cette section pourra être alimentée dans un futur bloc.";


// ============================================================
// LIMITES (P10.6) — dérivées uniquement des données réellement présentes
// ============================================================

function buildLimitationsFromModel(model: EconometricModel): LimitationItem[] {
  const items: LimitationItem[] = [];

  if (model.validObservationCount < 30) {
    items.push({
      id: "limit:sample_size",
      category: "Taille d'échantillon",
      description: `L'échantillon utilisé (n = ${model.validObservationCount}) reste limité, ce qui restreint la puissance statistique et la précision des estimations.`,
      severity: "detected",
    });
  }

  if (model.missingObservationCount > 0) {
    items.push({
      id: "limit:missing_data",
      category: "Données manquantes",
      description: `${model.missingObservationCount} observation(s) ont été exclues de l'estimation pour valeur manquante ou invalide sur Y ou l'un des régresseurs.`,
      severity: "detected",
    });
  }

  const highVif = model.diagnostics?.vif.filter((v) => v.concern) ?? [];
  if (highVif.length > 0) {
    items.push({
      id: "limit:multicollinearity",
      category: "Multicolinéarité",
      description: `Un VIF élevé est observé pour : ${highVif.map((v) => v.label).join(", ")} — la précision des coefficients concernés peut être affectée.`,
      severity: "detected",
    });
  }

  if (model.diagnostics && model.diagnostics.heteroscedasticity.pValue !== null && model.diagnostics.heteroscedasticity.pValue < 0.05) {
    items.push({
      id: "limit:heteroscedasticity",
      category: "Hétéroscédasticité",
      description: "Une possible hétéroscédasticité des résidus est détectée (test de Breusch-Pagan) — les erreurs standards doivent être interprétées avec prudence.",
      severity: "detected",
    });
  }

  if (model.diagnostics && model.diagnostics.normality.pValue !== null && model.diagnostics.normality.pValue < 0.05) {
    items.push({
      id: "limit:normality",
      category: "Normalité des résidus",
      description: "Un écart à la normalité des résidus est détecté (test de Jarque-Bera), à interpréter avec prudence sur un échantillon de cette taille.",
      severity: "detected",
    });
  }

  if ((model.diagnostics?.influentialObservations.length ?? 0) > 0) {
    items.push({
      id: "limit:influential",
      category: "Observations influentes",
      description: `${model.diagnostics!.influentialObservations.length} observation(s) présentent une distance de Cook élevée et méritent une vérification (jamais une suppression automatique).`,
      severity: "potential_risk",
    });
  }

  // Constats structurels toujours vrais pour ce type de collecte (questionnaire ponctuel) —
  // jamais un risque inventé, mais une caractéristique réelle de la méthode de collecte.
  items.push({
    id: "limit:cross_sectional",
    category: "Design transversal",
    description: "Les données sont collectées à un instant donné (design transversal, via questionnaire) — aucune inférence sur l'évolution dans le temps n'est possible avec ce dispositif.",
    severity: "potential_risk",
  });
  items.push({
    id: "limit:external_validity",
    category: "Limites de généralisation",
    description: "Les résultats sont propres à l'échantillon et au contexte étudiés ; leur généralisation à d'autres contextes n'est pas garantie par cette seule analyse.",
    severity: "potential_risk",
  });

  return items;
}


// ============================================================
// DISCUSSION D'UN RÉSULTAT ÉCONOMÉTRIQUE (P10.1)
// ============================================================

function section(id: string, title: string, statements: string[]): DiscussionSection {
  return { id, title, statements };
}

function buildEconometricResultDiscussion(model: EconometricModel, project: ResearchProject): ResultDiscussion {
  const vocabulary = getDomainVocabulary(project.domain);
  const significant = model.coefficients.filter((c) => c.significant);

  const resultSummary = section(
    `disc:${model.id}:summary`,
    "Rappel du résultat",
    [
      `Un modèle de régression MCO a été estimé pour expliquer « ${model.dependent.label} » à partir de ${model.regressors.length} régresseur(s) (n = ${model.validObservationCount}, R² = ${formatStat(model.r2)}).`,
    ]
  );

  const economicInterpretation = section(
    `disc:${model.id}:econ`,
    "Interprétation économique",
    significant.length > 0
      ? significant.map(
          (c) =>
            `« ${c.label} » est associée ${c.coefficient >= 0 ? "positivement" : "négativement"} à « ${model.dependent.label} » (β = ${formatStat(c.coefficient)}) — une association statistiquement significative, pas un effet causal établi.`
        )
      : ["Aucun coefficient n'est statistiquement significatif dans ce modèle — l'absence de relation détectée dans cet échantillon est elle-même une information à discuter."]
  );

  const hypothesisConfrontation = section(
    `disc:${model.id}:hyp`,
    "Confrontation à l'hypothèse",
    model.hypothesisLinks.length > 0
      ? model.hypothesisLinks.map((h) => `Hypothèse « ${h.statement} » : ${h.note}`)
      : ["Aucune hypothèse enregistrée n'est directement reliée aux variables incluses dans ce modèle."]
  );

  const theoreticalConfrontation = section(`disc:${model.id}:theory`, "Confrontation au cadre théorique", [THEORY_UNAVAILABLE_STATEMENT]);

  const literatureComparison = section(`disc:${model.id}:lit`, "Comparaison avec la littérature", [LITERATURE_UNAVAILABLE_STATEMENT]);

  const context = section(`disc:${model.id}:context`, "Contexte spécifique", [
    `Population étudiée : ${project.methodology?.population || "non précisée"}.`,
    `Domaine : ${project.domain || "non précisé"}${project.location ? ` · Contexte géographique : ${project.location}` : ""}.`,
  ]);

  const scientificImplication = section(
    `disc:${model.id}:sci`,
    "Implication scientifique",
    [
      significant.length > 0
        ? `Ces résultats apportent des éléments empiriques descriptifs sur la relation entre « ${model.dependent.label} » et les variables explicatives incluses, à confronter à un cadre théorique et une revue de littérature plus complets pour en apprécier la portée.`
        : "L'absence d'association statistiquement significative dans cet échantillon constitue elle-même un résultat scientifique à documenter, plutôt qu'un échec de l'analyse.",
    ]
  );

  let practicalImplication: DiscussionSection | undefined;
  if (significant.length > 0 && vocabulary.length > 0) {
    practicalImplication = section(`disc:${model.id}:practical`, "Implication pratique", [
      `Sous réserve d'une validation complémentaire (réplication, contrôle d'autres facteurs), ce résultat pourrait intéresser les acteurs concernés par ${vocabulary.slice(0, 2).join(" et ")} dans ce contexte — à formuler avec prudence, sans généralisation automatique.`,
    ]);
  }

  return {
    resultRef: `Modèle expliquant « ${model.dependent.label} »`,
    resultSummary,
    economicInterpretation,
    hypothesisConfrontation,
    theoreticalConfrontation,
    literatureComparison,
    context,
    scientificImplication,
    practicalImplication,
  };
}


// ============================================================
// DISCUSSION DE REPLI — DESCRIPTIF SEUL (aucun modèle estimé)
// ============================================================

function buildDescriptiveOnlyDiscussion(project: ResearchProject, dataset: Dataset): ResultDiscussion {
  const analysis = buildDescriptiveAnalysis(project, dataset);

  return {
    resultRef: "Statistiques descriptives disponibles",
    resultSummary: section(`disc:${project.id}:descr:summary`, "Rappel du résultat", [
      `n = ${analysis.sampleSize} observation(s), ${analysis.variableResults.length} variable(s) analysée(s) au stade descriptif.`,
    ]),
    economicInterpretation: section(`disc:${project.id}:descr:econ`, "Interprétation économique", [
      "Aucun modèle économétrique n'a encore été estimé pour ce projet. La discussion se limite ici aux constats descriptifs disponibles — voir la section « Analyse descriptive » ci-dessus pour le détail par variable.",
    ]),
    hypothesisConfrontation: section(`disc:${project.id}:descr:hyp`, "Confrontation à l'hypothèse", [
      "Une analyse purement descriptive ne permet pas de confronter les résultats à une hypothèse — cela suppose une analyse bivariée ou économétrique.",
    ]),
    theoreticalConfrontation: section(`disc:${project.id}:descr:theory`, "Confrontation au cadre théorique", [THEORY_UNAVAILABLE_STATEMENT]),
    literatureComparison: section(`disc:${project.id}:descr:lit`, "Comparaison avec la littérature", [LITERATURE_UNAVAILABLE_STATEMENT]),
    context: section(`disc:${project.id}:descr:context`, "Contexte spécifique", [`Domaine : ${project.domain || "non précisé"}.`]),
    scientificImplication: section(`disc:${project.id}:descr:sci`, "Implication scientifique", [
      "Une analyse bivariée ou un modèle économétrique permettra d'approfondir la compréhension des relations entre variables au-delà du simple constat descriptif.",
    ]),
    practicalImplication: undefined,
  };
}


// ============================================================
// DISCUSSION — PROJET QUALITATIF (Partie G)
// ============================================================

function buildQualitativeDiscussion(project: ResearchProject, dataset?: Dataset): ResultDiscussion {
  const themeCount = dataset?.columns.length ?? 0;
  const responseCount = dataset?.rows.length ?? 0;

  return {
    resultRef: "Guide d'entretien qualitatif",
    resultSummary: section(`disc:${project.id}:qual:summary`, "Rappel du résultat", [
      `${themeCount} thème(s) d'entretien identifié(s)${responseCount > 0 ? `, ${responseCount} réponse(s) recueillie(s)` : ", aucune réponse encore recueillie"}.`,
    ]),
    economicInterpretation: section(`disc:${project.id}:qual:econ`, "Interprétation économique", [
      "Ce projet suit une approche qualitative : l'interprétation porte sur les thèmes et observations du guide d'entretien — jamais sur des statistiques quantitatives (régression, p-value, coefficient, R²), qui ne sont pas applicables ici.",
    ]),
    hypothesisConfrontation: section(`disc:${project.id}:qual:hyp`, "Confrontation à l'hypothèse", [
      "Une approche qualitative n'a pas vocation à tester statistiquement une hypothèse — elle explore et éclaire le phénomène étudié à partir des thèmes recueillis.",
    ]),
    theoreticalConfrontation: section(`disc:${project.id}:qual:theory`, "Confrontation au cadre théorique", [THEORY_UNAVAILABLE_STATEMENT]),
    literatureComparison: section(`disc:${project.id}:qual:lit`, "Comparaison avec la littérature", [LITERATURE_UNAVAILABLE_STATEMENT]),
    context: section(`disc:${project.id}:qual:context`, "Contexte spécifique", [`Domaine : ${project.domain || "non précisé"}.`]),
    scientificImplication: section(`disc:${project.id}:qual:sci`, "Implication scientifique", [
      "L'analyse thématique détaillée des réponses (codage, convergences et divergences entre répondants) reste à réaliser à partir des données qualitatives collectées.",
    ]),
    practicalImplication: undefined,
  };
}


// ============================================================
// CONSTRUCTION COMPLÈTE
// ============================================================

export function buildScientificDiscussion(
  project: ResearchProject,
  dataset: Dataset | undefined,
  model: EconometricModel | null
): ScientificDiscussion {
  const results: ResultDiscussion[] = [];
  let limitations: LimitationItem[] = [];

  if (project.researchType === "qualitative") {
    results.push(buildQualitativeDiscussion(project, dataset));
  } else if (model && model.status === "ready") {
    results.push(buildEconometricResultDiscussion(model, project));
    limitations = buildLimitationsFromModel(model);
  } else if (dataset && dataset.rows.length > 0) {
    results.push(buildDescriptiveOnlyDiscussion(project, dataset));
  }

  return {
    projectId: project.id,
    datasetId: dataset?.id,
    generatedAt: new Date().toISOString(),
    results,
    theoryStatus: "none_registered",
    literature: [],
    limitations,
  };
}
