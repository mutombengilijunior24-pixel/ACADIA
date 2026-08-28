import { NextResponse } from "next/server";

/* =========================================================
   TYPES
========================================================= */

type ResearchInput = {
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
  collectionMethod?: string;
};

/* =========================================================
   SYSTEM PROMPT
========================================================= */

const QUESTIONNAIRE_SYSTEM_PROMPT = `
Tu es le moteur scientifique de génération de questionnaires
d'enquête d'ACADIA.

Ta mission est de construire des questionnaires universitaires
cohérents, adaptés au contexte de recherche présenté.

Principes :

1. Identifier la variable indépendante ou explicative.
2. Identifier la variable dépendante ou expliquée.
3. Identifier les dimensions pertinentes.
4. Déduire des indicateurs observables.
5. Relier chaque question à une variable et une dimension.
6. Éviter les questions redondantes.
7. Éviter les questions orientées.
8. Utiliser un langage simple et académique.
9. Adapter le questionnaire au type de recherche.
10. Utiliser principalement des questions fermées
    pour les recherches quantitatives.
11. Utiliser des questions ouvertes lorsque cela est pertinent.
12. Ne jamais inventer les données de la population étudiée.
13. Chaque question doit avoir une fonction analytique identifiable.

Pour une recherche quantitative :
- privilégier les échelles de Likert ;
- permettre la codification statistique ;
- produire des variables exploitables dans Excel, SPSS ou R.

Pour une recherche qualitative :
- privilégier les questions ouvertes ;
- rechercher les perceptions, expériences et explications.

Pour une recherche mixte :
- combiner intelligemment questions fermées et ouvertes.

Retourne uniquement un objet JSON valide.
`;

/* =========================================================
   OPENAI
========================================================= */

async function generateQuestionnaire(
  research: ResearchInput
) {
  const apiKey =
    process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY n'est pas configurée."
    );
  }

  const response = await fetch(
    "https://api.openai.com/chat/completions",
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },

      body: JSON.stringify({
        model: "gpt-5.6",

        messages: [
          {
            role: "system",
            content:
              QUESTIONNAIRE_SYSTEM_PROMPT,
          },

          {
            role: "user",
            content: `
Voici les informations de recherche :

${JSON.stringify(
  research,
  null,
  2
)}

Analyse cette recherche et construis
le questionnaire correspondant.

Retourne uniquement le JSON.
`,
          },
        ],

        response_format: {
          type: "json_object",
        },

        max_tokens: 12000,
      }),
    }
  );

  if (!response.ok) {
    const errorText =
      await response.text();

    throw new Error(
      `OpenAI API ${response.status}: ${errorText}`
    );
  }

  const data =
    await response.json();

  const content =
    data?.choices?.[0]?.message?.content;

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

/* =========================================================
   POST
   /api/ai/questionnaire
========================================================= */

export async function POST(
  request: Request
) {
  try {
    const body =
      await request.json();

    const research =
      body?.research as
        | ResearchInput
        | undefined;

    if (!research) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Les informations de recherche sont requises.",
        },
        {
          status: 400,
        }
      );
    }

    if (
      !research.title ||
      typeof research.title !==
        "string"
    ) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Le titre de la recherche est requis.",
        },
        {
          status: 400,
        }
      );
    }

    const questionnaire =
      await generateQuestionnaire(
        research
      );

    return NextResponse.json({
      success: true,
      questionnaire,
    });
  } catch (error) {
    console.error(
      "Erreur génération questionnaire :",
      error
    );

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Une erreur inconnue est survenue.",
      },
      {
        status: 500,
      }
    );
  }
}