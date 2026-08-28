import type { ResearchData } from "@/types/Research";

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
   TEST A1
========================================================= */

const result =
  understandResearchSubject(
    testResearch
  );

/* =========================================================
   AFFICHAGE
========================================================= */

console.log(
  "======================================"
);

console.log(
  "   ACADIA — SUBJECT UNDERSTANDING A1"
);

console.log(
  "======================================"
);

console.log(
  "Compréhension :"
);

console.log(
  JSON.stringify(
    result.understanding,
    null,
    2
  )
);

console.log(
  "======================================"
);

console.log(
  "Raisonnement :"
);

console.log(
  result.reasoning
);

console.log(
  "======================================"
);

export {
  result,
};