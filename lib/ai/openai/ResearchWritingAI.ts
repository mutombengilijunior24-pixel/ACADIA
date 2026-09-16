import { createTrackedResponse } from "./trackedResponses";
import { selectModel } from "@/lib/server/ai/ModelRouter";
import type { AITrackingInput } from "./SubjectUnderstandingAI";
import type { WritingBlockType } from "@/lib/core/writing/WritingTypes";

// ============================================================
// ACADIA — RESEARCH WRITING AI (Mission 9)
//
// Génère la prose des 4 sections qui n'ont AUCUN moteur existant à
// réutiliser (introduction, problématique, méthodologie, cadre
// théorique — voir WritingTypes.ts, AI_GENERATED_SECTION_TYPES).
// Discussion/conclusion/recommandations ne passent JAMAIS par ce
// fichier : ce sont des adaptateurs déterministes sur du contenu déjà
// validé (Mission 6/7, voir WritingAdapters.ts).
//
// Règles absolues, identiques en esprit à ScientificConclusionAI.ts
// et au principe fondateur du module (AGENTS.md : "l'IA propose, le
// chercheur valide ; ne jamais inventer un fait manquant") :
// - Ne jamais introduire un chiffre, une statistique, un auteur, une
//   année, un titre d'ouvrage ou une référence bibliographique absents
//   du contexte transmis.
// - `claimIds` ne peut contenir QUE des identifiants réellement fournis
//   dans `citableClaims` du contexte — jamais un id inventé.
// - Si une information structurante manque (aucune question de
//   recherche, aucune orientation théorique, aucun claim citable...),
//   le produire comme un bloc NOTE explicite ("à compléter par le
//   chercheur"), jamais comblé par une généralité de manuel non reliée
//   au sujet réel.
// ============================================================

export type WritingSectionKind = "INTRODUCTION" | "PROBLEMATIC" | "METHODOLOGY" | "LITERATURE_REVIEW";

export interface AIWritingBlock {
  type: WritingBlockType;
  text: string;
  items: string[];
  level: 0 | 2 | 3;
  claimIds: string[];
}

export interface ResearchWritingAIResult {
  blocks: AIWritingBlock[];
  warnings: string[];
  model: string;
}

const BLOCK_SCHEMA = {
  type: "object" as const,
  properties: {
    type: { type: "string" as const, enum: ["PARAGRAPH", "HEADING", "LIST", "QUOTE", "NOTE"] },
    text: { type: "string" as const },
    items: { type: "array" as const, items: { type: "string" as const } },
    level: { type: "integer" as const, enum: [0, 2, 3] },
    claimIds: { type: "array" as const, items: { type: "string" as const } },
  },
  required: ["type", "text", "items", "level", "claimIds"],
  additionalProperties: false as const,
};

const RESULT_SCHEMA = {
  type: "object" as const,
  properties: {
    blocks: { type: "array" as const, items: BLOCK_SCHEMA },
    warnings: { type: "array" as const, items: { type: "string" as const } },
  },
  required: ["blocks", "warnings"],
  additionalProperties: false as const,
};

const COMMON_RULES = `RÈGLES ABSOLUES — INTERDICTION FORMELLE :
- N'invente jamais un chiffre, une statistique, un pourcentage, une date, un nom d'auteur, un titre d'ouvrage ou une référence bibliographique absents du contexte fourni.
- N'affirme jamais un fait scientifique externe non présent dans le contexte — si une comparaison ou un ancrage théorique serait utile mais que le contexte ne le fournit pas, dis-le explicitement dans un bloc de type NOTE ("à compléter par le chercheur"), ne le remplace jamais par une généralité de manuel non reliée à ce sujet précis.
- "claimIds" ne peut contenir QUE des identifiants listés tels quels dans "citableClaims" du contexte transmis — jamais un identifiant inventé, jamais un identifiant absent de cette liste.
- Ne cite jamais un auteur, une théorie ou une date qui ne figure pas explicitement dans le contexte.
- N'utilise aucun vocabulaire de certitude absolue ("prouve", "démontre de manière définitive") — reste au registre académique prudent.
- Structure la réponse en blocs cohérents (2 à 6 blocs selon la richesse du contexte) : privilégie PARAGRAPH pour la prose, LIST uniquement pour une énumération réellement structurée, HEADING seulement pour une sous-partie interne à la section, QUOTE uniquement pour reprendre littéralement un texte déjà fourni (jamais une citation d'auteur externe inventée), NOTE pour signaler un manque réel.
- Pour un bloc qui n'est pas HEADING, "level" doit valoir 0. Pour un bloc qui n'est pas LIST, "items" doit être un tableau vide.
- Réponds exclusivement en français, dans un registre académique. La réponse doit être exclusivement un JSON valide respectant le schéma fourni.`;

