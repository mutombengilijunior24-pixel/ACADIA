import { openai } from "./client";
import {
  QUESTIONNAIRE_SYSTEM_PROMPT,
} from "./prompts";

export async function generateQuestionnaire(
  research: {
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
) {
  const response = await openai.chat.completions.create({
    model: "gpt-5.6",

    messages: [
      {
        role: "system",
        content: QUESTIONNAIRE_SYSTEM_PROMPT,
      },
      {
        role: "user",
        content: `
Voici les informations de recherche :

${JSON.stringify(research, null, 2)}

Analyse cette recherche et construis le questionnaire
correspondant.

Respecte strictement les règles scientifiques fournies
dans le message système.

Retourne uniquement le JSON demandé.
        `,
      },
    ],

    response_format: {
      type: "json_object",
    },

    max_tokens: 12000,
  });

  const content = response.choices[0]?.message?.content;

  if (!content) {
    throw new Error(
      "OpenAI n'a retourné aucun contenu."
    );
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error(
      "La réponse d'OpenAI n'est pas un JSON valide."
    );
  }
}