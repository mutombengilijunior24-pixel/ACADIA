import { openai } from "./client";
import { AI_MODEL } from "./config";

// ============================================================
// ACADIA — MOTEUR MÉTHODOLOGIQUE SURVEY (génération assistée)
//
// Remplace la substitution littérale de l'objectif dans des gabarits
// de phrase (bug source : "Depuis combien de temps êtes-vous
// concerné(e) par : <objectif complet>") par une véritable extraction
// dimension → variable → indicateur → question, réalisée par le même
// moteur OpenAI que les moteurs A1/A2 de Research (même client, même
// modèle, même schéma structuré strict) — jamais un second système
// OpenAI.
//
// Ce module ne construit QUE les questions de contenu (usage,
// évaluation, besoins, perceptions). Les questions de profil
// (catégorie, institution, faculté, niveau, âge, sexe) restent
// déterministes — elles ne nécessitent aucune compréhension du sujet
// et une génération IA n'y apporterait aucune valeur, seulement un
// risque d'incohérence. Jamais chargé côté navigateur (voir
// lib/ai/openai/client.ts).
// ============================================================

export type AIContentQuestionType = "short_text" | "long_text" | "single_choice" | "multiple_choice" | "scale" | "boolean" | "number";

export interface AIContentQuestion {
  dimension: string;
  variable: string;
  indicator: string;
  text: string;
  type: AIContentQuestionType;
  required: boolean;
  options: { label: string }[];
  visibleForCategoryLabels: string[];
}

export interface SurveyContentBrief {
  title: string;
  objective: string;
  problem?: string;
  targetAudience?: string;
  institution?: string;
  categories: string[];
}

const CONTENT_TYPES = ["short_text", "long_text", "single_choice", "multiple_choice", "scale", "boolean", "number"] as const;

