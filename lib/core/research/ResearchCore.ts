// ============================================================
// ACADIA — RESEARCH CORE
//
// Responsabilité :
// ResearchData → ResearchProject
//
// Le Research Core construit la structure centrale d'un projet.
// Il ne fait PAS l'analyse IA approfondie des variables.
// Cette responsabilité appartient aux moteurs A1 / A2.
// ============================================================

import type { ResearchData } from "@/types/Research";

import type {
  ResearchProject,
  ResearchObjective,
  ResearchMethodology,
  ResearchVariable,
  ResearchQuestion,
  ResearchType,
  ResearchMetadata,
  ProposalStatus,
  ConfidenceLevel,
} from "./ResearchTypes";


// ============================================================
// UTILITAIRES
// ============================================================

function clean(value?: string): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}


// ============================================================
// NORMALISATION DU TYPE DE RECHERCHE
// ============================================================

function normalizeResearchType(
  value?: string
): ResearchType {
  const type = clean(value).toLowerCase();

  if (
    type.includes("mixte") ||
    type.includes("mixed") ||
    type.includes("mix")
  ) {
    return "mixed";
  }

  if (
    type.includes("qualitatif") ||
    type.includes("qualitative") ||
    type.includes("exploratoire")
  ) {
    return "qualitative";
  }

  return "quantitative";
}


// ============================================================
// STATUT INITIAL
// ============================================================

const INITIAL_PROPOSAL_STATUS: ProposalStatus =
  "accepted";

const INITIAL_CONFIDENCE: ConfidenceLevel =
  "high";


// ============================================================
// CONSTRUCTION DES OBJECTIFS
// ============================================================

function buildObjectives(
  research: ResearchData
): ResearchObjective[] {
  const objectives: ResearchObjective[] = [];

  // ----------------------------------------------------------
  // OBJECTIF GÉNÉRAL
  // ----------------------------------------------------------

  const generalObjective =
    clean(research.objective);

  if (generalObjective) {
    objectives.push({
      id: "objective-general",

      text: generalObjective,

      title: generalObjective,

      role: "general",

      type: "general",

      status:
        INITIAL_PROPOSAL_STATUS,

      confidence:
        INITIAL_CONFIDENCE,
    });
  }

  // ----------------------------------------------------------
  // OBJECTIFS SPÉCIFIQUES
  // ----------------------------------------------------------

  (research.objectives ?? []).forEach(
    (objective, index) => {
      const text = clean(objective);

      if (!text) {
        return;
      }

      objectives.push({
        id:
          `objective-specific-${index + 1}`,

        text,

        title: text,

        role: "specific",

        type: "specific",

        index: index + 1,

        order: index + 1,

        status:
          INITIAL_PROPOSAL_STATUS,

        confidence:
          INITIAL_CONFIDENCE,
      });
    }
  );

  return objectives;
}


// ============================================================
// CONSTRUCTION DES QUESTIONS DE RECHERCHE
//
// ACADIA ne fabrique jamais artificiellement une question
// scientifique. La seule question conservée ici est celle que
// le chercheur a DÉJÀ formulée lui-même sous forme interrogative
// dans le champ "problème" du Wizard (ex. "Dans quelle mesure...
// ?"). Aucune transformation de texte, aucune reformulation :
// on catalogue une donnée déjà fournie, on ne l'invente pas.
// ============================================================

function buildResearchQuestions(
  research: ResearchData
): ResearchQuestion[] {
  const statement = clean(research.problem);

  if (!statement || !statement.endsWith("?")) {
    return [];
  }

  return [
    {
      id: "question-main",
      text: statement,
      type: "main",
      status: INITIAL_PROPOSAL_STATUS,
      confidence: INITIAL_CONFIDENCE,
    },
  ];
}


