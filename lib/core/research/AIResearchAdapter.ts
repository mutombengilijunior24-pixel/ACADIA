// ============================================================
// ACADIA — AI RESEARCH ADAPTER
//
// Responsabilité :
// A1 / A2 / IA → Research Core
//
// Ce fichier transforme les résultats produits par l'IA
// en objets conformes aux types définitifs du Research Core.
//
// IMPORTANT :
// - aucune analyse scientifique nouvelle ici
// - aucune invention de variable, de relation ou d'hypothèse
// - la relation ResearchRelation et l'hypothèse ResearchHypothesis
//   dérivées ici ne font que STRUCTURER, sous les types déjà
//   prévus par ResearchTypes.ts, la relation qu'A1 a lui-même
//   proposée (understanding.proposedRelationship) — rien n'est
//   ajouté au contenu scientifique. Si A1 marque la relation
//   "unknown", aucune hypothèse n'est générée.
// - uniquement conversion / normalisation
// ============================================================

import type {
  ResearchVariable,
  ResearchDimension,
  ResearchIndicator,
  ResearchRelation,
  ResearchHypothesis,
  ResearchObjective,
  ProposalStatus,
  ConfidenceLevel,
  VariableRole,
} from "./ResearchTypes";

import type {
  AIVariableIntelligenceResult,
  AIVariable,
  AIVariableDimension,
  AIVariableIndicator,
} from "@/lib/ai/openai/VariableIntelligenceAI";

import type {
  AIResearchUnderstanding,
} from "@/lib/ai/openai/SubjectUnderstandingAI";


// ============================================================
// TYPES INTERNES
// ============================================================

type UnknownRecord =
  Record<string, unknown>;


// ============================================================
// UTILITAIRES
// ============================================================

function clean(
  value: unknown
): string {

  if (
    typeof value !== "string"
  ) {
    return "";
  }

  return value
    .replace(/\s+/g, " ")
    .trim();
}


function asRecord(
  value: unknown
): UnknownRecord {

  if (
    typeof value === "object" &&
    value !== null
  ) {
    return value as UnknownRecord;
  }

  return {};
}


function asArray(
  value: unknown
): unknown[] {

  return Array.isArray(value)
    ? value
    : [];
}


// ============================================================
// NORMALISATION DU RÔLE
//
// ResearchTypes.VariableRole prévoit 6 rôles :
//
// independent / dependent / mediating / moderating /
// control / descriptive
//
// Les 6 sont conservés tels quels — aucune information n'est
// perdue ou réduite à independent/dependent. Seul un rôle
// réellement hors de cette liste (valeur inattendue du modèle)
// retourne null, auquel cas la variable est écartée et un
// avertissement est généré (voir getAIVariableWarnings).
// ============================================================

function normalizeVariableRole(
  value: unknown
): VariableRole | null {

  const role =
    clean(value).toLowerCase();


  if (
    role === "independent" ||
    role === "indépendante" ||
    role === "indépendant"
  ) {
    return "independent";
  }


  if (
    role === "dependent" ||
    role === "dépendante" ||
    role === "dépendant"
  ) {
    return "dependent";
  }


  if (
    role === "mediating" ||
    role === "médiatrice" ||
    role === "mediatrice"
  ) {
    return "mediating";
  }


  if (
    role === "moderating" ||
    role === "modératrice" ||
    role === "moderatrice"
  ) {
    return "moderating";
  }


  if (
    role === "control" ||
    role === "contrôle" ||
    role === "controle"
  ) {
    return "control";
  }


  if (
    role === "descriptive"
  ) {
    return "descriptive";
  }


  return null;
}


// ============================================================
// NORMALISATION DU STATUT
// ============================================================

function normalizeProposalStatus(
  value: unknown
): ProposalStatus {

  const status =
    clean(value).toLowerCase();


  switch (status) {

    case "accepted":
      return "accepted";

    case "rejected":
      return "rejected";

    case "proposed":
      return "proposed";

    case "draft":
      return "draft";

    default:
      return "proposed";
  }
}


// ============================================================
// NORMALISATION DE LA CONFIANCE
// ============================================================

