import type { ResearchData } from "@/types/Research";

import {
  generateMethodologyIntelligence,
} from "./MethodologyIntelligenceEngine";


/* =========================================================
   TEST A3
========================================================= */

const testResearch: ResearchData = {

  title:
    "Influence de l'évaluation du personnel sur la motivation des agents de la SNCC à Lubumbashi",

  domain:
    "Gestion",

  level:
    "Master",

  university:
    "Université de Lubumbashi",

  researchType:
    "Quantitative",

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

  populationSize:
    247,

  location:
    "Lubumbashi",

  collectionMethod:
    "Questionnaire",
};


/* =========================================================
   EXÉCUTION
========================================================= */

const result =
  generateMethodologyIntelligence(
    testResearch
  );


/* =========================================================
   AFFICHAGE
========================================================= */

console.log(
  "======================================"
);

console.log(
  "ACADIA — A3 METHODOLOGY INTELLIGENCE"
);

console.log(
  "======================================"
);


console.log(
  "STATUT :",
  result.status
);


console.log(
  "\nAPPROCHE :",
  result.methodology.approach
);


console.log(
  "\nMÉTHODE :",
  result.methodology.method
);


console.log(
  "\nTECHNIQUES :"
);

console.log(
  result.methodology.techniques
);


console.log(
  "\nVARIABLES :"
);

console.log(
  result.methodology.variables
);


console.log(
  "\nINDICATEURS :"
);

console.log(
  result.methodology.indicators
);


console.log(
  "\nHYPOTHÈSES :"
);

console.log(
  result.methodology.hypotheses
);


console.log(
  "\nANALYSES :"
);

console.log(
  result.methodology.analyses
);


console.log(
  "\nSCORE DE COHÉRENCE :",
  result.methodology.coherenceScore
);


console.log(
  "\nPOPULATION :",
  result.population
);


console.log(
  "\nÉCHANTILLONNAGE :",
  result.sampling
);


console.log(
  "\nRECOMMANDATIONS :"
);

console.log(
  result.recommendations
);


console.log(
  "\nAVERTISSEMENTS :"
);

console.log(
  result.warnings
);


console.log(
  "======================================"
);


export {
  result,
};