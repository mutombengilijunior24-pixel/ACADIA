// ============================================================
// ACADIA — MÉTHODOLOGIE RECOMMENDATION ENGINE (P3)
//
// Premier module méthodologique spécialisé Sciences économiques
// et de gestion. Moteur déterministe, AUCUN appel OpenAI.
//
// Ce fichier NE REMPLACE PAS ResearchCore.buildMethodology()
// (A0, qui construit la méthodologie initiale à partir du seul
// ResearchData). Il l'enrichit une fois le ResearchProject
// complet disponible (variables, relations, hypothèses produites
// par A1/A2), pour produire une RECOMMANDATION explicitement
// marquée comme proposition — jamais une décision.
//
// Source méthodologique : le document de référence (Sem Mbimbi
// & Cornet) n'est pas présent dans docs/reference/ à ce jour
// (voir ACADIA_SEG_METHODOLOGY.md). Les catégories utilisées ici
// (devis de recherche, primaire/secondaire, etc.) proviennent du
// prompt produit, pas d'une extraction du référentiel — elles
// sont donc systématiquement présentées comme des propositions
// à réviser, jamais comme une doctrine établie.
// ============================================================

import type {
  ResearchProject,
  ResearchDesignType,
  DataSourceType,
} from "../research/ResearchTypes";

import { checkResearchConsistency } from "../research/ResearchConsistencyEngine";


// ============================================================
// TYPES DU RÉSULTAT
// ============================================================

export type RecommendationStatus = "proposed" | "confirmed" | "needs_review";

export interface RecommendationSection<T> {
  value?: T;
  status: RecommendationStatus;
  justification?: string;
}

export interface MethodologyRecommendation {
  orientation: RecommendationSection<string>;
  researchDesignType: RecommendationSection<ResearchDesignType>;
  population: RecommendationSection<string>;
  samplingMethod: RecommendationSection<string>;
  sampleSize: RecommendationSection<number>;
  collection: RecommendationSection<string[]>;
  dataSourceType: RecommendationSection<DataSourceType>;
  analysisPlan: string[];
  toValidate: string[];
  readinessPercent: number;
  /**
   * P15 — note pédagogique dérivée du niveau d'étude renseigné
   * (`project.level`). Le niveau Master n'est jamais présenté
   * comme "meilleur" que Licence — seulement comme appelant une
   * profondeur méthodologique différente.
   */
  levelGuidance?: string;
}


// ============================================================
// UTILITAIRE
// ============================================================

