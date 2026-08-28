// ============================================================
// ACADIA — DOCUMENT BUILDER (P12)
//
// Transforme un ScientificWork (P11, déjà construit et validé par
// le chercheur) + une ScientificDiscussion (P10, déjà construite)
// en un DocumentModel neutre, prêt à être mis en page par les
// moteurs DOCX et PDF. AUCUNE logique scientifique n'est exécutée
// ici : aucun chiffre, aucune référence, aucun auteur, aucune
// hypothèse n'est recalculé ni inventé — cette fonction ne fait que
// RESTRUCTURER un contenu déjà produit par P6-P11.
//
// Fonction pure et isomorphe (aucun accès DOM/localStorage) afin de
// pouvoir être appelée aussi bien côté client (aperçu) que côté
// serveur (route API d'export) à partir des mêmes données envoyées
// par le client — le serveur ne recalcule jamais la science.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { ScientificDiscussion } from "@/lib/core/analysis/ScientificDiscussionTypes";
import type { ScientificWork, ScientificWorkType, WorkContentBlock } from "@/lib/core/scientific-work/ScientificWorkTypes";
import { SCIENTIFIC_WORK_TYPE_LABELS } from "@/lib/core/scientific-work/ScientificWorkTypes";

import type {
  CoverPageInfo,
  DocumentAnnexModel,
  DocumentChapterModel,
  DocumentModel,
  DocumentPreliminary,
  DocumentSectionModel,
  DocumentStyle,
  DocumentTocEntry,
} from "./DocumentTypes";
import { COVER_TO_COMPLETE, DEFAULT_DOCUMENT_STYLE, PRELIMINARY_TO_COMPLETE } from "./DocumentTypes";
import { createDocumentCounter, buildFlatSortTable, buildHypothesisConfrontationTable } from "./DocumentTableBuilder";
import { buildBarFigure } from "./DocumentFigureBuilder";
import { buildBibliography } from "./DocumentBibliographyBuilder";
import { resolveBlockParagraphs, resolveNamedTextParagraphs } from "./DocumentFormatter";
import type { AnnotationMap } from "./DocumentFormatter";

export type { AnnotationMap };

// ------------------------------------------------------------
// PAGE DE GARDE — jamais inventée. `overrides` provient des
// annotations "export:cover:*" (même mécanisme d'édition humaine
// persistée que P11, réutilisé à l'identique, aucun nouveau
// système de stockage).
// ------------------------------------------------------------

export function resolveCoverPageInfo(project: ResearchProject, annotations: AnnotationMap | undefined): CoverPageInfo {
  function field(id: string, fallback: string): string {
    return annotations?.[id]?.editedContent?.trim() || fallback;
  }
  return {
    institution: field("export:cover:institution", project.university || COVER_TO_COMPLETE),
    faculty: field("export:cover:faculty", COVER_TO_COMPLETE),
    department: field("export:cover:department", COVER_TO_COMPLETE),
    title: project.title,
    degreeStatement: field("export:cover:degreeStatement", COVER_TO_COMPLETE),
    author: field("export:cover:author", COVER_TO_COMPLETE),
    supervisor: field("export:cover:supervisor", COVER_TO_COMPLETE),
    academicYear: field("export:cover:academicYear", COVER_TO_COMPLETE),
  };
}

function resolvePreliminary(annotations: AnnotationMap | undefined): DocumentPreliminary {
  function field(id: string): string {
    return annotations?.[id]?.editedContent?.trim() || PRELIMINARY_TO_COMPLETE;
  }
  return {
    dedication: field("export:preliminary:dedication"),
    acknowledgements: field("export:preliminary:acknowledgements"),
    epigraph: field("export:preliminary:epigraph"),
    abstract: field("export:preliminary:abstract"),
    abstractEn: field("export:preliminary:abstractEn"),
  };
}

// ------------------------------------------------------------
// CHAPITRE 1 — INTRODUCTION (reprend exactement P11, jamais réécrit)
// ------------------------------------------------------------

