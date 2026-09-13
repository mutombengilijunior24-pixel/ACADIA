// ============================================================
// ACADIA — RESEARCH CONSISTENCY ENGINE
//
// Moteur déterministe de vérification de cohérence scientifique.
// Aucun appel OpenAI ici — uniquement des règles structurelles
// appliquées à un ResearchProject déjà construit (par A0 seul,
// ou après A1/A2/AIResearchAdapter).
//
// Ce moteur ne mesure PAS la qualité scientifique d'une
// recherche. Il vérifie que les structures internes du projet
// (sujet, objectifs, variables, relations, hypothèses,
// opérationnalisation) sont mutuellement cohérentes et repère
// les incohérences structurelles évidentes.
// ============================================================

import type {
  ResearchProject,
  ResearchVariable,
} from "./ResearchTypes";

import type { TheoreticalFrameworkEntry } from "./TheoreticalFrameworkTypes";
import { THEORY_TO_REGISTER } from "./TheoreticalFrameworkTypes";


// ============================================================
// TYPES DU RÉSULTAT
// ============================================================

export type ConsistencySeverity =
  | "pass"
  | "warning"
  | "needs_review"
  | "error";

export interface ConsistencyCheckItem {
  id: string;
  category: string;
  severity: ConsistencySeverity;
  title: string;
  message: string;
  relatedVariableId?: string;
  relatedHypothesisId?: string;
  relatedRelationId?: string;
  suggestion?: string;
}

export interface EconometricReadinessItem {
  label: string;
  met: boolean;
  detail?: string;
}

export interface EconometricReadiness {
  ratio: number;
  total: number;
  score: string;
  items: EconometricReadinessItem[];
}

export interface ConsistencyScoreSummary {
  pass: number;
  warning: number;
  needsReview: number;
  error: number;
  total: number;
}

export interface ResearchConsistencyResult {
  status: "pass" | "needs_review" | "error";
  score: ConsistencyScoreSummary;
  checks: ConsistencyCheckItem[];
  readiness: EconometricReadiness;
}


// ============================================================
// UTILITAIRE
// ============================================================

function clean(value?: string | null): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

function countIndicators(variable: ResearchVariable): number {
  const direct = variable.indicators?.length ?? 0;
  const nested = (variable.dimensions ?? []).reduce(
    (sum, dimension) => sum + (dimension.indicators?.length ?? 0),
    0
  );
  return direct + nested;
}


// ============================================================
// MOTEUR PRINCIPAL
// ============================================================

