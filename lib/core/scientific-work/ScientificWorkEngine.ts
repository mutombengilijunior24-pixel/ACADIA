// ============================================================
// ACADIA — SCIENTIFIC WORK ENGINE (P11)
//
// Compile la structure IRMRD (inspirée de Sem Mbimbi & Cornet,
// chapitre 4) à partir des éléments RÉELLEMENT disponibles dans
// ResearchProject/Dataset/Instrument. Le contenu descriptif (P6)
// est recalculé à la volée (aucune sélection requise) ; le
// contenu bivarié/économétrique (P7/P8) n'est intégré QUE
// lorsqu'il a été explicitement accepté ou édité par le chercheur
// (voir ResearchContext.annotations) — jamais un résultat non
// relu présenté comme définitif dans un document scientifique.
//
// 100 % déterministe, zéro appel OpenAI (P11.25). Chaque élément
// manquant est explicitement marqué "à compléter"/"à définir"/
// "à préciser" — jamais inventé.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";
import type { GeneratedQuestionnaire, InterviewGuide } from "@/lib/core/questionnaire/QuestionnaireTypes";
import { buildDescriptiveAnalysis } from "@/lib/core/analysis/DescriptiveAnalysisEngine";
import type { ValidationStatus } from "@/lib/core/analysis/EconomicInterpretationTypes";

import type {
  AnnexEntry,
  BibliographyReference,
  DescriptiveResultEntry,
  FlatSortRow,
  HypothesisConfrontationRow,
  QualitativeThemeResult,
  ScientificWork,
  ScientificWorkConclusion,
  ScientificWorkIntroduction,
  ScientificWorkLiteratureReview,
  ScientificWorkMethodology,
  ScientificWorkResults,
  ScientificWorkSectionNode,
  ScientificWorkType,
  ValidatedResultEntry,
  WorkContentBlock,
} from "./ScientificWorkTypes";


// ============================================================
// ANNOTATION — forme minimale lue ici (le type complet vit dans
// ResearchContext, une couche au-dessus de lib/core ; on ne
// dépend que de ce qui est réellement utilisé, jamais l'inverse).
// ============================================================

export interface AnnotationLike {
  status: ValidationStatus;
  editedContent?: string;
}

export type AnnotationMap = Record<string, AnnotationLike>;


// ============================================================
// UTILITAIRES
// ============================================================

const TO_COMPLETE = "À compléter par le chercheur.";
const LITERATURE_INCOMPLETE = "Revue de littérature à compléter.";
const THEORY_TO_REGISTER = "Cadre théorique à renseigner.";
const CONTRIBUTION_TO_SPECIFY = "Contribution à préciser par le chercheur.";

function block(id: string, label: string, statements: string[]): WorkContentBlock {
  const hasPlaceholder = statements.some((s) =>
    /à compléter|à définir|à préciser|à renseigner|à examiner|non disponible|non déterminé/i.test(s)
  );
  return { id, label, statements, hasPlaceholder };
}

function extractValidatedAnnotationBlocks(
  annotations: AnnotationMap | undefined,
  prefix: string
): { blockId: string; status: ValidationStatus; text: string }[] {
  if (!annotations) return [];
  return Object.entries(annotations)
    .filter(([id, rec]) => id.startsWith(prefix) && (rec.status === "accepted" || rec.status === "edited") && rec.editedContent)
    .map(([id, rec]) => ({ blockId: id, status: rec.status, text: rec.editedContent! }));
}


// ============================================================
// P11.4 — STRUCTURE IRMRD PAR DÉFAUT
//
// Proposition ACADIA inspirée du référentiel Sem Mbimbi & Cornet
// (chapitre 4) — jamais présentée comme une citation littérale de
// l'ouvrage, jamais imposée comme l'unique structure valide.
// ============================================================

