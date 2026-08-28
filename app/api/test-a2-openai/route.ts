import {
  analyzeVariablesWithAI,
} from "@/lib/ai/openai/VariableIntelligenceAI";
import { devOnlyRoute } from "@/lib/api/devOnlyRoute";

export async function GET() {
  const blocked = devOnlyRoute();
  if (blocked) return blocked;

  try {
    const result =
      await analyzeVariablesWithAI({

        researchFocus:
          "Comprendre dans quelle mesure l'accès au financement est lié à la pérennité des petites entreprises minières à Lubumbashi.",

        mainConcepts: [
          "Accès au financement",
          "Sources de financement",
          "Pérennité des petites entreprises minières",
          "Petites entreprises minières"
        ],

        proposedRelationship: {
          from:
            "Accès au financement",

          to:
            "Pérennité des petites entreprises minières",

          relation:
            "influence"
        },

        population:
          "Petites entreprises minières",

        location:
          "Lubumbashi",

        assumptions: [
          "L'accès au financement constitue la variable indépendante potentielle.",
          "La pérennité constitue la variable dépendante potentielle."
        ],

        pointsToConfirm: [
          "La définition opérationnelle d'une petite entreprise minière.",
          "Les dimensions exactes de l'accès au financement.",
          "Les dimensions exactes de la pérennité."
        ],

        confidence:
          "high"
      });

    return Response.json({
      success: true,
      result
    });

  } catch (error) {

    console.error(
      "A2 OPENAI ERROR:",
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