"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Brain, FileText, Users, BarChart3, Database, Check } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import PageContainer from "@/components/layout/PageContainer";
import { useRouter, useParams } from "next/navigation";
import { trackClientEvent } from "@/lib/client/trackEvent";
import ResearchConsistencyOverview from "@/components/research/consistency/ResearchConsistencyOverview";
import ResearchChainView from "@/components/research/consistency/ResearchChainView";
import MethodologyOverview from "@/components/research/consistency/MethodologyOverview";
import QuestionnaireOverview from "@/components/research/consistency/QuestionnaireOverview";
import DatasetOverview from "@/components/research/dataset/DatasetOverview";
import DatasetImportSection from "@/components/research/dataset/DatasetImportSection";
import ResearchStageProgress from "@/components/research/ResearchStageProgress";
import CollapsibleSection from "@/components/research/CollapsibleSection";
import DeepAnalysisSection from "@/components/research/consistency/DeepAnalysisSection";
import AnalysisOverview from "@/components/research/analysis/AnalysisOverview";
import BivariateAnalysisOverview from "@/components/research/analysis/BivariateAnalysisOverview";
import EconometricAnalysisOverview from "@/components/research/analysis/EconometricAnalysisOverview";
import ScientificWorkOverview from "@/components/research/scientific-work/ScientificWorkOverview";
import WritingOverview from "@/components/research/writing/WritingOverview";
import ExportOverview from "@/components/research/export/ExportOverview";
import { computeResearchProgress } from "@/lib/core/dashboard/ResearchProgressEngine";
import SubmitVersionButton from "@/components/supervision/SubmitVersionButton";

// ------------------------------------------------------------
// CORRECTIF (P2.4) — `params` est une Promise depuis Next.js 15
// dans les Server Components ; côté Client Component, l'API
// stable pour lire le paramètre de route dynamique est le hook
// useParams(), qui évite d'avoir à `use()` une prop `params`
// dont la forme réelle avait dérivé de son type déclaré.
// Bug préexistant (non lié à ce bloc) : la page affichait
// systématiquement "Projet introuvable" quel que soit l'id,
// car `params.id` valait toujours undefined à l'exécution.
// ------------------------------------------------------------

