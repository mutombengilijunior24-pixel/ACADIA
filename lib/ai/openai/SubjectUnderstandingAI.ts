import { openai } from "./client";
import { AI_MODEL } from "./config";

import type {
  ResearchRelationType,
  ConfidenceLevel,
} from "@/lib/core/research/ResearchTypes";

/* =========================================================
   A1 — COMPRÉHENSION IA DU SUJET

   Ce contrat représente uniquement la sortie du moteur A1.

   A1 ne construit pas :
   - les variables finales ;
   - les dimensions ;
   - les indicateurs ;
   - la méthodologie ;
   - le questionnaire.

   Il comprend d'abord la recherche.
========================================================= */

export interface AIResearchUnderstanding {
  researchFocus: string;

  mainConcepts: string[];

  proposedRelationship: {
    from: string;

    to: string;

    relation:
      | ResearchRelationType
      | "unknown";

    description?: string;
  };

  population?: string;

  location?: string;

  assumptions: string[];

  pointsToConfirm: string[];

  confidence: ConfidenceLevel;
}


/* =========================================================
   DONNÉES ENTRANTES A1
========================================================= */

export interface AIResearchInput {
  title: string;

  domain?: string;

  level?: string;

  university?: string;

  researchType?: string;

  problem?: string;

  objective?: string;

  objectives?: string[];

  population?: string;

  location?: string;
}


/* =========================================================
   A1 — COMPRÉHENSION IA DU SUJET
========================================================= */

export async function understandResearchWithAI(
  research: AIResearchInput
): Promise<AIResearchUnderstanding> {

  const response =
    await openai.responses.create({

      model: AI_MODEL,

      input: [
        {
          role: "system",

          content: `
Tu es le moteur scientifique A1 de la plateforme ACADIA.

ACADIA accompagne principalement des étudiants,
chercheurs et universitaires.

Ta mission est de COMPRENDRE une recherche avant
toute construction méthodologique.

Tu dois analyser uniquement les informations
fournies par le chercheur.

Tu ne dois jamais inventer une information.

Tu dois identifier :

1. Le phénomène ou focus principal de recherche.
2. Les concepts principaux.
3. Une éventuelle relation entre les concepts.
4. La population lorsqu'elle est identifiable.
5. La localisation lorsqu'elle est identifiable.
6. Les hypothèses de compréhension.
7. Les informations qui doivent encore être confirmées.
8. Le niveau de confiance global.

IMPORTANT :

- Ne transforme pas automatiquement les concepts
  en variables.
- Ne crée pas encore les dimensions.
- Ne crée pas encore les indicateurs.
- Ne crée pas encore de questionnaire.
- Ne construis pas encore la méthodologie.
- Ne suppose pas une causalité lorsqu'elle n'est
  pas suffisamment justifiée.
- Si une relation n'est pas suffisamment claire,
  utilise "unknown".
- Si une information est incertaine,
  place-la dans assumptions ou pointsToConfirm.
- La réponse doit être exclusivement un JSON valide.

RELATIONS AUTORISÉES :

- influence
- impact
- effect
- relationship
- association
- correlation
- mediation
- moderation
- unknown

STRUCTURE ATTENDUE :

{
  "researchFocus": "",
  "mainConcepts": [],
  "proposedRelationship": {
    "from": "",
    "to": "",
    "relation": "unknown",
    "description": ""
  },
  "population": "",
  "location": "",
  "assumptions": [],
  "pointsToConfirm": [],
  "confidence": "low"
}
`
        },

        {
          role: "user",

          content: `
Voici les informations actuellement fournies
par le chercheur :

${JSON.stringify(
  research,
  null,
  2
)}

Analyse cette recherche.

Je veux uniquement la compréhension
scientifique structurée du sujet.

Ne propose pas encore de questionnaire.

Ne propose pas encore de méthodologie.

Ne fabrique aucune information.
`
        }
      ],

      text: {
        format: {
          type: "json_schema",

          name: "research_understanding",

          strict: true,

          schema: {
            type: "object",

            properties: {

              researchFocus: {
                type: "string"
              },

              mainConcepts: {
                type: "array",

                items: {
                  type: "string"
                }
              },

              proposedRelationship: {
                type: "object",

                properties: {

                  from: {
                    type: "string"
                  },

                  to: {
                    type: "string"
                  },

                  relation: {
                    type: "string",

                    enum: [
                      "influence",
                      "impact",
                      "effect",
                      "relationship",
                      "association",
                      "correlation",
                      "mediation",
                      "moderation",
                      "unknown"
                    ]
                  },

                  description: {
                    type: "string"
                  }
                },

                required: [
                  "from",
                  "to",
                  "relation",
                  "description"
                ],

                additionalProperties: false
              },

              population: {
                type: "string"
              },

              location: {
                type: "string"
              },

              assumptions: {
                type: "array",

                items: {
                  type: "string"
                }
              },

              pointsToConfirm: {
                type: "array",

                items: {
                  type: "string"
                }
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
              "researchFocus",
              "mainConcepts",
              "proposedRelationship",
              "population",
              "location",
              "assumptions",
              "pointsToConfirm",
              "confidence"
            ],

            additionalProperties: false
          }
        }
      }
    });


  /* ========================================================
     EXTRACTION DU TEXTE
  ======================================================== */

  const content =
    response.output_text;


  if (!content) {

    throw new Error(
      "OpenAI n'a retourné aucun résultat."
    );
  }


  /* ========================================================
     PARSING JSON
  ======================================================== */

  try {

    const parsed =
      JSON.parse(
        content
      ) as AIResearchUnderstanding;


    /* ------------------------------------------------------
       VALIDATION MINIMALE
    ------------------------------------------------------ */

    if (
      !parsed.researchFocus ||
      !Array.isArray(
        parsed.mainConcepts
      ) ||
      !parsed.proposedRelationship
    ) {

      throw new Error(
        "La réponse A1 ne respecte pas le contrat de compréhension."
      );
    }


    return parsed;

  } catch {

    throw new Error(
      "La réponse d'OpenAI n'est pas un JSON valide ou ne respecte pas le contrat A1."
    );
  }
}