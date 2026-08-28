import type { ResearchData } from "@/types/Research";

/* =========================================================
   ACADIA — METHODOLOGY ENGINE
   Moteur méthodologique déterministe

   NOUVELLE ARCHITECTURE :

   A1 → Compréhension du sujet
   A2 → Variables / dimensions / indicateurs
   A3 → Méthodologie
   SamplingEngine → Échantillon

   IMPORTANT :
   - Ce moteur NE décide plus des variables.
   - Ce moteur NE construit plus les indicateurs.
   - Ce moteur NE génère plus les hypothèses.
   - Ces éléments appartiennent désormais aux moteurs
     intelligents spécialisés.
   - Ce moteur fournit les règles méthodologiques stables.
========================================================= */


/* =========================================================
   RESULTAT
========================================================= */

export interface MethodologyResult {
  /* Méthodologie */
  approach: string;
  method: string;
  techniques: string[];
  instruments: string[];
  analyses: string[];

  /* Compatibilité avec l'ancien système.
     Ces champs seront progressivement alimentés
     par A2 / A4 et non plus par ce moteur. */
  variables: string[];
  indicators: string[];
  hypotheses: string[];

  /* Contrôles */
  problemAnalysis: string;
  objectiveAnalysis: string;

  recommendations: string[];
  warnings: string[];

  coherenceScore: number;
}


/* =========================================================
   MOTEUR PRINCIPAL
========================================================= */

export function generateMethodology(
  research: ResearchData
): MethodologyResult {

  const approach =
    determineApproach(research);

  const method =
    determineMethod(
      research,
      approach
    );

  const techniques =
    determineTechniques(research);

  const instruments =
    determineInstruments(research);

  const analyses =
    determineAnalyses(
      research
    );

  const problemAnalysis =
    analyzeProblem(research);

  const objectiveAnalysis =
    analyzeObjectives(research);

  const recommendations =
    generateRecommendations(
      research,
      approach,
      method,
      techniques
    );

  const warnings =
    generateWarnings(research);

  const coherenceScore =
    calculateCoherence(research);


  return {

    /* -------------------------
       MÉTHODOLOGIE
    ------------------------- */

    approach,

    method,

    techniques,

    instruments,

    analyses,


    /* -------------------------
       DÉLÉGUÉ À A2 / A4
    ------------------------- */

    variables: [],

    indicators: [],

    hypotheses: [],


    /* -------------------------
       CONTRÔLES
    ------------------------- */

    problemAnalysis,

    objectiveAnalysis,

    recommendations,

    warnings,

    coherenceScore,
  };
}


/* =========================================================
   APPROCHE
========================================================= */

function determineApproach(
  research: ResearchData
): string {

  const type =
    (research.researchType ?? "")
      .toLowerCase()
      .trim();


  if (
    type.includes("quant")
  ) {
    return "Approche quantitative";
  }


  if (
    type.includes("qual")
  ) {
    return "Approche qualitative";
  }


  if (
    type.includes("mix")
  ) {
    return "Approche mixte";
  }


  /*
   * Proposition automatique lorsque
   * le type n'est pas encore renseigné.
   */

  if (
    (research.objectives ?? []).length > 0 &&
    Number(research.populationSize) > 0
  ) {
    return "Approche quantitative proposée";
  }


  return "Approche à déterminer";
}


/* =========================================================
   MÉTHODE
========================================================= */

function determineMethod(
  research: ResearchData,
  approach: string
): string {

  void research;


  if (
    approach
      .toLowerCase()
      .includes("qualitative")
  ) {
    return "Méthode compréhensive";
  }


  if (
    approach
      .toLowerCase()
      .includes("quantitative")
  ) {
    return "Méthode hypothético-déductive";
  }


  if (
    approach
      .toLowerCase()
      .includes("mixte")
  ) {
    return "Méthode mixte";
  }


  return "Méthode à déterminer";
}


/* =========================================================
   TECHNIQUES
========================================================= */