export function checkResearchConsistency(
  project: ResearchProject,
  theoreticalFrameworkEntries: TheoreticalFrameworkEntry[] = []
): ResearchConsistencyResult {

  const checks: ConsistencyCheckItem[] = [];
  let nextId = 1;

  function push(
    item: Omit<ConsistencyCheckItem, "id">
  ) {
    checks.push({ id: `check-${nextId++}`, ...item });
  }

  // ==========================================================
  // CHECK 1 — SUJET
  // ==========================================================

  const title = clean(project.title);

  if (!title) {
    push({
      category: "Sujet",
      severity: "error",
      title: "Sujet manquant",
      message: "Aucun sujet de recherche n'est renseigné.",
      suggestion: "Renseigner le sujet dans le Wizard avant de poursuivre.",
    });
  } else if (title.split(" ").length < 4) {
    push({
      category: "Sujet",
      severity: "warning",
      title: "Sujet très court",
      message: "Le sujet semble insuffisamment précisé pour orienter le cadrage.",
    });
  } else {
    push({
      category: "Sujet",
      severity: "pass",
      title: "Sujet renseigné",
      message: "Le sujet de recherche est présent et suffisamment développé.",
    });
  }

  // ==========================================================
  // CHECK 2 — QUESTION DE RECHERCHE
  //
  // ResearchProject.researchQuestions existe dans le modèle mais
  // n'est produit par aucun moteur actif à ce stade (A0/A1/A2) —
  // absence attendue aujourd'hui, donc WARNING et non ERROR.
  // ==========================================================

  if (!project.researchQuestions || project.researchQuestions.length === 0) {
    push({
      category: "Question de recherche",
      severity: "warning",
      title: "Question de recherche non formulée",
      message: "Aucune question de recherche explicite n'est encore rattachée au projet.",
      suggestion: "Écrire la question de recherche dans la section \"Question & objectifs\".",
    });
  } else {
    push({
      category: "Question de recherche",
      severity: "pass",
      title: "Question de recherche présente",
      message: `${project.researchQuestions.length} question(s) de recherche renseignée(s).`,
    });
  }

  // ==========================================================
  // CHECK 3 — OBJECTIFS
  // ==========================================================

  const generalObjectives = project.objectives.filter((o) => o.role === "general");
  const specificObjectives = project.objectives.filter((o) => o.role === "specific");

  if (generalObjectives.length === 0) {
    push({
      category: "Objectifs",
      severity: "error",
      title: "Objectif général manquant",
      message: "Aucun objectif général n'est défini.",
      suggestion: "Écrire l'objectif général dans la section \"Question & objectifs\".",
    });
  } else {
    push({
      category: "Objectifs",
      severity: "pass",
      title: "Objectif général présent",
      message: "L'objectif général est défini.",
    });
  }

  if (specificObjectives.length === 0) {
    push({
      category: "Objectifs",
      severity: "warning",
      title: "Objectifs spécifiques absents",
      message: "Aucun objectif spécifique n'est encore défini.",
      suggestion: "Ajouter au moins un objectif spécifique dans la section \"Question & objectifs\".",
    });
  } else {
    push({
      category: "Objectifs",
      severity: "pass",
      title: "Objectifs spécifiques présents",
      message: `${specificObjectives.length} objectif(s) spécifique(s) défini(s).`,
    });
  }

  const objectiveIds = new Set(project.objectives.map((o) => o.id));
  if (objectiveIds.size !== project.objectives.length) {
    push({
      category: "Objectifs",
      severity: "warning",
      title: "Identifiants d'objectifs dupliqués",
      message: "Plusieurs objectifs partagent le même identifiant.",
    });
  }

  // ==========================================================
  // CHECK 4 — VARIABLES
  // ==========================================================

  if (project.variables.length === 0) {
    push({
      category: "Variables",
      severity: "warning",
      title: "Aucune variable identifiée",
      message: "Les variables de recherche ne sont pas encore identifiées.",
      suggestion: "Lancer l'analyse en profondeur pour qu'ACADIA propose des variables à partir du sujet.",
    });
  } else {
    push({
      category: "Variables",
      severity: "pass",
      title: "Variables identifiées",
      message: `${project.variables.length} variable(s) identifiée(s).`,
    });
  }

  for (const variable of project.variables) {

    if (!variable.role) {
      push({
        category: "Variables",
        severity: "error",
        title: `Variable "${variable.name}" sans rôle`,
        message: "Le rôle de la variable est obligatoire et n'est pas défini.",
        relatedVariableId: variable.id,
      });
    }

    if (!clean(variable.definition) || variable.definition === "Définition à préciser.") {
      push({
        category: "Variables",
        severity: "warning",
        title: `Variable "${variable.name}" sans définition`,
        message: "La variable ne possède pas encore de définition exploitable.",
        relatedVariableId: variable.id,
      });
    }

    if (countIndicators(variable) === 0) {
      push({
        category: "Variables",
        severity: "warning",
        title: `Variable "${variable.name}" non opérationnalisée`,
        message: `La variable "${variable.name}" n'est pas encore suffisamment opérationnalisée (aucun indicateur).`,
        relatedVariableId: variable.id,
        suggestion: "Ajouter au moins une dimension et un indicateur mesurable.",
      });
    }
  }

  // ==========================================================
  // CHECK 5 — RELATIONS
  // ==========================================================

  const variableIds = new Set(project.variables.map((v) => v.id));

  for (const relation of project.relations ?? []) {

    if (!clean(relation.relation)) {
      push({
        category: "Relations",
        severity: "error",
        title: "Relation sans type défini",
        message: "Une relation ne précise pas la nature du lien entre les deux concepts.",
        relatedRelationId: relation.id,
      });
      continue;
    }

    const fromExists = variableIds.has(relation.from);
    const toExists = variableIds.has(relation.to);

    if (relation.status === "needs_review") {
      push({
        category: "Relations",
        severity: "needs_review",
        title: "Relation à confirmer",
        message: `La relation entre "${relation.from}" et "${relation.to}" n'a pas pu être résolue avec certitude vers des variables existantes.`,
        relatedRelationId: relation.id,
        suggestion: "Vérifier manuellement la correspondance entre les concepts et les variables.",
      });
    } else if (!fromExists || !toExists) {
      push({
        category: "Relations",
        severity: "error",
        title: "Relation vers une variable inexistante",
        message: `La relation "${relation.id}" référence une variable qui n'existe pas dans le projet.`,
        relatedRelationId: relation.id,
      });
    } else {
      push({
        category: "Relations",
        severity: "pass",
        title: "Relation cohérente",
        message: `La relation "${relation.relation}" entre les deux variables est correctement résolue.`,
        relatedRelationId: relation.id,
      });
    }
  }

  // ==========================================================
  // CHECK 6 / CHECK 8 — HYPOTHÈSES
  // ==========================================================

  for (const hypothesis of project.hypotheses ?? []) {

    if (!clean(hypothesis.statement)) {
      push({
        category: "Hypothèses",
        severity: "error",
        title: "Hypothèse sans formulation",
        message: "Une hypothèse ne possède pas de formulation.",
        relatedHypothesisId: hypothesis.id,
      });
      continue;
    }

    const hypothesisVariableIds = hypothesis.variableIds ?? [];

    if (hypothesisVariableIds.length === 0) {
      push({
        category: "Hypothèses",
        severity: "warning",
        title: `Hypothèse "${hypothesis.id}" insuffisamment opérationnalisée`,
        message: "Hypothèse insuffisamment opérationnalisée.",
        relatedHypothesisId: hypothesis.id,
        suggestion: "Relier explicitement l'hypothèse aux variables concernées.",
      });
      continue;
    }

    const missingVariables = hypothesisVariableIds.filter(
      (id) => !variableIds.has(id)
    );

    if (missingVariables.length > 0) {
      push({
        category: "Hypothèses",
        severity: "error",
        title: `Hypothèse "${hypothesis.id}" référence une variable inexistante`,
        message: `L'hypothèse référence une ou plusieurs variables absentes du projet (${missingVariables.join(", ")}).`,
        relatedHypothesisId: hypothesis.id,
      });
    } else {
      push({
        category: "Hypothèses",
        severity: "pass",
        title: `Hypothèse "${hypothesis.id}" structurée`,
        message: "L'hypothèse est formulée et correctement reliée à des variables existantes.",
        relatedHypothesisId: hypothesis.id,
      });
    }
  }

  // ==========================================================
  // CHECK 7 — OPÉRATIONNALISATION (dimensions / indicateurs)
  // ==========================================================

  for (const variable of project.variables) {

    for (const dimension of variable.dimensions ?? []) {

      if (dimension.variableId !== variable.id) {
        push({
          category: "Opérationnalisation",
          severity: "error",
          title: "Dimension mal rattachée",
          message: `La dimension "${dimension.name}" ne référence pas correctement sa variable parente.`,
          relatedVariableId: variable.id,
        });
      }

      for (const indicator of dimension.indicators ?? []) {
        if (indicator.dimensionId !== dimension.id) {
          push({
            category: "Opérationnalisation",
            severity: "error",
            title: "Indicateur mal rattaché",
            message: `L'indicateur "${indicator.name}" ne référence pas correctement sa dimension parente.`,
            relatedVariableId: variable.id,
          });
        }
      }
    }
  }

  // ==========================================================
  // CHECK 9 — OBJECTIFS → VARIABLES
  //
  // Règle structurelle uniquement (pas d'IA) : on vérifie si la
  // variable déclare un lien explicite vers un objectif. Le
  // pipeline actuel ne renseigne pas encore ce lien — l'absence
  // est donc un signal "à valider", pas une erreur.
  // ==========================================================

  for (const variable of project.variables) {
    if (!variable.linkedObjectiveIds || variable.linkedObjectiveIds.length === 0) {
      push({
        category: "Objectifs ↔ Variables",
        severity: "needs_review",
        title: `Variable "${variable.name}" non reliée à un objectif`,
        message: `La variable "${variable.name}" n'est reliée à aucun objectif spécifique.`,
        relatedVariableId: variable.id,
      });
    } else {
      push({
        category: "Objectifs ↔ Variables",
        severity: "pass",
        title: `Variable "${variable.name}" reliée à un objectif`,
        message: "La variable est explicitement rattachée à au moins un objectif.",
        relatedVariableId: variable.id,
      });
    }
  }

  // ==========================================================
  // CHECK 11 — CADRE THÉORIQUE (P13.2)
  //
  // ACADIA ne déduit ni n'invente jamais un cadre théorique. Un
  // cadre "non renseigné" est un état valide et explicite
  // (needs_review, jamais error) — pas une absence dissimulée.
  // ==========================================================

  if (theoreticalFrameworkEntries.length === 0) {
    push({
      category: "Cadre théorique",
      severity: "needs_review",
      title: "Cadre théorique non renseigné",
      message: THEORY_TO_REGISTER,
      suggestion: "Ajouter un cadre théorique depuis la section dédiée.",
    });
  } else {
    push({
      category: "Cadre théorique",
      severity: "pass",
      title: "Cadre théorique renseigné",
      message: `${theoreticalFrameworkEntries.length} élément(s) de cadre théorique renseigné(s) par le chercheur.`,
    });
  }

  // ==========================================================
  // CHECK 12 — STRUCTURE DES HYPOTHÈSES (principale / secondaires)
  //
  // ResearchHypothesis.role ("general" = principale, "specific" =
  // secondaire) existe déjà dans le modèle mais n'était jamais
  // exploité par une vérification. Ne jamais forcer un nombre
  // d'hypothèses — seulement signaler une structure ambiguë.
  // ==========================================================

  const activeHypotheses = (project.hypotheses ?? []).filter((h) => h.status !== "rejected");

  if (activeHypotheses.length > 0) {
    const principal = activeHypotheses.filter((h) => h.role === "general");
    const secondary = activeHypotheses.filter((h) => h.role === "specific");
    const unclassified = activeHypotheses.length - principal.length - secondary.length;

    if (principal.length === 0) {
      push({
        category: "Structure des hypothèses",
        severity: "needs_review",
        title: "Aucune hypothèse principale identifiée",
        message: "Aucune des hypothèses actives n'est marquée comme hypothèse principale.",
        suggestion: "Désigner explicitement une hypothèse principale (H).",
      });
    } else if (principal.length > 1) {
      push({
        category: "Structure des hypothèses",
        severity: "warning",
        title: "Plusieurs hypothèses principales",
        message: `${principal.length} hypothèses sont marquées comme principales — une seule hypothèse principale est attendue.`,
      });
    } else {
      push({
        category: "Structure des hypothèses",
        severity: "pass",
        title: "Hypothèse principale identifiée",
        message: `1 hypothèse principale et ${secondary.length} hypothèse(s) secondaire(s).`,
      });
    }

    if (unclassified > 0) {
      push({
        category: "Structure des hypothèses",
        severity: "needs_review",
        title: "Hypothèse(s) non classée(s)",
        message: `${unclassified} hypothèse(s) n'est/ne sont ni marquée(s) principale ni secondaire.`,
      });
    }
  }

  // ==========================================================
  // CHECKS A-H — COHÉRENCE MÉTHODOLOGIQUE (P3, Partie 4)
  //
  // Règles structurelles déterministes uniquement — aucune
  // logique IA. Ces checks comparent des champs déjà existants
  // (méthodologie, variables, hypothèses, relations) entre eux.
  // ==========================================================

  const methodology = project.methodology;
  const techniques = methodology?.techniques ?? [];
  const normalizedTechniques = techniques
    .map((t) => clean(t).toLowerCase())
    .join(" | ");

  const hasDependentVariable = project.variables.some((v) => v.role === "dependent");
  const specificObjectivesExist = project.objectives.some((o) => o.role === "specific");

  // CHECK A — Orientation ↔ technique de collecte
  if (methodology?.approach === "qualitative" && normalizedTechniques.includes("questionnaire") && !normalizedTechniques.includes("entretien")) {
    push({
      category: "Méthodologie",
      severity: "warning",
      title: "Orientation ↔ technique de collecte",
      message: "L'orientation est qualitative mais la technique de collecte retenue (questionnaire) est habituellement associée à une approche quantitative.",
    });
  } else if (methodology?.approach === "quantitative" && (normalizedTechniques.includes("entretien") || normalizedTechniques.includes("observation")) && !normalizedTechniques.includes("questionnaire")) {
    push({
      category: "Méthodologie",
      severity: "warning",
      title: "Orientation ↔ technique de collecte",
      message: "L'orientation est quantitative mais la technique de collecte retenue est habituellement associée à une approche qualitative.",
    });
  } else {
    push({
      category: "Méthodologie",
      severity: "pass",
      title: "Orientation ↔ technique de collecte",
      message: "L'orientation et la technique de collecte ne présentent pas d'incohérence apparente.",
    });
  }

  // CHECK B — Objectifs ↔ méthodes de collecte
  if (specificObjectivesExist && techniques.length === 0) {
    push({
      category: "Méthodologie",
      severity: "warning",
      title: "Objectifs sans méthode de collecte",
      message: "Des objectifs spécifiques sont définis mais aucune méthode de collecte n'est encore choisie.",
    });
  }

  // CHECK C — Variables ↔ instruments
  if (project.variables.length > 0 && (methodology?.instruments ?? []).length === 0) {
    push({
      category: "Méthodologie",
      severity: "needs_review",
      title: "Variables sans instrument déclaré",
      message: "Des variables sont identifiées mais aucun instrument de mesure n'est encore déclaré.",
    });
  }

  // CHECK D — Hypothèses ↔ orientation quantitative
  if ((project.hypotheses ?? []).length > 0 && methodology?.approach === "qualitative") {
    push({
      category: "Méthodologie",
      severity: "warning",
      title: "Hypothèses ↔ orientation",
      message: "Des hypothèses de relation entre variables sont formulées alors que l'orientation retenue est qualitative — à vérifier.",
    });
  }

  // CHECK E — Population ↔ échantillon
  if (methodology?.population && !methodology?.sampleSize && !methodology?.samplingMethod) {
    push({
      category: "Méthodologie",
      severity: "needs_review",
      title: "Population sans échantillonnage",
      message: "La population est définie mais aucune technique ni taille d'échantillon n'est encore précisée.",
    });
  }

  // CHECK F — Variables ↔ analyse prévue
  if (
    project.variables.some((v) => v.role === "independent") &&
    hasDependentVariable &&
    (methodology?.analysisMethods ?? []).length === 0 &&
    (project.relations ?? []).length === 0
  ) {
    push({
      category: "Méthodologie",
      severity: "needs_review",
      title: "Variables sans analyse prévue",
      message: "Une variable indépendante et une variable dépendante sont identifiées mais aucune méthode d'analyse n'est encore précisée.",
    });
  }

  // CHECK G — Données disponibles ↔ méthode d'analyse
  if (techniques.length === 0 && (methodology?.analysisMethods ?? []).length > 0) {
    push({
      category: "Méthodologie",
      severity: "error",
      title: "Analyse prévue sans collecte définie",
      message: "Une méthode d'analyse est prévue alors qu'aucune méthode de collecte de données n'est définie.",
    });
  }

  // CHECK H — Préparation économétrique ↔ variable dépendante
  if (
    (project.hypotheses ?? []).length > 0 &&
    methodology?.approach !== "qualitative" &&
    !hasDependentVariable
  ) {
    push({
      category: "Méthodologie",
      severity: "error",
      title: "Hypothèse sans variable dépendante",
      message: "Une hypothèse existe mais aucune variable dépendante n'est identifiée.",
    });
  }

  // ==========================================================
  // CHECKS I-K — RESEARCH INTELLIGENCE V3
  //
  // Règles déterministes supplémentaires exploitant les tags de mode
  // et le tableau de phénomène produits par A1 — toujours structurel,
  // aucune décision IA : l'IA ne doit pas être seule juge de la
  // cohérence de ce qu'elle propose.
  // ==========================================================

  const understanding = project.understanding;
  const modeTags = understanding?.researchModeTags ?? [];

  // CHECK I — Mode qualitatif ↔ questionnaire recommandé
  const isQualitativeOnly =
    modeTags.includes("QUALITATIVE") &&
    !modeTags.includes("QUANTITATIVE_SURVEY") &&
    !modeTags.includes("MIXED_METHOD");

  if (
    isQualitativeOnly &&
    (methodology?.instruments ?? []).some((i) => clean(i).toLowerCase().includes("questionnaire"))
  ) {
    push({
      category: "Méthodologie",
      severity: "warning",
      title: "Questionnaire recommandé pour une recherche qualitative",
      message: "ACADIA a identifié ce sujet comme purement qualitatif (aucun tag QUANTITATIVE_SURVEY ni MIXED_METHOD), mais un questionnaire figure parmi les instruments déclarés.",
      suggestion: "Vérifier si un guide d'entretien ne serait pas plus adapté, ou confirmer explicitement une composante quantitative.",
    });
  }

  // CHECK J — Tableau du phénomène : statut SOURCED sans source citée
  //
  // "SOURCED" ne doit jamais qualifier une donnée sans provenance
  // réelle — sinon le tableau présente une proposition comme un fait
  // documenté (voir mission V3 §10, dernier exemple).
  for (const row of understanding?.phenomenonTable ?? []) {
    if (row.status === "SOURCED" && !clean(row.source)) {
      push({
        category: "Phénomène",
        severity: "error",
        title: `Élément "${row.indicator}" marqué SOURCED sans source citée`,
        message: "Une ligne du tableau de structuration du phénomène est marquée comme sourcée (SOURCED) sans qu'aucune source ne soit renseignée.",
        suggestion: "Renseigner la source réelle, ou revenir à un statut TO_VERIFY/MISSING tant qu'aucune source n'est confirmée.",
      });
    }
  }

  // CHECK K — Variable potentiellement incohérente avec le sujet
  //
  // Heuristique structurelle légère (mots partagés avec les concepts/
  // phénomène/problème identifiés par A1) — ne juge jamais la
  // pertinence scientifique, seulement un décrochage lexical total
  // qui mérite d'être vérifié par le chercheur, jamais bloquant.
  const subjectVocabulary = new Set(
    [
      ...(understanding?.mainConcepts ?? []),
      understanding?.phenomenon ?? "",
      understanding?.problem ?? "",
      project.title ?? "",
    ]
      .join(" ")
      .toLowerCase()
      .split(/[^a-zàâçéèêëîïôûùüÿñæœ0-9]+/)
      .filter((word) => word.length >= 4)
  );

  if (subjectVocabulary.size > 0) {
    for (const variable of project.variables) {
      const variableWords = clean(variable.name)
        .toLowerCase()
        .split(/[^a-zàâçéèêëîïôûùüÿñæœ0-9]+/)
        .filter((word) => word.length >= 4);

      const hasOverlap = variableWords.some((word) => subjectVocabulary.has(word));

      if (variableWords.length > 0 && !hasOverlap) {
        push({
          category: "Variables",
          severity: "needs_review",
          title: `Variable "${variable.name}" potentiellement incohérente avec le sujet`,
          message: `Aucun mot de la variable "${variable.name}" ne se retrouve dans le sujet, le phénomène ou les concepts identifiés par ACADIA.`,
          relatedVariableId: variable.id,
          suggestion: "Vérifier que cette variable correspond bien au sujet étudié.",
        });
      }
    }
  }

  // ==========================================================
  // SCORE GLOBAL
  // ==========================================================

  const score: ConsistencyScoreSummary = {
    pass: checks.filter((c) => c.severity === "pass").length,
    warning: checks.filter((c) => c.severity === "warning").length,
    needsReview: checks.filter((c) => c.severity === "needs_review").length,
    error: checks.filter((c) => c.severity === "error").length,
    total: checks.length,
  };

  const status: ResearchConsistencyResult["status"] =
    score.error > 0
      ? "error"
      : score.needsReview > 0 || score.warning > 0
      ? "needs_review"
      : "pass";

  // ==========================================================
  // CHECK 10 — ECONOMETRIC READINESS
  //
  // Diagnostic de PRÉPARATION STRUCTURELLE uniquement — ne
  // mesure jamais la qualité scientifique, et ne déclenche
  // aucun calcul économétrique.
  // ==========================================================

  const hasDependent = project.variables.some((v) => v.role === "dependent");
  const hasIndependent = project.variables.some((v) => v.role === "independent");
  const hasHypotheses = (project.hypotheses ?? []).length > 0;
  const hasIndicators = project.variables.some((v) => countIndicators(v) > 0);
  const hasMeasures = project.variables.some((v) =>
    (v.dimensions ?? []).some((d) =>
      (d.indicators ?? []).some((i) => Boolean(i.measurementType))
    )
  );
  const hasDataset = false; // Le modèle Dataset n'existe pas encore (hors périmètre de ce bloc).

  const readinessItems: EconometricReadinessItem[] = [
    { label: "Variable dépendante identifiée", met: hasDependent },
    { label: "Variables explicatives identifiées", met: hasIndependent },
    { label: "Hypothèses présentes", met: hasHypotheses },
    { label: "Indicateurs présents", met: hasIndicators },
    { label: "Mesures définies", met: hasMeasures, detail: hasMeasures ? undefined : "Mesures à définir" },
    { label: "Dataset structuré", met: hasDataset, detail: "Dataset inexistant" },
  ];

  const readinessMet = readinessItems.filter((item) => item.met).length;

  const readiness: EconometricReadiness = {
    ratio: readinessMet,
    total: readinessItems.length,
    score: `${readinessMet} / ${readinessItems.length}`,
    items: readinessItems,
  };

  return {
    status,
    score,
    checks,
    readiness,
  };
}