function normalizeConfidence(
  value: unknown
): ConfidenceLevel {

  const confidence =
    clean(value).toLowerCase();


  if (
    confidence === "high" ||
    confidence === "élevée" ||
    confidence === "elevee"
  ) {
    return "high";
  }


  if (
    confidence === "low" ||
    confidence === "faible"
  ) {
    return "low";
  }


  return "medium";
}


// ============================================================
// INDICATEUR
// ============================================================

function convertIndicator(
  raw: unknown,
  index: number,
  dimensionId?: string
): ResearchIndicator {

  const source =
    asRecord(raw);


  const name =
    clean(
      source.name ??
      source.title ??
      source.indicator
    );


  const description =
    clean(
      source.description
    );


  return {

    id:
      clean(source.id) ||
      `indicator-${index + 1}`,

    name:
      name ||
      `Indicateur ${index + 1}`,

    description:
      description ||
      undefined,

    dimensionId,
  };
}


// ============================================================
// DIMENSION
// ============================================================

function convertDimension(
  raw: unknown,
  index: number,
  variableId: string
): ResearchDimension {

  const source =
    asRecord(raw);


  const id =
    clean(source.id) ||
    `dimension-${variableId}-${index + 1}`;


  const name =
    clean(
      source.name ??
      source.title ??
      source.dimension
    );


  const description =
    clean(
      source.description
    );


  const rawIndicators =
    asArray(
      source.indicators
    );


  const indicators =
    rawIndicators.map(
      (
        indicator,
        indicatorIndex
      ) =>
        convertIndicator(
          indicator,
          indicatorIndex,
          id
        )
    );


  return {

    id,

    name:
      name ||
      `Dimension ${index + 1}`,

    description:
      description ||
      "",

    variableId,

    indicators,

    status:
      normalizeProposalStatus(
        source.status
      ),

    confidence:
      normalizeConfidence(
        source.confidence
      ),
  };
}


// ============================================================
// VARIABLE
// ============================================================

function convertVariable(
  raw: unknown,
  index: number
): ResearchVariable | null {

  const source =
    asRecord(raw);


  const id =
    clean(source.id) ||
    `variable-${index + 1}`;


  const name =
    clean(
      source.name ??
      source.title ??
      source.variable
    );


  const definition =
    clean(
      source.definition ??
      source.description
    );


  const role =
    normalizeVariableRole(
      source.role ??
      source.type
    );


  // ----------------------------------------------------------
  // RÔLE NON SUPPORTÉ
  // ----------------------------------------------------------

  if (!role) {
    return null;
  }


  // ----------------------------------------------------------
  // DIMENSIONS
  // ----------------------------------------------------------

  const rawDimensions =
    asArray(
      source.dimensions
    );


  const dimensions =
    rawDimensions.map(
      (
        dimension,
        dimensionIndex
      ) =>
        convertDimension(
          dimension,
          dimensionIndex,
          id
        )
    );


  // ----------------------------------------------------------
  // INDICATEURS DIRECTS
  // ----------------------------------------------------------

  const rawIndicators =
    asArray(
      source.indicators
    );


  const indicators =
    rawIndicators.map(
      (
        indicator,
        indicatorIndex
      ) =>
        convertIndicator(
          indicator,
          indicatorIndex
        )
    );


  // ----------------------------------------------------------
  // OBJECTIFS LIÉS
  // ----------------------------------------------------------

  const linkedObjectiveIds =
    asArray(
      source.linkedObjectiveIds ??
      source.objectiveIds
    )
      .map(
        (objectiveId) =>
          clean(objectiveId)
      )
      .filter(Boolean);


  // ----------------------------------------------------------
  // VARIABLE NORMALISÉE
  // ----------------------------------------------------------

  return {

    id,

    name:
      name ||
      `Variable ${index + 1}`,

    role,

    definition:
      definition ||
      "Définition à préciser.",

    // A2 est explicitement instruit de fournir une "définition
    // opérationnelle claire" (voir VariableIntelligenceAI.ts) —
    // `definition` EST donc déjà cette définition opérationnelle.
    // On la reflète ici sans la dupliquer artificiellement.
    // `conceptualDefinition` reste undefined : A1/A2 ne produit
    // aujourd'hui aucune définition théorique distincte, et on
    // ne l'invente pas.
    operationalDefinition:
      definition ||
      undefined,

    dimensions,

    indicators,

    linkedObjectiveIds,

    status:
      normalizeProposalStatus(
        source.status
      ),

    confidence:
      normalizeConfidence(
        source.confidence
      ),
  };
}


