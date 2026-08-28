import { generateMethodology } from "./MethodologyEngine";

const result = generateMethodology({
  title:
    "Influence de l'évaluation du personnel sur la motivation des agents",
  domain: "Gestion",
  level: "Licence",
  university: "Université de Lubumbashi",
  researchType: "Quantitative",
  problem: "Problème de motivation du personnel",
  objective: "Évaluer l'influence de l'évaluation du personnel",
  objectives: [
    "Identifier les pratiques d'évaluation",
    "Mesurer la motivation",
  ],
  population: "Agents de la SNCC",
  populationSize: 250,
  location: "Lubumbashi",
  collectionMethod: "Questionnaire",
});

console.log(result);