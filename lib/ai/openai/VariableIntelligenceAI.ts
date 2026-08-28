import { openai } from "./client";
import { AI_MODEL } from "./config";

import type {
  AIResearchUnderstanding,
} from "./SubjectUnderstandingAI";


/* =========================================================
   ACADIA — VARIABLE INTELLIGENCE AI

   A2 — Intelligence des variables

   Architecture :

   A1 — Compréhension
          ↓
   A2 — Variables
          ↓
   AIResearchAdapter
          ↓
   ResearchVariable

   A2 ne construit PAS :
   - la méthodologie ;
   - les hypothèses ;
   - le questionnaire ;
   - les réponses ;
   - les statistiques.
========================================================= */


/* =========================================================
   RÔLES DES VARIABLES PRODUITES PAR A2
========================================================= */

export type AIVariableRole =
  | "independent"
  | "dependent"
  | "mediating"
  | "moderating"
  | "control"
  | "descriptive";


/* =========================================================
   INDICATEUR IA
========================================================= */

export interface AIVariableIndicator {

  name: string;

  description: string;

  confidence:
    | "high"
    | "medium"
    | "low";
}


/* =========================================================
   DIMENSION IA
========================================================= */

export interface AIVariableDimension {

  name: string;

  description: string;

  indicators:
    AIVariableIndicator[];
}


/* =========================================================
   VARIABLE IA
========================================================= */

export interface AIVariable {

  name: string;

  role: AIVariableRole;

  definition: string;

  dimensions:
    AIVariableDimension[];

  confidence:
    | "high"
    | "medium"
    | "low";

  explanation: string;
}


/* =========================================================
   RÉSULTAT GLOBAL A2
========================================================= */

export interface AIVariableIntelligenceResult {

  variables:
    AIVariable[];

  warnings:
    string[];

  pointsToConfirm:
    string[];

  overallConfidence:
    | "high"
    | "medium"
    | "low";
}


/* =========================================================
   A2 — ANALYSE DES VARIABLES
========================================================= */