// ============================================================
// RESEARCH INTEGRITY READINESS (P13.2, Étape 22)
//
// Une bande de préparation globale de la chaîne scientifique
// (problématique → objectifs → cadre théorique → hypothèses →
// variables → indicateurs → questionnaire → méthodologie),
// dérivée du même score pondéré déjà éprouvé pour la readiness
// scientifique du document final (P11) — jamais un 100 % simplement
// parce qu'un objet existe : une population inconnue ou un cadre
// théorique non renseigné réduit réellement le score (needs_review
// pèse moins qu'un pass, jamais autant).
// ============================================================

export type ResearchIntegrityLevel = "incomplete" | "in_preparation" | "almost_ready" | "ready_for_review";

export interface ResearchIntegrityReadiness {
  score: number;
  level: ResearchIntegrityLevel;
  label: string;
}

export function computeResearchIntegrityReadiness(score: ConsistencyScoreSummary): ResearchIntegrityReadiness {
  const total = score.total;
  const weighted = score.pass * 1 + score.warning * 0.4 + score.needsReview * 0.2;
  const computed = total > 0 ? Math.round((weighted / total) * 100) : 0;

  let level: ResearchIntegrityLevel;
  let label: string;

  if (score.error > 0) {
    level = "incomplete";
    label = "Incohérences à corriger";
  } else if (computed < 50) {
    level = "incomplete";
    label = "Recherche à structurer";
  } else if (computed < 75) {
    level = "in_preparation";
    label = "Recherche en préparation";
  } else if (computed < 90) {
    level = "almost_ready";
    label = "Recherche presque structurée";
  } else {
    level = "ready_for_review";
    label = "Recherche structurée";
  }

  return { score: computed, level, label };
}
