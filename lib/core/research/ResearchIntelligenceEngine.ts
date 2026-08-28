// ============================================================
// ACADIA — RESEARCH INTELLIGENCE ENGINE
//
// Architecture :
//
// ResearchData
//      ↓
// A1 — Compréhension du sujet
//      ↓
// A2 — Intelligence des variables
//      ↓
// AIResearchAdapter
//      ↓
// Research Core
//      ↓
// ResearchProject
//
// RESPONSABILITÉ :
// Ce fichier orchestre les différents moteurs.
//
// Il ne doit PAS :
// - définir les types scientifiques ;
// - inventer les variables ;
// - construire directement les dimensions ;
// - construire directement les indicateurs ;
// - remplacer le Research Core.
// ============================================================

import type { ResearchData } from "@/types/Research";

import {
  understandResearchWithAI,
  type AIResearchUnderstanding,
} from "@/lib/ai/openai/SubjectUnderstandingAI";

import {
  analyzeVariablesWithAI,
  type AIVariableIntelligenceResult,
} from "@/lib/ai/openai/VariableIntelligenceAI";

import {
  convertAIVariablesToResearchVariables,
  getAIVariableWarnings,
  buildRelationsFromUnderstanding,
  buildHypothesesFromRelations,
  linkVariablesToObjectives,
} from "./AIResearchAdapter";

import {
  checkResearchConsistency,
  type ResearchConsistencyResult,
} from "./ResearchConsistencyEngine";

import {
  createResearchProject,
  updateResearchProject,
} from "./ResearchCore";

import type {
  ResearchProject,
  ResearchUnderstanding,
  ConfidenceLevel,
} from "./ResearchTypes";


// ============================================================
// RÉSULTAT GLOBAL DE L'INTELLIGENCE DE RECHERCHE
// ============================================================

export interface ResearchIntelligenceResult {

  // ----------------------------------------------------------
  // A1 — Compréhension
  // ----------------------------------------------------------

  understanding:
    AIResearchUnderstanding;


  // ----------------------------------------------------------
  // A2 — Variables
  // ----------------------------------------------------------

  variableAnalysis:
    AIVariableIntelligenceResult;


  // ----------------------------------------------------------
  // RESEARCH CORE
  // ----------------------------------------------------------

  project:
    ResearchProject;


  // ----------------------------------------------------------
  // VARIABLES NORMALISÉES
  // ----------------------------------------------------------

  variables:
    ResearchProject["variables"];


  // ----------------------------------------------------------
  // RELATIONS NORMALISÉES
  // ----------------------------------------------------------

  relations:
    ResearchProject["relations"];


  // ----------------------------------------------------------
  // HYPOTHÈSES NORMALISÉES
  // ----------------------------------------------------------

  hypotheses:
    ResearchProject["hypotheses"];


  // ----------------------------------------------------------
  // COHÉRENCE SCIENTIFIQUE (déterministe, sans IA)
  // ----------------------------------------------------------

  consistency:
    ResearchConsistencyResult;


  // ----------------------------------------------------------
  // CONTRÔLE
  // ----------------------------------------------------------

  warnings:
    string[];

  status:
    | "ready"
    | "needs_review"
    | "failed";
}


// ============================================================
// NORMALISATION DE LA CONFIANCE
// ============================================================

function normalizeConfidence(
  value: unknown
): ConfidenceLevel {

  if (
    value === "high" ||
    value === "medium" ||
    value === "low"
  ) {
    return value;
  }

  return "medium";
}


// ============================================================
// CONVERSION A1 → RESEARCH CORE
// ============================================================

