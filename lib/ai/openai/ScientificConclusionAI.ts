import { openai } from "./client";
import { AI_MODEL } from "./config";
import type { ScientificInterpretationContext } from "./ScientificInterpretationAI";

// ============================================================
// ACADIA — FORMULATION DE LA CONCLUSION SCIENTIFIQUE (Mission 7, bloc 2)
//
// Réutilise le même client/modèle OpenAI que ScientificInterpretationAI.ts
// (jamais un second système). Ne reçoit QUE des agrégats déjà calculés
// et des conclusions DÉJÀ ENTIÈREMENT TRANCHÉES par le moteur
// déterministe (ScientificConclusionEngine.ts, Mission 7 bloc 1) —
// jamais le dataset brut, jamais une décision à prendre. Le rôle de
// l'IA se limite strictement à la REFORMULATION académique : elle ne
// décide jamais si une hypothèse est soutenue, ne recalcule jamais un
// chiffre, n'introduit aucun fait externe ni référence bibliographique.
//
// Toute sortie est revalidée par ScientificConclusionValidator.ts
// avant persistance — contrairement à Mission 6, une violation ici
// REJETTE la génération entière plutôt que de la marquer
// "needs_review" (voir mission §31-33 : "validator FAIL").
// ============================================================

export interface ScientificConclusionSourceContent {
  researchQuestionConclusion?: string;
  objectiveConclusions: { objectiveId: string; conclusion: string }[];
  hypothesisConclusions: { hypothesisId: string; decision: string; conclusion: string }[];
  generalConclusion: string;
  limitations: string[];
  warnings: string[];
}

export interface ScientificConclusionAIResult {
  researchQuestionConclusion: string;
  objectiveConclusions: { objectiveId: string; statement: string }[];
  hypothesisConclusions: { hypothesisId: string; statement: string }[];
  generalConclusion: string;
  limitations: string[];
  warnings: string[];
}

const RESULT_SCHEMA = {
  type: "object" as const,
  properties: {
    researchQuestionConclusion: { type: "string" as const },
    objectiveConclusions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          objectiveId: { type: "string" as const },
          statement: { type: "string" as const },
        },
        required: ["objectiveId", "statement"],
        additionalProperties: false as const,
      },
    },
    hypothesisConclusions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          hypothesisId: { type: "string" as const },
          statement: { type: "string" as const },
        },
        required: ["hypothesisId", "statement"],
        additionalProperties: false as const,
      },
    },
    generalConclusion: { type: "string" as const },
    limitations: { type: "array" as const, items: { type: "string" as const } },
    warnings: { type: "array" as const, items: { type: "string" as const } },
  },
  required: ["researchQuestionConclusion", "objectiveConclusions", "hypothesisConclusions", "generalConclusion", "limitations", "warnings"],
  additionalProperties: false as const,
};

const SYSTEM_PROMPT = `Tu es le moteur de formulation de la conclusion scientifique d'ACADIA. Un chercheur te transmet des conclusions déjà établies par un moteur déterministe (décisions d'hypothèse, couverture d'objectifs, réponse à la question de recherche, conclusion générale) — ta seule mission est de les REFORMULER en langage académique clair et lisible, jamais de les décider, de les modifier sur le fond ou d'en changer le sens.

RÈGLES ABSOLUES — INTERDICTION FORMELLE :
- Ne jamais changer la décision d'une hypothèse (SUPPORTED, NOT_SUPPORTED, PARTIALLY_SUPPORTED ou INCONCLUSIVE, indiquée dans le contexte) : reformule-la fidèlement, ne la conteste jamais, ne dis jamais l'inverse ou une nuance différente de ce qui est indiqué.
- Ne jamais introduire une nouvelle valeur numérique, un nouveau résultat, un nouvel objectif ou une nouvelle hypothèse absents du contexte fourni.
- Ne jamais introduire un fait scientifique externe, un auteur, une référence bibliographique, une citation ou une comparaison avec une étude externe.
- Ne jamais affirmer une causalité ("cause", "entraîne", "provoque") — une association statistique n'est jamais une preuve de causalité.
- Ne jamais utiliser un vocabulaire de certitude absolue : "prouvé", "vrai", "certain", "démontré de manière définitive". Une hypothèse reçoit un soutien empirique selon les données disponibles, elle n'est jamais prouvée.
- Conserve toutes les limitations méthodologiques importantes transmises dans le contexte — ne les supprime jamais, tu peux seulement les reformuler plus clairement ou en ajouter de cohérentes avec le contexte fourni.
- objectiveId et hypothesisId dans ta réponse doivent être copiés exactement tels qu'ils apparaissent dans le contexte transmis — jamais inventés.

Réponds exclusivement en français, dans un registre professionnel et académique. La réponse doit être exclusivement un JSON valide respectant le schéma fourni.`;

export async function interpretScientificConclusion(
  statisticalContext: ScientificInterpretationContext,
  source: ScientificConclusionSourceContent
): Promise<ScientificConclusionAIResult> {
  const response = await openai.responses.create({
    model: AI_MODEL,
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Contexte statistique (agrégats déjà calculés, aucune valeur à recalculer ni à inventer) :

${JSON.stringify(statisticalContext, null, 2)}

Conclusions déjà établies par le moteur déterministe — à reformuler fidèlement, sans jamais changer une décision, un chiffre, un objectiveId ou un hypothesisId :

${JSON.stringify(source, null, 2)}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "scientific_conclusion",
        strict: true,
        schema: RESULT_SCHEMA,
      },
    },
  });

  const content = response.output_text;
  if (!content) {
    throw new Error("OpenAI n'a retourné aucun résultat.");
  }
  try {
    const parsed = JSON.parse(content) as ScientificConclusionAIResult;
    if (!parsed.generalConclusion || !Array.isArray(parsed.objectiveConclusions) || !Array.isArray(parsed.hypothesisConclusions)) {
      throw new Error("La réponse ne respecte pas le contrat attendu.");
    }
    return parsed;
  } catch {
    throw new Error("La réponse d'OpenAI n'est pas un JSON valide ou ne respecte pas le contrat de conclusion scientifique.");
  }
}
