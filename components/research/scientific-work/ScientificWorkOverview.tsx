"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { useResearch, type InstrumentRecord } from "@/contexts/ResearchContext";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";
import {
  buildScientificWork,
  formatCitation,
  type AnnotationMap,
} from "@/lib/core/scientific-work/ScientificWorkEngine";
import { validateScientificWork } from "@/lib/core/scientific-work/ScientificWorkValidationEngine";
import {
  SCIENTIFIC_WORK_TYPE_LABELS,
  type BibliographyReference,
  type BibliographyReferenceType,
  type HypothesisConfrontationStatus,
  type ScientificWorkType,
} from "@/lib/core/scientific-work/ScientificWorkTypes";
import AnnotatedBlock from "@/components/research/analysis/AnnotatedBlock";
import ScientificDiscussionOverview from "@/components/research/analysis/ScientificDiscussionOverview";
import ScientificWorkStructure from "./ScientificWorkStructure";
import ScientificWorkSection from "./ScientificWorkSection";
import ScientificWorkValidation from "./ScientificWorkValidation";
import ScientificWorkPreview from "./ScientificWorkPreview";

// ============================================================
// P11 — PRODUCTION SCIENTIFIQUE (structure IRMRD)
//
// « ACADIA propose — le chercheur vérifie — le chercheur valide. »
// Compile en un document unique ce qui a déjà été produit et
// validé par le chercheur dans les blocs précédents (P1-P10),
// sans jamais recalculer ni inventer de contenu. Le type de
// travail (TFC/Mémoire/DEA/Thèse/Article/Personnalisé) n'est
// jamais déduit automatiquement.
// ============================================================

const TYPE_META_BLOCK_ID = "work:meta:type";

const TABS = [
  "structure",
  "introduction",
  "litterature",
  "methodologie",
  "resultats",
  "discussion",
  "conclusion",
  "annexes",
  "bibliographie",
  "validation",
  "apercu",
] as const;

type TabId = (typeof TABS)[number];

const TAB_LABELS: Record<TabId, string> = {
  structure: "Structure",
  introduction: "Introduction",
  litterature: "Littérature",
  methodologie: "Méthodologie",
  resultats: "Résultats",
  discussion: "Discussion",
  conclusion: "Conclusion",
  annexes: "Annexes",
  bibliographie: "Bibliographie",
  validation: "Validation",
  apercu: "Aperçu scientifique",
};

const HYPOTHESIS_STATUS_LABELS: Record<HypothesisConfrontationStatus, string> = {
  to_examine: "À examiner",
  compatible: "Résultat compatible",
  not_compatible: "Résultat non compatible",
  inconclusive: "Inconclusif",
  not_applicable: "Non applicable",
};

const HYPOTHESIS_STATUS_STYLES: Record<HypothesisConfrontationStatus, string> = {
  to_examine: "bg-slate-100 text-slate-600",
  compatible: "bg-emerald-50 text-emerald-700",
  not_compatible: "bg-red-50 text-red-700",
  inconclusive: "bg-amber-50 text-amber-700",
  not_applicable: "bg-slate-100 text-slate-500",
};

const BIBLIOGRAPHY_TYPE_LABELS: Record<BibliographyReferenceType, string> = {
  book: "Ouvrage",
  article: "Article",
  report: "Rapport",
  conference: "Actes de conférence",
  website: "Site web",
  thesis: "Thèse / mémoire",
  other: "Autre",
};

interface ProgressStep {
  key: string;
  label: string;
  done: boolean;
}

