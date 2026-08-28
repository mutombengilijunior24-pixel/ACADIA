import type { ResearchData } from "@/types/Research";

import type {
  ResearchUnderstanding,
  ResearchVariable,
  ResearchVariableRelation,
  ProposalStatus,
  ConfidenceLevel,
} from "./ResearchTypes";

import {
  analyzeVariablesWithAI,
  type AIVariable,
} from "./VariableIntelligenceAI";

/* =========================================================
   ACADIA — VARIABLE INTELLIGENCE ENGINE
   A2 — Identification et structuration des variables

   Architecture :

   A1 Understanding
        ↓
   A2 Variable Intelligence
        ↓
   Research Core

   Ce moteur transforme la proposition A2
   en structures compatibles avec le Research Core.
========================================================= */


/* =========================================================
   RÉSULTAT DU MOTEUR
========================================================= */

export interface VariableIntelligenceResult {
  variables: ResearchVariable[];

  relations: ResearchVariableRelation[];

  reasoning: string;

  warnings: string[];

  pointsToConfirm: string[];

  overallConfidence: ConfidenceLevel;
}


/* =========================================================
   OUTILS
========================================================= */

function clean(value?: string): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}


/* =========================================================
   CONFIANCE GLOBALE
========================================================= */

function calculateOverallConfidence(
  variables: ResearchVariable[]
): ConfidenceLevel {

  if (variables.length === 0) {
    return "low";
  }

  const confidences =
    variables.map(
      (variable) =>
        variable.confidence
    );

  if (
    confidences.every(
      (confidence) =>
        confidence === "high"
    )
  ) {
    return "high";
  }

  if (
    confidences.some(
      (confidence) =>
        confidence === "low"
    )
  ) {
    return "low";
  }

  return "medium";
}


/* =========================================================
   CONSTRUCTION DES VARIABLES
========================================================= */

function buildVariables(
  aiVariables: AIVariable[]
): ResearchVariable[] {

  return aiVariables.map(
    (variable, variableIndex) => {

      const variableId =
        `variable-${variableIndex + 1}`;


      /* -----------------------------------------------------
         DIMENSIONS
      ----------------------------------------------------- */

      const dimensions =
        (variable.dimensions ?? []).map(
          (dimension, dimensionIndex) => {

            const dimensionId =
              `${variableId}-dimension-${dimensionIndex + 1}`;


            /* -------------------------------------------------
               INDICATEURS
            ------------------------------------------------- */

            const indicators =
              (dimension.indicators ?? []).map(
                (
                  indicator,
                  indicatorIndex
                ) => {

                  return {
                    id:
                      `${dimensionId}-indicator-${indicatorIndex + 1}`,

                    name:
                      clean(
                        indicator.name
                      ),

                    description:
                      clean(
                        indicator.description
                      ),

                    dimensionId,

                    variableId,

                    status:
                      "proposed" as ProposalStatus,

                    /*
                     * Le contrat actuel de l'IA A2
                     * ne fournit pas de confiance au niveau
                     * de l'indicateur.
                     *
                     * On hérite donc de la confiance
                     * de la variable.
                     */
                    confidence:
                      variable.confidence ??
                      "medium",
                  };
                }
              );


            return {
              id:
                dimensionId,

              name:
                clean(
                  dimension.name
                ),

              description:
                clean(
                  dimension.description
                ),

              variableId,

              indicators,

              status:
                "proposed" as ProposalStatus,

              confidence:
                variable.confidence ??
                "medium",
            };
          }
        );


      /* -----------------------------------------------------
         INDICATEURS DE LA VARIABLE
      ----------------------------------------------------- */

      const indicators =
        dimensions.flatMap(
          (dimension) =>
            dimension.indicators
        );


      /* -----------------------------------------------------
         VARIABLE
      ----------------------------------------------------- */

      return {
        id:
          variableId,

        name:
          clean(
            variable.name
          ),

        /*
         * Adaptation du rôle IA vers le contrat
         * ResearchVariable.
         *
         * Le moteur conserve la valeur proposée
         * par l'IA tout en laissant ResearchTypes
         * contrôler le contrat final.
         */
        role:
          variable.role as ResearchVariable["role"],

        /*
         * ResearchVariable exige une chaîne.
         * On transforme undefined en chaîne vide.
         */
        definition:
          clean(
            variable.definition
          ),

        dimensions,

        indicators,

        linkedObjectiveIds:
          [],

        status:
          "proposed" as ProposalStatus,

        confidence:
          variable.confidence ??
          "medium",
      };
    }
  );
}