export default function ResearchProjectPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = typeof params.id === "string" ? params.id : "";

  const {
    researches,
    currentProject,
    projects,
    validateMethodology,
    updateMethodologyFields,
    instruments,
    generateInstrument,
    updateInstrumentQuestionText,
    updateInstrumentQuestion,
    addInstrumentQuestion,
    deleteInstrumentQuestion,
    reorderInstrumentQuestion,
    acceptInstrument,
    setImportedInstrument,
    datasets,
    generateDataset,
    addObservation,
    updateObservationValue,
    deleteObservation,
    theoreticalFramework,
    exportHistory,
  } = useResearch();

  const research = researches.find(
    (item) => item.id === id
  );

  // Repli par grande étape (Bloc E, Temps 2) — `undefined` pour une
  // clé signifie "pas encore de préférence explicite de l'étudiant",
  // auquel cas `isGroupOpen` retombe sur le comportement par défaut
  // (ouvert seulement pour l'étape en cours).
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (id) trackClientEvent("PROJECT_OPENED", { projectId: id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // --------------------------------------------------------
  // Le projet scientifique complet (variables/relations/
  // hypothèses/méthodologie) est lu depuis la persistance
  // (survit au rechargement) — currentProject ne sert que de
  // repli si l'analyse vient d'être faite mais pas encore
  // "enregistrée" dans cette même session.
  // --------------------------------------------------------

  const scientificProject =
    projects[id] ??
    (currentProject?.id === id ? currentProject : undefined);

  // --------------------------------------------------------
  // P15 — progression réelle (remplace l'ancien `research.progress`,
  // toujours figé à 0 à la création et jamais recalculé depuis —
  // voir ACADIA_P14_AUDIT.md / ResearchProgressEngine, P14).
  // --------------------------------------------------------

  const progress = scientificProject
    ? computeResearchProgress(
        scientificProject,
        theoreticalFramework[id] ?? [],
        instruments[id],
        (exportHistory[id]?.length ?? 0) > 0
      )
    : null;

  // --------------------------------------------------------
  // 6 GRANDES ÉTAPES (MVP simplification, 10/09/2026) —
  // remonté ici (hors JSX) pour que le calcul des statuts serve
  // à la fois à la frise ResearchStageProgress et au repli par
  // grande étape (Bloc E, Temps 2, 11/09/2026) plus bas sur la
  // page, sans dupliquer la logique.
  // --------------------------------------------------------

  const methodologyDoneForStages = scientificProject?.methodology.status === "accepted";
  const instrumentForStages = instruments[id];
  const instrumentAcceptedForStages = instrumentForStages?.status === "accepted";
  const responseCountForStages = instrumentForStages?.questionnaire?.publication?.responseCount ?? 0;
  const datasetForStages = datasets[id];
  const observationCountForStages = datasetForStages?.rows?.length ?? 0;
  const understoodForStages = Boolean(scientificProject?.problem && (scientificProject?.objectives.length ?? 0) > 0);
  // Valider l'instrument est déjà un jalon réel en soi (même sans
  // réponse ni dataset importé) — ne pas le compter laissait
  // l'étape "Collecter mes données" bloquée sur "current" alors
  // que l'étudiant venait de terminer l'action attendue ici.
  const collectedForStages = responseCountForStages > 0 || Boolean(datasetForStages) || instrumentAcceptedForStages;
  const exportedForStages = (exportHistory[id]?.length ?? 0) > 0;

  function stageStatus(done: boolean, unlocked: boolean): "done" | "current" | "upcoming" {
    if (done) return "done";
    return unlocked ? "current" : "upcoming";
  }

  const stages = [
    { key: "understand", label: "Comprendre ma recherche", status: stageStatus(understoodForStages, true), sectionId: "methodology-section" },
    { key: "methodology", label: "Construire ma méthodologie", status: stageStatus(methodologyDoneForStages, understoodForStages), sectionId: "methodology-section" },
    { key: "collect", label: "Collecter mes données", status: stageStatus(collectedForStages, methodologyDoneForStages), sectionId: "questionnaire-section" },
    { key: "analyze", label: "Analyser mes données", status: stageStatus(observationCountForStages > 0, collectedForStages), sectionId: "analysis-section" },
    // Ancre réelle (auparavant absente, l'étape restait bloquée sur
    // "upcoming" en dur) — "fait" une fois qu'un export a été produit,
    // puisque le document exporté contient le chapitre d'interprétation.
    { key: "interpret", label: "Interpréter mes résultats", status: stageStatus(exportedForStages, observationCountForStages > 0), sectionId: "interpretation-section" },
    // Mission 9 (Research Writing Engine) — même ancre de disponibilité
    // que "interpret" (aucun état dédié suivi ici : WritingOverview
    // affiche lui-même son propre état réel une fois ouvert).
    { key: "write", label: "Rédiger mon travail", status: stageStatus(exportedForStages, observationCountForStages > 0), sectionId: "writing-section" },
    { key: "finalize", label: "Finaliser mon travail", status: stageStatus(exportedForStages, observationCountForStages > 0), sectionId: "export-section" },
  ];

  // Groupe repliable auquel appartient chaque grande étape — les
  // étapes "understand" et "methodology" partagent déjà la même
  // ancre (`methodology-section`) et sont donc fusionnées en un seul
  // groupe repliable ci-dessous.
  const STAGE_TO_GROUP: Record<string, string> = {
    understand: "understand",
    methodology: "understand",
    collect: "collect",
    analyze: "analyze",
    interpret: "interpret",
    write: "write",
    finalize: "finalize",
  };
  const SECTION_TO_GROUP: Record<string, string> = {
    "methodology-section": "understand",
    "questionnaire-section": "collect",
    "dataset-import-section": "collect",
    "analysis-section": "analyze",
    "interpretation-section": "interpret",
    "writing-section": "write",
    "export-section": "finalize",
  };
  const currentStage = stages.find((s) => s.status === "current");
  const currentGroupKey = currentStage ? STAGE_TO_GROUP[currentStage.key] : "understand";

  function isGroupOpen(groupKey: string) {
    return openGroups[groupKey] ?? groupKey === currentGroupKey;
  }

  function toggleGroup(groupKey: string) {
    setOpenGroups((previous) => ({ ...previous, [groupKey]: !isGroupOpen(groupKey) }));
  }

  function groupStatusFor(groupKey: string): "done" | "current" | "upcoming" {
    const groupStages = stages.filter((s) => STAGE_TO_GROUP[s.key] === groupKey);
    if (groupStages.every((s) => s.status === "done")) return "done";
    if (groupStages.some((s) => s.status === "current")) return "current";
    return "upcoming";
  }

  function scrollToSection(sectionId: string) {
    const groupKey = SECTION_TO_GROUP[sectionId];
    if (groupKey && !isGroupOpen(groupKey)) {
      setOpenGroups((previous) => ({ ...previous, [groupKey]: true }));
      // Laisse React remonter le contenu replié dans le DOM avant de
      // faire défiler vers lui — sans ce délai, l'élément ciblé
      // n'existe pas encore au moment du scrollIntoView.
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      });
      return;
    }
    document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // ==================================================
  // Projet introuvable
  // ==================================================

  if (!research) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center">
        <div className="rounded-3xl border bg-white p-10 text-center shadow-sm">
          <h1 className="text-2xl font-bold text-slate-900">
            Projet introuvable
          </h1>

          <p className="mt-3 text-slate-500">
            Cette recherche n&apos;existe pas ou n&apos;est plus
            disponible.
          </p>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="bg-acadia-gradient mt-6 rounded-xl px-6 py-3 font-semibold text-white hover:brightness-110"
          >
            Retour au Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
    <div className="space-y-8">
      {/* ================================================= */}
      {/* EN-TÊTE */}
      {/* ================================================= */}

      <div>
        <button
          type="button"
          onClick={() => router.push("/dashboard")}
          className="mb-5 text-sm font-semibold text-slate-500 hover:text-blue-600"
        >
          ← Mes recherches
        </button>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-600">
              Projet de recherche
            </p>

            <h1 className="mt-2 max-w-4xl text-3xl font-bold tracking-tight text-slate-900 lg:text-4xl">
              {research.title}
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {progress && (
              <div className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                {progress.percent}% terminé
              </div>
            )}
            {scientificProject && (
              <SubmitVersionButton
                researchId={id}
                project={scientificProject}
                instrument={instruments[id]}
                theoreticalFramework={theoreticalFramework[id] ?? []}
              />
            )}
          </div>
        </div>
      </div>

      {/* ================================================= */}
      {/* INFORMATIONS RAPIDES */}
      {/* ================================================= */}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <InfoCard
          label="Domaine"
          value={research.domain || "—"}
        />

        <InfoCard
          label="Niveau"
          value={research.level || "—"}
        />

        <InfoCard
          label="Université"
          value={research.university || "—"}
        />

        <InfoCard
          label="Type"
          value={research.researchType || "—"}
        />
      </div>

      {/* ================================================= */}
      {/* PROGRESSION */}
      {/* ================================================= */}

      {progress && (
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                Progression du projet
              </p>

              <p className="mt-1 text-2xl font-bold text-slate-900">
                {progress.percent}%
              </p>
            </div>

            {scientificProject?.methodology.status === "accepted" && (
              <span className="rounded-full bg-green-50 px-3 py-1 text-sm font-semibold text-green-700">
                Méthodologie terminée
              </span>
            )}
          </div>

          <div className="mt-5 h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-blue-600 transition-all"
              style={{
                width: `${progress.percent}%`,
              }}
            />
          </div>

          {progress.nextStep && (
            <p className="mt-3 text-xs text-slate-500">
              Prochaine étape : <span className="font-semibold text-acadia-navy">{progress.nextStep.label}</span>
            </p>
          )}
        </div>
      )}

      {/* ================================================= */}
      {/* 6 GRANDES ÉTAPES (MVP simplification, 10/09/2026)  */}
      {/* ================================================= */}

      {scientificProject && <ResearchStageProgress stages={stages} onNavigate={scrollToSection} />}

      {/* ================================================= */}
      {/* ANALYSE EN PROFONDEUR (10/09/2026)                 */}
      {/* ================================================= */}

      {scientificProject && <DeepAnalysisSection project={scientificProject} />}

      {/* ================================================= */}
      {/* MODULES */}
      {/* ================================================= */}

      {(() => {
        const methodologyDone = scientificProject?.methodology.status === "accepted";
        const instrument = instruments[id];
        const hasInstrument = Boolean(instrument?.questionnaire || instrument?.interviewGuide);
        const instrumentAccepted = instrument?.status === "accepted";
        const responseCount = instrument?.questionnaire?.publication?.responseCount ?? 0;
        const dataset = datasets[id];
        const observationCount = dataset?.rows?.length ?? 0;

        return (
          <div className="space-y-6">
            {/* Les 4 modules du parcours principal — un vrai duo de */}
            {/* colonnes premium plutôt qu'un empilement dense. */}
            <div className="grid gap-6 sm:grid-cols-2">
              <ProjectModule
                icon={<Brain className="h-6 w-6" />}
                accent={{ halo: "bg-acadia-blue/10", line: "bg-acadia-blue", iconBox: "bg-gradient-to-br from-acadia-blue to-acadia-navy" }}
                title="Méthodologie"
                status={methodologyDone ? "Terminée" : "À valider"}
                description={
                  methodologyDone
                    ? "Vous avez validé la proposition méthodologique d'ACADIA."
                    : "ACADIA a préparé une proposition méthodologique à examiner et valider."
                }
                actionLabel="Voir la méthodologie"
                onAction={() => scrollToSection("methodology-section")}
                completed={methodologyDone}
              />

              <ProjectModule
                icon={<FileText className="h-6 w-6" />}
                accent={{ halo: "bg-violet-500/10", line: "bg-violet-500", iconBox: "bg-gradient-to-br from-violet-500 to-violet-700" }}
                title="Questionnaire"
                status={!hasInstrument ? "Pas encore créé" : instrumentAccepted ? "Validé" : "Généré — à valider"}
                description={
                  hasInstrument
                    ? "Votre instrument de collecte est prêt — vous pouvez encore le modifier."
                    : "ACADIA peut construire votre questionnaire à partir de votre sujet, vos objectifs, vos variables et vos indicateurs."
                }
                actionLabel={hasInstrument ? "Voir le questionnaire" : "Générer mon questionnaire"}
                onAction={() => scrollToSection("questionnaire-section")}
                completed={instrumentAccepted}
              />

              <ProjectModule
                icon={<Users className="h-6 w-6" />}
                accent={{ halo: "bg-emerald-500/10", line: "bg-emerald-500", iconBox: "bg-gradient-to-br from-emerald-500 to-emerald-700" }}
                title="Collecte"
                status={`${responseCount} réponse${responseCount > 1 ? "s" : ""}`}
                description="Les réponses apparaîtront ici une fois que votre questionnaire sera publié et partagé."
                actionLabel="Voir la collecte"
                onAction={() => scrollToSection("questionnaire-section")}
              />

              <ProjectModule
                icon={<BarChart3 className="h-6 w-6" />}
                accent={{ halo: "bg-amber-500/10", line: "bg-amber-500", iconBox: "bg-gradient-to-br from-amber-500 to-amber-600" }}
                title="Analyse"
                status={observationCount > 0 ? `${observationCount} observation${observationCount > 1 ? "s" : ""}` : "En attente"}
                description={
                  observationCount > 0
                    ? "Des données sont disponibles pour l'analyse statistique."
                    : "Les analyses statistiques seront disponibles après la collecte des réponses."
                }
                actionLabel="Voir les analyses"
                onAction={() => scrollToSection("analysis-section")}
                completed={observationCount > 0}
              />
            </div>

            {/* IMPORT DE DONNÉES PROPRES (Missions 4-7) — un chemin */}
            {/* alternatif, pas une 5e étape du même pipeline : sorti */}
            {/* de la grille pour éviter la carte esseulée en fin de */}
            {/* ligne et pour marquer sa nature de raccourci. */}
            <div className="flex flex-col items-start justify-between gap-4 rounded-3xl border border-dashed border-slate-300 bg-slate-50/60 p-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-700">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-acadia-navy">J&apos;ai déjà mes données</p>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {dataset
                      ? "Dataset importé."
                      : "Vous avez collecté vos données ailleurs ? Importez-les en CSV pour passer directement à l'analyse."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => scrollToSection("dataset-import-section")}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-acadia-blue hover:text-acadia-blue"
              >
                {dataset ? "Voir mon dataset" : "Importer mes données"} →
              </button>
            </div>
          </div>
        );
      })()}

      {/* ================================================= */}
      {/* MÉTHODOLOGIE / CHAÎNAGE / COHÉRENCE SCIENTIFIQUE   */}
      {/*                                                   */}
      {/* scientificProject provient de la persistance        */}
      {/* (localStorage) : survit à un rechargement, ne       */}
      {/* nécessite pas de relancer A1/A2.                     */}
      {/* ================================================= */}

      {scientificProject && (
        <>
          {/* ============================================= */}
          {/* COMPRENDRE MA RECHERCHE / MÉTHODOLOGIE         */}
          {/* ============================================= */}

          <CollapsibleSection
            title="Comprendre ma recherche & construire ma méthodologie"
            summary="Sujet, objectifs, cadre théorique, hypothèses, variables, méthodologie"
            status={groupStatusFor("understand")}
            open={isGroupOpen("understand")}
            onToggle={() => toggleGroup("understand")}
          >
            <div id="methodology-section">
              <MethodologyOverview
                project={scientificProject}
                onValidate={() => validateMethodology(scientificProject.id)}
                onContinue={() => scrollToSection("questionnaire-section")}
                onUpdateFields={(changes) => updateMethodologyFields(scientificProject.id, changes)}
              />
            </div>
            <ResearchChainView project={scientificProject} />
            <ResearchConsistencyOverview project={scientificProject} />
          </CollapsibleSection>

          {/* ============================================= */}
          {/* COLLECTER MES DONNÉES                          */}
          {/* ============================================= */}

          <CollapsibleSection
            title="Collecter mes données"
            summary="Questionnaire, dataset, import de données"
            status={groupStatusFor("collect")}
            open={isGroupOpen("collect")}
            onToggle={() => toggleGroup("collect")}
          >
            <div id="questionnaire-section">
              <QuestionnaireOverview
                project={scientificProject}
                questionnaire={instruments[scientificProject.id]?.questionnaire}
                interviewGuide={instruments[scientificProject.id]?.interviewGuide}
                status={instruments[scientificProject.id]?.status ?? "draft"}
                onGenerate={() => generateInstrument(scientificProject.id)}
                onEditQuestion={(questionId, text) =>
                  updateInstrumentQuestionText(scientificProject.id, questionId, text)
                }
                onUpdateQuestion={(questionId, patch) =>
                  updateInstrumentQuestion(scientificProject.id, questionId, patch)
                }
                onAddQuestion={(sectionId, payload) =>
                  addInstrumentQuestion(scientificProject.id, sectionId, payload)
                }
                onDeleteQuestion={(questionId) =>
                  deleteInstrumentQuestion(scientificProject.id, questionId)
                }
                onReorderQuestion={(questionId, direction) =>
                  reorderInstrumentQuestion(scientificProject.id, questionId, direction)
                }
                onAccept={() => acceptInstrument(scientificProject.id)}
                onContinue={() => scrollToSection("dataset-import-section")}
                onImport={(imported) => setImportedInstrument(scientificProject.id, imported)}
              />
            </div>

            {(instruments[scientificProject.id]?.questionnaire ||
              instruments[scientificProject.id]?.interviewGuide) && (
              <DatasetOverview
                project={scientificProject}
                dataset={datasets[scientificProject.id]}
                onGenerate={() => generateDataset(scientificProject.id)}
                onAddObservation={(values) => addObservation(scientificProject.id, values)}
                onUpdateValue={(rowId, columnId, value) =>
                  updateObservationValue(scientificProject.id, rowId, columnId, value)
                }
                onDeleteObservation={(rowId) => deleteObservation(scientificProject.id, rowId)}
              />
            )}

            <DatasetImportSection researchId={scientificProject.id} />
          </CollapsibleSection>

          {/* ============================================= */}
          {/* ANALYSER MES DONNÉES                           */}
          {/* ============================================= */}

          <CollapsibleSection
            title="Analyser mes données"
            summary="Statistique descriptive, analyse bivariée, modèle économétrique"
            status={groupStatusFor("analyze")}
            open={isGroupOpen("analyze")}
            onToggle={() => toggleGroup("analyze")}
          >
            <div id="analysis-section">
              <AnalysisOverview project={scientificProject} dataset={datasets[scientificProject.id]} />
            </div>
            <BivariateAnalysisOverview project={scientificProject} dataset={datasets[scientificProject.id]} />
            <EconometricAnalysisOverview project={scientificProject} dataset={datasets[scientificProject.id]} />
          </CollapsibleSection>

          {/* ============================================= */}
          {/* INTERPRÉTER MES RÉSULTATS                      */}
          {/* ============================================= */}

          <CollapsibleSection
            title="Interpréter mes résultats"
            summary="Production scientifique, confrontation aux hypothèses"
            status={groupStatusFor("interpret")}
            open={isGroupOpen("interpret")}
            onToggle={() => toggleGroup("interpret")}
          >
            <div id="interpretation-section">
              <ScientificWorkOverview
                project={scientificProject}
                dataset={datasets[scientificProject.id]}
                instrument={instruments[scientificProject.id]}
              />
            </div>
          </CollapsibleSection>

          {/* ============================================= */}
          {/* RÉDIGER MON TRAVAIL (Mission 9)                */}
          {/* ============================================= */}

          <CollapsibleSection
            title="Rédiger mon travail"
            summary="Introduction, problématique, méthodologie, discussion et conclusion en prose académique"
            status={groupStatusFor("write")}
            open={isGroupOpen("write")}
            onToggle={() => toggleGroup("write")}
          >
            <div id="writing-section">
              <WritingOverview project={scientificProject} />
            </div>
          </CollapsibleSection>

          {/* ============================================= */}
          {/* FINALISER MON TRAVAIL                          */}
          {/* ============================================= */}

          <CollapsibleSection
            title="Finaliser mon travail"
            summary="Export du document scientifique final"
            status={groupStatusFor("finalize")}
            open={isGroupOpen("finalize")}
            onToggle={() => toggleGroup("finalize")}
          >
            <div id="export-section">
              <ExportOverview
                project={scientificProject}
                dataset={datasets[scientificProject.id]}
                instrument={instruments[scientificProject.id]}
              />
            </div>
          </CollapsibleSection>
        </>
      )}
    </div>
    </PageContainer>
  );
}

