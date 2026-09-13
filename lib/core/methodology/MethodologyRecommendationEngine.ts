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
  ResearchModeTag,
} from "../research/ResearchTypes";

import { NON_QUESTIONNAIRE_DOMINANT_TAGS } from "../research/ResearchModeTaxonomy";

import { checkResearchConsistency } from "../research/ResearchConsistencyEngine";
import { calculateSampleSize } from "./SamplingEngine";


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
  /**
   * Research Intelligence V3 — instrument de collecte recommandé
   * (questionnaire / guide d'entretien / états financiers / données
   * administratives...), déduit des researchModeTags produits par
   * A1. Toujours une proposition (jamais imposée) : le chercheur
   * choisit ses propres techniques/instruments via "Modifier".
   */
  recommendedInstrument: RecommendationSection<string>;
  analysisPlan: string[];
  toValidate: string[];
  readinessPercent: number;
  /**
   * P16 (Bloc G) — limites méthodologiques déterministes, dérivées
   * uniquement de choix déjà connus (taille d'échantillon non
   * calculée, échantillonnage non probabiliste, devis
   * descriptif/transversal...). Jamais une difficulté de terrain
   * spécifique inventée pour ce projet (accès aux données,
   * contraintes locales...) — seulement ce qui découle logiquement
   * de la méthodologie déjà choisie.
   */
  limitations: string[];
  /**
   * P16 (Bloc G) — rappels déontologiques standards pour une
   * collecte de données de recherche (consentement, confidentialité,
   * neutralité scientifique, usage académique) — pas propres à ce
   * projet, universels dès qu'une collecte primaire est envisagée.
   */
  ethicalConsiderations: string[];
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

// ============================================================
// INSTRUMENT DE COLLECTE RECOMMANDÉ À PARTIR DES SEULS MODE TAGS
// (mission Preview WOW)
//
// Fonction pure, déterministe, sans dépendance à un ResearchProject
// complet — utilisable dès la preview anonyme (A1 seul, avant tout
// A2/variables). buildMethodologyRecommendation() (plus bas, qui
// dispose d'un projet complet) l'appelle aussi, pour ne jamais avoir
// deux logiques de décision différentes selon le moment du parcours.
// ============================================================

