import { createTrackedResponse } from "./trackedResponses";
import { selectModel } from "@/lib/server/ai/ModelRouter";
import type { ResearchRelationType, ConfidenceLevel } from "@/lib/core/research/ResearchTypes";

export interface PreviewNarrativeTracking {
  anonymousSessionId?: string | null;
  correlationId?: string | null;
}

/* =========================================================
   ORPHELIN DEPUIS LA MISSION "PREVIEW WOW" (Research Intelligence V3) —
   plus aucun appelant dans le dépôt. app/api/preview/route.ts appelle
   désormais directement A1 (understandResearchWithAI, depth="preview")
   pour ne plus avoir "un cerveau différent" entre la preview anonyme
   et le parcours authentifié — voir le rapport de cette mission.
   Conservé tel quel (non supprimé) pour laisser la revue humaine
   décider d'un nettoyage ultérieur, plutôt que de le retirer
   unilatéralement.

   PREVIEW SANS COMPTE — NARRATION IA (10/09/2026, révision 4)

   Distinct de A1 (SubjectUnderstandingAI.ts) — jamais un remplacement
   ni une modification de ce moteur, qui reste utilisé tel quel par
   ResearchIntelligenceEngine pour le parcours authentifié complet
   (A1 + A2). Ce module servait UN SEUL écran : le premier "waouh" avant
   inscription (voir components/landing/SubjectPreviewOverlay.tsx).

   Prompt distillé à partir de la spécification "ACADIA — identité
   académique" fournie par le produit : même logique de raisonnement
   (phénomène → problème → problématique → question → objectif),
   mêmes garde-fous anti-invention, même portée bornée pour la preview
   (§32-33 de la spec : une première lecture intelligente, jamais un
   mémoire). Le contrat JSON ci-dessous réutilise le vocabulaire déjà
   établi dans ce fichier (mainConcepts, proposedRelationship,
   population, location, pointsToConfirm, confidence) plutôt que le
   schéma conceptuel complet de la spec — celle-ci autorise
   explicitement cette adaptation ("le contrat JSON réel du repository
   prime... ne pas créer un second contrat concurrent").

   Un seul appel OpenAI (pas de second aller-retour après A1) : le
   coût reste celui d'une preview normale. La latence, elle, dépend
   directement de la richesse demandée ici — mesurée en conditions
   réelles à ~25-35s pour ce niveau de profondeur, contre ~9s pour un
   schéma minimal. Compromis assumé et communiqué, pas caché.
========================================================= */

export interface PreviewNarrative {
  headline: string;

  phenomenon: string;

  problem?: string;

  problematic: string;

  researchQuestion: string;

  generalObjective: string;

  specificObjectives: string[];

  mainConcepts: string[];

  proposedRelationship: {
    from: string;
    to: string;
    relation: ResearchRelationType | "unknown";
    description?: string;
  };

  population?: string;

  location?: string;

  methodologyOrientation: string;

  pointsToConfirm: string[];

  confidence: ConfidenceLevel;
}

const SYSTEM_PROMPT = `Tu es ACADIA, assistant de recherche universitaire pour des étudiants/chercheurs de RDC (priorité Lubumbashi, Haut-Katanga), en Sciences Économiques et de Gestion principalement (économie, gestion, finance, comptabilité, marketing, RH, entrepreneuriat, PME, administration publique, gouvernance, développement local — adapte-toi à la discipline réelle du sujet).

CE TEXTE S'AFFICHE SANS COMPTE, juste après que l'étudiant tape son sujet. Effet recherché : "il a compris ce que je veux faire" — jamais un rapport administratif, jamais un mémoire complet (pas de bibliographie, pas de méthodologie détaillée, pas d'hypothèses complexes ici).

LOGIQUE À SUIVRE : phénomène observé → problème (s'il ressort) → problématique (contexte + tension + enjeu) → question de recherche → objectif général → objectifs spécifiques. Chaque niveau doit découler du précédent.

DISTINGUE TOUJOURS : (1) ce que l'étudiant a écrit explicitement, (2) ce que tu déduis raisonnablement, (3) ce que tu proposes pour l'aider. Ne présente jamais (2) ou (3) comme (1).

TERRAIN : n'assume JAMAIS Lubumbashi ou la RDC comme terrain si le sujet ne le précise pas explicitement — utilise le contexte congolais comme grille de lecture, pas comme fait par défaut.

Produis :
- headline : 1 phrase percutante, concrète, directe (pas de "semble/pourrait" ici — c'est un constat de compréhension, pas une proposition).
- phenomenon : 1 phrase — ce qui se passe/semble se passer dans le domaine étudié.
- problem (optionnel, omets si non déterminable) : 1 phrase — l'écart/la difficulté qui justifie l'étude. Ne force jamais un problème artificiel.
- problematic : 1-2 phrases — contexte + tension scientifique, jamais une reformulation du titre.
- researchQuestion : 1 question réelle (terminée par "?"), découlant directement de problematic. N'utilise pas systématiquement "impact/effet/influence" — adapte au type réel de relation.
- generalObjective : 1 phrase, verbe scientifique (analyser/examiner/évaluer/comprendre/déterminer...), répond directement à researchQuestion.
- specificObjectives : 3 objectifs courts (4 maximum), chacun rattachable à un concept/une variable du sujet.
- mainConcepts : 3-4 termes courts, jamais la population ou le lieu.
- proposedRelationship : from/to/relation (+description ≤15 mots) si un lien ressort, sinon relation="unknown".
- population, location : 1-4 mots chacun, UNIQUEMENT si explicitement identifiables dans le texte.
- methodologyOrientation : 1 phrase proposant une orientation (quantitative/qualitative/mixte/étude de cas/...), formulée comme une proposition conditionnelle ("pourrait être pertinente si...") — c'est le seul endroit où ce type de formulation prudente est approprié, car c'est une proposition au-delà du texte, pas une hésitation sur ce qui est déjà écrit.
- pointsToConfirm : EXACTEMENT 4 questions concrètes (≤15 mots chacune) qu'un encadreur poserait en entretien — définition, périmètre, mesure, méthode. C'est ici que va toute incertitude, jamais dans phenomenon/problematic/headline sous forme d'hésitation.
- confidence : high/medium/low selon la clarté réelle du sujet.

RÈGLES ABSOLUES : n'invente jamais un chiffre, un lieu, une population, une statistique, une référence, une relation non déductible du texte ; ne présente jamais une proposition comme un fait acquis ; n'affirme jamais une causalité non démontrée ; ignore les fautes d'orthographe du sujet, comprends l'intention ; réponse JSON strictement conforme au schéma ; reste bref partout où une limite est indiquée.`;

