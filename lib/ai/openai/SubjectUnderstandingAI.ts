import { createTrackedResponse } from "./trackedResponses";

import type {
  ResearchRelationType,
  ConfidenceLevel,
  ResearchModeTag,
  FieldConfidenceMap,
  PhenomenonTableRow,
} from "@/lib/core/research/ResearchTypes";

import { RESEARCH_MODE_TAGS } from "@/lib/core/research/ResearchModeTaxonomy";
import { selectModel } from "@/lib/server/ai/ModelRouter";

export interface AITrackingInput {
  userId?: string | null;
  projectId?: string | null;
  anonymousSessionId?: string | null;
  correlationId?: string | null;
  /**
   * Mission Preview WOW — un seul cerveau A1, deux profondeurs :
   * "preview" (anonyme, avant inscription — modèle économique,
   * raisonnement réduit, opération journalisée PREVIEW_ANALYSIS) ou
   * "deep" (parcours authentifié complet, comportement historique
   * inchangé). Par défaut "deep" — aucun appelant existant n'est
   * affecté tant qu'il ne passe pas explicitement "preview".
   */
  depth?: "preview" | "deep";
}

const FIELD_CONFIDENCE_VALUES = [
  "KNOWN",
  "INFERRED",
  "PROPOSED",
  "MISSING",
  "TO_VERIFY",
  "SOURCED",
] as const;

// Research Intelligence V3 — traçabilité du contrat A1 (voir
// ResearchUnderstanding.engineVersion). Constante de code, jamais
// produite par le modèle.
const ENGINE_VERSION = "A1.v3";

/* =========================================================
   A1 — COMPRÉHENSION IA DU SUJET

   Ce contrat représente uniquement la sortie du moteur A1.

   A1 ne construit pas :
   - les variables finales ;
   - les dimensions ;
   - les indicateurs ;
   - la méthodologie ;
   - le questionnaire.

   Il comprend d'abord la recherche.

   Research Intelligence V2 (13/09/2026) — extension ADDITIVE du même
   contrat A1 (jamais un second moteur, jamais un second contrat) :
   ajoute phenomenon/problem, une classification multi-label du mode
   de recherche (researchModeTags), une fiabilité par champ
   (fieldConfidence) et un tableau de structuration du phénomène
   (phenomenonTable). A2 (VariableIntelligenceAI.ts) reçoit déjà
   l'objet complet tel quel (JSON.stringify) — ces champs lui
   parviennent automatiquement.

   Research Intelligence V3 — ferme la chaîne SUJET → COMPRÉHENSION →
   PHÉNOMÈNE → PROBLÈME → QUESTION → OBJECTIFS en ajoutant
   researchQuestion/generalObjective/specificObjectives (toujours des
   PROPOSITIONS d'A1, jamais auto-promues dans project.researchQuestions
   / project.objectives — voir ResearchIntelligenceEngine.ts) ; enrichit
   phenomenonTable (phenomenonElement/requiredData/source/
   geographicScope/status/provenance) et fieldConfidence avec le
   statut SOURCED — réservé à un enrichissement documentaire réel
   (PhenomenonContextAI), jamais assigné par A1 lui-même qui n'a accès
   à aucune recherche web.
========================================================= */

export interface AIResearchUnderstanding {
  researchFocus: string;

  /**
   * Le phénomène observé — ce qui se passe dans le domaine étudié.
   * Distinct de "problem" (l'écart/la difficulté qui justifie
   * l'étude) et de researchFocus (le focus reformulé). Jamais une
   * reformulation du titre.
   */
  phenomenon: string;

  /**
   * L'écart/la difficulté qui justifie l'étude, quand il ressort
   * clairement des informations fournies. Chaîne vide si non
   * déterminable — jamais un problème artificiel.
   */
  problem: string;

  /**
   * Question de recherche proposée — découle directement de
   * phenomenon/problem, jamais une simple reformulation du titre.
   * Chaîne vide si non déterminable à ce stade.
   */
  researchQuestion: string;

