import { openai } from "./client";
import { AI_MODEL } from "./config";

// ============================================================
// ACADIA — FORMULATION DE L'INTERPRÉTATION SCIENTIFIQUE (Mission 6, incrément 2)
//
// Réutilise le même client/modèle OpenAI que SurveyInterpretationAI.ts
// (lib/ai/openai/client.ts + config.ts) — jamais un second système
// OpenAI. Ne reçoit QUE des agrégats déjà calculés côté serveur
// (StatisticalResult produits par StatisticalExecutionEngine, et
// décisions déjà tranchées par HypothesisAssessmentEngine) — jamais
// le dataset brut, jamais une ligne individuelle, jamais une donnée
// personnelle de répondant.
//
// La décision de chaque hypothèse (SUPPORTED/NOT_SUPPORTED/...) est
// déjà tranchée avant cet appel — l'IA ne la recalcule ni ne la
// contredit, elle la formule en prose. Toute référence à un résultat
// ou une hypothèse renvoyée par l'IA est revérifiée et filtrée côté
// serveur après réception (voir app/api/research/[id]/interpretation/
// [interpretationId]/formulate/route.ts) : un contrôle de traçabilité
// basique, pas encore le NumericConsistencyGuard/ContradictionGuard
// complets prévus à l'incrément 3.
// ============================================================

export interface ScientificInterpretationHypothesisContext {
  hypothesisId: string;
  statement: string;
  decision: string;
  confidence: string;
  rationale: string[];
}

export interface ScientificInterpretationResultContext {
  id: string;
  analysisType: string;
  label: string;
  n: number;
  warnings: string[];
  descriptive?: {
    frequencyTable?: { label: string; count: number; percentage: number; validPercentage: number }[];
    numericalStatistics?: {
      min: number | null;
      max: number | null;
      mean: number | null;
      median: number | null;
      standardDeviation: number | null;
    };
  };
  bivariate?: {
    method: string;
    chiSquare?: { pValue: number | null; cramersV: number | null; assumptionsMet: boolean };
    pearson?: { coefficient: number | null; pValue: number | null };
    spearman?: { coefficient: number | null; pValue: number | null };
  };
}

export interface ScientificInterpretationContext {
  project: { title: string; researchType: string; domain?: string };
  sampleSize: number;
  alpha: number;
  hypotheses: ScientificInterpretationHypothesisContext[];
  results: ScientificInterpretationResultContext[];
}

export interface ScientificInterpretationAIFinding {
  category: "descriptive" | "hypothesis" | "sample_quality" | "methodological_limitation";
  statement: string;
  relatedResultIds: string[];
  /** Chaîne vide si le constat ne se rattache à aucune hypothèse précise. */
  relatedHypothesisId: string;
}

export interface ScientificInterpretationAIResult {
  summary: string;
  findings: ScientificInterpretationAIFinding[];
  recommendations: string[];
  limitations: string[];
}

const RESULT_SCHEMA = {
  type: "object" as const,
  properties: {
    summary: { type: "string" as const },
    findings: {
      type: "array" as const,
      items: {
        type: "object" as const,
        properties: {
          category: {
            type: "string" as const,
            enum: ["descriptive", "hypothesis", "sample_quality", "methodological_limitation"],
          },
          statement: { type: "string" as const },
          relatedResultIds: { type: "array" as const, items: { type: "string" as const } },
          relatedHypothesisId: { type: "string" as const },
        },
        required: ["category", "statement", "relatedResultIds", "relatedHypothesisId"],
        additionalProperties: false as const,
      },
    },
    recommendations: { type: "array" as const, items: { type: "string" as const } },
    limitations: { type: "array" as const, items: { type: "string" as const } },
  },
  required: ["summary", "findings", "recommendations", "limitations"],
  additionalProperties: false as const,
};

export async function interpretScientificResults(
  context: ScientificInterpretationContext
): Promise<ScientificInterpretationAIResult> {
  const response = await openai.responses.create({
    model: AI_MODEL,
    input: [
      {
        role: "system",
        content: `Tu es le moteur de formulation scientifique d'ACADIA (pipeline recherche quantitative). Un chercheur te transmet des résultats statistiques déjà calculés et des décisions d'hypothèse déjà tranchées par un moteur déterministe. Ta mission est de FORMULER ces résultats en langage clair et rigoureux — jamais de recalculer une statistique, jamais de modifier une décision d'hypothèse déjà tranchée, jamais d'inventer un chiffre absent du contexte transmis.

RÈGLES ABSOLUES — INTERDICTION FORMELLE :
- Ne jamais inventer une statistique, un chiffre, un pourcentage ou une catégorie qui n'apparaît pas explicitement dans le contexte fourni.
- Chaque nombre que tu cites doit être directement vérifiable dans les résultats transmis (champ "results").
- La décision de chaque hypothèse ("decision" : SUPPORTED, NOT_SUPPORTED, PARTIALLY_SUPPORTED ou INCONCLUSIVE) est déjà tranchée — reformule-la fidèlement, ne la remets JAMAIS en question et n'en choisis JAMAIS une autre.
- Ne jamais affirmer une causalité ("cause", "entraîne", "provoque", "explique", "est à l'origine de") — une association statistique n'est jamais une preuve de causalité. Utilise un vocabulaire descriptif ("est associé à", "varie avec", "diffère selon").
- Si un résultat a un effectif faible ou des avertissements méthodologiques (champ "warnings"), signale-le explicitement et évite toute conclusion forte à son sujet.
- Chaque constat ("findings") doit citer, dans "relatedResultIds", les identifiants des résultats sur lesquels il s'appuie réellement — ne jamais laisser ce champ vide pour un constat chiffré. Utilise "relatedHypothesisId" uniquement quand le constat concerne directement une hypothèse listée, sinon laisse une chaîne vide "".
- Distingue toujours DONNÉE (le chiffre brut), CONSTAT (observation directe et prudente) et INTERPRÉTATION (lecture raisonnable mais non certaine) dans ta formulation.

STRUCTURE ATTENDUE :
- summary : résumé synthétique des résultats les plus importants (2-4 phrases).
- findings : constats factuels structurés, chacun catégorisé ("descriptive" pour une variable seule, "hypothesis" pour un résultat lié à une hypothèse, "sample_quality" pour un problème d'échantillon, "methodological_limitation" pour une limite de méthode).
- recommendations : pistes d'action directement liées aux résultats observés, jamais génériques.
- limitations : ce que ces résultats ne permettent PAS d'affirmer (taille d'échantillon, absence de causalité établie, hypothèses statistiques non respectées, etc.).

Réponds exclusivement en français, dans un registre professionnel et académique. La réponse doit être exclusivement un JSON valide respectant le schéma fourni.`,
      },
      {
        role: "user",
        content: `Contexte de la recherche et résultats statistiques déjà calculés (toutes les valeurs numériques ci-dessous sont réelles — n'en invente aucune autre) :

${JSON.stringify(context, null, 2)}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "scientific_interpretation",
        strict: true,
        schema: RESULT_SCHEMA,
      },
    },
  });

  const content = response.output_text;
  if (!content) {
    throw new Error("OpenAI n'a retourné aucun résultat.");
  }
  try {
    const parsed = JSON.parse(content) as ScientificInterpretationAIResult;
    if (!parsed.summary || !Array.isArray(parsed.findings)) {
      throw new Error("La réponse ne respecte pas le contrat attendu.");
    }
    return parsed;
  } catch {
    throw new Error("La réponse d'OpenAI n'est pas un JSON valide ou ne respecte pas le contrat scientifique.");
  }
}
