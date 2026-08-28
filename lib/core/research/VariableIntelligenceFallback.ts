import type { ResearchData } from "@/types/Research";

import type {
  ConfidenceLevel,
  ProposalStatus,
  ResearchUnderstanding,
  ResearchVariable,
  ResearchVariableRelation,
} from "./ResearchTypes";

export interface VariableFallbackResult {
  variables: ResearchVariable[];
  relations: ResearchVariableRelation[];
  reasoning: string;
  warnings: string[];
}

/* =========================================================
   ACADIA — A2 FALLBACK
   Permet de tester A2 sans API externe
========================================================= */

export function generateFallbackVariables(
  research: ResearchData,
  understanding: ResearchUnderstanding
): VariableFallbackResult {

  const variables: ResearchVariable[] = [];

  const relations: ResearchVariableRelation[] = [];

  const title =
    research.title.toLowerCase();

  /*
   * Détection simple des relations
   */

  const hasInfluence =
    title.includes("influence") ||
    title.includes("impact") ||
    title.includes("effet") ||
    title.includes("relation");

  /*
   * Le paramètre understanding est conservé dans
   * la signature afin de rester compatible avec
   * l'architecture A1 → A2.
   *
   * Il pourra être exploité dans une prochaine
   * version du fallback.
   */
  void understanding;

  /* =======================================================
     STRUCTURE FALLBACK POUR UNE RECHERCHE RELATIONNELLE
  ======================================================= */

  if (hasInfluence) {

    /* =====================================================
       VARIABLE INDÉPENDANTE
    ===================================================== */

    const independent: ResearchVariable = {

      id:
        "variable-independent-1",

      name:
        "Évaluation du personnel",

      role:
        "independent",

      definition:
        "Processus permettant d'apprécier les performances, les comportements ou les résultats du personnel selon des critères déterminés.",

      dimensions: [

        {
          id:
            "dimension-evaluation-pratiques",

          name:
            "Pratiques d'évaluation",

          description:
            "Modalités selon lesquelles l'évaluation du personnel est réalisée.",

          variableId:
            "variable-independent-1",

          indicators: [

            {
              id:
                "indicator-evaluation-frequency",

              name:
                "Fréquence de l'évaluation",

              description:
                "Régularité avec laquelle l'évaluation du personnel est réalisée.",

              dimensionId:
                "dimension-evaluation-pratiques",

              variableId:
                "variable-independent-1",

              status:
                "proposed" as ProposalStatus,

              confidence:
                "medium" as ConfidenceLevel,
            },

            {
              id:
                "indicator-evaluation-criteria",

              name:
                "Clarté des critères",

              description:
                "Degré de clarté des critères utilisés pour évaluer le personnel.",

              dimensionId:
                "dimension-evaluation-pratiques",

              variableId:
                "variable-independent-1",

              status:
                "proposed" as ProposalStatus,

              confidence:
                "medium" as ConfidenceLevel,
            },

          ],

          status:
            "proposed" as ProposalStatus,

          confidence:
            "medium" as ConfidenceLevel,
        },

      ],

      indicators: [

        {
          id:
            "indicator-evaluation-frequency",

          name:
            "Fréquence de l'évaluation",

          description:
            "Régularité avec laquelle l'évaluation du personnel est réalisée.",

          dimensionId:
            "dimension-evaluation-pratiques",

          variableId:
            "variable-independent-1",

          status:
            "proposed" as ProposalStatus,

          confidence:
            "medium" as ConfidenceLevel,
        },

        {
          id:
            "indicator-evaluation-criteria",

          name:
            "Clarté des critères",

          description:
            "Degré de clarté des critères utilisés pour évaluer le personnel.",

          dimensionId:
            "dimension-evaluation-pratiques",

          variableId:
            "variable-independent-1",

          status:
            "proposed" as ProposalStatus,

          confidence:
            "medium" as ConfidenceLevel,
        },

      ],

      linkedObjectiveIds:
        [],

      status:
        "proposed" as ProposalStatus,

      confidence:
        "medium" as ConfidenceLevel,
    };


    /* =====================================================
       VARIABLE DÉPENDANTE
    ===================================================== */

    const dependent: ResearchVariable = {

      id:
        "variable-dependent-1",

      name:
        "Motivation des agents",

      role:
        "dependent",

      definition:
        "État dans lequel un agent est disposé à fournir des efforts et à s'impliquer dans son activité professionnelle.",

      dimensions: [

        {
          id:
            "dimension-motivation-engagement",

          name:
            "Engagement professionnel",

          description:
            "Degré d'implication de l'agent dans son travail.",

          variableId:
            "variable-dependent-1",

          indicators: [

            {
              id:
                "indicator-engagement-effort",

              name:
                "Effort fourni au travail",

              description:
                "Niveau d'effort que l'agent déclare fournir dans l'exécution de son travail.",

              dimensionId:
                "dimension-motivation-engagement",

              variableId:
                "variable-dependent-1",

              status:
                "proposed" as ProposalStatus,

              confidence:
                "medium" as ConfidenceLevel,
            },

            {
              id:
                "indicator-engagement-implication",

              name:
                "Implication professionnelle",

              description:
                "Degré d'implication de l'agent dans ses activités professionnelles.",

              dimensionId:
                "dimension-motivation-engagement",

              variableId:
                "variable-dependent-1",

              status:
                "proposed" as ProposalStatus,

              confidence:
                "medium" as ConfidenceLevel,
            },

          ],

          status:
            "proposed" as ProposalStatus,

          confidence:
            "medium" as ConfidenceLevel,
        },

      ],

      indicators: [

        {
          id:
            "indicator-engagement-effort",

          name:
            "Effort fourni au travail",

          description:
            "Niveau d'effort que l'agent déclare fournir dans l'exécution de son travail.",

          dimensionId:
            "dimension-motivation-engagement",

          variableId:
            "variable-dependent-1",

          status:
            "proposed" as ProposalStatus,

          confidence:
            "medium" as ConfidenceLevel,
        },

        {
          id:
            "indicator-engagement-implication",

          name:
            "Implication professionnelle",

          description:
            "Degré d'implication de l'agent dans ses activités professionnelles.",

          dimensionId:
            "dimension-motivation-engagement",

          variableId:
            "variable-dependent-1",

          status:
            "proposed" as ProposalStatus,

          confidence:
            "medium" as ConfidenceLevel,
        },

      ],

      linkedObjectiveIds:
        [],

      status:
        "proposed" as ProposalStatus,

      confidence:
        "medium" as ConfidenceLevel,
    };


    /* =====================================================
       AJOUT DES VARIABLES
    ===================================================== */

    variables.push(
      independent,
      dependent
    );


    /* =====================================================
       RELATION ENTRE LES VARIABLES
       IMPORTANT :
       ResearchRelation utilise from / to
       et non fromVariableId / toVariableId.
    ===================================================== */

    const relation: ResearchVariableRelation = {

      id:
        "relation-independent-dependent",

      from:
        independent.id,

      to:
        dependent.id,

      relation:
        "influence",

      description:
        "Relation proposée entre les pratiques d'évaluation du personnel et la motivation des agents.",

      status:
        "proposed" as ProposalStatus,

      confidence:
        "medium" as ConfidenceLevel,
    };

    relations.push(
      relation
    );
  }


  /* =======================================================
     RÉSULTAT FINAL
  ======================================================= */

  return {

    variables,

    relations,

    reasoning:
      variables.length > 0
        ? "Variables générées par le moteur local A2 afin de permettre le développement et les tests de l'architecture avant la connexion effective à OpenAI."
        : "Le moteur local A2 n'a pas identifié de structure relationnelle à partir du sujet fourni.",

    warnings:
      variables.length === 0
        ? [
            "Le moteur local n'a pas identifié de structure de variables adaptée. Une analyse IA sera nécessaire."
          ]
        : [],
  };
}