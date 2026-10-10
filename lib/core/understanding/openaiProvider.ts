import type { AiProvider } from "./ai";

/**
 * Fournisseur OpenAI — SERVEUR UNIQUEMENT (route API). Réutilise le client existant
 * (lib/ai/openai/client) et l'API Responses avec sortie JSON stricte, comme les moteurs A1/A2.
 * Le client est importé à la demande : sans clé, aucun appel n'est tenté.
 */
export function openAiProvider(model: string): AiProvider {
  return async ({ system, user, schemaName, schema }) => {
    const { openai } = await import("@/lib/ai/openai/client");
    const response = await openai.responses.create(
      {
        model,
        input: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        text: { format: { type: "json_schema", name: schemaName, strict: true, schema } },
      },
      { timeout: 90_000, maxRetries: 1 },
    );
    return response.output_text;
  };
}