function systemPromptFor(kind: WritingSectionKind): string {
  switch (kind) {
    case "INTRODUCTION":
      return `Tu es le moteur de rédaction de l'introduction d'un mémoire/travail de recherche sur ACADIA. Tu reçois le sujet, le phénomène observé, la problématique déjà validée par le chercheur, les questions de recherche et les objectifs déjà formulés. Ta mission : rédiger une introduction académique qui présente le sujet, justifie son intérêt, annonce la problématique et la structure du travail — sans jamais décider ou reformuler le fond de la problématique, des questions ou des objectifs (reprends-les fidèlement).\n\n${COMMON_RULES}`;
    case "PROBLEMATIC":
      return `Tu es le moteur de rédaction de la section "Problématique" d'un travail de recherche sur ACADIA. Tu reçois le phénomène observé, l'énoncé de problématique déjà validé par le chercheur, les concepts principaux, la relation proposée entre variables et un contexte sourcé (extraits réellement attribués à une source, avec titre et URL). Ta mission : développer en prose académique l'écart/la difficulté qui justifie la recherche, en t'appuyant sur ces éléments réels — jamais en inventant un contexte statistique ou un chiffre absent.\n\n${COMMON_RULES}`;
    case "METHODOLOGY":
      return `Tu es le moteur de rédaction de la section "Méthodologie" d'un travail de recherche sur ACADIA. Tu reçois une recommandation méthodologique déjà calculée par un moteur déterministe (orientation, devis de recherche, population, échantillonnage, taille d'échantillon, techniques de collecte, limites, considérations éthiques) — chaque champ porte un statut ("proposed"/"confirmed"/"needs_review"). Ta mission : rédiger en prose académique la description de la méthodologie retenue, en reprenant fidèlement CHAQUE valeur fournie (jamais un chiffre différent), et en signalant par un bloc NOTE les champs marqués "needs_review" (encore à trancher par le chercheur) plutôt que de les présenter comme déjà décidés.\n\n${COMMON_RULES}`;
    case "LITERATURE_REVIEW":
      return `Tu es le moteur de rédaction de la section "Cadre théorique et revue de la littérature" d'un travail de recherche sur ACADIA. Tu reçois les orientations théoriques déjà proposées pour ce sujet (théorie + raison de la pertinence) et une liste de "claims" — des affirmations DÉJÀ SAISIES PAR LE CHERCHEUR et reliées à une référence bibliographique réelle qu'il a lui-même enregistrée. Ta mission : structurer ces éléments en revue de littérature académique, en citant les claims fournis via leur claimId exact. Si aucune orientation théorique ni aucun claim citable n'est fourni, ne rédige JAMAIS un cadre théorique générique de manuel — produis un unique bloc NOTE expliquant qu'aucune littérature n'est encore enregistrée pour ce projet et qu'elle doit être ajoutée par le chercheur (module Bibliography).\n\n${COMMON_RULES}`;
  }
}

export async function generateWritingSection(
  kind: WritingSectionKind,
  context: unknown,
  tracking: AITrackingInput = {}
): Promise<ResearchWritingAIResult> {
  const { model } = selectModel("WRITING");
  const response = await createTrackedResponse(
    {
      model,
      input: [
        { role: "system", content: systemPromptFor(kind) },
        { role: "user", content: `Contexte réel de ce projet (n'utilise aucune information en dehors de ce contexte) :\n\n${JSON.stringify(context, null, 2)}` },
      ],
      text: {
        format: {
          type: "json_schema",
          name: "writing_section",
          strict: true,
          schema: RESULT_SCHEMA,
        },
      },
    },
    {
      operation: "WRITING",
      userId: tracking.userId,
      projectId: tracking.projectId,
      correlationId: tracking.correlationId,
    },
    // Même discipline que GradingAI.ts/ReferenceAnalysisAI.ts : borne
    // explicite sous le maxDuration=60 de la route, pour échouer
    // proprement (erreur claire, filet de sécurité déjà en place côté
    // route) plutôt que de laisser la requête serverless expirer sans
    // message exploitable.
    { timeout: 55000 }
  );

  const content = response.output_text;
  if (!content) {
    throw new Error("OpenAI n'a retourné aucun résultat.");
  }
  try {
    const parsed = JSON.parse(content) as ResearchWritingAIResult;
    if (!Array.isArray(parsed.blocks) || parsed.blocks.length === 0) {
      throw new Error("La réponse ne respecte pas le contrat attendu.");
    }
    return { ...parsed, model };
  } catch {
    throw new Error("La réponse d'OpenAI n'est pas un JSON valide ou ne respecte pas le contrat de rédaction.");
  }
}