function determineTechniques(
  research: ResearchData
): string[] {

  const techniques: string[] = [];

  const collection =
    (research.collectionMethod ?? "")
      .toLowerCase()
      .trim();

  const type =
    (research.researchType ?? "")
      .toLowerCase()
      .trim();


  /*
   * Technique explicitement fournie
   */

  if (collection) {

    techniques.push(
      capitalize(collection)
    );
  }


  /*
   * QUANTITATIVE
   */

  if (
    type.includes("quant")
  ) {

    addIfMissing(
      techniques,
      "Questionnaire"
    );
  }


  /*
   * QUALITATIVE
   */

  if (
    type.includes("qual")
  ) {

    addIfMissing(
      techniques,
      "Entretien"
    );

    addIfMissing(
      techniques,
      "Observation"
    );
  }


  /*
   * MIXTE
   */

  if (
    type.includes("mix")
  ) {

    addIfMissing(
      techniques,
      "Questionnaire"
    );

    addIfMissing(
      techniques,
      "Entretien"
    );
  }


  if (
    techniques.length === 0
  ) {

    techniques.push(
      "À déterminer"
    );
  }


  return techniques;
}


/* =========================================================
   INSTRUMENTS
========================================================= */

function determineInstruments(
  research: ResearchData
): string[] {

  const instruments: string[] = [];

  const type =
    (research.researchType ?? "")
      .toLowerCase()
      .trim();


  if (
    type.includes("quant")
  ) {

    instruments.push(
      "Questionnaire structuré"
    );
  }


  if (
    type.includes("qual")
  ) {

    instruments.push(
      "Guide d'entretien"
    );

    instruments.push(
      "Grille d'observation"
    );
  }


  if (
    type.includes("mix")
  ) {

    instruments.push(
      "Questionnaire structuré"
    );

    instruments.push(
      "Guide d'entretien"
    );
  }


  if (
    instruments.length === 0
  ) {

    instruments.push(
      "À déterminer"
    );
  }


  return instruments;
}


/* =========================================================
   ANALYSES
========================================================= */

function determineAnalyses(
  research: ResearchData
): string[] {

  const type =
    (research.researchType ?? "")
      .toLowerCase()
      .trim();


  /* -------------------------
     QUALITATIVE
  ------------------------- */

  if (
    type.includes("qual")
  ) {

    return [
      "Analyse thématique",
      "Analyse de contenu",
      "Analyse comparative des discours",
    ];
  }


  /* -------------------------
     MIXTE
  ------------------------- */

  if (
    type.includes("mix")
  ) {

    return [
      "Statistiques descriptives",
      "Analyse comparative",
      "Analyse de corrélation",
      "Analyse thématique",
      "Triangulation des résultats",
    ];
  }


  /* -------------------------
     QUANTITATIVE
  ------------------------- */

  if (
    type.includes("quant")
  ) {

    return [
      "Statistiques descriptives",
      "Fréquences et pourcentages",
      "Moyennes et écarts-types",
      "Analyse de corrélation",
      "Analyse de régression",
    ];
  }


  return [
    "Analyse à déterminer",
  ];
}


/* =========================================================
   ANALYSE DU PROBLÈME
========================================================= */

function analyzeProblem(
  research: ResearchData
): string {

  const problem =
    (research.problem ?? "")
      .trim();


  if (!problem) {

    return (
      "La problématique n'a pas encore été renseignée."
    );
  }


  if (
    problem.length < 30
  ) {

    return (
      "La problématique semble encore trop courte. " +
      "ACADIA recommande de préciser le phénomène " +
      "observé, ses causes éventuelles et ses conséquences."
    );
  }


  return (
    "La problématique a été renseignée. " +
    "ACADIA vérifiera sa cohérence avec la compréhension " +
    "du sujet, les variables et les objectifs."
  );
}


/* =========================================================
   ANALYSE DES OBJECTIFS
========================================================= */

function analyzeObjectives(
  research: ResearchData
): string {

  const objective =
    (research.objective ?? "")
      .trim();

  const objectives =
    research.objectives ?? [];


  if (!objective) {

    return (
      "L'objectif général n'a pas encore été renseigné."
    );
  }


  if (
    objectives.length === 0
  ) {

    return (
      "L'objectif général est renseigné, " +
      "mais les objectifs spécifiques doivent encore être définis."
    );
  }


  return (
    `ACADIA a identifié ${objectives.length} ` +
    `objectif(s) spécifique(s) à mettre en relation ` +
    `avec l'objectif général.`
  );
}


/* =========================================================
   RECOMMANDATIONS
========================================================= */

