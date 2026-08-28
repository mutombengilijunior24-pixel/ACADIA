import {
  analyzeResearch,
} from "@/lib/core/research/ResearchIntelligenceEngine";
import { devOnlyRoute } from "@/lib/api/devOnlyRoute";


export async function GET() {

  const blocked = devOnlyRoute();
  if (blocked) return blocked;

  try {

    const result =
      await analyzeResearch({

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

        populationSize:
          100,

        location:
          "Lubumbashi",

        collectionMethod:
          "Questionnaire",
      });


    return Response.json({

      success:
        true,

      result,
    });

  } catch (error) {

    console.error(
      "RESEARCH INTELLIGENCE ERROR:",
      error
    );

    return Response.json(
      {
        success:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Erreur inconnue",
      },
      {
        status:
          500,
      }
    );
  }
}