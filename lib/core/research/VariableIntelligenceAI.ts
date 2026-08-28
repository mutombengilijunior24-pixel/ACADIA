import OpenAI from "openai";

import type { ResearchData } from "@/types/Research";
import type { ResearchUnderstanding } from "./ResearchTypes";

/* =========================================================
   ACADIA — VARIABLE INTELLIGENCE AI
   A2 — Intelligence des variables

   Contrat officiel A2 :

   ResearchData
        +
   ResearchUnderstanding
        ↓
   VariableAIResult
========================================================= */

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-key-for-build",
  dangerouslyAllowBrowser: true,
});


/* =========================================================
   TYPES A2
========================================================= */

export type AIVariableRole =
  | "independent"
  | "dependent"
  | "mediating"
  | "moderating"
  | "control"
  | "descriptive";

export type AIConfidenceLevel =
  | "high"
  | "medium"
  | "low";

export type AIVariableRelationType =
  | "influence"
  | "impact"
  | "effect"
  | "association"
  | "comparison"
  | "mediation"
  | "moderation"
  | "unknown";

/* =========================================================
   INDICATEUR
========================================================= */

export interface AIVariableIndicator {
  name: string;
  description: string;
}

/* =========================================================
   DIMENSION
========================================================= */

export interface AIVariableDimension {
  name: string;
  description: string;
  indicators: AIVariableIndicator[];
}

/* =========================================================
   VARIABLE
========================================================= */

export interface AIVariable {
  name: string;

  role: AIVariableRole;

  definition: string;

  dimensions: AIVariableDimension[];

  confidence: AIConfidenceLevel;

  explanation: string;
}

/* =========================================================
   RELATION
========================================================= */

export interface AIVariableRelation {
  fromVariable: string;

  toVariable: string;

  relation: AIVariableRelationType;

  explanation: string;
}

/* =========================================================
   RÉSULTAT COMPLET A2
========================================================= */

export interface VariableAIResult {
  variables: AIVariable[];

  relations: AIVariableRelation[];

  reasoning: string;

  warnings: string[];

  pointsToConfirm: string[];

  overallConfidence: AIConfidenceLevel;
}

/* =========================================================
   PROMPT SCIENTIFIQUE A2
========================================================= */

const VARIABLE_SYSTEM_PROMPT = `
Tu es ACADIA, un moteur scientifique spécialisé
dans l'analyse des recherches universitaires.

Tu interviens après le moteur A1 de compréhension
scientifique.

Ta mission est d'identifier les variables réellement
pertinentes à partir :

1. du sujet ;
2. de la problématique ;
3. des objectifs ;
4. de la compréhension scientifique produite par A1.

CONTEXTE PRIORITAIRE :

- République démocratique du Congo
- Lubumbashi
- Haut-Katanga
- Sciences économiques
- Sciences de gestion
- Management
- Marketing
- Ressources humaines
- Finance
- Comptabilité
- Entrepreneuriat
- Sciences sociales

=========================================================
RÈGLES SCIENTIFIQUES
=========================================================

Ne transforme PAS automatiquement chaque concept
en variable.

Une variable doit être justifiée par le sujet,
la problématique, les objectifs ou la relation étudiée.

Si une relation d'influence, d'impact ou d'effet
est clairement identifiable :

- le premier concept peut être candidat à la variable
  indépendante ;
- le second peut être candidat à la variable dépendante.

Ne crée pas artificiellement :

- de variable médiatrice ;
- de variable modératrice ;
- de variable de contrôle.

Ces variables doivent être scientifiquement justifiées.

=========================================================
POUR CHAQUE VARIABLE
=========================================================

Donne :

- son nom ;
- son rôle ;
- sa définition opérationnelle ;
- ses dimensions ;
- ses indicateurs ;
- son niveau de confiance ;
- une explication scientifique.

Les dimensions doivent appartenir réellement
à la variable.

Les indicateurs doivent être observables ou mesurables.

Évite :

- les doublons ;
- les dimensions vagues ;
- les indicateurs impossibles à mesurer ;
- les variables sans justification ;
- les informations inventées.

=========================================================
OBJECTIFS
=========================================================

Vérifie que les variables proposées permettent
de couvrir les objectifs spécifiques.

Si un objectif n'est pas suffisamment couvert,
signale-le dans warnings ou pointsToConfirm.

=========================================================
RELATIONS
=========================================================

Décris une relation uniquement lorsqu'elle est
justifiée par le sujet ou la problématique.

=========================================================
CONFIANCE
=========================================================

high :
la variable est clairement identifiable.

medium :
la variable est plausible mais nécessite validation.

low :
la variable est incertaine.

=========================================================
PRINCIPE ACADIA
=========================================================

Les variables produites sont des PROPOSITIONS.

ACADIA ne décide jamais définitivement à la place
du chercheur.

Le chercheur doit pouvoir accepter, modifier
ou refuser les propositions.

=========================================================
RÉPONSE
=========================================================

Retourne exclusivement un JSON valide.

Aucune explication hors JSON.
`;