export function buildScientificWorkStructure(): ScientificWorkSectionNode[] {
  return [
    { id: "introduction", number: "1", title: "Introduction", chapterId: "introduction" },
    {
      id: "literature",
      number: "2",
      title: "Revue de littérature",
      chapterId: "literature",
      children: [
        { id: "literature-2-1", number: "2.1", title: "Cadre conceptuel", chapterId: "literature" },
        { id: "literature-2-2", number: "2.2", title: "Cadre théorique", chapterId: "literature" },
        { id: "literature-2-3", number: "2.3", title: "Études théoriques", chapterId: "literature" },
        { id: "literature-2-4", number: "2.4", title: "Études empiriques", chapterId: "literature" },
        { id: "literature-2-5", number: "2.5", title: "Positionnement / originalité de la recherche", chapterId: "literature" },
      ],
    },
    {
      id: "methodology",
      number: "3",
      title: "Méthodologie",
      chapterId: "methodology",
      children: [
        { id: "methodology-3-1", number: "3.1", title: "Approche méthodologique", chapterId: "methodology" },
        { id: "methodology-3-2", number: "3.2", title: "Méthode(s)", chapterId: "methodology" },
        { id: "methodology-3-3", number: "3.3", title: "Terrain de recherche", chapterId: "methodology" },
        { id: "methodology-3-4", number: "3.4", title: "Population", chapterId: "methodology" },
        { id: "methodology-3-5", number: "3.5", title: "Échantillonnage", chapterId: "methodology" },
        { id: "methodology-3-6", number: "3.6", title: "Techniques de collecte", chapterId: "methodology" },
        { id: "methodology-3-7", number: "3.7", title: "Instrument(s)", chapterId: "methodology" },
        { id: "methodology-3-8", number: "3.8", title: "Préparation des données", chapterId: "methodology" },
        { id: "methodology-3-9", number: "3.9", title: "Méthodes d'analyse", chapterId: "methodology" },
        { id: "methodology-3-10", number: "3.10", title: "Considérations de validité / fiabilité", chapterId: "methodology" },
      ],
    },
    {
      id: "results",
      number: "4",
      title: "Résultats",
      chapterId: "results",
      children: [
        { id: "results-4-1", number: "4.1", title: "Présentation du terrain / échantillon", chapterId: "results" },
        { id: "results-4-2", number: "4.2", title: "Résultats descriptifs", chapterId: "results" },
        { id: "results-4-3", number: "4.3", title: "Résultats bivariés", chapterId: "results" },
        { id: "results-4-4", number: "4.4", title: "Résultats économétriques", chapterId: "results" },
        { id: "results-4-5", number: "4.5", title: "Résultats qualitatifs", chapterId: "results" },
        { id: "results-4-6", number: "4.6", title: "Synthèse des résultats", chapterId: "results" },
      ],
    },
    {
      id: "discussion",
      number: "5",
      title: "Discussion",
      chapterId: "discussion",
      children: [
        { id: "discussion-5-1", number: "5.1", title: "Discussion des principaux résultats", chapterId: "discussion" },
        { id: "discussion-5-2", number: "5.2", title: "Confrontation aux hypothèses", chapterId: "discussion" },
        { id: "discussion-5-3", number: "5.3", title: "Confrontation au cadre théorique", chapterId: "discussion" },
        { id: "discussion-5-4", number: "5.4", title: "Confrontation à la littérature", chapterId: "discussion" },
        { id: "discussion-5-5", number: "5.5", title: "Convergences / divergences", chapterId: "discussion" },
        { id: "discussion-5-6", number: "5.6", title: "Limites", chapterId: "discussion" },
        { id: "discussion-5-7", number: "5.7", title: "Implications scientifiques", chapterId: "discussion" },
        { id: "discussion-5-8", number: "5.8", title: "Implications managériales / pratiques", chapterId: "discussion" },
      ],
    },
    { id: "conclusion", number: "6", title: "Conclusion", chapterId: "conclusion" },
    { id: "annexes", number: "7", title: "Annexes", chapterId: "annexes" },
    { id: "bibliography", number: "8", title: "Bibliographie", chapterId: "bibliography" },
  ];
}


// ============================================================
// P11.5 — INTRODUCTION
// ============================================================