  /**
   * Objectif général proposé. Si le chercheur en a déjà fourni un
   * (AIResearchInput.objective), A1 doit l'ECHOER (jamais le
   * remplacer silencieusement par une autre formulation) et le
   * marquer KNOWN dans fieldConfidence.
   */
  generalObjective: string;

  /**
   * Objectifs spécifiques proposés — même règle : échoer ceux déjà
   * fournis, n'en proposer de nouveaux que si la liste d'entrée est
   * vide ou incomplète.
   */
  specificObjectives: string[];

  mainConcepts: string[];

  proposedRelationship: {
    from: string;

    to: string;

    relation:
      | ResearchRelationType
      | "unknown";

    description?: string;
  };

  population?: string;

  location?: string;

  assumptions: string[];

  pointsToConfirm: string[];

  confidence: ConfidenceLevel;

  /**
   * Classification multi-label du/des mode(s) de recherche identifié(s)
   * (voir ResearchModeTag) — jamais une seule catégorie forcée.
   */
  researchModeTags: ResearchModeTag[];

  /**
   * Fiabilité champ par champ — KNOWN (écrit explicitement par le
   * chercheur) / INFERRED (déduit raisonnablement) / PROPOSED
   * (proposition d'ACADIA au-delà du texte) / MISSING (absent) /
   * TO_VERIFY (à confirmer par le chercheur).
   */
  fieldConfidence: FieldConfidenceMap;

  /**
   * Tableau de STRUCTURATION du phénomène — jamais des chiffres
   * réels. Liste les indicateurs pertinents, la donnée qu'il
   * faudrait obtenir pour les mesurer, et l'état de la recherche de
   * cette donnée. Peut être vide si le phénomène ne s'y prête pas
   * encore (ex. sujet trop peu précisé).
   */
  phenomenonTable: PhenomenonTableRow[];

  /**
   * Version du moteur A1 — définie en code après réception de la
   * réponse (jamais produite par le modèle), voir ENGINE_VERSION.
   */
  engineVersion: string;
}


/* =========================================================
   DONNÉES ENTRANTES A1
========================================================= */

export interface AIResearchInput {
  title: string;

  domain?: string;

  level?: string;

  university?: string;

  researchType?: string;

  problem?: string;

  objective?: string;

  objectives?: string[];

  population?: string;

  location?: string;
}


/* =========================================================
   A1 — COMPRÉHENSION IA DU SUJET
========================================================= */