// ============================================================
// CONSTRUCTION DES VARIABLES
//
// IMPORTANT :
//
// Le Research Core ne doit pas inventer les variables.
//
// Les variables scientifiques seront produites par :
// A1 → compréhension
// A2 → intelligence des variables
// puis converties par AIResearchAdapter.
//
// On initialise donc proprement le projet avec [].
// ============================================================

function buildVariables(): ResearchVariable[] {
  return [];
}


// ============================================================
// CONSTRUCTION DE LA MÉTHODOLOGIE INITIALE
// ============================================================

function buildMethodology(
  research: ResearchData
): ResearchMethodology {
  const researchType =
    normalizeResearchType(
      research.researchType
    );

  // ----------------------------------------------------------
  // MÉTHODE
  // ----------------------------------------------------------

  let method: string;

  switch (researchType) {
    case "qualitative":
      method =
        "Méthode compréhensive";
      break;

    case "mixed":
      method =
        "Méthode mixte";
      break;

    case "quantitative":
    default:
      method =
        "Méthode hypothético-déductive";
      break;
  }

  // ----------------------------------------------------------
  // TECHNIQUES
  // ----------------------------------------------------------

  const techniques: string[] = [];

  const collectionMethod =
    clean(research.collectionMethod);

  if (collectionMethod) {
    techniques.push(collectionMethod);
  }

  if (
    techniques.length === 0 &&
    researchType === "quantitative"
  ) {
    techniques.push("Questionnaire");
  }

  if (
    techniques.length === 0 &&
    researchType === "qualitative"
  ) {
    techniques.push(
      "Entretien",
      "Observation"
    );
  }

  if (
    techniques.length === 0 &&
    researchType === "mixed"
  ) {
    techniques.push(
      "Questionnaire",
      "Entretien"
    );
  }

  // ----------------------------------------------------------
  // MÉTHODOLOGIE
  // ----------------------------------------------------------

  return {
    approach: researchType,

    approachExplanation:
      buildApproachExplanation(
        researchType
      ),

    method,

    methodExplanation:
      `La ${method.toLowerCase()} est proposée comme orientation initiale. Elle devra être confirmée ou ajustée après l'analyse scientifique du sujet.`,

    techniques,

    instruments: [],

    population:
      clean(research.population) ||
      undefined,

    populationSize:
      research.populationSize > 0
        ? research.populationSize
        : undefined,

    samplingMethod:
      undefined,

    sampleSize:
      undefined,

    dataSources: [],

    analysisMethods: [],

    analyses: [],

    collectionMethod:
      collectionMethod ||
      undefined,

    analysisMethod:
      undefined,

    description:
      "Orientation méthodologique initiale générée à partir des informations fournies par le chercheur.",

    status: "to_review",

    confidence:
      research.researchType
        ? "high"
        : "medium",

    warnings: [],
  };
}


// ============================================================
// EXPLICATION DE L'APPROCHE
// ============================================================

function buildApproachExplanation(
  researchType: ResearchType
): string {
  switch (researchType) {
    case "qualitative":
      return (
        "L'approche qualitative vise à comprendre en profondeur les perceptions, expériences, comportements ou mécanismes liés au phénomène étudié."
      );

    case "mixed":
      return (
        "L'approche mixte combine des données quantitatives et qualitatives afin de mesurer le phénomène et d'en approfondir la compréhension."
      );

    case "quantitative":
    default:
      return (
        "L'approche quantitative vise à mesurer les phénomènes étudiés à partir de données pouvant être codées, comparées et analysées statistiquement."
      );
  }
}


// ============================================================
// CONSTRUCTION DE LA PROBLÉMATIQUE
// ============================================================

function buildProblem(
  research: ResearchData
) {
  const statement =
    clean(research.problem);

  if (!statement) {
    return undefined;
  }

  return {
    statement,

    status:
      INITIAL_PROPOSAL_STATUS,

    confidence:
      INITIAL_CONFIDENCE,
  };
}


// ============================================================
// MÉTADONNÉES
// ============================================================

