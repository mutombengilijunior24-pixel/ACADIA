import {
  understandResearchWithAI,
} from "@/lib/ai/openai/SubjectUnderstandingAI";
import { devOnlyRoute } from "@/lib/api/devOnlyRoute";

export async function GET() {

  const blocked = devOnlyRoute();
  if (blocked) return blocked;

  try {

    const result =
      await understandResearchWithAI({

        title:
          "Influence de l'accès au financement sur la pérennité des petites entreprises minières à Lubumbashi",

        domain:
          "Sciences de gestion",

        level:
          "Master",

        university:
          "Université de Lubumbashi",

        researchType:
          "Quantitative",

        problem:
          "Malgré leur importance dans l'économie locale, de nombreuses petites entreprises minières rencontrent des difficultés de financement qui pourraient compromettre leur pérennité.",

        objective:
          "Analyser l'influence de l'accès au financement sur la pérennité des petites entreprises minières à Lubumbashi.",

        objectives: [
          "Identifier les principales sources de financement accessibles aux petites entreprises minières.",
          "Évaluer le niveau d'accès au financement.",
          "Analyser le niveau de pérennité des petites entreprises minières.",
          "Déterminer la relation entre l'accès au financement et la pérennité."
        ],

        population:
          "Petites entreprises minières",

        location:
          "Lubumbashi"
      });

    return Response.json({
      success: true,
      result
    });

  } catch (error) {

    console.error(
      "A1 OPENAI ERROR:",
      error
    );

    return Response.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue"
      },
      {
        status: 500
      }
    );
  }
}