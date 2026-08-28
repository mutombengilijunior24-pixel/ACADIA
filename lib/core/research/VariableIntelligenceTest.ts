import type { ResearchData } from "@/types/Research";

import {
  identifyResearchVariables,
} from "./VariableIntelligenceEngine";

import {
  understandResearchSubject,
} from "./SubjectUnderstandingEngine";

/* =========================================================
   DONNÉES DE TEST
========================================================= */

const testResearch: ResearchData = {
  title:
    "Influence de l'évaluation du personnel sur la motivation des agents de la SNCC à Lubumbashi",

  domain: "Gestion",

  level: "Master",

  university:
    "Université de Lubumbashi",

  researchType: "Quantitative",

  problem:
    "Dans quelle mesure l'évaluation du personnel influence-t-elle la motivation des agents de la SNCC à Lubumbashi ?",

  objective:
    "Analyser l'influence de l'évaluation du personnel sur la motivation des agents de la SNCC à Lubumbashi.",

  objectives: [
    "Identifier les pratiques d'évaluation du personnel à la SNCC.",
    "Mesurer le niveau de motivation des agents.",
    "Analyser la relation entre l'évaluation du personnel et la motivation.",
  ],

  population:
    "Agents de la SNCC à Lubumbashi",

  populationSize: 247,

  location: "Lubumbashi",

  collectionMethod: "Questionnaire",
};

/* =========================================================
   TEST
========================================================= */

export async function runVariableIntelligenceTest() {

  const understanding =
    understandResearchSubject(
      testResearch
    );

  const result =
    await identifyResearchVariables(
      testResearch,
      understanding.understanding
    );

  console.log(
    "======================================"
  );

  console.log(
    " ACADIA — VARIABLE INTELLIGENCE A2"
  );

  console.log(
    "======================================"
  );

  console.log(
    JSON.stringify(
      result,
      null,
      2
    )
  );

  return result;
}