function buildIntroduction(project: ResearchProject): ScientificWorkIntroduction {
  const context = block("work:intro:context", "Contexte", project.description ? [project.description] : [TO_COMPLETE]);

  const researchProblem = block(
    "work:intro:problem",
    "Problème de recherche",
    project.problem?.statement ? [project.problem.statement] : [TO_COMPLETE]
  );

  const justification = block(
    "work:intro:justification",
    "Justification du sujet",
    project.problem?.statement || project.description
      ? [`Cette proposition rédactionnelle reste à enrichir par le chercheur : l'étude porte sur « ${project.title} ».`]
      : [TO_COMPLETE]
  );

  const mainQuestion = project.researchQuestions.find((q) => q.type === "main") ?? project.researchQuestions[0];
  const researchQuestion = block(
    "work:intro:question",
    "Question de recherche",
    mainQuestion ? [mainQuestion.text] : [TO_COMPLETE]
  );

  const generalObjective = project.objectives.find((o) => o.role === "general");
  const specificObjectives = project.objectives.filter((o) => o.role === "specific");
  const objectiveStatements: string[] = [];
  if (generalObjective) objectiveStatements.push(`Objectif général : ${generalObjective.text}`);
  specificObjectives.forEach((o, i) => objectiveStatements.push(`Objectif spécifique ${i + 1} : ${o.text}`));
  const objectives = block("work:intro:objectives", "Objectifs", objectiveStatements.length > 0 ? objectiveStatements : [TO_COMPLETE]);

  const activeHypotheses = project.hypotheses.filter((h) => h.status !== "rejected");
  const hypotheses =
    activeHypotheses.length > 0
      ? block("work:intro:hypotheses", "Hypothèses", activeHypotheses.map((h) => h.statement))
      : undefined;

  const approach = project.methodology?.approach;
  const methodologySummary = block(
    "work:intro:methodology",
    "Méthodologie résumée",
    approach ? [`Cette recherche adopte une approche ${approach}.`] : [TO_COMPLETE]
  );

  const delimitationStatements: string[] = [];
  if (project.location) delimitationStatements.push(`Délimitation spatiale : ${project.location}.`);
  if (project.methodology?.population) delimitationStatements.push(`Population concernée : ${project.methodology.population}.`);
  const delimitation = block(
    "work:intro:delimitation",
    "Délimitation",
    delimitationStatements.length > 0 ? delimitationStatements : [TO_COMPLETE]
  );

  const workStructure = block("work:intro:structure", "Structure du travail", [
    "Ce travail s'organise en plusieurs chapitres : introduction, revue de la littérature, méthodologie, résultats, discussion, conclusion, annexes et bibliographie.",
  ]);

  return { context, researchProblem, justification, researchQuestion, objectives, hypotheses, methodologySummary, delimitation, workStructure };
}


// ============================================================
// P11.6/7 — REVUE DE LITTÉRATURE / CADRE THÉORIQUE
//
// ResearchProject ne possède aujourd'hui aucun champ théorie ou
// littérature — ces sections affichent donc systématiquement
// leur état "à compléter/renseigner", jamais un contenu inventé
// (même règle que P10, réutilisée à l'identique).
// ============================================================

function buildLiteratureReview(bibliography: BibliographyReference[]): ScientificWorkLiteratureReview {
  const citations = bibliography.map((b) => formatCitation(b));

  return {
    conceptualFramework: block("work:lit:concepts", "Cadre conceptuel", [LITERATURE_INCOMPLETE]),
    theoreticalFramework: block("work:lit:theory", "Cadre théorique", [THEORY_TO_REGISTER]),
    theoreticalStudies: block("work:lit:theoretical-studies", "Études théoriques", citations.length > 0 ? citations : [LITERATURE_INCOMPLETE]),
    empiricalStudies: block("work:lit:empirical-studies", "Études empiriques", citations.length > 0 ? citations : [LITERATURE_INCOMPLETE]),
    positioning: block("work:lit:positioning", "Positionnement / originalité", [LITERATURE_INCOMPLETE]),
  };
}

export function formatCitation(ref: BibliographyReference): string {
  const year = ref.year ? ` (${ref.year})` : "";
  const container = ref.journal ? ` ${ref.journal}` : ref.publisher ? ` ${ref.publisher}` : "";
  return `${ref.author}${year}. ${ref.title}.${container}`.trim();
}


// ============================================================
// P11.8 — MÉTHODOLOGIE
// ============================================================