// ======================================================
// INFO CARD
// ======================================================

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
      <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>

      <p className="mt-1.5 truncate font-semibold text-acadia-navy">
        {value}
      </p>
    </div>
  );
}

// ======================================================
// PROJECT MODULE
//
// Bloc J (refonte visuelle, 11/09/2026) — reprend le traitement déjà
// éprouvé par components/dashboard/StatsCard.tsx (halo décoratif,
// liseré dégradé, icône dans un caisson coloré avec micro-animation
// au survol) plutôt que le cercle gris plat + emoji d'origine.
// ======================================================

interface ProjectModuleAccent {
  halo: string;
  line: string;
  iconBox: string;
}

function ProjectModule({
  icon,
  accent,
  title,
  status,
  description,
  actionLabel,
  onAction,
  completed = false,
}: {
  icon: ReactNode;
  accent: ProjectModuleAccent;
  title: string;
  status: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  completed?: boolean;
}) {
  return (
    <div className="group relative overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className={`absolute -right-10 -top-10 h-40 w-40 rounded-full blur-3xl ${accent.halo}`} />
      <div className={`absolute inset-x-0 top-0 h-1 ${accent.line}`} />

      <div className="relative z-10 flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-white shadow-md transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${accent.iconBox}`}
          >
            {icon}
          </div>

          <div>
            <h2 className="text-lg font-bold text-acadia-navy">
              {title}
            </h2>

            <div className="mt-1 flex items-center gap-1.5">
              {completed && <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={3} />}

              <span
                className={
                  completed
                    ? "text-sm font-semibold text-emerald-600"
                    : "text-sm font-semibold text-slate-500"
                }
              >
                {status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="relative z-10 mt-5 text-sm leading-6 text-slate-600">
        {description}
      </p>

      <button
        type="button"
        onClick={onAction}
        className="relative z-10 mt-6 inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:border-acadia-blue hover:text-acadia-blue"
      >
        {actionLabel} →
      </button>
    </div>
  );
}