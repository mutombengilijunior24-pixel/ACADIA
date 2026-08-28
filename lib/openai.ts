import OpenAI from "openai";

// P13.2 — cette instance n'est importée que par des routes API
// (côté serveur) ; `dangerouslyAllowBrowser` n'a donc aucune raison
// d'être activé ici et ne devrait jamais l'être pour une clé
// serveur (retiré : relevé pendant l'audit P13, corrigé ici).
export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "sk-placeholder-key-for-build",
});