/* =========================================================
   CONSTRUCTION DES RELATIONS
   A1 → Research Core
========================================================= */

function buildRelations(
  understanding: ResearchUnderstanding,
  variables: ResearchVariable[]
): ResearchVariableRelation[] {

  const proposed =
    understanding.proposedRelationship;


  /* ---------------------------------------------------------
     Aucune relation proposée par A1
  --------------------------------------------------------- */

  if (!proposed) {
    return [];
  }


  /* ---------------------------------------------------------
     Nettoyage des noms
  --------------------------------------------------------- */

  const fromName =
    clean(
      proposed.from
    ).toLowerCase();

  const toName =
    clean(
      proposed.to
    ).toLowerCase();


  if (
    !fromName ||
    !toName
  ) {
    return [];
  }


  /* ---------------------------------------------------------
     Recherche de la variable source
  --------------------------------------------------------- */

  const fromVariable =
    variables.find(
      (variable) =>
        clean(
          variable.name
        ).toLowerCase() ===
        fromName
    );


  /* ---------------------------------------------------------
     Recherche de la variable cible
  --------------------------------------------------------- */

  const toVariable =
    variables.find(
      (variable) =>
        clean(
          variable.name
        ).toLowerCase() ===
        toName
    );


  /*
   * A1 peut proposer une relation entre deux concepts
   * qui ne deviennent finalement pas des variables.
   *
   * On ne crée donc pas artificiellement la relation.
   */

  if (
    !fromVariable ||
    !toVariable
  ) {
    return [];
  }


  /* ---------------------------------------------------------
     Création de la relation
  --------------------------------------------------------- */

  return [
    {
      id:
        "relation-1",

      /*
       * ResearchRelation utilise from / to.
       */
      from:
        fromVariable.id,

      to:
        toVariable.id,

      relation:
        proposed.relation,

      status:
        "proposed" as ProposalStatus,

      confidence:
        understanding.confidence ??
        "medium",
    },
  ];
}


/* =========================================================
   MOTEUR PRINCIPAL A2
========================================================= */

export async function identifyResearchVariables(
  research: ResearchData,
  understanding: ResearchUnderstanding
): Promise<VariableIntelligenceResult> {


  /* ---------------------------------------------------------
     VALIDATION MINIMALE
  --------------------------------------------------------- */

  if (
    !clean(
      research.title
    )
  ) {
    throw new Error(
      "Impossible d'identifier les variables sans sujet de recherche."
    );
  }


  /* ---------------------------------------------------------
     APPEL À L'INTELLIGENCE IA A2
  --------------------------------------------------------- */

  const aiResult =
    await analyzeVariablesWithAI(
      research,
      understanding
    );


  /* ---------------------------------------------------------
     TRANSFORMATION DES VARIABLES
  --------------------------------------------------------- */

  const variables =
    buildVariables(
      aiResult.variables
    );


  /* ---------------------------------------------------------
     TRANSFORMATION DE LA RELATION
  --------------------------------------------------------- */

  const relations =
    buildRelations(
      understanding,
      variables
    );


  /* ---------------------------------------------------------
     RAISONNEMENT
  --------------------------------------------------------- */

  const reasoning =
    aiResult.reasoning ||
    (
      variables.length > 0
        ? `A2 a identifié ${variables.length} variable(s) à partir de la compréhension scientifique produite par A1.`
        : "A2 n'a identifié aucune variable suffisamment structurée à ce stade."
    );


  /* ---------------------------------------------------------
     AVERTISSEMENTS
  --------------------------------------------------------- */

  const warnings =
    aiResult.warnings ?? [];


  /* ---------------------------------------------------------
     POINTS À CONFIRMER
     
     Le contrat actuel de VariableIntelligenceAI
     ne fournit pas encore ce champ.
     
     On prépare donc le contrat du moteur sans
     inventer de contenu.
  --------------------------------------------------------- */

  const pointsToConfirm:
    string[] = [];


  /* ---------------------------------------------------------
     CONFIANCE GLOBALE
  --------------------------------------------------------- */

  const overallConfidence =
    calculateOverallConfidence(
      variables
    );


  /* ---------------------------------------------------------
     RÉSULTAT FINAL
  --------------------------------------------------------- */

  return {
    variables,

    relations,

    reasoning,

    warnings,

    pointsToConfirm,

    overallConfidence,
  };
}