export async function understandResearchWithAI(
  research: AIResearchInput,
  tracking: AITrackingInput = {}
): Promise<AIResearchUnderstanding> {

  const isPreview = tracking.depth === "preview";

  const { model } = selectModel(isPreview ? "PREVIEW_ANALYSIS" : "DEEP_ANALYSIS");

  const response =
    await createTrackedResponse({

      model,

      // Preview (anonyme, avant inscription) : raisonnement réduit pour
      // rester rapide et économique — même compromis déjà validé par
      // l'ancien moteur de preview dédié. Parcours authentifié complet
      // ("deep") : réglage par défaut de l'API, inchangé.
      ...(isPreview ? { reasoning: { effort: "none" as const } } : {}),

      input: [
        {
          role: "system",

          content: `
Tu es le moteur scientifique A1 de la plateforme ACADIA.

ACADIA accompagne principalement des étudiants,
chercheurs et universitaires.

Ta mission est de COMPRENDRE une recherche avant
toute construction méthodologique — et de RAISONNER
sur le type de recherche qu'il s'agit réellement,
pas seulement de reformuler le sujet en prose.

Tu dois analyser uniquement les informations
fournies par le chercheur.

Tu ne dois JAMAIS inventer un chiffre, une source,
une tendance ou un fait. Si une donnée n'existe pas
dans les informations disponibles, dis-le explicitement
et propose plutôt comment la rechercher.

CHAÎNE DE RAISONNEMENT À SUIVRE (chaque niveau découle
du précédent, jamais une simple répétition) :

phénomène observé → problème → question de recherche →
objectif général → objectifs spécifiques → concepts →
relation → mode(s) de recherche → population/localisation
→ ce qu'il faudrait mesurer et avec quelles données.

Tu dois identifier :

1. Le phénomène observé (ce qui se passe réellement dans
   le domaine étudié — pas une reformulation du titre).
2. Le problème (l'écart/la difficulté qui justifie
   l'étude), uniquement s'il ressort clairement.
3. La question de recherche qui en découle directement
   (researchQuestion) — jamais sans phénomène/problème
   qui la justifie.
4. L'objectif général et les objectifs spécifiques
   (generalObjective/specificObjectives) — si le
   chercheur en a déjà fourni, ÉCHOE-les tels quels
   (jamais de reformulation silencieuse) ; sinon,
   propose-les à partir de la question de recherche.
5. Le focus principal de recherche et les concepts
   principaux.
6. Une éventuelle relation entre les concepts.
7. La population lorsqu'elle est identifiable.
8. La localisation lorsqu'elle est identifiable.
9. Le(s) mode(s) de recherche réellement en jeu
   (researchModeTags — voir plus bas).
10. Un tableau de structuration du phénomène
    (phenomenonTable — voir plus bas).
11. La fiabilité de chaque champ important
    (fieldConfidence — voir plus bas).
12. Les hypothèses de compréhension.
13. Les informations qui doivent encore être confirmées.
14. Le niveau de confiance global.

IMPORTANT :

- Ne transforme pas automatiquement les concepts
  en variables.
- Ne crée pas encore les dimensions.
- Ne crée pas encore les indicateurs.
- Ne crée pas encore de questionnaire.
- Ne construis pas encore la méthodologie.
- Ne suppose pas une causalité lorsqu'elle n'est
  pas suffisamment justifiée.
- Si une relation n'est pas suffisamment claire,
  utilise "unknown".
- Si une information est incertaine,
  place-la dans assumptions ou pointsToConfirm.
- La réponse doit être exclusivement un JSON valide.

RELATIONS AUTORISÉES :

- influence
- impact
- effect
- relationship
- association
- correlation
- mediation
- moderation
- unknown

=========================================================
RESEARCHMODETAGS — CLASSIFICATION MULTI-LABEL
=========================================================

Identifie TOUS les tags pertinents parmi (jamais une seule
catégorie forcée — plusieurs tags peuvent coexister,
ex. FINANCIAL_ANALYSIS + CASE_STUDY + SECONDARY_DATA) :

${RESEARCH_MODE_TAGS.map((tag) => `- ${tag}`).join("\n")}

RÈGLES DE CLASSIFICATION :

- QUANTITATIVE_SURVEY : le sujet appelle un questionnaire
  auprès d'une population (attitudes, perceptions, pratiques
  déclarées mesurables par échelle).
- QUALITATIVE : le sujet vise à comprendre un vécu, une
  expérience, un sens — entretiens, récits, analyse
  thématique. Ne génère jamais un questionnaire quantitatif
  pour ce mode.
- FINANCIAL_ANALYSIS : le sujet porte sur la rentabilité, la
  performance financière, les états financiers, un bilan, un
  compte de résultat, des ratios (marge, ROA, ROE, liquidité,
  solvabilité, autonomie financière...). Ne propose PAS de
  questionnaire par défaut pour ce mode.
- SECONDARY_DATA : le sujet repose principalement sur des
  données déjà existantes (statistiques publiques, rapports,
  bases institutionnelles) plutôt que sur une collecte
  primaire. Ne propose pas de questionnaire par défaut.
- MIXED_METHOD : le sujet combine réellement une composante
  quantitative ET une composante qualitative. N'utilise ce
  tag QUE si les deux composantes sont réellement présentes
  — jamais par défaut pour un sujet complexe.
- CASE_STUDY : le sujet porte sur un cas précis (une
  entreprise, une organisation) étudié en profondeur. CECI
  EST UN CADRE/CONTEXTE D'ÉTUDE, PAS UNE MÉTHODE — ne
  l'assimile JAMAIS à MIXED_METHOD. Un sujet peut être
  CASE_STUDY + QUANTITATIVE_SURVEY, ou CASE_STUDY seul, ou
  CASE_STUDY + MIXED_METHOD uniquement si les deux méthodes
  sont réellement combinées.
- DESCRIPTIVE / CORRELATIONAL / EXPLANATORY / COMPARATIVE :
  devis de recherche, à assigner seulement si le texte le
  justifie réellement (ex. une comparaison explicite entre
  groupes → COMPARATIVE ; une relation entre deux variables
  mesurables → CORRELATIONAL ; une relation orientée avec
  hypothèse → EXPLANATORY).

=========================================================
PHENOMENONTABLE — TABLEAU DE STRUCTURATION DU PHÉNOMÈNE
=========================================================

ATTENTION — CECI N'EST PAS UN TABLEAU DE CHIFFRES RÉELS.
C'est un tableau qui structure comment le phénomène POURRAIT
être observé : quel élément du phénomène, quel indicateur,
quelle donnée serait nécessaire pour le mesurer, quelle
source plausible, sur quelle période et quel périmètre
géographique. JAMAIS une valeur numérique, JAMAIS une
source inventée (aucune URL, aucun nom d'organisme précis
que le chercheur n'a pas lui-même mentionné).

Chaque ligne comprend :
- phenomenonElement : l'aspect du phénomène concerné (ex.
  "Dépenses publiques"), distinct de l'indicateur précis.
- indicator : la mesure précise (ex. "Montant exécuté").
- requiredData : la donnée qu'il faudrait obtenir.
- source : nature/type de source plausible, JAMAIS une
  URL ou un nom d'organisme inventé — reste générique si
  le chercheur n'a rien précisé ("comptes de résultat de
  l'entreprise", "rapports budgétaires municipaux").
- period : période pertinente, ou "à préciser".
- geographicScope : périmètre géographique, ou "à préciser".
- status : KNOWN / INFERRED / PROPOSED / MISSING /
  TO_VERIFY / SOURCED (voir FIELDCONFIDENCE ci-dessous).
  N'UTILISE JAMAIS "SOURCED" TOI-MÊME : tu n'as accès à
  aucune recherche documentaire réelle. Utilise "MISSING"
  ou "TO_VERIFY" — "SOURCED" est réservé à un enrichissement
  ultérieur (recherche web effectuée par un autre module).
- provenance : courte justification du statut (ex.
  "proposé par ACADIA, jamais confirmé par le chercheur").
- collectionProposal : comment aller chercher cette donnée.

Pour un sujet FINANCIAL_ANALYSIS, pense en termes de :
chiffre d'affaires, charges, résultat net, actifs, passifs,
capitaux propres, trésorerie, et des ratios pertinents
UNIQUEMENT s'ils sont pertinents (marge nette, marge
opérationnelle, ROA, ROE, liquidité, solvabilité, autonomie
financière) — status doit alors presque toujours être
"TO_VERIFY" ou "MISSING" (états financiers rarement déjà
fournis à ce stade).

Pour un sujet SECONDARY_DATA, pense aux indicateurs publics
pertinents et à leurs sources institutionnelles plausibles
(sans jamais inventer une URL ou un nom d'organisme précis
non mentionné par le chercheur — reste générique : "rapports
institutionnels", "statistiques officielles du secteur").

Pour un sujet QUALITATIVE, le tableau peut rester vide ou
très court (un phénomène qualitatif ne se réduit pas
toujours à des indicateurs chiffrés) — ne force jamais des
indicateurs quantitatifs sur un phénomène qualitatif.

Exemple conceptuel (sujet financier) :
{
  "phenomenonElement": "Rentabilité de l'entreprise",
  "indicator": "Rentabilité nette",
  "requiredData": "Résultat net et chiffre d'affaires annuels",
  "source": "Comptes de résultat de l'entreprise étudiée",
  "period": "à préciser (ex. 3 à 5 derniers exercices)",
  "geographicScope": "à préciser",
  "status": "TO_VERIFY",
  "provenance": "Indicateur proposé par ACADIA à partir du sujet — données non fournies par le chercheur",
  "collectionProposal": "Obtenir les états financiers (bilan, compte de résultat) auprès de l'entreprise étudiée"
}

=========================================================
FIELDCONFIDENCE — FIABILITÉ CHAMP PAR CHAMP
=========================================================

Pour phenomenon, problem, researchQuestion, generalObjective,
specificObjectives, population, location, mainConcepts et
proposedRelationship, indique KNOWN (écrit explicitement par
le chercheur), INFERRED (déduit raisonnablement du texte),
PROPOSED (proposition d'ACADIA au-delà du texte), MISSING
(absent) ou TO_VERIFY (présent mais à confirmer). N'utilise
JAMAIS "SOURCED" ici — tu n'as accès à aucune source réelle.

Pour researchModeTags, ajoute UNE ENTRÉE PAR TAG que tu as
assigné (jamais toute la taxonomie), avec son propre niveau
de confiance.

- Si une information n'est pas disponible, ne remplis pas
  le champ correspondant avec une supposition — marque-le
  MISSING et laisse la valeur vide ("").
- Ne présente jamais une déduction (INFERRED) ou une
  proposition (PROPOSED) comme une information écrite par
  le chercheur (KNOWN).
- Si le chercheur a déjà fourni un objectif général/des
  objectifs spécifiques (voir les champs objective/objectives
  dans les informations fournies), ÉCHOE-les tels quels et
  marque-les KNOWN — ne les reformule jamais silencieusement.

STRUCTURE ATTENDUE :

{
  "researchFocus": "",
  "phenomenon": "",
  "problem": "",
  "researchQuestion": "",
  "generalObjective": "",
  "specificObjectives": [],
  "mainConcepts": [],
  "proposedRelationship": {
    "from": "",
    "to": "",
    "relation": "unknown",
    "description": ""
  },
  "population": "",
  "location": "",
  "assumptions": [],
  "pointsToConfirm": [],
  "confidence": "low",
  "researchModeTags": [],
  "fieldConfidence": {
    "phenomenon": "MISSING",
    "problem": "MISSING",
    "researchQuestion": "MISSING",
    "generalObjective": "MISSING",
    "specificObjectives": "MISSING",
    "population": "MISSING",
    "location": "MISSING",
    "mainConcepts": "MISSING",
    "proposedRelationship": "MISSING",
    "researchModeTags": []
  },
  "phenomenonTable": []
}
`
        },

        {
          role: "user",

          content: `
Voici les informations actuellement fournies
par le chercheur :

${JSON.stringify(
  research,
  null,
  2
)}

Analyse cette recherche.

Je veux uniquement la compréhension
scientifique structurée du sujet.

Ne propose pas encore de questionnaire.

Ne propose pas encore de méthodologie.

Ne fabrique aucune information.
`
        }
      ],

      text: {
        format: {
          type: "json_schema",

          name: "research_understanding",

          strict: true,

          schema: {
            type: "object",

            properties: {

              researchFocus: {
                type: "string"
              },

              phenomenon: {
                type: "string"
              },

              problem: {
                type: "string"
              },

              researchQuestion: {
                type: "string"
              },

              generalObjective: {
                type: "string"
              },

              specificObjectives: {
                type: "array",

                items: {
                  type: "string"
                }
              },

              mainConcepts: {
                type: "array",

                items: {
                  type: "string"
                }
              },

              proposedRelationship: {
                type: "object",

                properties: {

                  from: {
                    type: "string"
                  },

                  to: {
                    type: "string"
                  },

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
                      "unknown"
                    ]
                  },

                  description: {
                    type: "string"
                  }
                },

                required: [
                  "from",
                  "to",
                  "relation",
                  "description"
                ],

                additionalProperties: false
              },

              population: {
                type: "string"
              },

              location: {
                type: "string"
              },

              assumptions: {
                type: "array",

                items: {
                  type: "string"
                }
              },

              pointsToConfirm: {
                type: "array",

                items: {
                  type: "string"
                }
              },

              confidence: {
                type: "string",

                enum: [
                  "high",
                  "medium",
                  "low"
                ]
              },

              researchModeTags: {
                type: "array",

                items: {
                  type: "string",

                  enum: RESEARCH_MODE_TAGS
                }
              },

              fieldConfidence: {
                type: "object",

                properties: {

                  phenomenon: { type: "string", enum: FIELD_CONFIDENCE_VALUES },
                  problem: { type: "string", enum: FIELD_CONFIDENCE_VALUES },
                  researchQuestion: { type: "string", enum: FIELD_CONFIDENCE_VALUES },
                  generalObjective: { type: "string", enum: FIELD_CONFIDENCE_VALUES },
                  specificObjectives: { type: "string", enum: FIELD_CONFIDENCE_VALUES },
                  population: { type: "string", enum: FIELD_CONFIDENCE_VALUES },
                  location: { type: "string", enum: FIELD_CONFIDENCE_VALUES },
                  mainConcepts: { type: "string", enum: FIELD_CONFIDENCE_VALUES },
                  proposedRelationship: { type: "string", enum: FIELD_CONFIDENCE_VALUES },

                  researchModeTags: {
                    type: "array",

                    items: {
                      type: "object",

                      properties: {
                        tag: { type: "string", enum: RESEARCH_MODE_TAGS },
                        confidence: { type: "string", enum: FIELD_CONFIDENCE_VALUES }
                      },

                      required: ["tag", "confidence"],

                      additionalProperties: false
                    }
                  }
                },

                required: [
                  "phenomenon",
                  "problem",
                  "researchQuestion",
                  "generalObjective",
                  "specificObjectives",
                  "population",
                  "location",
                  "mainConcepts",
                  "proposedRelationship",
                  "researchModeTags"
                ],

                additionalProperties: false
              },

              phenomenonTable: {
                type: "array",

                items: {
                  type: "object",

                  properties: {
                    phenomenonElement: { type: "string" },
                    indicator: { type: "string" },
                    requiredData: { type: "string" },
                    source: { type: "string" },
                    period: { type: "string" },
                    geographicScope: { type: "string" },

                    status: {
                      type: "string",

                      enum: FIELD_CONFIDENCE_VALUES
                    },

                    provenance: { type: "string" },
                    collectionProposal: { type: "string" }
                  },

                  required: [
                    "phenomenonElement",
                    "indicator",
                    "requiredData",
                    "source",
                    "period",
                    "geographicScope",
                    "status",
                    "provenance",
                    "collectionProposal"
                  ],

                  additionalProperties: false
                }
              }
            },

            required: [
              "researchFocus",
              "phenomenon",
              "problem",
              "researchQuestion",
              "generalObjective",
              "specificObjectives",
              "mainConcepts",
              "proposedRelationship",
              "population",
              "location",
              "assumptions",
              "pointsToConfirm",
              "confidence",
              "researchModeTags",
              "fieldConfidence",
              "phenomenonTable"
            ],

            additionalProperties: false
          }
        }
      }
    }, {
      operation: isPreview ? "PREVIEW_ANALYSIS" : "DEEP_ANALYSIS",
      userId: tracking.userId,
      projectId: tracking.projectId,
      anonymousSessionId: tracking.anonymousSessionId,
      correlationId: tracking.correlationId,
    });


  /* ========================================================
     EXTRACTION DU TEXTE
  ======================================================== */

  const content =
    response.output_text;


  if (!content) {

    throw new Error(
      "OpenAI n'a retourné aucun résultat."
    );
  }


  /* ========================================================
     PARSING JSON
  ======================================================== */

  try {

    const parsed =
      JSON.parse(
        content
      ) as AIResearchUnderstanding;


    /* ------------------------------------------------------
       VALIDATION MINIMALE
    ------------------------------------------------------ */

    if (
      !parsed.researchFocus ||
      !Array.isArray(
        parsed.mainConcepts
      ) ||
      !parsed.proposedRelationship ||
      !Array.isArray(
        parsed.researchModeTags
      ) ||
      !parsed.fieldConfidence ||
      !Array.isArray(
        parsed.phenomenonTable
      ) ||
      !Array.isArray(
        parsed.specificObjectives
      )
    ) {

      throw new Error(
        "La réponse A1 ne respecte pas le contrat de compréhension."
      );
    }

    // Research Intelligence V3 — version de moteur toujours fixée en
    // code, jamais produite par le modèle (voir ENGINE_VERSION).
    parsed.engineVersion = ENGINE_VERSION;

    return parsed;

  } catch {

    throw new Error(
      "La réponse d'OpenAI n'est pas un JSON valide ou ne respecte pas le contrat A1."
    );
  }
}