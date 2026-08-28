// ============================================================
// ACADIA — CONFIGURATION IA (A1 / A2)
//
// Point unique de vérité pour le nom du modèle utilisé par
// les moteurs A1 (SubjectUnderstandingAI) et A2
// (VariableIntelligenceAI).
//
// La valeur fonctionnelle actuelle ("gpt-5.6") n'est PAS
// modifiée par cette centralisation — seul l'endroit où elle
// est déclarée change. Un changement de modèle se fera en un
// seul point, ou via la variable d'environnement AI_MODEL.
//
// Ce fichier est importé uniquement par du code serveur
// (lib/ai/openai/*), jamais par un composant client.
// ============================================================

export const AI_MODEL = process.env.AI_MODEL || "gpt-5.6";
