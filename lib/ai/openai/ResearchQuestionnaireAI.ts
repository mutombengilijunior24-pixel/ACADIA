import { createTrackedResponse } from "./trackedResponses";
import { selectModel } from "@/lib/server/ai/ModelRouter";
import type { AITrackingInput } from "./SubjectUnderstandingAI";

/* =========================================================
   FORMULATION IA DU QUESTIONNAIRE DE RECHERCHE (Bloc A, 11/09/2026)

   Ne remplace PAS QuestionnaireGenerationEngine.ts (moteur protégé,
   non modifié) : celui-ci reste seul responsable de la structure —
   quelles variables/dimensions/indicateurs deviennent des questions,
   avec quelle traçabilité (variableId/dimensionId/indicatorId).

   Ce module intervient APRÈS, en enrichissement (voir
   lib/core/questionnaire/QuestionnaireAIEnrichment.ts) : il reçoit
   la liste des indicateurs déjà décidés et reformule uniquement le
   texte / le type de CHAQUE question existante, sur le même modèle
   que lib/ai/openai/SurveyQuestionnaireAI.ts (schéma JSON strict,
   interdiction explicite des formulations génériques répétitives).
   Il ne peut ni ajouter ni supprimer un indicateur — chaque
   questionId fourni en entrée doit revenir exactement une fois en
   sortie (c'est un identifiant de corrélation technique, jamais l'id
   scientifique de l'indicateur, qui n'est pas unique globalement).
========================================================= */

export type AIQuestionType =
  | "single_choice"
  | "multiple_choice"
  | "likert"
  | "yes_no"
  | "number"
  | "text"
  | "long_text"
  | "frequency"
  | "date"
  | "percentage";

const QUESTION_TYPES: AIQuestionType[] = [
  "single_choice",
  "multiple_choice",
  "likert",
  "yes_no",
  "number",
  "text",
  "long_text",
  "frequency",
  "date",
  "percentage",
];

export interface AIQuestionnaireItem {
  /**
   * Identifiant de CORRÉLATION technique (l'id de la question dans le
   * questionnaire généré, ex. "Q7") — jamais l'id scientifique de
   * l'indicateur, qui n'est pas garanti unique globalement (il est
   * renuméroté par dimension). Sert uniquement à réassocier la
   * formulation IA à la bonne question ; ne porte aucune information
   * de contenu.
   */
  questionId: string;
  variableName: string;
  variableRole: string;
  dimensionName: string;
  indicatorName: string;
  indicatorDescription?: string;
}

export interface AIQuestionnaireContext {
  projectTitle: string;
  domain?: string;
  researchQuestion?: string;
  population?: string;
  location?: string;
}

export interface AIQuestionnaireFormulation {
  questionId: string;
  type: AIQuestionType;
  text: string;
  options: { label: string }[];
}