function section(counter: { n: number }, chapterN: number, title: string, paragraphs: string[]): DocumentSectionModel {
  counter.n += 1;
  return {
    id: `sec-${chapterN}-${counter.n}`,
    number: `${chapterN}.${counter.n}`,
    title,
    paragraphs,
    tableIds: [],
    figureIds: [],
    hasPlaceholder: paragraphs.some((p) => /à compléter|à définir|à préciser|à renseigner|à examiner|non disponible|non déterminé/i.test(p)),
  };
}

function buildIntroductionChapter(work: ScientificWork, annotations: AnnotationMap | undefined): DocumentChapterModel {
  const c = { n: 0 };
  const blocks: (WorkContentBlock | undefined)[] = [
    work.introduction.context,
    work.introduction.researchProblem,
    work.introduction.justification,
    work.introduction.researchQuestion,
    work.introduction.objectives,
    work.introduction.hypotheses,
    work.introduction.methodologySummary,
    work.introduction.delimitation,
    work.introduction.workStructure,
  ];
  const sections = blocks
    .filter((b): b is WorkContentBlock => Boolean(b))
    .map((b) => section(c, 1, b.label, resolveBlockParagraphs(annotations, b)));
  return { id: "chapter-introduction", number: "1", title: "Introduction", sections };
}

function buildLiteratureChapter(work: ScientificWork, annotations: AnnotationMap | undefined): DocumentChapterModel {
  const c = { n: 0 };
  const blocks = [
    work.literatureReview.conceptualFramework,
    work.literatureReview.theoreticalFramework,
    work.literatureReview.theoreticalStudies,
    work.literatureReview.empiricalStudies,
    work.literatureReview.positioning,
  ];
  const sections = blocks.map((b) => section(c, 2, b.label, resolveBlockParagraphs(annotations, b)));
  return { id: "chapter-literature", number: "2", title: "Revue de littérature", sections };
}

function buildMethodologyChapter(work: ScientificWork, annotations: AnnotationMap | undefined): DocumentChapterModel {
  const c = { n: 0 };
  const blocks: (WorkContentBlock | undefined)[] = [
    work.methodology.approach,
    work.methodology.methods,
    work.methodology.fieldOfStudy,
    work.methodology.population,
    work.methodology.sampling,
    work.methodology.collectionTechniques,
    work.methodology.instruments,
    work.methodology.dataPreparation,
    work.methodology.analysisMethods,
    work.methodology.validityReliability,
  ];
  const sections = blocks
    .filter((b): b is WorkContentBlock => Boolean(b))
    .map((b) => section(c, 3, b.label, resolveBlockParagraphs(annotations, b)));
  return { id: "chapter-methodology", number: "3", title: "Méthodologie", sections };
}

function buildResultsChapter(
  work: ScientificWork,
  tableCounter: ReturnType<typeof createDocumentCounter>,
  figureCounter: ReturnType<typeof createDocumentCounter>,
  tables: ReturnType<typeof buildFlatSortTable>[],
  figures: ReturnType<typeof buildBarFigure>[]
): DocumentChapterModel {
  const c = { n: 0 };
  const sections: DocumentSectionModel[] = [];

  sections.push(section(c, 4, "Présentation du terrain / échantillon", work.results.fieldPresentation.statements));

  if (work.results.descriptive.length > 0) {
    const paragraphs: string[] = [];
    const tableIds: string[] = [];
    const figureIds: string[] = [];
    for (const entry of work.results.descriptive) {
      paragraphs.push(`${entry.label} — ${entry.block.statements.join(" ")}`);
      if (entry.flatSort && entry.flatSort.length > 0) {
        const t = buildFlatSortTable(tableCounter, `table-desc-${entry.columnId}`, entry.label, entry.flatSort);
        const f = buildBarFigure(figureCounter, `figure-desc-${entry.columnId}`, entry.label, entry.flatSort);
        tables.push(t);
        figures.push(f);
        tableIds.push(t.id);
        figureIds.push(f.id);
      }
    }
    const s = section(c, 4, "Résultats descriptifs", paragraphs);
    s.tableIds = tableIds;
    s.figureIds = figureIds;
    sections.push(s);
  }

  if (work.results.bivariate.length > 0) {
    sections.push(section(c, 4, "Résultats bivariés", work.results.bivariate.flatMap((e) => e.block.statements)));
  }

  if (work.results.econometric.length > 0) {
    sections.push(section(c, 4, "Résultats économétriques", work.results.econometric.flatMap((e) => e.block.statements)));
  }

  if (work.results.qualitative.length > 0) {
    sections.push(
      section(
        c,
        4,
        "Résultats qualitatifs",
        work.results.qualitative.flatMap((q) => [`${q.theme} — ${q.block.statements.join(" ")}`])
      )
    );
  }

  sections.push(section(c, 4, "Synthèse des résultats", work.results.synthesis.statements));

  return { id: "chapter-results", number: "4", title: "Résultats", sections };
}

