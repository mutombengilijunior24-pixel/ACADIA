import OpenAI from "openai";

// ============================================================
// ACADIA — CLIENT OPENAI (A1 / A2)
//
// Ce module ne doit JAMAIS être importé, directement ou
// transitivement, par un fichier "use client". Il porte la
// clé API et les prompts système des moteurs A1/A2.
//
// Garde-fou sans dépendance supplémentaire : si ce module
// s'exécute malgré tout dans un navigateur (régression future
// d'un import client), on échoue bruyamment plutôt que
// d'exposer silencieusement le SDK/la clé.
// ============================================================

if (typeof window !== "undefined") {
  throw new Error(
    "lib/ai/openai/client.ts a été chargé côté navigateur. " +
      "Ce module est réservé au serveur (routes API / moteurs A1-A2)."
  );
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-key-for-build",
});