export async function craftPreviewNarrative(
  subject: string,
  tracking: PreviewNarrativeTracking = {}
): Promise<PreviewNarrative> {
  const { model } = selectModel("PREVIEW_ANALYSIS");

  const response = await createTrackedResponse(
    {
    model,

    // Tâche d'extraction + construction contrainte par des règles
    // explicites (pas de raisonnement multi-étapes profond
    // nécessaire) — un effort réduit accélère la réponse sans
    // dégrader la qualité pour ce type de tâche. Uniquement ici
    // (preview) : ne touche jamais A1/A2, qui gardent leur réglage
    // par défaut.
    reasoning: { effort: "none" },

    input: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Voici le sujet de recherche tel que l'étudiant l'a écrit :\n\n"${subject}"\n\nProduis la réponse structurée qui créera l'effet "waouh" décrit dans tes instructions, en respectant strictement les règles anti-invention et la logique phénomène → problème → problématique → question → objectif.`,
      },
    ],

    text: {
      format: {
        type: "json_schema",
        name: "preview_narrative",
        strict: true,
        schema: {
          type: "object",
          properties: {
            headline: { type: "string" },
            phenomenon: { type: "string" },
            problem: { type: "string" },
            problematic: { type: "string" },
            researchQuestion: { type: "string" },
            generalObjective: { type: "string" },
            specificObjectives: { type: "array", items: { type: "string" } },
            mainConcepts: { type: "array", items: { type: "string" } },
            proposedRelationship: {
              type: "object",
              properties: {
                from: { type: "string" },
                to: { type: "string" },
                relation: {
                  type: "string",
                  enum: [
                    "influence",
                    "impact",
                    "effect",
                    "relationship",
                    "association",
                    "correlation",
                    "mediation",
                    "moderation",
                    "unknown",
                  ],
                },
                description: { type: "string" },
              },
              required: ["from", "to", "relation", "description"],
              additionalProperties: false,
            },
            population: { type: "string" },
            location: { type: "string" },
            methodologyOrientation: { type: "string" },
            pointsToConfirm: { type: "array", items: { type: "string" } },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
          },
          required: [
            "headline",
            "phenomenon",
            "problem",
            "problematic",
            "researchQuestion",
            "generalObjective",
            "specificObjectives",
            "mainConcepts",
            "proposedRelationship",
            "population",
            "location",
            "methodologyOrientation",
            "pointsToConfirm",
            "confidence",
          ],
          additionalProperties: false,
        },
      },
    },
    },
    {
      operation: "PREVIEW_ANALYSIS",
      anonymousSessionId: tracking.anonymousSessionId,
      correlationId: tracking.correlationId,
    }
  );

  const content = response.output_text;
  if (!content) {
    throw new Error("OpenAI n'a retourné aucun résultat.");
  }

  try {
    const parsed = JSON.parse(content) as PreviewNarrative;
    if (!parsed.headline || !parsed.problematic || !parsed.researchQuestion) {
      throw new Error("La réponse ne respecte pas le contrat de la preview.");
    }
    return parsed;
  } catch {
    throw new Error("La réponse d'OpenAI n'est pas un JSON valide ou ne respecte pas le contrat de la preview.");
  }
}
