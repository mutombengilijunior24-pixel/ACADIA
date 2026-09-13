import { createTrackedResponse } from "./trackedResponses";
import { selectModel } from "@/lib/server/ai/ModelRouter";
import type { AITrackingInput } from "./SubjectUnderstandingAI";

/* =========================================================
   CONTEXTE RÉEL DU PHÉNOMÈNE (Bloc B, aperçu, 11/09/2026)

   Distinct du récit principal de l'aperçu (PreviewNarrativeAI.ts) —
   jamais un remplacement. Appelé en second, une fois l'aperçu déjà
   affiché (affichage différé, décision produit), pour ne pas
   allonger la latence déjà mesurée à ~26-27s du récit principal.

   Utilise l'outil `web_search` hébergé de l'API OpenAI Responses
   (vérifié empiriquement le 11/09/2026 : compatible avec une sortie
   `json_schema` stricte dans le même appel, ~49s de latence réelle,
   sources réelles et vérifiables retournées — ex. ARPTC, Banque
   Centrale du Congo). Aucune statistique n'est formulée sans une
   source réelle trouvée par la recherche — si rien de solide n'est
   trouvé, la fonction retourne `null` plutôt qu'un remplissage
   approximatif.
========================================================= */

export interface PhenomenonContextItem {
  text: string;
  sourceUrl: string;
  sourceTitle: string;
}

export interface PhenomenonContextInput {
  phenomenon: string;
  domain?: string;
  location?: string;
}

export async function searchPhenomenonContext(
  input: PhenomenonContextInput,
  tracking: AITrackingInput & { anonymousSessionId?: string | null } = {}
): Promise<PhenomenonContextItem[] | null> {
  const { model } = selectModel("OTHER");
  const response = await createTrackedResponse({
    model,
    tools: [{ type: "web_search" }],
    input: [
      {
        role: "system",
        content: `Tu cherches, via une vraie recherche web, des éléments de contexte réels et récents sur un phénomène étudié dans un travail de recherche académique.

RÈGLE ABSOLUE : chaque élément retourné doit provenir d'une source réellement trouvée par la recherche — jamais un chiffre, une tendance ou un fait inventé ou reconstitué de mémoire sans recherche. Si la recherche ne trouve rien de solide et vérifiable sur ce phénomène précis, retourne une liste vide plutôt que d'inventer un contenu générique ou plausible.

Retourne 1 à 3 éléments maximum, chacun avec : le fait/la tendance/la statistique trouvée (une ou deux phrases, avec l'unité et la période si disponibles), l'URL réelle de la source, et le titre de cette source. Privilégie des sources institutionnelles ou académiques (banques centrales, régulateurs, organismes statistiques, études publiées) quand elles existent. N'invente jamais une URL — si tu ne peux pas fournir une URL réelle trouvée par la recherche, n'inclus pas cet élément.`,
      },
      {
        role: "user",
        content: `Phénomène étudié : ${input.phenomenon}${input.domain ? `\nDomaine : ${input.domain}` : ""}${input.location ? `\nTerrain : ${input.location}` : ""}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "phenomenon_context",
        strict: true,
        schema: {
          type: "object",
          properties: {
            items: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  text: { type: "string" },
                  sourceUrl: { type: "string" },
                  sourceTitle: { type: "string" },
                },
                required: ["text", "sourceUrl", "sourceTitle"],
                additionalProperties: false,
              },
            },
          },
          required: ["items"],
          additionalProperties: false,
        },
      },
    },
  }, {
    operation: "OTHER",
    userId: tracking.userId,
    projectId: tracking.projectId,
    anonymousSessionId: tracking.anonymousSessionId,
    correlationId: tracking.correlationId,
  });

  const content = response.output_text;
  if (!content) return null;

  try {
    const parsed = JSON.parse(content) as { items: PhenomenonContextItem[] };
    if (!Array.isArray(parsed.items) || parsed.items.length === 0) return null;
    return parsed.items.filter((item) => item.sourceUrl && item.text);
  } catch {
    return null;
  }
}