function buildMethodology(project: ResearchProject, dataset: Dataset | undefined, instrumentLabel: string | undefined): ScientificWorkMethodology {
  const m = project.methodology;

  const approach = block(
    "work:method:approach",
    "Approche méthodologique",
    m?.approach ? [`Approche ${m.approach}${m.approachExplanation ? ` — ${m.approachExplanation}` : ""}.`] : ["Approche méthodologique à préciser."]
  );

  const methods = block(
    "work:method:methods",
    "Méthode(s)",
    m?.method ? [`${m.method}${m.methodExplanation ? ` — ${m.methodExplanation}` : ""}.`] : ["Méthode à préciser."]
  );

  const fieldOfStudy = block("work:method:field", "Terrain de recherche", project.location ? [project.location] : ["Terrain de recherche à préciser."]);

  const population = block(
    "work:method:population",
    "Population",
    m?.population ? [`${m.population}${m.populationSize ? ` (N = ${m.populationSize})` : ""}.`] : ["Population à définir."]
  );

  const samplingStatements: string[] = [];
  samplingStatements.push(m?.samplingMethod ? `Méthode d'échantillonnage : ${m.samplingMethod}.` : "Méthode d'échantillonnage : à définir.");
  samplingStatements.push(m?.sampleSize ? `Taille de l'échantillon : ${m.sampleSize}.` : "Taille de l'échantillon : à définir.");
  if (m?.samplingJustification) samplingStatements.push(m.samplingJustification);
  const sampling = block("work:method:sampling", "Échantillonnage", samplingStatements);

  const collectionTechniques = block(
    "work:method:collection",
    "Techniques de collecte",
    (m?.techniques?.length ?? 0) > 0 ? m!.techniques : ["Technique de collecte à préciser."]
  );

  const instruments = block("work:method:instruments", "Instrument(s)", instrumentLabel ? [instrumentLabel] : ["Instrument à préciser."]);

  const dataPreparation = block(
    "work:method:data-prep",
    "Préparation des données",
    dataset
      ? [`Le dataset comprend ${dataset.columns.length} variable(s) et ${dataset.rows.length} observation(s) au moment de la génération de ce document.`]
      : ["Préparation des données : à documenter une fois le dataset disponible."]
  );

  const analysisMethods = block(
    "work:method:analysis",
    "Méthodes d'analyse",
    (m?.analysisMethods?.length ?? 0) > 0 ? m!.analysisMethods : ["Méthodes d'analyse à préciser."]
  );

  const validityReliability =
    m?.warnings && m.warnings.length > 0 ? block("work:method:validity", "Considérations de validité / fiabilité", m.warnings) : undefined;

  return { approach, methods, fieldOfStudy, population, sampling, collectionTechniques, instruments, dataPreparation, analysisMethods, validityReliability };
}


// ============================================================
// P11.9-15 — RÉSULTATS (factuels — jamais mêlés à la discussion)
// ============================================================

function buildDescriptiveResultsEntries(project: ResearchProject, dataset: Dataset): DescriptiveResultEntry[] {
  const analysis = buildDescriptiveAnalysis(project, dataset);

  return analysis.variableResults.map((r) => {
    const statements = r.reading ? [...r.reading.statements] : ["Synthèse non disponible pour cette variable (voir les avertissements de l'analyse descriptive)."];

    const flatSort: FlatSortRow[] | undefined = r.frequencyTable?.map((f) => ({
      modality: f.label,
      count: f.count,
      percentage: f.validPercentage,
    }));

    return {
      columnId: r.columnId,
      variableId: r.variableId,
      dimensionId: r.dimensionId,
      indicatorId: r.indicatorId,
      label: r.label,
      block: block(`work:results:descriptive:${r.columnId}`, r.label, statements),
      flatSort,
      validN: r.validCount,
    };
  });
}

function buildBivariateResultEntries(annotations: AnnotationMap | undefined): ValidatedResultEntry[] {
  return extractValidatedAnnotationBlocks(annotations, "interp:bivariate:").map(({ blockId, status, text }) => ({
    blockId,
    label: "Analyse bivariée",
    block: block(blockId, "Analyse bivariée", [text]),
    status,
    sourceType: "bivariate" as const,
  }));
}

function buildEconometricResultEntries(annotations: AnnotationMap | undefined): ValidatedResultEntry[] {
  return extractValidatedAnnotationBlocks(annotations, "interp:econ:").map(({ blockId, status, text }) => {
    const sourceType = blockId.includes(":coef:")
      ? ("econometric_coefficient" as const)
      : blockId.endsWith(":limits")
      ? ("econometric_diagnostics" as const)
      : ("econometric_summary" as const);
    const label =
      sourceType === "econometric_coefficient"
        ? `Coefficient — ${blockId.split(":coef:")[1] ?? ""}`
        : sourceType === "econometric_diagnostics"
        ? "Limites du modèle"
        : "Résumé du modèle";
    return { blockId, label, block: block(blockId, label, [text]), status, sourceType };
  });
}