// ------------------------------------------------------------
// CHAPITRE 5 — DISCUSSION (reprend P10 tel quel, jamais recalculée
// ni réinterprétée — voir P12.16)
// ------------------------------------------------------------

function buildDiscussionChapter(
  work: ScientificWork,
  discussion: ScientificDiscussion | undefined,
  annotations: AnnotationMap | undefined,
  tableCounter: ReturnType<typeof createDocumentCounter>,
  tables: ReturnType<typeof buildFlatSortTable>[]
): DocumentChapterModel {
  const c = { n: 0 };
  const sections: DocumentSectionModel[] = [];

  if (discussion && discussion.results.length > 0) {
    for (const result of discussion.results) {
      const subBlocks = [
        result.resultSummary,
        result.economicInterpretation,
        result.hypothesisConfrontation,
        result.theoreticalConfrontation,
        result.literatureComparison,
        result.context,
        result.scientificImplication,
        ...(result.practicalImplication ? [result.practicalImplication] : []),
      ];
      const paragraphs = subBlocks.flatMap((b) => {
        const text = resolveNamedTextParagraphs(annotations, b.id, b.statements).join(" ");
        return text ? [`${b.title} — ${text}`] : [];
      });
      sections.push(section(c, 5, result.resultRef, paragraphs));
    }
  } else {
    sections.push(section(c, 5, "Discussion des principaux résultats", ["Discussion à compléter — aucun résultat n'est encore disponible pour ce projet."]));
  }

  const theoryText =
    discussion?.theoryStatus === "available"
      ? "Cadre théorique enregistré."
      : "Le cadre théorique n'est pas suffisamment renseigné pour produire une confrontation théorique fiable.";
  sections.push(section(c, 5, "Confrontation au cadre théorique", [theoryText]));

  const literatureText =
    discussion && discussion.literature.length > 0
      ? discussion.literature.map((ref) => `${ref.author} (${ref.year}) — ${ref.title}`)
      : ["À compléter. Aucune référence bibliographique structurée n'est encore enregistrée pour ce projet."];
  sections.push(section(c, 5, "Confrontation à la littérature", literatureText));

  const hypothesisTable = buildHypothesisConfrontationTable(tableCounter, work.discussion.hypothesisConfrontations);
  const hypothesisSection = section(
    c,
    5,
    "Confrontation aux hypothèses",
    work.discussion.hypothesisConfrontations.length > 0
      ? ["Voir le tableau de confrontation des hypothèses ci-dessous."]
      : ["Aucune hypothèse active à confronter pour ce projet."]
  );
  if (hypothesisTable) {
    tables.push(hypothesisTable);
    hypothesisSection.tableIds = [hypothesisTable.id];
  }
  sections.push(hypothesisSection);

  if (discussion && discussion.limitations.length > 0) {
    sections.push(
      section(
        c,
        5,
        "Limites",
        discussion.limitations.map((l) => `${l.category} (${l.severity === "detected" ? "limite détectée" : "risque potentiel"}) — ${l.description}`)
      )
    );
  }

  return { id: "chapter-discussion", number: "5", title: "Discussion", sections };
}