export async function formulateQuestionnaireQuestions(
  context: AIQuestionnaireContext,
  items: AIQuestionnaireItem[],
  tracking: AITrackingInput = {}
): Promise<AIQuestionnaireFormulation[]> {
  const { model } = selectModel("QUESTIONNAIRE_GENERATION");
  const response = await createTrackedResponse({
    model,
    reasoning: { effort: "none" },
    input: [
      {
        role: "system",
        content: `Tu formules les questions d'un questionnaire de recherche universitaire pour la plateforme ACADIA.

RÈGLE ABSOLUE : chaque question fournie en entrée correspond à un indicateur déjà décidé (variable → dimension → indicateur). Tu ne dois JAMAIS inventer, fusionner ou supprimer un indicateur — tu formules uniquement le texte et le type de question qui le mesure le mieux. Un indicateur = une question, toujours.

INTERDICTION FORMELLE : ne formule JAMAIS la majorité des questions sur le même gabarit répétitif "Dans quelle mesure êtes-vous d'accord avec l'affirmation suivante concernant X : « Y » ?". C'est précisément le défaut à corriger. Varie réellement la construction grammaticale d'une question à l'autre, comme le ferait un vrai méthodologue.

MÉTHODE :
1. Lis le nom et la description réels de l'indicateur — ne les remplace jamais par autre chose, formule une question qui les mesure fidèlement.
2. Choisis le type le plus adapté à la NATURE de l'indicateur (pas systématiquement "likert") : "single_choice"/"multiple_choice" pour une liste de modalités réalistes, "likert" pour une perception/accord/satisfaction, "yes_no" pour une existence/un fait binaire, "number"/"percentage" pour une quantité chiffrée, "date" pour une ancienneté/échéance, "text"/"long_text" seulement si aucune structuration fermée n'est possible.
2bis. COHÉRENCE QUESTION/ÉCHELLE POUR "likert" (règle stricte) : le type "likert" est TOUJOURS associé à l'échelle fixe d'accord "Pas du tout d'accord → Tout à fait d'accord" — jamais une autre échelle. La formulation doit donc obligatoirement inviter à exprimer un ACCORD avec une affirmation ("Dans quelle mesure êtes-vous d'accord avec…", "Êtes-vous satisfait de…", "Cette affirmation correspond-elle à votre expérience…"). N'utilise JAMAIS pour "likert" une formulation en "à quel niveau…", "quel est le niveau de…" ou "évaluez le niveau de…" : ces formulations appellent une échelle d'intensité (Très faible → Très élevé), pas une échelle d'accord — si l'indicateur appelle ce type de formulation, choisis plutôt "single_choice" avec des modalités d'intensité réalistes (ex. Très faible, Faible, Moyen, Élevé, Très élevé) adaptées à cet indicateur précis.
3. Pour "single_choice"/"multiple_choice" uniquement : fournis 2 à 6 modalités réalistes et mutuellement pertinentes pour CET indicateur précis (jamais des modalités génériques copiées d'un autre sujet). Pour tout autre type, "options" doit être un tableau vide — ne fournis jamais de modalités pour "likert"/"yes_no"/"frequency" (des échelles standard leur sont déjà associées ailleurs).
4. Une question = un seul concept, jamais de double question ("... et ...").
5. Aucun jargon inutile, formulation courte et non ambiguë, adaptée au vrai sujet et au vrai contexte fournis (jamais une formulation qui pourrait s'appliquer à n'importe quel sujet).

N'invente aucun chiffre, aucune institution, aucun fait non fourni. La réponse doit être exclusivement un JSON valide respectant le schéma fourni, avec exactement un objet par questionId reçu en entrée (reprends-le tel quel, ne le modifie jamais), dans n'importe quel ordre.`,
      },
      {
        role: "user",
        content: `Sujet de la recherche : ${context.projectTitle}
${context.domain ? `Domaine : ${context.domain}\n` : ""}${context.researchQuestion ? `Question de recherche : ${context.researchQuestion}\n` : ""}${context.population ? `Population : ${context.population}\n` : ""}${context.location ? `Terrain : ${context.location}\n` : ""}
Indicateurs à formuler en questions :
${JSON.stringify(items, null, 2)}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "research_questionnaire_formulation",
        strict: true,
        schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  questionId: { type: "string" },
                  type: { type: "string", enum: [...QUESTION_TYPES] },
                  text: { type: "string" },
                  options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { label: { type: "string" } },
                      required: ["label"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["questionId", "type", "text", "options"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    },
  }, {
    operation: "QUESTIONNAIRE_GENERATION",
    userId: tracking.userId,
    projectId: tracking.projectId,
    correlationId: tracking.correlationId,
  });

  const content = response.output_text;
  if (!content) {
    throw new Error("OpenAI n'a retourné aucun résultat.");
  }

  try {
    const parsed = JSON.parse(content) as { questions: AIQuestionnaireFormulation[] };
    if (!Array.isArray(parsed.questions)) {
      throw new Error("Contrat non respecté.");
    }
    return parsed.questions;
  } catch {
    throw new Error("La réponse d'OpenAI n'est pas un JSON valide pour la formulation du questionnaire.");
  }
}
