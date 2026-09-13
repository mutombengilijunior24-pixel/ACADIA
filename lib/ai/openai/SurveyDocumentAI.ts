import { createTrackedResponse } from "./trackedResponses";
import { selectModel } from "@/lib/server/ai/ModelRouter";
import type { AITrackingInput } from "./SubjectUnderstandingAI";

// ============================================================
// ACADIA — RECONNAISSANCE ET RESTRUCTURATION DE QUESTIONNAIRE IMPORTÉ
//
// Réutilise le même client/modèle OpenAI que la génération guidée
// (lib/ai/openai/SurveyQuestionnaireAI.ts) et les moteurs A1/A2 de
// Research — jamais un second système OpenAI, jamais un second moteur
// Survey. Ne modifie jamais silencieusement le sens d'une question :
// la restructuration renvoie toujours une paire (originale, proposée)
// pour validation humaine avant tout enregistrement.
// ============================================================

export type ExtractedQuestionType =
  | "short_text"
  | "long_text"
  | "single_choice"
  | "multiple_choice"
  | "scale"
  | "boolean"
  | "number"
  | "age"
  | "date"
  | "institution"
  | "faculty"
  | "level"
  | "category";

export interface ExtractedQuestion {
  section: string;
  text: string;
  type: ExtractedQuestionType;
  required: boolean;
  options: { label: string }[];
}

export interface ExtractedQuestionnaire {
  title: string;
  questions: ExtractedQuestion[];
}

const QUESTION_TYPES = [
  "short_text", "long_text", "single_choice", "multiple_choice", "scale", "boolean",
  "number", "age", "date", "institution", "faculty", "level", "category",
] as const;

const QUESTIONNAIRE_SCHEMA = {
  type: "object" as const,
  properties: {
    title: { type: "string" as const },
    questions: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          section: { type: "string" as const },
          text: { type: "string" as const },
          type: { type: "string" as const, enum: [...QUESTION_TYPES] },
          required: { type: "boolean" as const },
          options: {
            type: "array" as const,
            items: {
              type: "object" as const,
              properties: { label: { type: "string" as const } },
              required: ["label"],
              additionalProperties: false as const,
            },
          },
        },
        required: ["section", "text", "type", "required", "options"],
        additionalProperties: false as const,
      },
    },
  },
  required: ["title", "questions"],
  additionalProperties: false as const,
};

function parseQuestionnaire(content: string | null | undefined): ExtractedQuestionnaire {
  if (!content) {
    throw new Error("OpenAI n'a retourné aucun résultat.");
  }
  try {
    const parsed = JSON.parse(content) as ExtractedQuestionnaire;
    if (!parsed.title || !Array.isArray(parsed.questions)) {
      throw new Error("La réponse ne respecte pas le contrat attendu.");
    }
    return parsed;
  } catch {
    throw new Error("La réponse d'OpenAI n'est pas un JSON valide ou ne respecte pas le contrat Survey.");
  }
}

/**
 * Reconnaissance d'un document importé : à partir du texte brut extrait
 * (mammoth), reconstruit une structure interne (titre + questions
 * typées avec options) — ne se contente jamais d'un simple découpage
 * de texte, identifie réellement la numérotation, les modalités de
 * réponse et les types de question.
 */