function convertUnderstanding(
  understanding:
    AIResearchUnderstanding
): ResearchUnderstanding {

  return {

    // --------------------------------------------------------
    // Informations principales
    // --------------------------------------------------------

    researchFocus:
      understanding.researchFocus,

    mainConcepts:
      understanding.mainConcepts,

    population:
      understanding.population,

    location:
      understanding.location,


    // --------------------------------------------------------
    // Relation proposée
    // --------------------------------------------------------

    proposedRelationship:
      understanding.proposedRelationship
        ? {
            from:
              understanding.proposedRelationship.from,

            to:
              understanding.proposedRelationship.to,

            relation:
              understanding.proposedRelationship.relation,

            description:
              understanding.proposedRelationship.description,
          }
        : undefined,


    // --------------------------------------------------------
    // Hypothèses de compréhension
    // --------------------------------------------------------

    assumptions:
      understanding.assumptions,

    pointsToConfirm:
      understanding.pointsToConfirm,


    // --------------------------------------------------------
    // Confiance
    // --------------------------------------------------------

    confidence:
      normalizeConfidence(
        understanding.confidence
      ),


    // --------------------------------------------------------
    // Statut
    // --------------------------------------------------------

    status:
      "proposed",
  };
}


// ============================================================
// AVERTISSEMENTS A1
// ============================================================

function getUnderstandingWarnings(
  understanding:
    AIResearchUnderstanding
): string[] {

  const warnings:
    string[] = [];


  // ----------------------------------------------------------
  // Points à confirmer
  // ----------------------------------------------------------

  for (
    const point of
      understanding.pointsToConfirm ?? []
  ) {

    if (
      typeof point !== "string" ||
      !point.trim()
    ) {
      continue;
    }

    warnings.push(
      `Point à confirmer : ${point.trim()}`
    );
  }


  // ----------------------------------------------------------
  // Confiance faible
  // ----------------------------------------------------------

  if (
    normalizeConfidence(
      understanding.confidence
    ) === "low"
  ) {

    warnings.push(
      "Le niveau de confiance de la compréhension du sujet est faible."
    );
  }


  // ----------------------------------------------------------
  // Concepts absents
  // ----------------------------------------------------------

  if (
    !understanding.mainConcepts ||
    understanding.mainConcepts.length === 0
  ) {

    warnings.push(
      "Aucun concept principal n'a été identifié avec suffisamment de précision."
    );
  }


  // ----------------------------------------------------------
  // Relation absente
  // ----------------------------------------------------------

  if (
    !understanding.proposedRelationship
  ) {

    warnings.push(
      "Aucune relation de recherche n'a encore été identifiée."
    );
  }


  return warnings;
}


// ============================================================
// DÉDUPLICATION DES AVERTISSEMENTS
// ============================================================

function uniqueWarnings(
  warnings:
    string[]
): string[] {

  return Array.from(
    new Set(
      warnings
        .map(
          (warning) =>
            warning.trim()
        )
        .filter(Boolean)
    )
  );
}


// ============================================================
// MOTEUR PRINCIPAL
//
// ResearchData
//      ↓
// A1
//      ↓
// A2
//      ↓
// Adapter
//      ↓
// Core
// ============================================================