export async function generateContentQuestionsWithAI(brief: SurveyContentBrief): Promise<AIContentQuestion[]> {
  const response = await openai.responses.create({
    model: AI_MODEL,
    input: [
      {
        role: "system",
        content: `Tu es le moteur méthodologique Survey de la plateforme ACADIA. Tu conçois des questions d'enquête institutionnelle pour des établissements, universités et organisations.

RÈGLE ABSOLUE — INTERDICTION FORMELLE :
L'objectif fourni par le chercheur est un CONTEXTE, jamais une question. Tu ne dois JAMAIS recopier l'objectif complet, une phrase de l'objectif, ou un long fragment de l'objectif dans le texte d'une question. Interdiction stricte de formulations comme "Cette enquête cherche à...", "Je souhaite mesurer...", "Cette étude vise à...", "Dans quelle mesure cette enquête...", ou "Depuis combien de temps êtes-vous concerné(e) par [objectif complet]...".

MÉTHODE OBLIGATOIRE :
1. Comprends l'objectif et le problème fournis.
2. Extrais les DIMENSIONS pertinentes (ex. accès, utilisation, fréquence, facilité d'utilisation, rapidité, fiabilité, satisfaction, difficultés, besoins, priorités).
3. Pour chaque dimension, identifie une VARIABLE mesurable et un INDICATEUR concret.
4. Construis une question courte, claire, non ambiguë, directement liée à l'indicateur — jamais à l'objectif brut.

EXEMPLE (objectif : "Je souhaite mesurer la satisfaction et l'expérience numérique des étudiants universitaires.") :
- dimension "Utilisation", variable "services utilisés", indicateur "liste des services numériques utilisés" -> question "Quels services numériques universitaires utilisez-vous ?" (multiple_choice)
- dimension "Utilisation", variable "fréquence d'usage", indicateur "fréquence hebdomadaire" -> question "À quelle fréquence utilisez-vous ces services ?" (single_choice)
- dimension "Évaluation", variable "facilité d'utilisation", indicateur "niveau perçu de facilité" -> question "Comment évaluez-vous la facilité d'utilisation des plateformes numériques universitaires ?" (scale)
- dimension "Satisfaction", variable "satisfaction globale", indicateur "niveau de satisfaction" -> question "Quel est votre niveau de satisfaction globale ?" (scale)
Ces exemples illustrent le STYLE attendu — ne les recopie pas systématiquement, adapte-les au sujet réel fourni.

QUALITÉ DES QUESTIONS :
- Une question = un seul concept. Jamais de question double ("... et ...").
- Préfère "Comment évaluez-vous...", "À quelle fréquence...", "Quels/Quelles..." à des formulations lourdes comme "Dans quelle mesure pensez-vous que...".
- Aucun jargon inutile.
- Vise 70 à 85 % de questions structurées/fermées (single_choice, multiple_choice, scale, boolean, number) sur l'ensemble que tu produis. Les questions ouvertes (short_text, long_text) restent uniquement lorsqu'une liste de modalités ne permettrait pas de recueillir correctement l'information.
- Une échelle ("scale") doit toujours avoir entre 4 et 6 options, symétriques (ex. Très insatisfait/Insatisfait/Neutre/Satisfait/Très satisfait, ou Très faible/Faible/Moyen/Élevé/Très élevé, ou Très improbable/Improbable/Neutre/Probable/Très probable selon ce qui est réellement mesuré). Ne jamais associer une échelle à des options qui ne sont pas une échelle (ex. jamais de tranches de durée ou de dates comme options d'une question de satisfaction).
- single_choice et multiple_choice doivent avoir entre 2 et 7 options réalistes, incluant "Autre" lorsque pertinent.
- boolean et number et short_text et long_text : tableau "options" vide.
- Ne génère JAMAIS de question uniquement pour atteindre un nombre : la quantité découle des dimensions réellement identifiées, jamais d'un chiffre cible.
- N'invente aucune institution, aucun chiffre, aucun fait non fourni par le chercheur.
- "visibleForCategoryLabels" ne doit contenir que des libellés strictement identiques à ceux fournis dans la liste de catégories, et rester vide ([]) si la question concerne toutes les catégories.

La réponse doit être exclusivement un JSON valide respectant le schéma fourni.`,
      },
      {
        role: "user",
        content: `Informations fournies par le chercheur :
${JSON.stringify(
  {
    title: brief.title,
    objective: brief.objective,
    problem: brief.problem,
    targetAudience: brief.targetAudience,
    institution: brief.institution,
    categoriesDeRepondants: brief.categories,
  },
  null,
  2
)}

Construis uniquement les questions de CONTENU (usage, évaluation, besoins, perceptions) — ne construis PAS de question de profil (catégorie, institution, faculté, niveau d'étude, âge, sexe), ces questions sont déjà gérées séparément.`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "survey_content_questions",
        strict: true,
        schema: {
          type: "object",
          properties: {
            questions: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  dimension: { type: "string" },
                  variable: { type: "string" },
                  indicator: { type: "string" },
                  text: { type: "string" },
                  type: { type: "string", enum: [...CONTENT_TYPES] },
                  required: { type: "boolean" },
                  options: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: { label: { type: "string" } },
                      required: ["label"],
                      additionalProperties: false,
                    },
                  },
                  visibleForCategoryLabels: { type: "array", items: { type: "string" } },
                },
                required: ["dimension", "variable", "indicator", "text", "type", "required", "options", "visibleForCategoryLabels"],
                additionalProperties: false,
              },
            },
          },
          required: ["questions"],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.output_text;
  if (!content) {
    throw new Error("OpenAI n'a retourné aucun résultat.");
  }

  try {
    const parsed = JSON.parse(content) as { questions: AIContentQuestion[] };
    if (!Array.isArray(parsed.questions)) {
      throw new Error("La réponse du moteur Survey ne respecte pas le contrat attendu.");
    }
    return parsed.questions;
  } catch {
    throw new Error("La réponse d'OpenAI n'est pas un JSON valide ou ne respecte pas le contrat Survey.");
  }
}