function generateRecommendations(
  research: ResearchData,
  approach: string,
  method: string,
  techniques: string[]
): string[] {

  const recommendations: string[] = [];


  if (
    !(research.title ?? "").trim()
  ) {

    recommendations.push(
      "Précisez le titre de votre recherche."
    );
  }


  if (
    !(research.problem ?? "").trim()
  ) {

    recommendations.push(
      "Formulez clairement votre problématique."
    );
  }


  if (
    !(research.objective ?? "").trim()
  ) {

    recommendations.push(
      "Définissez votre objectif général."
    );
  }


  if (
    !(research.objectives ?? []).length
  ) {

    recommendations.push(
      "Ajoutez vos objectifs spécifiques."
    );
  }


  if (
    !(research.population ?? "").trim()
  ) {

    recommendations.push(
      "Définissez votre population d'étude."
    );
  }


  if (
    Number(research.populationSize) <= 0
  ) {

    recommendations.push(
      "Indiquez la taille de la population " +
      "pour calculer automatiquement l'échantillon."
    );
  }


  if (
    approach !==
    "Approche à déterminer"
  ) {

    recommendations.push(
      `${approach} proposée.`
    );
  }


  if (
    method !==
    "Méthode à déterminer"
  ) {

    recommendations.push(
      `${method} proposée.`
    );
  }


  if (
    techniques.length > 0
  ) {

    recommendations.push(
      "Les techniques de collecte peuvent maintenant " +
      "être vérifiées avec le contexte de la recherche."
    );
  }


  /*
   * IMPORTANT :
   *
   * Les variables ne sont plus générées ici.
   *
   * Elles proviennent de :
   *
   * A1 → compréhension
   * A2 → variables / dimensions / indicateurs
   */

  recommendations.push(
    "Les variables et leurs dimensions doivent être " +
    "validées par le moteur A2 avant la construction " +
    "des hypothèses et du questionnaire."
  );


  return recommendations;
}


/* =========================================================
   AVERTISSEMENTS
========================================================= */

function generateWarnings(
  research: ResearchData
): string[] {

  const warnings: string[] = [];


  if (
    !(research.problem ?? "").trim()
  ) {

    warnings.push(
      "La problématique est absente."
    );
  }


  if (
    !(research.objective ?? "").trim()
  ) {

    warnings.push(
      "L'objectif général est absent."
    );
  }


  if (
    !(research.objectives ?? []).length
  ) {

    warnings.push(
      "Aucun objectif spécifique n'a été renseigné."
    );
  }


  if (
    !(research.population ?? "").trim()
  ) {

    warnings.push(
      "La population d'étude n'est pas précisée."
    );
  }


  if (
    !(research.researchType ?? "")
      .trim()
  ) {

    warnings.push(
      "Le type de recherche n'a pas encore été déterminé."
    );
  }


  return warnings;
}


/* =========================================================
   SCORE DE COHÉRENCE
========================================================= */

function calculateCoherence(
  research: ResearchData
): number {

  let score = 0;


  /* -------------------------
     IDENTIFICATION
  ------------------------- */

  if (
    (research.title ?? "").trim()
  ) score += 10;

  if (
    (research.domain ?? "").trim()
  ) score += 5;

  if (
    (research.level ?? "").trim()
  ) score += 5;

  if (
    (research.university ?? "").trim()
  ) score += 5;


  /* -------------------------
     PROBLÉMATIQUE
  ------------------------- */

  if (
    (research.problem ?? "").trim()
  ) {

    score += 15;

    if (
      research.problem.trim().length >= 100
    ) {
      score += 5;
    }
  }


  /* -------------------------
     OBJECTIFS
  ------------------------- */

  if (
    (research.objective ?? "").trim()
  ) {

    score += 10;
  }


  if (
    (research.objectives ?? []).length >= 1
  ) {

    score += 5;
  }


  if (
    (research.objectives ?? []).length >= 3
  ) {

    score += 5;
  }


  /* -------------------------
     POPULATION
  ------------------------- */

  if (
    (research.population ?? "").trim()
  ) {

    score += 10;
  }


  if (
    Number(research.populationSize) > 0
  ) {

    score += 10;
  }


  /* -------------------------
     MÉTHODOLOGIE
  ------------------------- */

  if (
    (research.researchType ?? "").trim()
  ) {

    score += 5;
  }


  if (
    (research.location ?? "").trim()
  ) {

    score += 5;
  }


  if (
    (research.collectionMethod ?? "").trim()
  ) {

    score += 5;
  }


  return Math.min(
    Math.round(score),
    100
  );
}


/* =========================================================
   UTILITAIRES
========================================================= */

function addIfMissing(
  array: string[],
  value: string
) {

  if (
    !array.includes(value)
  ) {

    array.push(value);
  }
}


function capitalize(
  value: string
): string {

  return (
    value.charAt(0).toUpperCase() +
    value.slice(1)
  );
}