// ============================================================
// CONVERSION PRINCIPALE
//
// AIVariableIntelligenceResult
//              ↓
//       ResearchVariable[]
// ============================================================

export function convertAIVariablesToResearchVariables(
  result: AIVariableIntelligenceResult
): ResearchVariable[] {

  const source =
    asRecord(result);


  const rawVariables =
    asArray(
      source.variables
    );


  return rawVariables
    .map(
      (
        variable,
        index
      ) =>
        convertVariable(
          variable,
          index
        )
    )
    .filter(
      (
        variable
      ): variable is ResearchVariable =>
        variable !== null &&
        variable.name.trim().length > 0
    );
}


// ============================================================
// AVERTISSEMENTS DE L'IA
// ============================================================

export function getAIVariableWarnings(
  result: AIVariableIntelligenceResult
): string[] {

  const warnings: string[] = [];


  const source =
    asRecord(result);


  // ----------------------------------------------------------
  // AVERTISSEMENTS PRODUITS PAR A2
  // ----------------------------------------------------------

  const aiWarnings =
    asArray(
      source.warnings
    );


  for (
    const warning of aiWarnings
  ) {

    const text =
      clean(warning);


    if (
      text &&
      !warnings.includes(text)
    ) {

      warnings.push(
        text
      );
    }
  }


  // ----------------------------------------------------------
  // POINTS À CONFIRMER
  // ----------------------------------------------------------

  const pointsToConfirm =
    asArray(
      source.pointsToConfirm
    );


  for (
    const point of pointsToConfirm
  ) {

    const text =
      clean(point);


    if (!text) {
      continue;
    }


    const warning =
      `Point à confirmer : ${text}`;


    if (
      !warnings.includes(
        warning
      )
    ) {

      warnings.push(
        warning
      );
    }
  }


  // ----------------------------------------------------------
  // VARIABLES
  // ----------------------------------------------------------

  const variables =
    asArray(
      source.variables
    );


  if (
    variables.length === 0
  ) {

    warnings.push(
      "Aucune variable exploitable n'a été produite par l'intelligence scientifique."
    );
  }


  // ----------------------------------------------------------
  // RÔLE NON RECONNU
  //
  // Les 6 rôles de VariableRole (independent, dependent,
  // mediating, moderating, control, descriptive) sont tous
  // supportés par normalizeVariableRole. On ne signale ici
  // qu'un rôle réellement hors de cette liste.
  // ----------------------------------------------------------

  const KNOWN_ROLES = new Set([
    "independent", "indépendante", "indépendant",
    "dependent", "dépendante", "dépendant",
    "mediating", "médiatrice", "mediatrice",
    "moderating", "modératrice", "moderatrice",
    "control", "contrôle", "controle",
    "descriptive",
  ]);

  for (
    const variable of variables
  ) {

    const record =
      asRecord(
        variable
      );


    const role =
      clean(
        record.role ??
        record.type
      ).toLowerCase();


    if (
      role &&
      !KNOWN_ROLES.has(role)
    ) {

      warnings.push(
        `La variable "${clean(record.name) || "sans nom"}" possède le rôle "${role}", qui n'est pas reconnu par ACADIA. Elle doit être revue avant validation.`
      );
    }
  }


  // ----------------------------------------------------------
  // CONFIANCE GLOBALE
  // ----------------------------------------------------------

  const overallConfidence =
    normalizeConfidence(
      source.overallConfidence
    );


  if (
    overallConfidence === "low"
  ) {

    warnings.push(
      "Le niveau de confiance global de l'analyse des variables est faible."
    );
  }


  // ----------------------------------------------------------
  // DÉDUPLICATION
  // ----------------------------------------------------------

  return Array.from(
    new Set(
      warnings
    )
  );
}


// ============================================================
// RÉSULTAT COMPLET DE L'ADAPTATEUR
// ============================================================

export interface AdaptedVariableAnalysis {

  variables:
    ResearchVariable[];

  warnings:
    string[];

  status:
    | "ready"
    | "needs_review";
}


// ============================================================
// ADAPTATION COMPLÈTE
// ============================================================