export async function analyzeResearch(
  research:
    ResearchData
): Promise<ResearchIntelligenceResult> {

  // ----------------------------------------------------------
  // Le projet Core de base est créé immédiatement.
//
// Cela garantit que le résultat possède toujours un
// ResearchProject valide.
// ----------------------------------------------------------

  const baseProject =
    createResearchProject(
      research
    );


  try {

    // ========================================================
    // VALIDATION MINIMALE
    // ========================================================

    if (
      !research.title?.trim()
    ) {

      throw new Error(
        "Le sujet de recherche est obligatoire pour lancer l'analyse."
      );
    }


    // ========================================================
    // A1 — COMPRÉHENSION DU SUJET
    // ========================================================

    const understanding =
      await understandResearchWithAI({

        title:
          research.title,

        domain:
          research.domain,

        level:
          research.level,

        university:
          research.university,

        researchType:
          research.researchType,

        problem:
          research.problem,

        objective:
          research.objective,

        objectives:
          research.objectives,

        population:
          research.population,

        location:
          research.location,
      });


    // ========================================================
    // A1 → RESEARCH CORE
    // ========================================================

    const coreUnderstanding =
      convertUnderstanding(
        understanding
      );


    // ========================================================
    // A2 — INTELLIGENCE DES VARIABLES
    // ========================================================

    const variableAnalysis =
      await analyzeVariablesWithAI(
        understanding
      );


    // ========================================================
    // A2 → RESEARCH CORE
    // ========================================================

    const rawVariables =
      convertAIVariablesToResearchVariables(
        variableAnalysis
      );


    // ========================================================
    // VARIABLES ↔ OBJECTIFS
    //
    // Règle structurelle (pas d'IA) : relie chaque variable aux
    // objectifs spécifiques dont le texte la mentionne
    // explicitement. Sans correspondance, la variable reste non
    // reliée (signalé par ResearchConsistencyEngine).
    // ========================================================

    const variables =
      linkVariablesToObjectives(
        rawVariables,
        baseProject.objectives
      );


    const generalObjectiveId =
      baseProject.objectives.find(
        (objective) => objective.role === "general"
      )?.id;


    // ========================================================
    // A1 → RELATIONS
    //
    // La relation proposée par A1 (understanding.proposedRelationship)
    // n'était auparavant jamais conservée dans le ResearchProject.
    // ========================================================

    const relations =
      buildRelationsFromUnderstanding(
        understanding,
        variables
      );


    // ========================================================
    // A1 → HYPOTHÈSES
    //
    // Formalisation de la relation en hypothèse, uniquement
    // lorsque la relation est d'un type reconnu (jamais pour
    // "unknown" — voir AIResearchAdapter).
    // ========================================================

    const hypotheses =
      buildHypothesesFromRelations(
        understanding,
        relations,
        variables,
        generalObjectiveId
      );


    // ========================================================
    // INJECTION DANS LE PROJECT
    // ========================================================

    const project =
      updateResearchProject(
        baseProject,
        {
          understanding:
            coreUnderstanding,

          variables,

          relations,

          hypotheses,
        }
      );


    // ========================================================
    // COHÉRENCE SCIENTIFIQUE
    //
    // Vérification déterministe, exécutée sur le projet final
    // (aucun appel OpenAI ici).
    // ========================================================

    const consistency =
      checkResearchConsistency(
        project
      );


    // ========================================================
    // AVERTISSEMENTS
    // ========================================================

    const understandingWarnings =
      getUnderstandingWarnings(
        understanding
      );


    const variableWarnings =
      getAIVariableWarnings(
        variableAnalysis
      );


    const warnings =
      uniqueWarnings([
        ...understandingWarnings,
        ...variableWarnings,
      ]);


    // ========================================================
    // STATUT GLOBAL
    // ========================================================

    const status =
      warnings.length > 0
        ? "needs_review"
        : "ready";


    // ========================================================
    // RÉSULTAT
    // ========================================================

    return {

      understanding,

      variableAnalysis,

      project,

      variables,

      relations,

      hypotheses,

      consistency,

      warnings,

      status,
    };

  } catch (error) {

    // ========================================================
    // GESTION DE L'ERREUR
    // ========================================================

    console.error(
      "ACADIA — Research Intelligence Engine:",
      error
    );


    // ========================================================
    // MESSAGE
    // ========================================================

    const errorMessage =
      error instanceof Error
        ? error.message
        : "Une erreur est survenue pendant l'analyse de la recherche.";


    // ========================================================
    // PROJET DE SECOURS
    //
    // Le Core reste valide même si A1/A2 échoue.
    // ========================================================

    const failedProject =
      updateResearchProject(
        baseProject,
        {
          understanding:
            undefined,

          variables:
            [],
        }
      );


    // ========================================================
    // RÉSULTAT D'ÉCHEC
    // ========================================================

    return {

      understanding:
        {} as AIResearchUnderstanding,


      variableAnalysis:
        {
          variables: [],

          warnings: [
            errorMessage,
          ],

          pointsToConfirm: [],

          overallConfidence:
            "low",
        },


      project:
        failedProject,


      variables:
        [],


      relations:
        [],


      hypotheses:
        [],


      consistency:
        checkResearchConsistency(
          failedProject
        ),


      warnings:
        [
          errorMessage,
        ],


      status:
        "failed",
    };
  }
}


// ============================================================
// RACCOURCI — ANALYSER ET RÉCUPÉRER LE PROJET
// ============================================================

export async function buildResearchProjectWithAI(
  research:
    ResearchData
): Promise<ResearchProject> {

  const result =
    await analyzeResearch(
      research
    );


  return result.project;
}