export function recommendInstrumentFromModeTags(
  modeTags: ResearchModeTag[]
): RecommendationSection<string> {
  if (modeTags.length === 0) {
    return {
      status: "needs_review",
      justification: "ACADIA ne peut pas encore recommander d'instrument : aucun mode de recherche n'est identifié pour ce sujet.",
    };
  }

  const hasTag = (tag: ResearchModeTag) => modeTags.includes(tag);
  const isFinancial = hasTag("FINANCIAL_ANALYSIS");
  const isSecondary = hasTag("SECONDARY_DATA");
  const isQuantitative = hasTag("QUANTITATIVE_SURVEY");
  const isQualitative = hasTag("QUALITATIVE");
  const isMixed = hasTag("MIXED_METHOD");
  const isCaseStudyOnly = hasTag("CASE_STUDY") && !isFinancial && !isSecondary && !isQuantitative && !isQualitative && !isMixed;

  if (isMixed || (isQuantitative && isQualitative)) {
    return {
      value: "Questionnaire structuré + guide d'entretien",
      status: "needs_review",
      justification: "Le sujet combine une composante quantitative et une composante qualitative — un instrument pour chaque volet est proposé, à confirmer par le chercheur.",
    };
  }

  if (isFinancial) {
    return {
      value: "États financiers (bilan, compte de résultat) de l'entité étudiée",
      status: "needs_review",
      justification: "Le sujet porte sur une analyse financière — l'instrument principal est documentaire (états financiers), pas un questionnaire.",
    };
  }

  if (isSecondary) {
    return {
      value: "Données administratives / documentation existante",
      status: "needs_review",
      justification: "Le sujet repose sur des données déjà produites par des tiers — l'instrument principal est la collecte documentaire, pas un questionnaire.",
    };
  }

  if (isQualitative) {
    return {
      value: "Guide d'entretien",
      status: "needs_review",
      justification: "Le sujet vise à comprendre un vécu ou une expérience — un guide d'entretien est l'instrument adapté, pas un questionnaire quantitatif.",
    };
  }

  if (isQuantitative) {
    return {
      value: "Questionnaire structuré",
      status: "needs_review",
      justification: "Le sujet appelle une mesure auprès d'une population — un questionnaire structuré est l'instrument adapté.",
    };
  }

  if (isCaseStudyOnly) {
    return {
      value: "Étude documentaire du cas (entretiens et/ou documents internes selon l'accès)",
      status: "needs_review",
      justification: "Le sujet porte sur un cas précis sans mode de collecte encore déterminé — l'instrument dépendra de l'accès réel aux données de ce cas.",
    };
  }

  return { status: "needs_review" };
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

  // Research Intelligence V2 — le(s) mode(s) de recherche identifié(s)
  // par A1 (voir SubjectUnderstandingAI.ts) permettent de sortir de la
  // seule dichotomie descriptive/explicative. Moteur toujours
  // déterministe : aucun appel IA ici, seulement une lecture des tags
  // déjà produits par A1.
  const modeTags: ResearchModeTag[] = project.understanding?.researchModeTags ?? [];
  const hasTag = (tag: ResearchModeTag) => modeTags.includes(tag);

  let researchDesignType: RecommendationSection<ResearchDesignType>;

  if (hasHypotheses && hasCausalLeaningRelation) {
    researchDesignType = {
      value: "explicative",
      status: "proposed",
      justification:
        "Une hypothèse relie explicitement des variables par une relation orientée — la recherche semble viser à expliquer un phénomène plutôt qu'à seulement le décrire. Cette relation reste à démontrer, pas à supposer acquise.",
    };
  } else if (hasTag("COMPARATIVE")) {
    researchDesignType = {
      value: "comparative",
      status: "needs_review",
      justification:
        "La compréhension du sujet fait ressortir une dimension comparative (entre groupes, périodes ou cas) — ce devis reste à confirmer par le chercheur, pas encore une décision acquise.",
    };
  } else if (hasTag("CORRELATIONAL") && (project.relations ?? []).length > 0) {
    researchDesignType = {
      value: "correlationnelle",
      status: "needs_review",
      justification:
        "Une relation mesurable entre variables a été identifiée, sans hypothèse à tendance causale à ce stade — un devis corrélationnel est la posture la plus prudente, à confirmer par le chercheur.",
    };
  } else if (
    hasTag("QUALITATIVE") &&
    !hasHypotheses &&
    !hasTag("QUANTITATIVE_SURVEY") &&
    !hasTag("MIXED_METHOD")
  ) {
    researchDesignType = {
      value: "exploratoire",
      status: "needs_review",
      justification:
        "Le sujet vise à comprendre un vécu, une expérience ou un sens plutôt qu'à mesurer une relation entre variables — un devis exploratoire est généralement adapté à ce stade, à confirmer par le chercheur.",
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
  // P3.4 — ÉCHANTILLON (Bloc G, 11/09/2026)
  //
  // Si le chercheur a déjà renseigné une taille de population
  // (methodology.populationSize — champ existant, jusqu'ici jamais
  // exploité ici), ACADIA propose désormais un calcul réel via
  // SamplingEngine.calculateSampleSize (formule de Yamane,
  // déterministe, aucune invention). Si la population n'a pas de
  // taille connue (cas fréquent : population non probabiliste,
  // accès difficile), ACADIA ne calcule jamais un chiffre — il
  // propose la voie méthodologique correcte dans ce cas :
  // l'échantillonnage non probabiliste (raisonné), justifié par
  // des critères de sélection plutôt que par un calcul statistique
  // — cohérent avec les mémoires de référence où la population
  // n'est pas dénombrable.
  // ----------------------------------------------------------

  const knownPopulationSize =
    methodology?.populationSize && methodology.populationSize > 0
      ? methodology.populationSize
      : undefined;

  const computedSampling = knownPopulationSize
    ? calculateSampleSize(knownPopulationSize)
    : undefined;

  const samplingMethod: RecommendationSection<string> = methodology?.samplingMethod
    ? {
        value: clean(methodology.samplingMethod),
        status: "proposed",
        justification: clean(methodology.samplingJustification) || undefined,
      }
    : !populationValue
    ? {
        status: "needs_review",
        justification:
          "ACADIA ne propose pas de technique d'échantillonnage tant que la population d'étude n'est pas renseignée.",
      }
    : knownPopulationSize
    ? {
        value: "Échantillonnage probabiliste (aléatoire simple ou systématique)",
        status: "needs_review",
        justification:
          "La taille de la population étant connue, un tirage probabiliste est possible. Cette technique reste une proposition à confirmer ou à remplacer par le chercheur (stratifié, en grappes...) selon l'accès réel au terrain.",
      }
    : {
        value: "Échantillonnage non probabiliste (raisonné / à choix raisonné)",
        status: "needs_review",
        justification:
          "La taille de la population d'étude n'est pas connue avec précision (population difficile à dénombrer) : un tirage probabiliste n'est pas réalisable. ACADIA propose un échantillonnage raisonné, où les répondants sont sélectionnés selon des critères explicites (disponibilité, connaissance du sujet, accessibilité) — à confirmer et à justifier par le chercheur, jamais un remplacement du calcul statistique par une estimation inventée.",
      };

  const sampleSize: RecommendationSection<number> = methodology?.sampleSize
    ? { value: methodology.sampleSize, status: "proposed" }
    : computedSampling?.sampleSize
    ? {
        value: computedSampling.sampleSize,
        status: "needs_review",
        justification: `${computedSampling.explanation} (${computedSampling.method}, marge d'erreur ${computedSampling.marginOfError} %, niveau de confiance ${computedSampling.confidenceLevel} %). Proposition à confirmer par le chercheur — ACADIA ne l'impose pas.`,
      }
    : {
        status: "needs_review",
        justification: !populationValue
          ? "ACADIA ne propose pas de taille d'échantillon car la population d'étude n'est pas encore renseignée."
          : "La taille de la population n'étant pas connue avec précision, ACADIA ne peut pas calculer statistiquement une taille d'échantillon. Avec un échantillonnage raisonné, la taille se justifie par des critères de saturation/accessibilité plutôt que par une formule — précisez et justifiez le nombre de répondants retenu.",
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
  // RESEARCH INTELLIGENCE V3 — INSTRUMENT DE COLLECTE RECOMMANDÉ
  //
  // Déduit des researchModeTags (A1) — jamais un questionnaire par
  // défaut. Reste une proposition ("proposed"/"needs_review"), jamais
  // imposée : le chercheur choisit ses propres instruments via
  // "Modifier" (methodology.instruments reste le champ qui compte).
  // Extrait en fonction autonome (mission Preview WOW) : réutilisée
  // telle quelle par la preview anonyme, qui n'a pas encore de
  // ResearchProject complet (voir recommendInstrumentFromModeTags).
  // ----------------------------------------------------------

  const recommendedInstrument = recommendInstrumentFromModeTags(modeTags);

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
  // P16 (Bloc G) — LIMITES MÉTHODOLOGIQUES
  //
  // Uniquement des conséquences logiques de choix déjà connus,
  // jamais une difficulté de terrain propre à ce projet (accès aux
  // données, contraintes locales...) qu'ACADIA ne peut pas
  // connaître sans que le chercheur ne la formule lui-même.
  // ----------------------------------------------------------

  const limitations: string[] = [];

  if (!knownPopulationSize) {
    limitations.push(
      "La taille exacte de la population d'étude n'étant pas connue, la représentativité statistique de l'échantillon ne peut pas être garantie par un calcul probabiliste — les résultats devront être interprétés comme des tendances observées sur l'échantillon étudié, non généralisées automatiquement à l'ensemble de la population."
    );
  } else if (sampleSize.status === "needs_review") {
    limitations.push(
      "La taille d'échantillon reste à confirmer par le chercheur avant la collecte — sans confirmation, la marge d'erreur annoncée par ACADIA n'est qu'une proposition, pas une garantie."
    );
  }

  if (samplingMethod.value?.toLowerCase().includes("non probabiliste")) {
    limitations.push(
      "L'échantillonnage non probabiliste envisagé limite la portée des résultats : ils décrivent l'échantillon interrogé et ne peuvent pas être généralisés avec une marge d'erreur statistique à l'ensemble de la population, contrairement à un tirage aléatoire."
    );
  }

  if (researchDesignType.value === "descriptive") {
    limitations.push(
      "Le devis descriptif retenu à ce stade permet de décrire les variables étudiées mais ne permet pas, en l'état, d'établir une relation de causalité entre elles."
    );
  }

  if (
    (methodology?.techniques ?? []).some((t) => clean(t).toLowerCase().includes("questionnaire")) ||
    (methodology?.techniques ?? []).some((t) => clean(t).toLowerCase().includes("entretien"))
  ) {
    limitations.push(
      "Les données étant recueillies auprès des répondants eux-mêmes (questionnaire/entretien), elles peuvent comporter un biais déclaratif (perception subjective, désirabilité sociale) à prendre en compte dans l'interprétation."
    );
  }

  // ----------------------------------------------------------
  // P16 (Bloc G) — CONSIDÉRATIONS ÉTHIQUES
  //
  // Rappels déontologiques universels pour une collecte de
  // données de recherche — pas des faits propres à ce projet.
  // ----------------------------------------------------------

  const ethicalConsiderations: string[] = [
    "Consentement éclairé : chaque participant doit être informé de l'objectif de l'étude et de l'usage exclusivement académique des données avant de répondre, et sa participation doit rester volontaire.",
    "Confidentialité et anonymat : les réponses individuelles ne doivent permettre d'identifier personne dans le mémoire ; les données doivent être traitées et présentées de manière agrégée ou anonymisée.",
    "Neutralité scientifique : les résultats doivent être rapportés tels qu'observés, y compris lorsqu'ils infirment une hypothèse — jamais orientés pour confirmer une attente du chercheur.",
    "Respect des sources : toute donnée, statistique ou théorie empruntée à un tiers doit être référencée conformément aux normes académiques, pour éviter tout plagiat.",
  ];

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

  // Research Intelligence V2 — ne force jamais un questionnaire quand
  // le sujet semble reposer principalement sur des données
  // financières/secondaires (voir NON_QUESTIONNAIRE_DOMINANT_TAGS).
  // Reste une note à valider, jamais un blocage : le chercheur garde
  // la main pour générer un questionnaire malgré tout s'il le juge
  // utile (ex. volet mixte non encore tagué comme tel par A1).
  const hasNonQuestionnaireDominantTag = NON_QUESTIONNAIRE_DOMINANT_TAGS.some((tag) =>
    modeTags.includes(tag)
  );
  if (
    hasNonQuestionnaireDominantTag &&
    !hasTag("QUANTITATIVE_SURVEY") &&
    !hasTag("MIXED_METHOD")
  ) {
    toValidate.push(
      "Un questionnaire n'est peut-être pas l'outil de collecte principal ici — le sujet semble reposer sur des données financières ou déjà existantes plutôt que sur une enquête. Voir le tableau des données nécessaires dans la compréhension du sujet."
    );
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
    recommendedInstrument,
    analysisPlan,
    toValidate,
    readinessPercent,
    levelGuidance,
    limitations,
    ethicalConsiderations,
  };
}