export function adaptVariableAnalysis(
  result: AIVariableIntelligenceResult
): AdaptedVariableAnalysis {

  const variables =
    convertAIVariablesToResearchVariables(
      result
    );


  const warnings =
    getAIVariableWarnings(
      result
    );


  return {

    variables,

    warnings,

    status:
      warnings.length > 0
        ? "needs_review"
        : "ready",
  };
}


// ============================================================
// RÉSOLUTION D'UN CONCEPT VERS UNE VARIABLE
//
// A1 nomme un concept ("Marketing digital") ; A2 peut nommer la
// variable correspondante différemment ("Marketing digital des
// PME perçu ou expérimenté par les clients"). Une correspondance
// textuelle exacte échoue alors silencieusement — c'est ce que
// corrige cette résolution à paliers :
//
// 1. correspondance exacte (nettoyée, insensible à la casse) ;
// 2. correspondance normalisée (accents/ponctuation ignorés) ;
// 3. correspondance "contenue" contrôlée : l'un des deux noms
//    normalisés contient entièrement l'autre — déterministe,
//    pas de similarité sémantique/IA ;
// 4. sinon : non résolu.
//
// Un id de variable n'est JAMAIS inventé : à défaut de
// résolution, le nom brut du concept est conservé et la relation
// est marquée "needs_review" par l'appelant.
// ============================================================

interface VariableMatch {
  id: string;
  resolved: boolean;
}