function buildConclusionChapter(work: ScientificWork, annotations: AnnotationMap | undefined): DocumentChapterModel {
  const c = { n: 0 };
  const blocks: WorkContentBlock[] = [
    work.conclusion.researchObjectRecall,
    work.conclusion.problemRecall,
    work.conclusion.mainQuestions,
    work.conclusion.methodologySynthesis,
    work.conclusion.mainResults,
    work.conclusion.theoreticalContribution,
    work.conclusion.methodologicalContribution,
    work.conclusion.practicalContribution,
    work.conclusion.limitations,
    work.conclusion.perspectives,
  ];
  const sections = blocks.map((b) => section(c, 6, b.label, resolveBlockParagraphs(annotations, b)));
  return { id: "chapter-conclusion", number: "6", title: "Conclusion", sections };
}

function buildAnnexes(work: ScientificWork): DocumentAnnexModel[] {
  return work.annexes
    .filter((a) => a.available)
    .map((a, i) => ({ id: a.id, number: i + 1, title: a.label, available: true, note: "" }));
}

function buildTableOfContents(chapters: DocumentChapterModel[]): DocumentTocEntry[] {
  const entries: DocumentTocEntry[] = [];
  for (const chapter of chapters) {
    entries.push({ level: 1, number: chapter.number, title: chapter.title });
    for (const s of chapter.sections) {
      entries.push({ level: 2, number: s.number, title: s.title });
    }
  }
  return entries;
}

// ------------------------------------------------------------
// ASSEMBLAGE COMPLET
// ------------------------------------------------------------

export interface BuildDocumentModelInput {
  project: ResearchProject;
  work: ScientificWork;
  discussion?: ScientificDiscussion;
  annotations?: AnnotationMap;
  style?: Partial<DocumentStyle>;
  /**
   * `ScientificWork.type` retombe silencieusement sur "CUSTOM" quand le
   * chercheur n'a jamais choisi de type (P11) — un document ne doit
   * jamais afficher "Personnalisé" dans ce cas comme s'il s'agissait d'un
   * choix réel. Passer `false` restitue le message P12.4 exact.
   */
  workTypeExplicit?: boolean;
}

export function buildDocumentModel(input: BuildDocumentModelInput): DocumentModel {
  const { project, work, discussion, annotations } = input;
  const style: DocumentStyle = { ...DEFAULT_DOCUMENT_STYLE, ...input.style };

  const tableCounter = createDocumentCounter();
  const figureCounter = createDocumentCounter();
  const tables: ReturnType<typeof buildFlatSortTable>[] = [];
  const figures: ReturnType<typeof buildBarFigure>[] = [];

  const introduction = buildIntroductionChapter(work, annotations);
  const literature = buildLiteratureChapter(work, annotations);
  const methodology = buildMethodologyChapter(work, annotations);
  const results = buildResultsChapter(work, tableCounter, figureCounter, tables, figures);
  const disc = buildDiscussionChapter(work, discussion, annotations, tableCounter, tables);
  const conclusion = buildConclusionChapter(work, annotations);

  const chapters = [introduction, literature, methodology, results, disc, conclusion];

  const workTypeLabel =
    input.workTypeExplicit === false ? "Type de document à préciser." : (SCIENTIFIC_WORK_TYPE_LABELS[work.type] ?? "Type de document à préciser.");

  return {
    projectId: project.id,
    workType: work.type,
    workTypeLabel,
    coverPage: resolveCoverPageInfo(project, annotations),
    preliminary: resolvePreliminary(annotations),
    tableOfContents: buildTableOfContents(chapters),
    chapters,
    tables,
    figures,
    annexes: buildAnnexes(work),
    bibliography: buildBibliography(work.bibliography),
    style,
    generatedAt: new Date().toISOString(),
  };
}

export type { ScientificWorkType };