function buildMetadata(
  now: string
): ResearchMetadata {
  return {
    createdAt: now,

    updatedAt: now,

    version: 1,

    source: "acadia",

    language: "fr",
  };
}


// ============================================================
// CRÉATION DU PROJET
//
// Fonction principale du Research Core.
//
// ResearchData
//      ↓
// ResearchProject
// ============================================================

export function createResearchProject(
  research: ResearchData
): ResearchProject {
  const now =
    new Date();

  const nowISO =
    now.toISOString();

  const researchType =
    normalizeResearchType(
      research.researchType
    );

  const project: ResearchProject = {
    // --------------------------------------------------------
    // IDENTITÉ
    // --------------------------------------------------------

    id:
      `research-${Date.now()}`,

    title:
      clean(research.title),

    description:
      undefined,

    status:
      "draft",

    // --------------------------------------------------------
    // INFORMATIONS GÉNÉRALES
    // --------------------------------------------------------

    domain:
      clean(research.domain) ||
      undefined,

    level:
      clean(research.level) ||
      undefined,

    university:
      clean(research.university) ||
      undefined,

    location:
      clean(research.location) ||
      undefined,

    researchType,

    // --------------------------------------------------------
    // DATES
    // --------------------------------------------------------

    createdAt:
      now,

    updatedAt:
      now,

    // --------------------------------------------------------
    // COMPRÉHENSION
    //
    // A1 remplira cette partie.
    // --------------------------------------------------------

    understanding:
      undefined,

    // --------------------------------------------------------
    // PROBLÉMATIQUE
    // --------------------------------------------------------

    problem:
      buildProblem(research),

    // --------------------------------------------------------
    // QUESTIONS
    // --------------------------------------------------------

    researchQuestions:
      buildResearchQuestions(research),

    // --------------------------------------------------------
    // OBJECTIFS
    // --------------------------------------------------------

    objectives:
      buildObjectives(research),

    // --------------------------------------------------------
    // VARIABLES
    //
    // Elles seront ajoutées par A2.
    // --------------------------------------------------------

    variables:
      buildVariables(),

    // --------------------------------------------------------
    // RELATIONS
    // --------------------------------------------------------

    relations:
      [],

    // --------------------------------------------------------
    // HYPOTHÈSES
    // --------------------------------------------------------

    hypotheses:
      [],

    // --------------------------------------------------------
    // MÉTHODOLOGIE
    // --------------------------------------------------------

    methodology:
      buildMethodology(research),

    // --------------------------------------------------------
    // MATRICE
    // --------------------------------------------------------

    matrix:
      undefined,

    // --------------------------------------------------------
    // INSTRUMENTS
    // --------------------------------------------------------

    instruments:
      [],

    // --------------------------------------------------------
    // MÉTADONNÉES
    // --------------------------------------------------------

    metadata:
      buildMetadata(nowISO),
  };

  return project;
}


// ============================================================
// MISE À JOUR D'UN PROJET
// ============================================================

export function updateResearchProject(
  project: ResearchProject,

  changes:
    Partial<ResearchProject>
): ResearchProject {
  const now =
    new Date();

  const updatedMetadata: ResearchMetadata = {
    ...project.metadata,

    updatedAt:
      now.toISOString(),

    version:
      project.metadata.version + 1,
  };

  return {
    ...project,

    ...changes,

    updatedAt:
      now,

    metadata:
      updatedMetadata,
  };
}


// ============================================================
// AJOUT D'UNE VARIABLE
//
// Fonction utilitaire volontairement simple.
// Elle permet au moteur A2 ou à l'interface d'ajouter
// une variable sans modifier directement le tableau.
// ============================================================

export function addResearchVariable(
  project: ResearchProject,

  variable: ResearchVariable
): ResearchProject {
  return updateResearchProject(
    project,
    {
      variables: [
        ...project.variables,
        variable,
      ],
    }
  );
}


// ============================================================
// AJOUT D'UN OBJECTIF
// ============================================================