export async function analyzeVariablesWithAI(
  understanding:
    AIResearchUnderstanding
): Promise<AIVariableIntelligenceResult> {


  /* =======================================================
     APPEL OPENAI
  ======================================================= */

  const response =
    await openai.responses.create({

      model: AI_MODEL,

      input: [

        /* ===================================================
           INSTRUCTIONS SCIENTIFIQUES A2
        =================================================== */

        {
          role: "system",

          content: `
Tu es le moteur A2 d'intelligence des variables
de la plateforme ACADIA.

ACADIA accompagne des étudiants, chercheurs
et universitaires dans la construction
de recherches scientifiques.

Tu reçois exclusivement la compréhension structurée
produite par le moteur A1.

Ta mission est d'identifier et d'opérationnaliser
les variables pertinentes de la recherche.

Pour chaque variable retenue, tu dois :

1. Donner son nom.
2. Déterminer son rôle.
3. Donner une définition opérationnelle claire.
4. Identifier ses dimensions.
5. Identifier ses indicateurs.
6. Expliquer pourquoi la variable est proposée.
7. Donner un niveau de confiance.

=========================================================
RÔLES AUTORISÉS
=========================================================

- independent
- dependent
- mediating
- moderating
- control
- descriptive

=========================================================
RÈGLES SCIENTIFIQUES
=========================================================

- Ne transforme jamais automatiquement chaque concept
  en variable.

- Utilise les informations fournies par A1.

- Utilise la relation proposée par A1 lorsqu'elle
  est suffisamment claire.

- Si A1 identifie une relation entre deux concepts,
  le concept situé à l'origine de la relation peut
  être candidat à une variable indépendante.

- Le concept situé à destination peut être candidat
  à une variable dépendante.

- Ne crée jamais artificiellement une variable
  médiatrice ou modératrice.

- Une variable doit pouvoir être définie et mesurée.

- Une dimension doit réellement appartenir
  à la variable.

- Un indicateur doit être observable ou mesurable.

- Évite les dimensions redondantes.

- Évite les indicateurs redondants.

- Ne fabrique aucune donnée sur une organisation,
  une population ou un terrain.

- Lorsque des informations manquent,
  signale-les dans pointsToConfirm.

- Une proposition IA n'est jamais une vérité scientifique.

- Le chercheur doit pouvoir accepter, modifier
  ou refuser chaque proposition.

=========================================================
INTERDICTIONS
=========================================================

Ne génère PAS :

- de questionnaire ;
- de méthodologie ;
- d'hypothèses ;
- de statistiques ;
- de résultats ;
- de données de terrain.

Concentre-toi exclusivement sur :

VARIABLES
DIMENSIONS
INDICATEURS

Retourne exclusivement le JSON correspondant
au schéma demandé.
`
        },


        /* ===================================================
           DONNÉES A1
        =================================================== */

        {
          role: "user",

          content: `
Voici la compréhension scientifique produite
par le moteur A1 :

${JSON.stringify(
  understanding,
  null,
  2
)}

À partir de cette compréhension :

1. Identifie les variables pertinentes.
2. Attribue leur rôle.
3. Donne leur définition.
4. Propose leurs dimensions.
5. Propose leurs indicateurs.
6. Explique les choix effectués.
7. Signale les éléments qui doivent être confirmés.

Ne génère rien d'autre.
`
        }

      ],


      /* =====================================================
         SORTIE STRUCTURÉE
      ===================================================== */

      text: {

        format: {

          type: "json_schema",

          name:
            "variable_intelligence",

          strict: true,

          schema: {

            type: "object",

            properties: {

              /* =============================================
                 VARIABLES
              ============================================= */

              variables: {

                type: "array",

                items: {

                  type: "object",

                  properties: {

                    name: {
                      type: "string"
                    },


                    /* =======================================
                       RÔLE
                    ======================================= */

                    role: {

                      type: "string",

                      enum: [
                        "independent",
                        "dependent",
                        "mediating",
                        "moderating",
                        "control",
                        "descriptive"
                      ]
                    },


                    /* =======================================
                       DÉFINITION
                    ======================================= */

                    definition: {
                      type: "string"
                    },


                    /* =======================================
                       DIMENSIONS
                    ======================================= */

                    dimensions: {

                      type: "array",

                      items: {

                        type: "object",

                        properties: {

                          name: {
                            type: "string"
                          },

                          description: {
                            type: "string"
                          },

                          indicators: {

                            type: "array",

                            items: {

                              type: "object",

                              properties: {

                                name: {
                                  type: "string"
                                },

                                description: {
                                  type: "string"
                                },

                                confidence: {

                                  type: "string",

                                  enum: [
                                    "high",
                                    "medium",
                                    "low"
                                  ]
                                }

                              },

                              required: [
                                "name",
                                "description",
                                "confidence"
                              ],

                              additionalProperties:
                                false
                            }
                          }

                        },

                        required: [
                          "name",
                          "description",
                          "indicators"
                        ],

                        additionalProperties:
                          false
                      }
                    },


                    /* =======================================
                       CONFIANCE
                    ======================================= */

                    confidence: {

                      type: "string",

                      enum: [
                        "high",
                        "medium",
                        "low"
                      ]
                    },


                    /* =======================================
                       EXPLICATION
                    ======================================= */

                    explanation: {

                      type: "string"
                    }

                  },

                  required: [
                    "name",
                    "role",
                    "definition",
                    "dimensions",
                    "confidence",
                    "explanation"
                  ],

                  additionalProperties:
                    false
                }
              },


              /* =============================================
                 AVERTISSEMENTS
              ============================================= */

              warnings: {

                type: "array",

                items: {
                  type: "string"
                }
              },


              /* =============================================
                 POINTS À CONFIRMER
              ============================================= */

              pointsToConfirm: {

                type: "array",

                items: {
                  type: "string"
                }
              },


              /* =============================================
                 CONFIANCE GLOBALE
              ============================================= */

              overallConfidence: {

                type: "string",

                enum: [
                  "high",
                  "medium",
                  "low"
                ]
              }

            },

            required: [
              "variables",
              "warnings",
              "pointsToConfirm",
              "overallConfidence"
            ],

            additionalProperties:
              false
          }
        }
      }
    });


  /* ========================================================
     EXTRACTION
  ======================================================== */

  const content =
    response.output_text;


  if (!content) {

    throw new Error(
      "OpenAI n'a retourné aucun résultat pour A2."
    );
  }


  /* ========================================================
     PARSING + VALIDATION
  ======================================================== */

  try {

    const parsed =
      JSON.parse(
        content
      ) as AIVariableIntelligenceResult;


    /* ------------------------------------------------------
       VALIDATION MINIMALE
    ------------------------------------------------------ */

    if (
      !parsed ||
      !Array.isArray(
        parsed.variables
      ) ||
      !Array.isArray(
        parsed.warnings
      ) ||
      !Array.isArray(
        parsed.pointsToConfirm
      )
    ) {

      throw new Error(
        "La réponse A2 ne respecte pas le contrat d'intelligence des variables."
      );
    }


    return parsed;

  } catch {

    throw new Error(
      "La réponse A2 d'OpenAI n'est pas un JSON valide ou ne respecte pas le contrat A2."
    );
  }
}