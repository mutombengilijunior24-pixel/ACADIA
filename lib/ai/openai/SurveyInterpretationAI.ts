import { openai } from "./client";
import { AI_MODEL } from "./config";

// ============================================================
// ACADIA — PASSERELLE « INTERPRÉTER AVEC ACADIA » (P20-B)
//
// Réutilise le même client/modèle OpenAI que la génération guidée et
// l'import DOCX (lib/ai/openai/client.ts + config.ts) — jamais un
// second système OpenAI. Ne reçoit QUE des statistiques déjà calculées
// côté serveur (SurveyAnalyticsEngine) — jamais toutes les réponses
// individuelles lorsque l'agrégation suffit. Le moteur n'invente
// jamais une donnée : il interprète strictement ce qui lui est fourni.
// ============================================================

export interface InterpretationContext {
  survey: {
    title: string;
    description?: string;
    objective?: string;
    targetAudience?: string;
  };
  analysis: {
    mode: "crosstab" | "overview";
    variable?: string;
    indicator?: string;
    section?: string;
    compareByLabel?: string;
    filtersDescription: string;
    sampleSize: number;
    isMultiSelect?: boolean;
    smallSampleColumns?: string[];
    crosstab?: {
      questionText: string;
      rowLabels: string[];
      colLabels: string[];
      percents: number[][];
      colTotals: Record<string, number>;
    };
    frequencies?: {
      questionText: string;
      variable?: string;
      indicator?: string;
      section?: string;
      type: string;
      distribution: { label: string; count: number; percent: number }[];
      average?: number;
      median?: number;
    }[];
    openQuestions?: { questionText: string; totalAnswers: number; sampleAnswers: string[] }[];
  };
}

export interface InterpretationResult {
  summary: string;
  findings: string[];
  trends: string[];
  comparisons: string[];
  attentionPoints: string[];
  interpretation: string[];
  recommendations: string[];
  limitations: string[];
}

const RESULT_SCHEMA = {
  type: "object" as const,
  properties: {
    summary: { type: "string" as const },
    findings: { type: "array" as const, items: { type: "string" as const } },
    trends: { type: "array" as const, items: { type: "string" as const } },
    comparisons: { type: "array" as const, items: { type: "string" as const } },
    attentionPoints: { type: "array" as const, items: { type: "string" as const } },
    interpretation: { type: "array" as const, items: { type: "string" as const } },
    recommendations: { type: "array" as const, items: { type: "string" as const } },
    limitations: { type: "array" as const, items: { type: "string" as const } },
  },
  required: ["summary", "findings", "trends", "comparisons", "attentionPoints", "interpretation", "recommendations", "limitations"],
  additionalProperties: false as const,
};

export async function interpretSurveyResults(context: InterpretationContext): Promise<InterpretationResult> {
  const response = await openai.responses.create({
    model: AI_MODEL,
    input: [
      {
        role: "system",
        content: `Tu es le moteur d'interprétation méthodologique d'ACADIA Survey. Un chercheur ou une institution te transmet des statistiques déjà calculées à partir de réponses réelles à une enquête. Ta mission est d'aider à COMPRENDRE ces résultats — jamais de décider à la place du chercheur, jamais d'inventer.

RÈGLES ABSOLUES — INTERDICTION FORMELLE :
- Ne jamais inventer une statistique, un chiffre, une catégorie ou une tendance qui n'apparaît pas explicitement dans les données fournies.
- Chaque nombre que tu cites doit être directement vérifiable dans le contexte statistique transmis.
- Ne jamais affirmer une causalité non démontrée par les données (corrélation ≠ causalité).
- Ne jamais prétendre qu'une différence entre groupes est "statistiquement significative" — aucun test statistique n'a été effectué ici. Décris les différences de façon purement descriptive.
- Distingue toujours DONNÉE (le chiffre brut), CONSTAT (une observation directe et prudente) et INTERPRÉTATION (une lecture raisonnable mais non certaine).
- Si un groupe comparé a un échantillon très restreint (indiqué explicitement dans le contexte), signale-le clairement et évite toute conclusion forte sur ce groupe.
- Pour les questions ouvertes : cite uniquement des comptes exacts ("5 réponses mentionnent..."), ne dis jamais "la majorité" ou "beaucoup" sauf si ce terme est mathématiquement exact au regard du nombre total de réponses à cette question précise. N'invente aucun thème absent des verbatims fournis.

EXEMPLE DE STYLE ATTENDU (à partir d'une donnée « 62 % des répondants se déclarent satisfaits ») :
- Constat : "La majorité des répondants déclarent être satisfaits."
- Interprétation prudente : "Ce résultat suggère une perception globalement favorable du service."
- À ÉVITER ABSOLUMENT : "Le service est performant." (affirmation non fondée sur les données)

EXEMPLE DE COMPARAISON ACCEPTABLE : "Le niveau de satisfaction observé est plus élevé chez les répondants de l'UNILU que chez ceux de l'UNH."
EXEMPLE DE COMPARAISON INTERDITE : "L'UNILU offre un meilleur service." (implique une causalité non démontrée)

STRUCTURE ATTENDUE DE LA RÉPONSE :
- summary : résumé synthétique des résultats les plus importants (2-4 phrases).
- findings : liste des principaux constats factuels (données/observations directes).
- trends : tendances descriptives présentes dans les données (peut être vide si non pertinent).
- comparisons : différences observées entre les groupes comparés, toujours descriptives, jamais causales (peut être vide si aucune comparaison n'est demandée).
- attentionPoints : résultats nécessitant une attention particulière (ex. insatisfaction notable, échantillon faible).
- interpretation : lecture raisonnable des résultats au regard de l'objectif de l'enquête — toujours prudente, jamais affirmative sans nuance.
- recommendations : pistes d'action directement liées aux résultats observés, jamais des recommandations génériques sans lien avec les données.
- limitations : ce que les données ne permettent PAS d'affirmer (taille d'échantillon, absence de test statistique, causalité non établie, etc.).

Réponds exclusivement en français, dans un registre professionnel et institutionnel. La réponse doit être exclusivement un JSON valide respectant le schéma fourni.`,
      },
      {
        role: "user",
        content: `Contexte de l'enquête et des statistiques calculées (toutes les valeurs numériques ci-dessous sont réelles, calculées à partir des réponses effectivement collectées — n'en invente aucune autre) :

${JSON.stringify(context, null, 2)}`,
      },
    ],
    text: {
      format: {
        type: "json_schema",
        name: "survey_interpretation",
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
    const parsed = JSON.parse(content) as InterpretationResult;
    if (!parsed.summary || !Array.isArray(parsed.findings)) {
      throw new Error("La réponse ne respecte pas le contrat attendu.");
    }
    return parsed;
  } catch {
    throw new Error("La réponse d'OpenAI n'est pas un JSON valide ou ne respecte pas le contrat Survey.");
  }
}