export function addResearchObjective(
  project: ResearchProject,

  objective: ResearchObjective
): ResearchProject {
  return updateResearchProject(
    project,
    {
      objectives: [
        ...project.objectives,
        objective,
      ],
    }
  );
}


// ============================================================
// AJOUT D'UNE QUESTION
// ============================================================

export function addResearchQuestion(
  project: ResearchProject,

  question: ResearchQuestion
): ResearchProject {
  return updateResearchProject(
    project,
    {
      researchQuestions: [
        ...project.researchQuestions,
        question,
      ],
    }
  );
}


// ============================================================
// FINALISATION DU PROJET
// ============================================================

export function completeResearchProject(
  project: ResearchProject
): ResearchProject {
  return updateResearchProject(
    project,
    {
      status: "completed",
    }
  );
}


// ============================================================
// ARCHIVAGE DU PROJET
// ============================================================

export function archiveResearchProject(
  project: ResearchProject
): ResearchProject {
  return updateResearchProject(
    project,
    {
      status: "archived",
    }
  );
}


// ============================================================
// AVERTISSEMENTS DU RESEARCH CORE
//
// Ces avertissements ne bloquent pas la création.
// Ils indiquent simplement les éléments que le chercheur
// ou les moteurs IA doivent encore compléter.
// ============================================================

export function getResearchCoreWarnings(
  project: ResearchProject
): string[] {
  const warnings: string[] = [];

  // ----------------------------------------------------------
  // SUJET
  // ----------------------------------------------------------

  if (!project.title.trim()) {
    warnings.push(
      "Le sujet de recherche n'est pas renseigné."
    );
  }

  // ----------------------------------------------------------
  // DOMAINE
  // ----------------------------------------------------------

  if (!project.domain?.trim()) {
    warnings.push(
      "Le domaine de recherche n'est pas encore renseigné."
    );
  }

  // ----------------------------------------------------------
  // PROBLÉMATIQUE
  // ----------------------------------------------------------

  if (
    !project.problem?.statement?.trim()
  ) {
    warnings.push(
      "La problématique n'est pas encore renseignée."
    );
  }

  // ----------------------------------------------------------
  // OBJECTIF GÉNÉRAL
  // ----------------------------------------------------------

  const hasGeneralObjective =
    project.objectives.some(
      (objective) =>
        objective.role === "general"
    );

  if (!hasGeneralObjective) {
    warnings.push(
      "L'objectif général n'est pas encore renseigné."
    );
  }

  // ----------------------------------------------------------
  // OBJECTIFS SPÉCIFIQUES
  // ----------------------------------------------------------

  const hasSpecificObjectives =
    project.objectives.some(
      (objective) =>
        objective.role === "specific"
    );

  if (!hasSpecificObjectives) {
    warnings.push(
      "Aucun objectif spécifique n'est encore renseigné."
    );
  }

  // ----------------------------------------------------------
  // POPULATION
  // ----------------------------------------------------------

  if (
    !project.methodology.population
  ) {
    warnings.push(
      "La population d'étude n'est pas encore renseignée."
    );
  }

  // ----------------------------------------------------------
  // VARIABLES
  // ----------------------------------------------------------

  if (
    project.variables.length === 0
  ) {
    warnings.push(
      "Les variables de recherche doivent encore être identifiées par le moteur d'intelligence scientifique."
    );
  }

  // ----------------------------------------------------------
  // QUESTIONS
  // ----------------------------------------------------------

  if (
    project.researchQuestions.length === 0
  ) {
    warnings.push(
      "Les questions de recherche doivent encore être formulées."
    );
  }

  return warnings;
}


// ============================================================
// VALIDATION RAPIDE DU PROJET
// ============================================================

export function isResearchProjectReady(
  project: ResearchProject
): boolean {
  return (
    project.title.trim().length > 0 &&
    Boolean(
      project.problem?.statement?.trim()
    ) &&
    project.objectives.some(
      (objective) =>
        objective.role === "general"
    )
  );
}