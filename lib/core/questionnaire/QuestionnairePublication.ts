import type {
  GeneratedQuestionnaire,
  QuestionnairePublication,
} from "./QuestionnaireTypes";

/**
 * Génère un identifiant public court et lisible.
 * On évite volontairement les caractères ambigus
 * comme 0/O et 1/I.
 */
function generatePublicId(length = 8): string {
  const characters =
    "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

  let result = "";

  for (let i = 0; i < length; i++) {
    result +=
      characters[
        Math.floor(
          Math.random() * characters.length
        )
      ];
  }

  return result;
}

/**
 * Génère l'URL publique du questionnaire.
 */
export function buildPublicQuestionnaireUrl(
  publicId: string
): string {
  if (
    typeof window !== "undefined" &&
    window.location.origin
  ) {
    return `${window.location.origin}/questionnaire/${publicId}`;
  }

  return `/questionnaire/${publicId}`;
}

/**
 * Publie un questionnaire.
 *
 * Cette fonction ne touche pas encore à une base de données.
 * Elle prépare simplement l'objet de publication.
 */
export function publishQuestionnaire(
  questionnaire: GeneratedQuestionnaire
): GeneratedQuestionnaire {
  /*
   * Si le questionnaire est déjà publié,
   * on évite de créer inutilement un nouveau lien.
   */
  if (
    questionnaire.publication?.status ===
      "published"
  ) {
    return questionnaire;
  }

  const publicId =
    generatePublicId();

  const publication:
    QuestionnairePublication = {
    id:
      `publication-${Date.now()}`,

    publicId,

    status: "published",

    publishedAt:
      new Date().toISOString(),

    responseCount: 0,

    publicUrl:
      buildPublicQuestionnaireUrl(
        publicId
      ),
  };

  return {
    ...questionnaire,

    publication,
  };
}

/**
 * Ferme la collecte.
 */
export function closeQuestionnaire(
  questionnaire: GeneratedQuestionnaire
): GeneratedQuestionnaire {
  if (!questionnaire.publication) {
    return questionnaire;
  }

  return {
    ...questionnaire,

    publication: {
      ...questionnaire.publication,

      status: "closed",

      closedAt:
        new Date().toISOString(),
    },
  };
}

/**
 * Rouvre un questionnaire fermé.
 */
export function reopenQuestionnaire(
  questionnaire: GeneratedQuestionnaire
): GeneratedQuestionnaire {
  if (!questionnaire.publication) {
    return questionnaire;
  }

  return {
    ...questionnaire,

    publication: {
      ...questionnaire.publication,

      status: "published",

      closedAt: undefined,
    },
  };
}