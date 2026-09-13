import { createTrackedResponse } from "./trackedResponses";
import { selectModel } from "@/lib/server/ai/ModelRouter";
import type { AITrackingInput } from "./SubjectUnderstandingAI";

import type { ConfidenceLevel } from "@/lib/core/research/ResearchTypes";

/* =========================================================
   ORIENTATION THÉORIQUE (analyse en profondeur, 10/09/2026)

   Distinct de A1/A2 — jamais un remplacement ni une modification de
   ces moteurs. Sert l'écran "Analyser en profondeur" (voir
   app/api/research/[id]/deep-analysis/route.ts) : propose des
   théories mobilisables pour le sujet, à partir de ce qu'A1/A2 ont
   déjà établi. Toujours une proposition à confronter à la vraie
   littérature — jamais une affirmation qu'une théorie s'applique.
========================================================= */

export interface AITheoreticalOrientation {
  theory: string;
  reason: string;
  confidence: ConfidenceLevel;
}

export interface TheoreticalOrientationInput {
  researchFocus: string;
  mainConcepts: string[];
  relationDescription?: string;
  domain?: string;
}

const SYSTEM_PROMPT = `Tu proposes des théories mobilisables pour une recherche universitaire en RDC (Sciences Économiques et de Gestion principalement, adapte-toi si le domaine diffère).

Produis 2 à 3 théories réellement pertinentes pour le sujet décrit — jamais une liste générique copiée d'un cours. Pour chaque théorie : son nom exact, et en une phrase (≤25 mots) pourquoi elle éclaire CE sujet précis, pas la discipline en général.

RÈGLES ABSOLUES : ne cite jamais un auteur, une date ou une référence bibliographique précise que tu ne peux pas garantir exacte — reste au niveau du nom de la théorie et de son mécanisme. N'affirme jamais qu'une théorie "s'applique" ou "est validée" ici — utilise "peut éclairer", "offre un cadre pertinent pour", jamais un ton affirmatif définitif. Si aucune théorie ne ressort clairement, retourne une liste plus courte plutôt que d'en inventer une non pertinente. confidence: high si la théorie est un choix classique et évident pour ce type de sujet, medium/low si le lien est plus indirect.`;

export async function proposeTheoreticalOrientations(
  input: TheoreticalOrientationInput,
  tracking: AITrackingInput = {}
): Promise<AITheoreticalOrientation[]> {
  const { model } = selectModel("OTHER");
  const response = await createTrackedResponse({
    model,
    reasoning: { effort: "none" },
    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Sujet compris : ${input.researchFocus}\nConcepts : ${input.mainConcepts.join(", ")}${
          input.relationDescription ? `\nRelation étudiée : ${input.relationDescription}` : ""
        }${input.domain ? `\nDomaine : ${input.domain}` : ""}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "theoretical_orientations",
        strict: true,
        schema: {
          type: "object",
          properties: {
            orientations: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  theory: { type: "string" },
                  reason: { type: "string" },
                  confidence: { type: "string", enum: ["high", "medium", "low"] },
                },
                required: ["theory", "reason", "confidence"],
                additionalProperties: false,
              },
            },
          },
          required: ["orientations"],
          additionalProperties: false,
        },
      },
    },
  }, {
    operation: "OTHER",
    userId: tracking.userId,
    projectId: tracking.projectId,
    correlationId: tracking.correlationId,
  });

  const content = response.output_text;
  if (!content) {
    throw new Error("OpenAI n'a retourné aucun résultat.");
  }

  try {
    const parsed = JSON.parse(content) as { orientations: AITheoreticalOrientation[] };
    if (!Array.isArray(parsed.orientations)) {
      throw new Error("Contrat non respecté.");
    }
    return parsed.orientations;
  } catch {
    throw new Error("La réponse d'OpenAI n'est pas un JSON valide pour les orientations théoriques.");
  }
}