export async function extractQuestionnaireFromText(
  rawText: string,
  tracking: AITrackingInput = {}
): Promise<ExtractedQuestionnaire> {
  const { model } = selectModel("DOCUMENT_ANALYSIS");
  const response = await createTrackedResponse({
    model,
    input: [
      {
        role: "system",
        content: `Tu es le moteur de reconnaissance de documents Survey d'ACADIA. On te fournit le texte brut extrait d'un document Word (.docx) contenant un questionnaire d'enquête déjà rédigé par un chercheur ou une institution.

Ta mission :
1. Identifier le titre du questionnaire (ou en déduire un titre court et fidèle s'il n'est pas explicite).
2. Identifier chaque question individuellement (numérotation, puces, sauts de ligne).
3. Pour chaque question, déterminer :
   - le type le plus probable (single_choice si une liste de choix numérotée/à puces suit la question, multiple_choice si le texte indique explicitement un choix multiple, scale si une échelle de type Likert est présente, boolean si la question attend Oui/Non, short_text/long_text si aucune modalité n'est fournie, number/age/date/institution/faculty/level/category si le texte le suggère clairement) ;
   - les options réellement présentes dans le document (jamais inventées) ;
   - si la question semble obligatoire (par défaut true sauf mention contraire) ;
   - une section (regroupe les questions par thème si le document a des parties, sinon "Questionnaire importé").

RÈGLES STRICTES :
- Ne fabrique aucune question, aucune option, aucun texte qui n'apparaît pas dans le document fourni.
- Ne résume pas le document, reconstruis sa structure réelle.
- Si un passage n'est manifestement pas une question (titre, instruction, introduction), ne le transforme pas en question.
- La réponse doit être exclusivement un JSON valide respectant le schéma fourni.`,
      },
      {
        role: "user",
        content: `Texte brut extrait du document :\n\n${rawText.slice(0, 20000)}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "extracted_questionnaire",
        strict: true,
        schema: QUESTIONNAIRE_SCHEMA,
      },
    },
  }, {
    operation: "DOCUMENT_ANALYSIS",
    userId: tracking.userId,
    projectId: tracking.projectId,
    correlationId: tracking.correlationId,
  });

  return parseQuestionnaire(response.output_text);
}

/**
 * Restructuration : corrige la formulation, supprime les doublons,
 * uniformise les modalités, organise par sections — SANS jamais
 * modifier silencieusement le sens d'une question. Retourne toujours
 * la paire (originale conservée par l'appelant, proposée) pour
 * validation humaine explicite avant tout enregistrement.
 */
export async function restructureQuestionnaireWithAI(
  questions: ExtractedQuestion[],
  tracking: AITrackingInput = {}
): Promise<ExtractedQuestion[]> {
  const { model } = selectModel("DOCUMENT_ANALYSIS");
  const response = await createTrackedResponse({
    model,
    input: [
      {
        role: "system",
        content: `Tu es le moteur de restructuration méthodologique Survey d'ACADIA. On te fournit une liste de questions d'enquête déjà extraites d'un document importé, potentiellement mal formulées, redondantes ou mal typées.

Ta mission, pour CHAQUE question fournie (même nombre en sortie qu'en entrée, même ordre) :
- corriger la formulation si elle est ambiguë, trop longue, ou contient une double question (scinde mentalement mais ne renvoie qu'une reformulation single-concept — ne crée pas de nouvelle question) ;
- proposer des modalités de réponse structurées (single_choice/multiple_choice/scale) lorsque cela est méthodologiquement pertinent et que la question s'y prête réellement (ex. "Quels problèmes rencontrez-vous ?" -> choix multiple avec les problèmes qui apparaissent implicitement ou explicitement dans le texte) ;
- uniformiser les échelles (toujours symétriques, 4 à 6 modalités cohérentes) ;
- normaliser le type si le type initial est incorrect (ex. une question de satisfaction typée short_text doit devenir scale) ;
- conserver rigoureusement le sens et l'intention initiale de la question — ne jamais changer ce qu'elle mesure ;
- si une question est déjà correcte, la renvoyer inchangée.

Ne renvoie jamais moins ou plus de questions que fourni en entrée. La réponse doit être exclusivement un JSON valide respectant le schéma fourni.`,
      },
      {
        role: "user",
        content: `Questions à restructurer :\n\n${JSON.stringify(questions, null, 2)}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "restructured_questionnaire",
        strict: true,
        schema: {
          type: "object",
          properties: { questions: QUESTIONNAIRE_SCHEMA.properties.questions },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    },
  }, {
    operation: "DOCUMENT_ANALYSIS",
    userId: tracking.userId,
    projectId: tracking.projectId,
    correlationId: tracking.correlationId,
  });

  const content = response.output_text;
  if (!content) {
    throw new Error("OpenAI n'a retourné aucun résultat.");
  }
  try {
    const parsed = JSON.parse(content) as { questions: ExtractedQuestion[] };
    if (!Array.isArray(parsed.questions)) {
      throw new Error("La réponse ne respecte pas le contrat attendu.");
    }
    return parsed.questions;
  } catch {
    throw new Error("La réponse d'OpenAI n'est pas un JSON valide ou ne respecte pas le contrat Survey.");
  }
}
