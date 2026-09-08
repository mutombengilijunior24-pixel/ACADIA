// ============================================================
// ACADIA — MOTEUR DE CONCLUSION DE LA QUESTION DE RECHERCHE (Mission 7, bloc 1)
//
// 100% déterministe. N'invente jamais de question : si aucune
// ResearchQuestion n'est marquée type === "main" pour ce projet,
// retourne `undefined` plutôt qu'une question fabriquée (voir
// audit Mission 7 — ResearchQuestion.type existe déjà, "main"|
// "secondary", jamais recréé ici).
//
// Agrège TOUS les objectifs spécifiques du projet (ResearchQuestion
// n'a aujourd'hui aucun lien explicite vers un objectif précis dans
// le modèle de données — voir audit) : une question principale est,
// par construction méthodologique standard, servie par l'ensemble
// des objectifs spécifiques d'un projet.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { ObjectiveConclusion, ResearchQuestionConclusion } from "./ScientificConclusionTypes";

export function buildResearchQuestionConclusion(
  project: ResearchProject,
  objectiveConclusions: ObjectiveConclusion[]
): ResearchQuestionConclusion | undefined {
  const mainQuestion = project.researchQuestions.find((q) => q.type === "main");
  if (!mainQuestion) return undefined;

  if (objectiveConclusions.length === 0) {
    return {
      researchQuestionId: mainQuestion.id,
      statement: mainQuestion.text,
      conclusion: "Aucun objectif spécifique ne peut encore être relié à cette question de recherche avec les données actuellement disponibles.",
      objectiveIds: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const fullyCovered = objectiveConclusions.filter((o) => o.coverage.status === "FULL");
  const partiallyCovered = objectiveConclusions.filter((o) => o.coverage.status === "PARTIAL");
  const notCovered = objectiveConclusions.filter((o) => o.coverage.status === "NONE");

  let conclusion: string;
  if (notCovered.length === objectiveConclusions.length) {
    conclusion =
      "Les objectifs spécifiques rattachés à cette question ne sont pas encore suffisamment couverts par les données et analyses disponibles pour y répondre.";
  } else if (fullyCovered.length === objectiveConclusions.length) {
    conclusion =
      "Les résultats obtenus pour l'ensemble des objectifs spécifiques permettent d'apporter des éléments de réponse à cette question de recherche, dans les limites méthodologiques de l'étude.";
  } else {
    conclusion = `Les résultats obtenus permettent d'apporter une réponse partielle à cette question de recherche : ${fullyCovered.length} objectif(s) sur ${objectiveConclusions.length} sont pleinement couverts, ${partiallyCovered.length} partiellement, ${notCovered.length} pas encore.`;
  }

  return {
    researchQuestionId: mainQuestion.id,
    statement: mainQuestion.text,
    conclusion,
    objectiveIds: objectiveConclusions.map((o) => o.objectiveId),
    generatedAt: new Date().toISOString(),
  };
}