function buildQualitativeResultsEntries(dataset: Dataset | undefined): QualitativeThemeResult[] {
  if (!dataset) return [];
  return dataset.columns.map((col) => {
    const responses = dataset.rows.map((r) => r.values[col.id]).filter((v) => v !== null && v !== "" && v !== undefined);
    const statements =
      responses.length > 0
        ? [`${responses.length} réponse(s) recueillie(s) pour ce thème.`, "Analyse thématique (codage, convergences/divergences) à réaliser par le chercheur."]
        : ["Aucune réponse encore recueillie pour ce thème."];
    return {
      themeId: col.id,
      theme: col.label,
      responseCount: responses.length,
      block: block(`work:results:qual:${col.id}`, col.label, statements),
    };
  });
}

function determineResultsMode(project: ResearchProject): ScientificWorkResults["mode"] {
  if (project.researchType === "qualitative") return "qualitative";
  if (project.researchType === "mixed") return "mixed";
  const hasHypotheticalRelation = project.variables.some((v) => v.role === "independent") && project.variables.some((v) => v.role === "dependent");
  return hasHypotheticalRelation ? "quantitative" : "descriptive_only";
}

function buildFieldPresentation(dataset: Dataset | undefined): WorkContentBlock {
  const statements = dataset
    ? [`L'échantillon exploité comprend ${dataset.rows.length} observation(s) sur ${dataset.columns.length} variable(s) collectée(s) au moment de la génération de ce document.`]
    : ["Présentation du terrain / échantillon : à compléter (aucun dataset disponible)."];
  return block("work:results:field", "Présentation du terrain / échantillon", statements);
}

function buildResultsSynthesis(
  descriptive: DescriptiveResultEntry[],
  bivariate: ValidatedResultEntry[],
  econometric: ValidatedResultEntry[],
  qualitative: QualitativeThemeResult[]
): WorkContentBlock {
  const parts: string[] = [];
  if (descriptive.length > 0) parts.push(`${descriptive.length} variable(s) analysée(s) au plan descriptif.`);
  if (bivariate.length > 0) parts.push(`${bivariate.length} résultat(s) d'analyse bivariée validé(s) par le chercheur intégré(s).`);
  if (econometric.length > 0) parts.push(`${econometric.length} élément(s) de modèle économétrique validé(s) par le chercheur intégré(s).`);
  if (qualitative.length > 0) parts.push(`${qualitative.length} thème(s) qualitatif(s) documenté(s).`);
  if (parts.length === 0) parts.push("Synthèse des résultats : à compléter une fois les analyses disponibles et validées.");
  return block("work:results:synthesis", "Synthèse des résultats", parts);
}

const ECONOMETRIC_UNAVAILABLE = "Résultat économétrique indisponible : le modèle doit d'abord être vérifié.";

function buildScientificWorkResults(project: ResearchProject, dataset: Dataset | undefined, annotations: AnnotationMap | undefined): ScientificWorkResults {
  const mode = determineResultsMode(project);

  const fieldPresentation = buildFieldPresentation(dataset);
  const descriptive = mode === "qualitative" || !dataset ? [] : buildDescriptiveResultsEntries(project, dataset);
  const bivariate = mode === "qualitative" ? [] : buildBivariateResultEntries(annotations);
  const validatedEconometric = mode === "qualitative" || mode === "descriptive_only" ? [] : buildEconometricResultEntries(annotations);
  // P11.13 — un modèle économétrique est théoriquement applicable (variables
  // indépendante/dépendante identifiées) mais n'a pas encore été vérifié/validé
  // par le chercheur : jamais un résultat vide silencieux, toujours ce message
  // explicite (jamais un chiffre ou un modèle inventé).
  const econometric: ValidatedResultEntry[] =
    validatedEconometric.length === 0 && (mode === "quantitative" || mode === "mixed")
      ? [
          {
            blockId: "work:results:econ:unavailable",
            label: "Modèle économétrique",
            block: block("work:results:econ:unavailable", "Modèle économétrique", [ECONOMETRIC_UNAVAILABLE]),
            status: "generated",
            sourceType: "econometric_summary",
          },
        ]
      : validatedEconometric;
  // P11.14 — le dataset qualitatif (thèmes textuels) n'est distinct du dataset
  // quantitatif que pour un projet PUREMENT qualitatif dans l'architecture
  // actuelle (P5) ; un projet mixte utilise le dataset quantitatif comme
  // source principale — les résultats qualitatifs mixtes restent donc hors
  // périmètre de cette version (voir rapport final).
  const qualitative = mode === "qualitative" ? buildQualitativeResultsEntries(dataset) : [];

  const synthesis = buildResultsSynthesis(descriptive, bivariate, validatedEconometric, qualitative);

  return { fieldPresentation, descriptive, bivariate, econometric, qualitative, synthesis, mode };
}