/* =========================================================
   FONCTION PRINCIPALE A2
========================================================= */

export async function analyzeVariablesWithAI(
  research: ResearchData,
  understanding: ResearchUnderstanding
): Promise<VariableAIResult> {

  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY n'est pas configurée."
    );
  }

  const response =
    await openai.chat.completions.create({

      model: "gpt-5-mini",

      messages: [

        {
          role: "system",

          content:
            VARIABLE_SYSTEM_PROMPT,
        },

        {
          role: "user",

          content: `
Voici les informations fournies
par le chercheur :

${JSON.stringify(
  research,
  null,
  2
)}

Voici la compréhension scientifique
produite par le moteur A1 :

${JSON.stringify(
  understanding,
  null,
  2
)}

À partir de ces informations :

1. Identifie uniquement les variables
   scientifiquement pertinentes.

2. Détermine leur rôle.

3. Donne leur définition opérationnelle.

4. Identifie leurs dimensions.

5. Identifie leurs indicateurs.

6. Explique pourquoi chaque variable
   est proposée.

7. Identifie les relations suffisamment
   justifiées entre les variables.

8. Vérifie la couverture des objectifs
   spécifiques.

9. Signale les incertitudes.

Ne génère PAS de questionnaire.

Ne génère PAS de méthodologie.

Ne génère PAS d'hypothèses.

Retourne uniquement le JSON demandé.
          `,
        },
      ],

      response_format: {
        type: "json_object",
      },

      max_tokens: 10000,
    });

  const content =
    response.choices[0]?.message?.content;

  if (!content) {
    throw new Error(
      "OpenAI n'a retourné aucun contenu pour A2."
    );
  }

  try {

    const parsed =
      JSON.parse(
        content
      ) as Partial<VariableAIResult>;

    /*
     * Normalisation défensive.
     *
     * Même si l'IA omet accidentellement certains
     * tableaux, A2 conserve toujours son contrat.
     */

    return {

      variables:
        Array.isArray(parsed.variables)
          ? parsed.variables
          : [],

      relations:
        Array.isArray(parsed.relations)
          ? parsed.relations
          : [],

      reasoning:
        typeof parsed.reasoning === "string"
          ? parsed.reasoning
          : "",

      warnings:
        Array.isArray(parsed.warnings)
          ? parsed.warnings
          : [],

      pointsToConfirm:
        Array.isArray(parsed.pointsToConfirm)
          ? parsed.pointsToConfirm
          : [],

      overallConfidence:
        parsed.overallConfidence === "high" ||
        parsed.overallConfidence === "low"
          ? parsed.overallConfidence
          : "medium",
    };

  } catch {

    throw new Error(
      "La réponse d'OpenAI n'est pas un JSON valide."
    );
  }
}