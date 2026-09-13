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

        phenomenon:
          "Des petites entreprises minières à Lubumbashi cherchent à financer leurs activités, avec des implications sur leur pérennité.",

        problem:
          "Le lien entre l'accès au financement et la pérennité de ces entreprises n'est pas encore caractérisé.",

        researchQuestion:
          "Dans quelle mesure l'accès au financement est-il lié à la pérennité des petites entreprises minières à Lubumbashi ?",

        generalObjective:
          "Analyser le lien entre l'accès au financement et la pérennité des petites entreprises minières à Lubumbashi.",

        specificObjectives: [],

        researchModeTags: ["QUANTITATIVE_SURVEY"],

        fieldConfidence: {
          phenomenon: "INFERRED",
          problem: "INFERRED",
          researchQuestion: "INFERRED",
          generalObjective: "INFERRED",
          specificObjectives: "MISSING",
          population: "KNOWN",
          location: "KNOWN",
          mainConcepts: "INFERRED",
          proposedRelationship: "INFERRED",
          researchModeTags: [{ tag: "QUANTITATIVE_SURVEY", confidence: "INFERRED" }],
        },

        phenomenonTable: [],

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
          "high",

        engineVersion: "A1.v3"
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