export default function ScientificWorkOverview({
  project,
  dataset,
  instrument,
}: {
  project: ResearchProject;
  dataset?: Dataset;
  instrument?: InstrumentRecord;
}) {
  const { annotations, setAnnotation, bibliography, addBibliographyReference, removeBibliographyReference } = useResearch();
  const [tab, setTab] = useState<TabId>("structure");

  const researchId = project.id;
  const forResearch = annotations[researchId];
  const referencesForResearch = useMemo(() => bibliography[researchId] ?? [], [bibliography, researchId]);

  const storedType = forResearch?.[TYPE_META_BLOCK_ID]?.editedContent as ScientificWorkType | undefined;
  const type: ScientificWorkType = storedType && SCIENTIFIC_WORK_TYPE_LABELS[storedType] ? storedType : "CUSTOM";
  const typeLabel = storedType && SCIENTIFIC_WORK_TYPE_LABELS[storedType] ? SCIENTIFIC_WORK_TYPE_LABELS[storedType] : "Type de travail à préciser";

  const work = useMemo(
    () => buildScientificWork(project, type, dataset, instrument, forResearch as AnnotationMap | undefined, referencesForResearch),
    [project, type, dataset, instrument, forResearch, referencesForResearch]
  );

  const isDatasetStale = useMemo(() => computeStaleness(dataset, forResearch), [dataset, forResearch]);

  const validation = useMemo(() => validateScientificWork(project, work, dataset, isDatasetStale), [project, work, dataset, isDatasetStale]);

  const mainQuestion = project.researchQuestions.find((q) => q.type === "main") ?? project.researchQuestions[0];
  const hasRealEconometricResult = work.results.econometric.some((e) => e.blockId !== "work:results:econ:unavailable");
  const hasInterpretation = work.results.bivariate.length > 0 || hasRealEconometricResult;
  const hasResults = work.results.descriptive.length > 0 || work.results.bivariate.length > 0 || hasRealEconometricResult || work.results.qualitative.length > 0;

  const steps: ProgressStep[] = [
    { key: "question", label: "Question", done: Boolean(mainQuestion) },
    { key: "objectifs", label: "Objectifs", done: project.objectives.length > 0 },
    { key: "methodologie", label: "Méthodologie", done: Boolean(project.methodology?.approach) },
    { key: "donnees", label: "Données", done: Boolean(dataset && dataset.rows.length > 0) },
    { key: "resultats", label: "Résultats", done: hasResults },
    { key: "interpretation", label: "Interprétation", done: hasInterpretation },
    { key: "discussion", label: "Discussion", done: work.discussion.hypothesisConfrontations.length > 0 || project.researchType === "qualitative" },
    { key: "conclusion", label: "Conclusion", done: !work.conclusion.mainResults.hasPlaceholder },
  ];

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
        <FileText className="h-3.5 w-3.5" /> Production scientifique
      </p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">{project.title}</h2>
      <p className="mt-1 text-xs italic text-slate-400">ACADIA propose — le chercheur vérifie — le chercheur valide.</p>

      {/* TYPE DE TRAVAIL — jamais déduit automatiquement (P11.3) */}
      <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl bg-slate-50/70 p-3.5">
        <label className="text-xs font-semibold text-slate-500" htmlFor="work-type-select">
          Type de travail :
        </label>
        <select
          id="work-type-select"
          value={storedType ?? ""}
          onChange={(e) => {
            const value = e.target.value as ScientificWorkType | "";
            if (value) setAnnotation(researchId, TYPE_META_BLOCK_ID, { status: "edited", editedContent: value });
          }}
          className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-acadia-navy"
        >
          <option value="">{typeLabel}</option>
          {(Object.keys(SCIENTIFIC_WORK_TYPE_LABELS) as ScientificWorkType[]).map((t) => (
            <option key={t} value={t}>
              {SCIENTIFIC_WORK_TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {/* PROGRESSION */}
      <div className="mt-4 flex flex-wrap gap-2">
        {steps.map((s) => (
          <span
            key={s.key}
            className={`rounded-full px-3 py-1 text-2xs font-bold uppercase tracking-wider ${
              s.done ? "bg-acadia-blue-50 text-acadia-blue" : "bg-slate-100 text-slate-400"
            }`}
          >
            {s.label}
          </span>
        ))}
      </div>

      {/* NAVIGATION */}
      <div className="mt-5 flex flex-wrap gap-1.5 border-b border-slate-200 pb-3">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition ${
              tab === t ? "bg-acadia-blue text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "structure" && <ScientificWorkStructure structure={work.structure} />}

        {tab === "introduction" && (
          <ScientificWorkSection
            researchId={researchId}
            title="Introduction"
            blocks={[
              work.introduction.context,
              work.introduction.researchProblem,
              work.introduction.justification,
              work.introduction.researchQuestion,
              work.introduction.objectives,
              work.introduction.hypotheses,
              work.introduction.methodologySummary,
              work.introduction.delimitation,
              work.introduction.workStructure,
            ]}
          />
        )}

        {tab === "litterature" && (
          <ScientificWorkSection
            researchId={researchId}
            title="Revue de littérature"
            blocks={[
              work.literatureReview.conceptualFramework,
              work.literatureReview.theoreticalFramework,
              work.literatureReview.theoreticalStudies,
              work.literatureReview.empiricalStudies,
              work.literatureReview.positioning,
            ]}
          />
        )}

        {tab === "methodologie" && (
          <ScientificWorkSection
            researchId={researchId}
            title="Méthodologie"
            blocks={[
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
            ]}
          />
        )}

        {tab === "resultats" && (
          <div className="space-y-6">
            <AnnotatedBlock
              researchId={researchId}
              blockId={work.results.fieldPresentation.id}
              title={work.results.fieldPresentation.label}
              statements={work.results.fieldPresentation.statements}
              compact
            />

            {work.results.descriptive.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Résultats descriptifs</p>
                {work.results.descriptive.map((d) => (
                  <div key={d.columnId} className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4">
                    <p className="text-sm font-semibold text-acadia-navy">
                      {d.label} <span className="font-normal text-slate-400">(N = {d.validN})</span>
                    </p>
                    <div className="mt-2 space-y-1 text-sm text-slate-600">
                      {d.block.statements.map((s, i) => (
                        <p key={i}>{s}</p>
                      ))}
                    </div>
                    {d.flatSort && d.flatSort.length > 0 && (
                      <div className="mt-3 overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="text-slate-400">
                              <th className="pb-1 pr-4 font-semibold">Modalité</th>
                              <th className="pb-1 pr-4 font-semibold">Effectif</th>
                              <th className="pb-1 font-semibold">Pourcentage</th>
                            </tr>
                          </thead>
                          <tbody>
                            {d.flatSort.map((row) => (
                              <tr key={row.modality} className="border-t border-slate-200/70">
                                <td className="py-1 pr-4 text-slate-700">{row.modality}</td>
                                <td className="py-1 pr-4 text-slate-700">{row.count}</td>
                                <td className="py-1 text-slate-700">{row.percentage.toFixed(1)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {work.results.bivariate.length > 0 && (
              <ValidatedResultsBlock title="Résultats bivariés" entries={work.results.bivariate} />
            )}

            {work.results.econometric.length > 0 && (
              <ValidatedResultsBlock title="Résultats économétriques" entries={work.results.econometric} />
            )}

            {work.results.qualitative.length > 0 && (
              <div className="space-y-3">
                <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Résultats qualitatifs</p>
                {work.results.qualitative.map((q) => (
                  <div key={q.themeId} className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4">
                    <p className="text-sm font-semibold text-acadia-navy">{q.theme}</p>
                    {q.block.statements.map((s, i) => (
                      <p key={i} className="mt-1 text-sm text-slate-600">
                        {s}
                      </p>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <AnnotatedBlock
              researchId={researchId}
              blockId={work.results.synthesis.id}
              title={work.results.synthesis.label}
              statements={work.results.synthesis.statements}
              compact
            />

            {work.results.bivariate.length === 0 && work.results.econometric.length === 0 && (
              <p className="text-xs text-slate-400">
                Aucun résultat bivarié ou économétrique validé n&apos;est encore intégré ici — validez une
                interprétation dans la section « Interprétation économique » ci-dessus pour qu&apos;elle apparaisse
                dans ce document.
              </p>
            )}
          </div>
        )}

        {tab === "discussion" && (
          <div className="space-y-6">
            <ScientificDiscussionOverview project={project} dataset={dataset} model={null} isStale={isDatasetStale} />

            <div>
              <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Confrontation des hypothèses</p>
              {work.discussion.hypothesisConfrontations.length === 0 ? (
                <p className="mt-2 text-sm text-slate-500">Aucune hypothèse active à confronter pour ce projet.</p>
              ) : (
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="pb-2 pr-4 font-semibold">Hypothèse</th>
                        <th className="pb-2 pr-4 font-semibold">Variable(s)</th>
                        <th className="pb-2 pr-4 font-semibold">Test utilisé</th>
                        <th className="pb-2 pr-4 font-semibold">Résultat statistique</th>
                        <th className="pb-2 pr-4 font-semibold">Interprétation</th>
                        <th className="pb-2 font-semibold">Statut</th>
                      </tr>
                    </thead>
                    <tbody>
                      {work.discussion.hypothesisConfrontations.map((h) => (
                        <tr key={h.hypothesisId} className="border-t border-slate-200/70 align-top">
                          <td className="py-2 pr-4 text-slate-700">{h.statement}</td>
                          <td className="py-2 pr-4 text-slate-700">{h.variableLabels.join(", ") || "—"}</td>
                          <td className="py-2 pr-4 text-slate-700">{h.testUsed}</td>
                          <td className="py-2 pr-4 text-slate-700">{h.statisticalResult}</td>
                          <td className="py-2 pr-4 max-w-xs text-slate-600">{h.interpretation}</td>
                          <td className="py-2">
                            <span className={`rounded-full px-2 py-0.5 text-2xs font-bold ${HYPOTHESIS_STATUS_STYLES[h.status]}`}>
                              {HYPOTHESIS_STATUS_LABELS[h.status]}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "conclusion" && (
          <ScientificWorkSection
            researchId={researchId}
            title="Conclusion"
            blocks={[
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
            ]}
          />
        )}

        {tab === "annexes" && (
          <div className="space-y-2">
            {work.annexes.map((a) => (
              <div key={a.id} className="flex items-center gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5">
                <span className={a.available ? "text-emerald-600" : "text-slate-300"}>{a.available ? "✓" : "—"}</span>
                <p className="text-sm font-semibold text-acadia-navy">{a.label}</p>
                <span className="ml-auto text-2xs text-slate-400">{a.available ? "Disponible" : "Non disponible"}</span>
              </div>
            ))}
          </div>
        )}

        {tab === "bibliographie" && (
          <BibliographyTab
            researchId={researchId}
            references={referencesForResearch}
            onAdd={(ref) => addBibliographyReference(researchId, ref)}
            onRemove={(id) => removeBibliographyReference(researchId, id)}
          />
        )}

        {tab === "validation" && <ScientificWorkValidation validation={validation} />}

        {tab === "apercu" && <ScientificWorkPreview researchId={researchId} work={work} />}
      </div>
    </section>
  );
}

// ============================================================
// STALENESS — le dataset a-t-il changé depuis la dernière
// analyse bivariée/économétrique validée intégrée au document ?
// ============================================================

function computeStaleness(dataset: Dataset | undefined, forResearch: Record<string, { status: string; updatedAt: string }> | undefined): boolean {
  if (!dataset || !forResearch) return false;
  const datasetUpdated = new Date(dataset.updatedAt).getTime();
  const relevant = Object.entries(forResearch).filter(
    ([id, rec]) => (id.startsWith("interp:bivariate:") || id.startsWith("interp:econ:")) && (rec.status === "accepted" || rec.status === "edited")
  );
  if (relevant.length === 0) return false;
  return relevant.some(([, rec]) => new Date(rec.updatedAt).getTime() < datasetUpdated);
}

// ============================================================
// RÉSULTATS VALIDÉS (bivariés / économétriques) — affichage
// factuel en lecture seule ; l'édition se fait à la source
// (section Interprétation économique), même enregistrement
// d'annotation, jamais un second point d'édition dupliqué.
// ============================================================

function ValidatedResultsBlock({ title, entries }: { title: string; entries: { blockId: string; label: string; block: { statements: string[] } }[] }) {
  return (
    <div className="space-y-3">
      <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">{title}</p>
      {entries.map((e) => (
        <div key={e.blockId} className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4">
          <p className="text-sm font-semibold text-acadia-navy">{e.label}</p>
          {e.block.statements.map((s, i) => (
            <p key={i} className="mt-1 text-sm text-slate-600">
              {s}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

// ============================================================
// BIBLIOGRAPHIE — jamais de référence inventée, uniquement ce
// que le chercheur ajoute explicitement (P11.20).
// ============================================================

function BibliographyTab({
  researchId,
  references,
  onAdd,
  onRemove,
}: {
  researchId: string;
  references: BibliographyReference[];
  onAdd: (ref: BibliographyReference) => void;
  onRemove: (id: string) => void;
}) {
  const [author, setAuthor] = useState("");
  const [year, setYear] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState<BibliographyReferenceType>("book");
  const [publisher, setPublisher] = useState("");
  const [journal, setJournal] = useState("");

  const sorted = [...references].sort((a, b) => a.author.localeCompare(b.author));

  function submit() {
    if (!author.trim() || !title.trim()) return;
    onAdd({
      id: `bib-${researchId}-${Date.now()}`,
      author: author.trim(),
      year: year.trim() ? Number(year.trim()) : undefined,
      title: title.trim(),
      publisher: publisher.trim() || undefined,
      journal: journal.trim() || undefined,
      type,
    });
    setAuthor("");
    setYear("");
    setTitle("");
    setPublisher("");
    setJournal("");
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Références enregistrées</p>
        {sorted.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Aucune référence enregistrée.</p>
        ) : (
          <div className="mt-2 space-y-2">
            {sorted.map((ref) => (
              <div key={ref.id} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5">
                <div>
                  <p className="text-sm text-slate-700">{formatCitation(ref)}</p>
                  <span className="text-2xs text-slate-400">{BIBLIOGRAPHY_TYPE_LABELS[ref.type]}</span>
                </div>
                <button type="button" onClick={() => onRemove(ref.id)} className="text-2xs font-semibold text-red-500 hover:text-red-700">
                  Retirer
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-slate-300 p-4">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Ajouter une référence</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <input
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            placeholder="Auteur(s)"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
          />
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            placeholder="Année"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
          />
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm sm:col-span-2"
          />
          <input
            value={publisher}
            onChange={(e) => setPublisher(e.target.value)}
            placeholder="Éditeur (optionnel)"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
          />
          <input
            value={journal}
            onChange={(e) => setJournal(e.target.value)}
            placeholder="Revue (optionnel)"
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm"
          />
          <select
            value={type}
            onChange={(e) => setType(e.target.value as BibliographyReferenceType)}
            className="rounded-xl border border-slate-200 px-3 py-1.5 text-sm sm:col-span-2"
          >
            {(Object.keys(BIBLIOGRAPHY_TYPE_LABELS) as BibliographyReferenceType[]).map((t) => (
              <option key={t} value={t}>
                {BIBLIOGRAPHY_TYPE_LABELS[t]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={submit}
          className="mt-3 rounded-xl bg-acadia-blue px-4 py-2 text-xs font-bold text-white hover:opacity-90"
        >
          Ajouter la référence
        </button>
      </div>
    </div>
  );
}
