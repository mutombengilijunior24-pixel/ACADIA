import type { ResearchData } from "@/types/Research";

import {
  createResearchProject,
  getResearchCoreWarnings,
} from "./ResearchCore";

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
   CRÉATION DU PROJET CENTRAL
========================================================= */

const project =
  createResearchProject(
    testResearch
  );

/* =========================================================
   VALIDATION
========================================================= */

const warnings =
  getResearchCoreWarnings(project);

/* =========================================================
   AFFICHAGE
========================================================= */

console.log(
  "======================================"
);

console.log(
  "       ACADIA — RESEARCH CORE A0"
);

console.log(
  "======================================"
);

console.log(
  "ID :",
  project.id
);

console.log(
  "Sujet :",
  project.title
);

console.log(
  "Domaine :",
  project.domain
);

console.log(
  "Niveau :",
  project.level
);

console.log(
  "Université :",
  project.university
);

console.log(
  "Type :",
  project.researchType
);

console.log(
  "Problématique :",
  project.problem
);

console.log(
  "Objectifs :",
  project.objectives
);

console.log(
  "Méthodologie :",
  project.methodology
);

console.log(
  "Variables :",
  project.variables
);

console.log(
  "======================================"
);

console.log(
  "AVERTISSEMENTS :"
);

console.log(
  warnings
);

console.log(
  "======================================"
);

export {
  project,
  warnings,
};