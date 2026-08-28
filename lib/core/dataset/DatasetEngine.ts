// ============================================================
// ACADIA — DATASET ENGINE (P5)
//
// Construit le socle Dataset à partir de l'instrument de
// collecte (questionnaire quantitatif OU guide d'entretien
// qualitatif) déjà présent dans le projet. Réutilise
// GeneratedQuestionnaire/InterviewGuide (P4) sans les modifier.
//
// INTERDIT dans ce fichier : moyenne, médiane, variance,
// écart-type, corrélation, test statistique, régression,
// p-value, interprétation. Uniquement structure et contrôles
// de forme (présence, type, doublon, cohérence structurelle).
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";

import type {
  GeneratedQuestionnaire,
  QuestionnaireQuestion,
  InterviewGuide,
} from "@/lib/core/questionnaire/QuestionnaireTypes";

import type {
  Dataset,
  DatasetColumn,
  DatasetColumnDataType,
  DatasetQualityItem,
  DatasetQualityResult,
  DatasetReadiness,
  MeasurementLevel,
} from "./DatasetTypes";


// ============================================================
// UTILITAIRES
// ============================================================

function normalize(value: string): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(new RegExp("[\\u0300-\\u036f]", "g"), "")
    .trim();
}

function truncate(value: string, max: number): string {
  const clean = (value ?? "").replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/**
 * Préfixe stable dérivé du nom de la variable (B4) — ex.
 * "Motivation des agents" → "MOT". Purement structurel,
 * jamais une convention inventée arbitrairement : dérivée du
 * nom réel de la variable de recherche.
 */
function variablePrefix(variableName: string): string {
  const letters = normalize(variableName)
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return letters.slice(0, 4) || "VAR";
}

function uniqueName(base: string, used: Set<string>): string {
  if (!used.has(base)) {
    used.add(base);
    return base;
  }
  let suffix = 2;
  while (used.has(`${base}_${suffix}`)) suffix++;
  const name = `${base}_${suffix}`;
  used.add(name);
  return name;
}


// ============================================================
// TYPE DE RÉPONSE / NIVEAU DE MESURE — DÉRIVÉS DU TYPE DE QUESTION
//
// B5/B6 : deux notions distinctes, jamais confondues. Le niveau
// de mesure reste une information méthodologique conservée,
// pas une donnée recalculée statistiquement.
// ============================================================

function dataTypeForQuestion(question: QuestionnaireQuestion): DatasetColumnDataType {
  switch (question.type) {
    case "single_choice":
      return "single_choice";
    case "multiple_choice":
      return "multiple_choice";
    case "likert":
      return "likert";
    case "frequency":
    case "importance":
      return "single_choice";
    case "yes_no":
      return "boolean";
    case "number":
    case "percentage":
      return "decimal";
    case "date":
      return "date";
    case "long_text":
    case "text":
    default:
      return "text";
  }
}

function measurementLevelForQuestion(question: QuestionnaireQuestion): MeasurementLevel {
  switch (question.type) {
    case "likert":
    case "frequency":
    case "importance":
      return "ordinal";
    case "number":
    case "percentage":
      return "ratio";
    case "date":
      return "interval";
    case "yes_no":
    case "single_choice":
    case "multiple_choice":
    case "text":
    case "long_text":
    default:
      return "nominal";
  }
}


// ============================================================
// COLONNE DEPUIS UNE QUESTION (traçabilité conservée telle quelle)
// ============================================================

function columnFromQuestion(
  question: QuestionnaireQuestion,
  project: ResearchProject,
  used: Set<string>
): DatasetColumn {
  const prefixSource =
    question.variable ??
    (question.variableId
      ? project.variables.find((v) => v.id === question.variableId)?.name
      : undefined) ??
    "GEN";

  const prefix = variablePrefix(prefixSource);
  const name = uniqueName(prefix, used);

  const role = question.variableId
    ? project.variables.find((v) => v.id === question.variableId)?.role
    : undefined;

  const sourceOptions = question.options ?? question.scale;
  const options = sourceOptions?.map((o) => ({ value: o.value, label: o.label }));

  return {
    id: question.id,
    name,
    label: truncate(question.indicator || question.text, 80),
    dataType: dataTypeForQuestion(question),
    measurementLevel: measurementLevelForQuestion(question),
    sourceQuestionId: question.id,
    variableId: question.variableId,
    dimensionId: question.dimensionId,
    indicatorId: question.indicatorId,
    role,
    required: question.required,
    options,
  };
}


// ============================================================
// DATASET DEPUIS UN QUESTIONNAIRE QUANTITATIF (B2, B7)
// ============================================================

export function buildDatasetFromInstrument(
  project: ResearchProject,
  questionnaire: GeneratedQuestionnaire
): Dataset {
  const used = new Set<string>();
  const questions = questionnaire.sections.flatMap((s) => s.questions);

  const columns = questions.map((q) => columnFromQuestion(q, project, used));

  return {
    id: `dataset-${project.id}`,
    projectId: project.id,
    instrumentId: questionnaire.id,
    name: `${project.title} — Dataset`,
    status: "draft",
    columns,
    rows: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}


// ============================================================
// DATASET DEPUIS UN GUIDE D'ENTRETIEN QUALITATIF (B19 — Test 5)
//
// Une recherche qualitative n'est jamais forcée dans un
// questionnaire Likert : chaque thème du guide devient une
// colonne texte, compatible avec la nature réelle des données
// (réponses textuelles d'entretien).
// ============================================================

export function buildDatasetFromInterviewGuide(
  project: ResearchProject,
  guide: InterviewGuide
): Dataset {
  const used = new Set<string>();

  const columns: DatasetColumn[] = guide.themes.map((theme) => {
    const prefixSource =
      (theme.variableId && project.variables.find((v) => v.id === theme.variableId)?.name) ||
      theme.theme;
    const prefix = variablePrefix(prefixSource);
    const name = uniqueName(prefix, used);
    const role = theme.variableId
      ? project.variables.find((v) => v.id === theme.variableId)?.role
      : undefined;

    return {
      id: theme.id,
      name,
      label: truncate(theme.theme, 80),
      dataType: "text",
      measurementLevel: "nominal",
      sourceQuestionId: theme.id,
      variableId: theme.variableId,
      dimensionId: theme.dimensionId,
      role,
      required: false,
    };
  });

  return {
    id: `dataset-${project.id}`,
    projectId: project.id,
    instrumentId: guide.id,
    name: `${project.title} — Dataset (entretiens)`,
    status: "draft",
    columns,
    rows: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}


// ============================================================
// CONTRÔLES DE QUALITÉ (B14) — STRUCTURELS UNIQUEMENT
// ============================================================

export function valueMatchesType(value: unknown, column: DatasetColumn): boolean {
  if (value === null || value === undefined || value === "") return true; // absence gérée séparément

  switch (column.dataType) {
    case "integer":
    case "decimal":
      return typeof value === "number" || (typeof value === "string" && value.trim() !== "" && !isNaN(Number(value)));
    case "boolean":
      return typeof value === "boolean" || value === "true" || value === "false" || value === "Oui" || value === "Non";
    case "multiple_choice":
      return Array.isArray(value);
    case "single_choice":
    case "likert":
    case "text":
    case "date":
    default:
      return true;
  }
}

export function checkDatasetQuality(dataset: Dataset): DatasetQualityResult {
  const items: DatasetQualityItem[] = [];

  // -- Colonne sans source --------------------------------------------------
  const orphanColumns = dataset.columns.filter((c) => !c.sourceQuestionId);
  items.push({
    id: "orphan-columns",
    label: "Colonnes sans question source",
    severity: orphanColumns.length > 0 ? "warning" : "pass",
    detail:
      orphanColumns.length > 0
        ? `${orphanColumns.length} colonne(s) sans lien vers une question.`
        : "Chaque colonne référence une question source.",
  });

  // -- Doublon de nom ---------------------------------------------------------
  const nameCounts = new Map<string, number>();
  for (const c of dataset.columns) nameCounts.set(c.name, (nameCounts.get(c.name) ?? 0) + 1);
  const duplicates = [...nameCounts.entries()].filter(([, count]) => count > 1);
  items.push({
    id: "duplicate-names",
    label: "Doublons de noms de variables",
    severity: duplicates.length > 0 ? "error" : "pass",
    detail:
      duplicates.length > 0
        ? `Noms dupliqués : ${duplicates.map(([n]) => n).join(", ")}.`
        : "Tous les noms de variables sont uniques.",
  });

  // -- Variable sans question (colonne vide de structure) ----------------------
  const columnsWithoutIndicator = dataset.columns.filter((c) => !c.indicatorId);
  items.push({
    id: "columns-without-indicator",
    label: "Colonnes sans indicateur scientifique",
    severity: columnsWithoutIndicator.length > 0 ? "needs_review" : "pass",
    detail:
      columnsWithoutIndicator.length > 0
        ? `${columnsWithoutIndicator.length} colonne(s) sans lien vers un indicateur (question générale ou sans lien établi).`
        : "Toutes les colonnes sont reliées à un indicateur.",
  });

  if (dataset.rows.length === 0) {
    items.push({
      id: "no-observations",
      label: "Observations",
      severity: "warning",
      detail: "Aucune observation n'a encore été saisie.",
    });
    return {
      items,
      errorCount: items.filter((i) => i.severity === "error").length,
      warningCount: items.filter((i) => i.severity === "warning").length,
    };
  }

  // -- Valeurs incompatibles / absentes / obligatoires non renseignées --------
  let incompatibleCount = 0;
  let missingRequiredCount = 0;
  let missingCount = 0;

  for (const row of dataset.rows) {
    for (const column of dataset.columns) {
      const value = row.values[column.id];
      const isEmpty = value === null || value === undefined || value === "";

      if (isEmpty) {
        missingCount++;
        if (column.required) missingRequiredCount++;
        continue;
      }

      if (!valueMatchesType(value, column)) {
        incompatibleCount++;
      }
    }
  }

  items.push({
    id: "incompatible-values",
    label: "Valeurs incompatibles avec le type",
    severity: incompatibleCount > 0 ? "error" : "pass",
    detail:
      incompatibleCount > 0
        ? `${incompatibleCount} valeur(s) incompatible(s) avec le type de colonne déclaré.`
        : "Toutes les valeurs saisies sont compatibles avec leur type.",
  });

  items.push({
    id: "missing-required",
    label: "Questions obligatoires non renseignées",
    severity: missingRequiredCount > 0 ? "warning" : "pass",
    detail:
      missingRequiredCount > 0
        ? `${missingRequiredCount} valeur(s) obligatoire(s) manquante(s).`
        : "Aucune valeur obligatoire manquante.",
  });

  items.push({
    id: "missing-values",
    label: "Valeurs absentes",
    severity: missingCount > 0 ? "warning" : "pass",
    detail:
      missingCount > 0
        ? `${missingCount} valeur(s) absente(s) au total (obligatoires ou non).`
        : "Aucune valeur absente.",
  });

  return {
    items,
    errorCount: items.filter((i) => i.severity === "error").length,
    warningCount: items.filter((i) => i.severity === "warning").length,
  };
}


// ============================================================
// READINESS (B15) — jamais "prêt pour l'analyse" sans observation
// ============================================================

export function computeDatasetReadiness(
  dataset: Dataset,
  quality: DatasetQualityResult
): DatasetReadiness {
  const variablesStructured = dataset.columns.length > 0;
  const questionsLinked = dataset.columns.every((c) => Boolean(c.sourceQuestionId));
  const dictionaryAvailable = variablesStructured;
  const hasObservations = dataset.rows.length > 0;
  const analyzable = hasObservations && quality.errorCount === 0;

  return {
    variablesStructured,
    questionsLinked,
    dictionaryAvailable,
    hasObservations,
    analyzable,
    label: analyzable ? "Prêt pour l'analyse" : "Prêt à recevoir les données",
  };
}