function clean(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

const CAUSAL_LEANING_RELATIONS = new Set([
  "influence",
  "impact",
  "effect",
  "mediation",
  "moderation",
]);

const PRIMARY_COLLECTION_KEYWORDS = [
  "questionnaire",
  "entretien",
  "observation",
  "focus group",
];

const SECONDARY_COLLECTION_KEYWORDS = [
  "documentaire",
  "archive",
  "base de données",
  "base secondaire",
];


// ============================================================
// MOTEUR PRINCIPAL
// ============================================================

export function buildMethodologyRecommendation(
  project: ResearchProject
): MethodologyRecommendation {

  const methodology = project.methodology;
  const isLicence = project.level === "Licence";
  const isMaster = project.level === "Master";

  // ----------------------------------------------------------
  // P3.1 — ORIENTATION
  // ----------------------------------------------------------

  const orientationValue = clean(methodology?.approach) || undefined;

  const orientation: RecommendationSection<string> = {
    value: orientationValue,
    status: orientationValue ? "proposed" : "needs_review",
    justification:
      clean(methodology?.approachExplanation) || undefined,
  };

  // ----------------------------------------------------------
  // P3.2 — DEVIS DE RECHERCHE
  //
  // Règle structurelle : une hypothèse formulée + une relation
  // d'un type "à tendance causale" (influence/impact/effet/
  // médiation/modération), non marquée "draft" (donc non
  // "unknown"), suggère un devis explicatif. Sinon, en présence
  // de variables sans hypothèse, un devis descriptif. Jamais
  // une affirmation de causalité prouvée — uniquement une
  // proposition de posture d'étude.
  // ----------------------------------------------------------

  const hasHypotheses = (project.hypotheses ?? []).length > 0;

  const hasCausalLeaningRelation = (project.relations ?? []).some(
    (relation) =>
      relation.status !== "draft" &&
      CAUSAL_LEANING_RELATIONS.has(relation.relation)
  );

  let researchDesignType: RecommendationSection<ResearchDesignType>;

  if (hasHypotheses && hasCausalLeaningRelation) {
    researchDesignType = {
      value: "explicative",
      status: "proposed",
      justification:
        "Une hypothèse relie explicitement des variables par une relation orientée — la recherche semble viser à expliquer un phénomène plutôt qu'à seulement le décrire. Cette relation reste à démontrer, pas à supposer acquise.",
    };
  } else if (project.variables.length > 0) {
    researchDesignType = {
      value: "descriptive",
      status: "needs_review",
      justification:
        "Aucune hypothèse de relation orientée n'est encore formulée entre les variables identifiées ; la recherche semble à ce stade viser à décrire les variables plutôt qu'à expliquer une relation entre elles.",
    };
  } else {
    researchDesignType = {
      status: "needs_review",
    };
  }

  // ----------------------------------------------------------
  // P3.3 — POPULATION
  // ----------------------------------------------------------

  const populationValue = clean(methodology?.population) || undefined;

  const population: RecommendationSection<string> = {
    value: populationValue,
    status: populationValue ? "proposed" : "needs_review",
    justification: !populationValue
      ? "La population d'étude n'est pas encore renseignée. ACADIA ne va pas en inventer une : précisez qui est étudié, où, sur quelle période, quelle unité statistique, et les critères d'inclusion/exclusion."
      : undefined,
  };

  // ----------------------------------------------------------
  // P3.4 — ÉCHANTILLON
  //
  // Jamais calculé automatiquement ici (SamplingEngine existe
  // déjà et reste la seule source de calcul, invoquée ailleurs
  // sur décision explicite). On ne fait que rapporter ce qui est
  // déjà connu.
  // ----------------------------------------------------------

  const samplingMethod: RecommendationSection<string> = {
    value: clean(methodology?.samplingMethod) || undefined,
    status: methodology?.samplingMethod ? "proposed" : "needs_review",
    justification:
      clean(methodology?.samplingJustification) ||
      (!populationValue
        ? "ACADIA ne propose pas de technique d'échantillonnage tant que la population d'étude n'est pas renseignée."
        : undefined),
  };

  const sampleSize: RecommendationSection<number> = {
    value: methodology?.sampleSize,
    status: methodology?.sampleSize ? "proposed" : "needs_review",
    justification: !methodology?.sampleSize
      ? !populationValue
        ? "ACADIA ne propose pas de taille d'échantillon car la taille de la population n'est pas encore connue."
        : "La taille d'échantillon n'est pas encore calculée pour cette population."
      : undefined,
  };

  // ----------------------------------------------------------
  // P3.5 — COLLECTE
  // ----------------------------------------------------------

  const techniques = methodology?.techniques ?? [];

  const collection: RecommendationSection<string[]> = {
    value: techniques.length > 0 ? techniques : undefined,
    status: techniques.length > 0 ? "proposed" : "needs_review",
  };

  // ----------------------------------------------------------
  // P3.6 — SOURCES DE DONNÉES (primaire / secondaire)
  //
  // Déduction structurelle sûre : les techniques de collecte
  // "questionnaire/entretien/observation/focus group" impliquent
  // par définition une collecte primaire ; "analyse documentaire/
  // archives/bases existantes" impliquent une collecte secondaire.
  // Ce n'est pas une invention de source — c'est une conséquence
  // directe et non ambiguë de la technique déjà choisie.
  // ----------------------------------------------------------

  const normalizedTechniques = techniques
    .map((t) => clean(t).toLowerCase())
    .join(" | ");

  const hasPrimary = PRIMARY_COLLECTION_KEYWORDS.some((kw) =>
    normalizedTechniques.includes(kw)
  );
  const hasSecondary = SECONDARY_COLLECTION_KEYWORDS.some((kw) =>
    normalizedTechniques.includes(kw)
  );

  let dataSourceType: RecommendationSection<DataSourceType>;

  if (hasPrimary && hasSecondary) {
    dataSourceType = { value: "mixte", status: "proposed" };
  } else if (hasPrimary) {
    dataSourceType = { value: "primaire", status: "proposed" };
  } else if (hasSecondary) {
    dataSourceType = { value: "secondaire", status: "proposed" };
  } else {
    dataSourceType = {
      status: "needs_review",
      justification: "ACADIA ne peut pas encore déduire si vos données seront primaires ou secondaires : aucune technique de collecte n'est encore précisée.",
    };
  }

  // ----------------------------------------------------------
  // P3.8 — PRÉPARATION ÉCONOMÉTRIQUE (réutilise le readiness
  // déjà calculé par ResearchConsistencyEngine — pas de logique
  // dupliquée, aucun calcul statistique ici).
  // ----------------------------------------------------------

  const consistency = checkResearchConsistency(project);
  const readinessItems = consistency.readiness.items;
  const hasDependent = readinessItems.find((i) => i.label.includes("dépendante"))?.met ?? false;
  const hasIndependent = readinessItems.find((i) => i.label.includes("explicatives"))?.met ?? false;

  const analysisPlan: string[] = ["Statistiques descriptives"];

  if ((project.relations ?? []).length > 0) {
    analysisPlan.push("Analyse des relations entre variables");
  }

  // P15 — le niveau d'étude module la profondeur d'analyse suggérée,
  // sans jamais présenter Master comme "meilleur" que Licence : à
  // ce niveau, la modélisation économétrique reste possible si le
  // chercheur le souhaite, mais n'est pas proposée par défaut.
  if (hasDependent && hasIndependent) {
    if (isLicence) {
      analysisPlan.push("Analyse bivariée approfondie (modélisation économétrique optionnelle à ce niveau)");
    } else {
      analysisPlan.push("Modèle économétrique à définir");
    }
  }

  const levelGuidance = isLicence
    ? "Niveau Licence : structure méthodologique proportionnée, explications pédagogiques renforcées, nombre d'hypothèses raisonnable. Une opérationnalisation moins exhaustive n'est pas une lacune à ce niveau."
    : isMaster
    ? "Niveau Master : profondeur méthodologique et opérationnalisation plus détaillées attendues, avec une justification méthodologique plus développée."
    : undefined;

  // ----------------------------------------------------------
  // ÉLÉMENTS À VALIDER PAR LE CHERCHEUR
  // ----------------------------------------------------------

  const toValidate: string[] = [];

  if (samplingMethod.status === "needs_review") {
    toValidate.push("Technique d'échantillonnage à confirmer");
  }
  if (sampleSize.status === "needs_review") {
    toValidate.push("Taille de l'échantillon à définir");
  }
  if (!readinessItems.find((i) => i.label === "Mesures définies")?.met) {
    toValidate.push("Mesure définitive des variables à préciser");
  }
  if (researchDesignType.status === "needs_review") {
    toValidate.push("Devis de recherche à confirmer");
  }
  if (dataSourceType.status === "needs_review") {
    toValidate.push("Nature des sources de données à préciser");
  }

  // ----------------------------------------------------------
  // ÉTAT DE PRÉPARATION GLOBAL
  // ----------------------------------------------------------

  const sections: RecommendationSection<unknown>[] = [
    orientation,
    researchDesignType,
    population,
    samplingMethod,
    sampleSize,
    collection,
    dataSourceType,
  ];

  const resolved = sections.filter((s) => s.status !== "needs_review").length;
  const readinessPercent = Math.round((resolved / sections.length) * 100);

  return {
    orientation,
    researchDesignType,
    population,
    samplingMethod,
    sampleSize,
    collection,
    dataSourceType,
    analysisPlan,
    toValidate,
    readinessPercent,
    levelGuidance,
  };
}