function normalizeForMatching(
  value: string
): string {

  const DIACRITICS_PATTERN =
    new RegExp("[\\u0300-\\u036f]", "g");

  return clean(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(DIACRITICS_PATTERN, "")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveVariableMatch(
  concept: string,
  variables: ResearchVariable[]
): VariableMatch {

  const rawConcept =
    clean(concept);

  if (!rawConcept) {
    return { id: rawConcept, resolved: false };
  }

  // Palier 1 — correspondance exacte
  const exact =
    variables.find(
      (variable) =>
        variable.name.toLowerCase() === rawConcept.toLowerCase()
    );

  if (exact) {
    return { id: exact.id, resolved: true };
  }

  const normalizedConcept =
    normalizeForMatching(rawConcept);

  if (!normalizedConcept) {
    return { id: rawConcept, resolved: false };
  }

  // Palier 2 — correspondance normalisée
  const normalized =
    variables.find(
      (variable) =>
        normalizeForMatching(variable.name) === normalizedConcept
    );

  if (normalized) {
    return { id: normalized.id, resolved: true };
  }

  // Palier 3 — correspondance contenue, contrôlée
  const contained =
    variables.find((variable) => {
      const normalizedName =
        normalizeForMatching(variable.name);

      return (
        normalizedName.length > 0 &&
        (
          normalizedName.includes(normalizedConcept) ||
          normalizedConcept.includes(normalizedName)
        )
      );
    });

  if (contained) {
    return { id: contained.id, resolved: true };
  }

  // Palier 4 — non résolu : le nom brut est conservé,
  // jamais un identifiant inventé.
  return { id: rawConcept, resolved: false };
}


// ============================================================
// RELATION (A1 → Research Core)
// ============================================================

export function buildRelationsFromUnderstanding(
  understanding: AIResearchUnderstanding | undefined,
  variables: ResearchVariable[]
): ResearchRelation[] {

  const relationship =
    understanding?.proposedRelationship;

  if (
    !relationship ||
    !clean(relationship.from) ||
    !clean(relationship.to)
  ) {
    return [];
  }

  const isUnknown =
    relationship.relation === "unknown";

  const fromMatch =
    resolveVariableMatch(
      relationship.from,
      variables
    );

  const toMatch =
    resolveVariableMatch(
      relationship.to,
      variables
    );

  const bothResolved =
    fromMatch.resolved &&
    toMatch.resolved;

  return [
    {
      id: "relation-1",

      from: fromMatch.id,

      to: toMatch.id,

      relation:
        relationship.relation,

      description:
        clean(relationship.description) ||
        undefined,

      // Une relation "unknown" reste tracée (A1 a identifié
      // deux concepts liés) mais avec un statut qui reflète
      // explicitement l'incertitude — jamais présentée comme
      // une relation établie. Une relation dont les variables
      // ne sont pas résolues avec certitude est marquée
      // "needs_review" plutôt que liée à un faux identifiant.
      status:
        isUnknown
          ? "draft"
          : bothResolved
          ? "proposed"
          : "needs_review",

      confidence:
        isUnknown || !bothResolved
          ? "low"
          : normalizeConfidence(understanding?.confidence),
    },
  ];
}


// ============================================================
// HYPOTHÈSE (A1 → Research Core)
//
// Formalise, sous ResearchHypothesis, la relation proposée par
// A1 — UNIQUEMENT lorsque cette relation est d'un type reconnu
// (jamais lorsque relation === "unknown" : ACADIA ne doit
// jamais formuler d'hypothèse sur une relation qu'A1 lui-même
// n'a pas su qualifier). Le libellé est construit à partir des
// noms de concepts fournis par A1, pas inventé.
// ============================================================

const RELATION_HYPOTHESIS_TEMPLATES: Record<
  string,
  (from: string, to: string) => string
> = {
  influence: (from, to) => `${from} influence ${to}.`,
  impact: (from, to) => `${from} a un impact sur ${to}.`,
  effect: (from, to) => `${from} a un effet sur ${to}.`,
  relationship: (from, to) => `Il existe une relation entre ${from} et ${to}.`,
  association: (from, to) => `${from} est associé(e) à ${to}.`,
  correlation: (from, to) => `${from} est corrélé(e) à ${to}.`,
  mediation: (from, to) => `${from} influence ${to} par médiation.`,
  moderation: (from, to) => `${from} modère la relation avec ${to}.`,
};


export function buildHypothesesFromRelations(
  understanding: AIResearchUnderstanding | undefined,
  relations: ResearchRelation[],
  variables: ResearchVariable[],
  generalObjectiveId?: string
): ResearchHypothesis[] {

  const relationship =
    understanding?.proposedRelationship;

  if (
    !relationship ||
    relationship.relation === "unknown"
  ) {
    return [];
  }

  const template =
    RELATION_HYPOTHESIS_TEMPLATES[
      relationship.relation
    ];

  if (!template) {
    return [];
  }

  const relation =
    relations[0];

  if (!relation) {
    return [];
  }

  const variableIds =
    [relation.from, relation.to].filter(
      (id) =>
        variables.some(
          (variable) => variable.id === id
        )
    );

  return [
    {
      id: "hypothesis-1",

      statement:
        template(
          clean(relationship.from),
          clean(relationship.to)
        ),

      role: "general",

      variableIds:
        variableIds.length > 0
          ? variableIds
          : undefined,

      // L'hypothèse formalise la relation principale identifiée
      // par A1, qui découle directement de l'objectif général —
      // c'est le seul lien objectif↔hypothèse qu'on peut établir
      // sans supposer une correspondance non justifiée.
      objectiveId:
        generalObjectiveId,

      status: "proposed",

      confidence:
        normalizeConfidence(understanding?.confidence),
    },
  ];
}


// ============================================================
// OBJECTIFS ↔ VARIABLES
//
// Règle STRUCTURELLE uniquement (pas d'IA, pas de similarité
// sémantique) : une variable est reliée à un objectif lorsque
// son nom normalisé apparaît explicitement dans le texte de cet
// objectif. Si aucune correspondance n'est trouvée, la variable
// reste non reliée — ResearchConsistencyEngine la signale alors
// en "needs_review" plutôt que de forcer un lien incertain.
// ============================================================

export function linkVariablesToObjectives(
  variables: ResearchVariable[],
  objectives: ResearchObjective[]
): ResearchVariable[] {

  return variables.map((variable) => {

    const normalizedVariableName =
      normalizeForMatching(variable.name);

    if (!normalizedVariableName) {
      return variable;
    }

    const matchedObjectiveIds =
      objectives
        .filter((objective) => {
          const normalizedObjectiveText =
            normalizeForMatching(objective.text);

          return (
            normalizedObjectiveText.length > 0 &&
            normalizedObjectiveText.includes(normalizedVariableName)
          );
        })
        .map((objective) => objective.id);

    if (matchedObjectiveIds.length === 0) {
      return variable;
    }

    return {
      ...variable,

      linkedObjectiveIds: Array.from(
        new Set([
          ...(variable.linkedObjectiveIds ?? []),
          ...matchedObjectiveIds,
        ])
      ),
    };
  });
}