// ============================================================
// P11.17 — CONFRONTATION DES HYPOTHÈSES
//
// Le statut "compatible"/"non compatible" n'est dérivé QUE d'un
// texte déjà validé par le chercheur (P9), lui-même déjà construit
// de façon prudente ("soutien empirique" / jamais "confirmée") —
// jamais une nouvelle inférence statistique inventée ici.
// ============================================================

function extractStatFromText(text: string): string {
  const patterns = [/β\s*=\s*[+\-−]?[\d,.]+(?:\s*,\s*p\s*=\s*[\d,.]+)?/, /rho\s*=\s*[+\-−]?[\d,.]+/i, /\br\s*=\s*[+\-−]?[\d,.]+/, /χ²\([^)]*\)\s*=\s*[\d,.]+/];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[0];
  }
  return "Voir le résultat empirique ci-dessus.";
}

function buildHypothesisConfrontations(project: ResearchProject, annotations: AnnotationMap | undefined): HypothesisConfrontationRow[] {
  const validated = [...buildBivariateResultEntries(annotations), ...buildEconometricResultEntries(annotations)];

  return project.hypotheses
    .filter((h) => h.status !== "rejected")
    .map((h) => {
      const variableLabels = (h.variableIds ?? [])
        .map((vid) => project.variables.find((v) => v.id === vid)?.name)
        .filter((v): v is string => Boolean(v));

      const matching = validated.filter((e) => e.block.statements.some((s) => s.includes(h.statement)));

      if (matching.length === 0) {
        return {
          hypothesisId: h.id,
          statement: h.statement,
          variableLabels,
          empiricalResult: "Résultat empirique non encore disponible — validez une analyse bivariée ou économétrique liée à cette hypothèse (section Interprétation économique) pour l'intégrer ici.",
          testUsed: "Non déterminé",
          statisticalResult: "Non disponible",
          interpretation: "À examiner par le chercheur.",
          status: variableLabels.length > 0 ? "to_examine" : "not_applicable",
        };
      }

      const combinedText = matching.map((m) => m.block.statements.join(" ")).join(" ");
      const supportive = combinedText.includes("apporte un soutien empirique") && !combinedText.includes("n'apporte pas de soutien empirique");
      const testUsed = matching[0].sourceType === "bivariate" ? "Analyse bivariée" : "Modèle économétrique (MCO)";

      return {
        hypothesisId: h.id,
        statement: h.statement,
        variableLabels,
        empiricalResult: combinedText,
        testUsed,
        statisticalResult: extractStatFromText(combinedText),
        interpretation: combinedText,
        status: supportive ? "compatible" : "not_compatible",
      };
    });
}


// ============================================================
// P11.18 — CONCLUSION
// ============================================================

