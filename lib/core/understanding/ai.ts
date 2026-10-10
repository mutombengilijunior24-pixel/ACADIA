import { z } from "zod";

import type { ResearchUnderstandingInput, UnderstandingReport } from "./types";

/**
 * Enrichissement facultatif par IA.
 * - Le fournisseur est injecté (OpenAI en production, fournisseur simulé dans les tests uniquement).
 * - La réponse doit respecter un schéma JSON strict, puis est revalidée ici (zod) : une réponse
 *   non conforme est rejetée et signalée, jamais « réparée » ni remplacée par un contenu simulé.
 * - Tout ce qui vient de l'IA reste une suggestion (origine « ai ») tant que l'utilisateur ne l'a pas validé.
 */

/** Même modèle que les moteurs A1/A2 existants (lib/ai/openai). */
export const UNDERSTANDING_AI_MODEL = "gpt-5.6";

const DATA_KINDS = ["quantitative", "ordinal", "nominal", "binary", "qualitative"] as const;
const ELEMENTS = ["title", "context", "problem", "mainQuestion", "specificQuestions", "generalObjective", "specificObjectives", "hypotheses", "field", "period", "population", "concepts", "notes", "study"] as const;

const indicatorSchema = z.object({
  label: z.string().min(1).max(300),
  dataType: z.enum(DATA_KINDS),
  measure: z.string().max(300),
  example: z.string().max(300),
});

export const aiEnrichmentSchema = z.object({
  concepts: z
    .array(
      z.object({
        name: z.string().min(1).max(200),
        engineConcept: z.string().max(200),
        contextualDefinition: z.string().max(1200),
        dimensions: z.array(z.object({ name: z.string().min(1).max(200), indicators: z.array(indicatorSchema).max(6) })).max(6),
        ambiguities: z.array(z.string().max(500)).max(5),
        evidence: z.string().max(500),
      }),
    )
    .max(12),
  clarificationQuestions: z
    .array(z.object({ question: z.string().min(1).max(500), why: z.string().max(500), priority: z.enum(["essential", "important", "useful"]) }))
    .max(8),
  observations: z
    .array(
      z.object({
        element: z.enum(ELEMENTS),
        kind: z.enum(["contradiction", "missing", "improvement"]),
        observation: z.string().min(1).max(600),
        whyItMatters: z.string().max(600),
      }),
    )
    .max(8),
});

export type AiEnrichment = z.infer<typeof aiEnrichmentSchema>;

const str = { type: "string" } as const;
const strictObject = (properties: Record<string, unknown>) => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });

/** Schéma JSON strict transmis au fournisseur (miroir du schéma zod). */
export const AI_JSON_SCHEMA = strictObject({
  concepts: {
    type: "array",
    items: strictObject({
      name: str,
      engineConcept: str,
      contextualDefinition: str,
      dimensions: {
        type: "array",
        items: strictObject({
          name: str,
          indicators: { type: "array", items: strictObject({ label: str, dataType: { type: "string", enum: [...DATA_KINDS] }, measure: str, example: str }) },
        }),
      },
      ambiguities: { type: "array", items: str },
      evidence: str,
    }),
  },
  clarificationQuestions: { type: "array", items: strictObject({ question: str, why: str, priority: { type: "string", enum: ["essential", "important", "useful"] } }) },
  observations: {
    type: "array",
    items: strictObject({ element: { type: "string", enum: [...ELEMENTS] }, kind: { type: "string", enum: ["contradiction", "missing", "improvement"] }, observation: str, whyItMatters: str }),
  },
});

export interface AiRequest {
  system: string;
  user: string;
  schemaName: string;
  schema: Record<string, unknown>;
}

/** Retourne le texte JSON produit par le modèle. */
export type AiProvider = (request: AiRequest) => Promise<string>;

export type AiEnrichmentResult =
  | { status: "ok"; data: AiEnrichment; model: string }
  | { status: "error"; message: string }
  | { status: "disabled"; message: string };

const SYSTEM = `Tu assistes le moteur de compréhension de la recherche d'ACADIA (plateforme d'accompagnement de chercheurs et d'étudiants).
Tu reçois les éléments d'une recherche fournis par l'utilisateur et l'analyse déterministe déjà produite par le moteur.
Ton rôle : COMPLÉTER cette analyse, en français, sur ce que les règles déterministes ne savent pas faire (comprendre le sens des textes libres).

Règles impératives :
- N'utilise que les informations fournies. N'invente ni donnée, ni résultat, ni source, ni chiffre.
- Ne déclare jamais une hypothèse confirmée ou infirmée : aucune donnée empirique n'a été analysée.
- Ne présente jamais une relation comme causale démontrée ; distingue association supposée et causalité.
- Pour chaque concept, propose une définition adaptée AU CONTEXTE de cette étude et des dimensions/indicateurs adaptés à la population et au terrain ; n'enferme pas un concept dans un seul indicateur réducteur.
- "engineConcept" : recopie exactement le nom du concept du moteur auquel ta proposition se rapporte, ou "" s'il s'agit d'un concept que le moteur n'a pas repéré.
- "evidence" : cite le passage du texte de l'utilisateur qui justifie le concept, ou "" s'il n'y en a pas.
- Ne répète pas les observations que le moteur a déjà faites ; signale seulement ce qu'il a manqué.
- Si une information manque pour conclure, pose une question de clarification plutôt que de supposer.
- Si tu n'as rien de pertinent à ajouter dans une rubrique, renvoie une liste vide.`;

export function buildAiRequest(input: ResearchUnderstandingInput, report: UnderstandingReport): AiRequest {
  const engine = {
    natureDeLEtude: report.nature.nature,
    concepts: report.variables.map((v) => ({ nom: v.name, role: v.role, groupe: v.group })),
    relations: report.relations.map((r) => ({
      de: report.variables.find((v) => v.key === r.from)?.name ?? r.from,
      vers: report.variables.find((v) => v.key === r.to)?.name ?? r.to,
      nature: r.nature,
      orientee: r.directed,
    })),
    observationsDejaFaites: report.diagnostics.map((d) => d.title),
  };
  return {
    system: SYSTEM,
    user: `ÉLÉMENTS FOURNIS PAR L'UTILISATEUR :\n${JSON.stringify(input, null, 2)}\n\nANALYSE DÉTERMINISTE DU MOTEUR :\n${JSON.stringify(engine, null, 2)}`,
    schemaName: "acadia_research_understanding",
    schema: AI_JSON_SCHEMA,
  };
}

/** Retire d'un message d'erreur tout ce qui ressemble à une clé d'API. */
export function sanitizeError(message: string): string {
  return message
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[clé masquée]")
    .replace(/Bearer\s+\S+/gi, "Bearer [masqué]")
    .slice(0, 240);
}

export async function requestAiEnrichment(
  input: ResearchUnderstandingInput,
  report: UnderstandingReport,
  provider: AiProvider,
  model: string = UNDERSTANDING_AI_MODEL,
): Promise<AiEnrichmentResult> {
  let raw: string;
  try {
    raw = await provider(buildAiRequest(input, report));
  } catch (error) {
    return { status: "error", message: `Le service d'IA n'a pas répondu : ${sanitizeError(error instanceof Error ? error.message : String(error))}` };
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { status: "error", message: "Réponse de l'IA illisible (JSON invalide) : elle a été ignorée." };
  }
  const parsed = aiEnrichmentSchema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { status: "error", message: `Réponse de l'IA non conforme au format attendu (${issue?.path.join(".") || "racine"} : ${issue?.message ?? "invalide"}) : elle a été ignorée.` };
  }
  return { status: "ok", data: parsed.data, model };
}