function buildConclusion(project: ResearchProject, dataset: Dataset | undefined, annotations: AnnotationMap | undefined): ScientificWorkConclusion {
  const researchObjectRecall = block("work:conclusion:object", "Rappel de l'objet de recherche", [project.title]);

  const problemRecall = block(
    "work:conclusion:problem",
    "Rappel du problème",
    project.problem?.statement ? [project.problem.statement] : [TO_COMPLETE]
  );

  const mainQuestion = project.researchQuestions.find((q) => q.type === "main") ?? project.researchQuestions[0];
  const mainQuestions = block("work:conclusion:questions", "Questions principales", mainQuestion ? [mainQuestion.text] : [TO_COMPLETE]);

  const approach = project.methodology?.approach;
  const methodologySynthesis = block(
    "work:conclusion:method",
    "Méthodologie synthétique",
    approach
      ? [`Une approche ${approach} a été mobilisée${dataset ? `, sur un échantillon de ${dataset.rows.length} observation(s)` : ""}.`]
      : [TO_COMPLETE]
  );

  const validatedResults = [...buildBivariateResultEntries(annotations), ...buildEconometricResultEntries(annotations)];
  const mainResults = block(
    "work:conclusion:results",
    "Principaux résultats",
    validatedResults.length > 0
      ? validatedResults.flatMap((r) => r.block.statements)
      : ["Résultats à intégrer une fois les analyses validées par le chercheur (section Interprétation économique)."]
  );

  const theoreticalContribution = block("work:conclusion:contrib-theory", "Contribution théorique", [CONTRIBUTION_TO_SPECIFY]);
  const methodologicalContribution = block("work:conclusion:contrib-method", "Contribution méthodologique", [CONTRIBUTION_TO_SPECIFY]);
  const practicalContribution = block("work:conclusion:contrib-practice", "Contribution managériale / pratique", [CONTRIBUTION_TO_SPECIFY]);

  const limitations = block("work:conclusion:limits", "Limites", [
    "Les limites de cette recherche sont détaillées dans le chapitre Discussion (section Limites), construites à partir des diagnostics réellement disponibles.",
  ]);

  const perspectives = block("work:conclusion:perspectives", "Perspectives de recherche", [
    "Une réplication de cette étude dans un autre contexte ou auprès d'un autre échantillon permettrait d'apprécier la robustesse des résultats.",
    "L'intégration de variables ou de contrôles supplémentaires pourrait enrichir le modèle explicatif proposé.",
    "Une extension à d'autres terrains ou périodes constitue une piste de recherche future.",
  ]);

  return {
    researchObjectRecall,
    problemRecall,
    mainQuestions,
    methodologySynthesis,
    mainResults,
    theoreticalContribution,
    methodologicalContribution,
    practicalContribution,
    limitations,
    perspectives,
  };
}


// ============================================================
// P11.19 — ANNEXES (jamais une annexe inexistante)
// ============================================================

function buildAnnexes(
  instrument: { questionnaire?: GeneratedQuestionnaire; interviewGuide?: InterviewGuide } | undefined,
  dataset: Dataset | undefined
): AnnexEntry[] {
  return [
    { id: "annex-questionnaire", label: "Questionnaire", type: "questionnaire", available: Boolean(instrument?.questionnaire) },
    { id: "annex-interview-guide", label: "Guide d'entretien", type: "interview_guide", available: Boolean(instrument?.interviewGuide) },
    { id: "annex-data-dictionary", label: "Dictionnaire des données", type: "data_dictionary", available: Boolean(dataset && dataset.columns.length > 0) },
  ];
}


// ============================================================
// CONSTRUCTION COMPLÈTE DU TRAVAIL SCIENTIFIQUE
// ============================================================

export function buildScientificWork(
  project: ResearchProject,
  type: ScientificWorkType,
  dataset: Dataset | undefined,
  instrument: { questionnaire?: GeneratedQuestionnaire; interviewGuide?: InterviewGuide } | undefined,
  annotations: AnnotationMap | undefined,
  bibliography: BibliographyReference[]
): ScientificWork {
  const introduction = buildIntroduction(project);
  const literatureReview = buildLiteratureReview(bibliography);

  const instrumentLabel = instrument?.questionnaire
    ? `Questionnaire (${instrument.questionnaire.totalQuestions} question(s)).`
    : instrument?.interviewGuide
    ? `Guide d'entretien (${instrument.interviewGuide.themes.length} thème(s)).`
    : undefined;

  const methodology = buildMethodology(project, dataset, instrumentLabel);
  const results = buildScientificWorkResults(project, dataset, annotations);
  const hypothesisConfrontations = buildHypothesisConfrontations(project, annotations);
  const conclusion = buildConclusion(project, dataset, annotations);
  const annexes = buildAnnexes(instrument, dataset);

  return {
    id: `work-${project.id}`,
    projectId: project.id,
    title: project.title,
    type,
    structure: buildScientificWorkStructure(),
    introduction,
    literatureReview,
    methodology,
    results,
    discussion: {
      available: project.researchType !== undefined,
      hypothesisConfrontations,
    },
    conclusion,
    annexes,
    bibliography,
    updatedAt: new Date().toISOString(),
  };
}
