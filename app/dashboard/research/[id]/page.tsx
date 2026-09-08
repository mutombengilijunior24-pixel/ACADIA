"use client";

import { useEffect } from "react";
import { useResearch } from "@/contexts/ResearchContext";
import { useRouter, useParams } from "next/navigation";
import { trackClientEvent } from "@/lib/client/trackEvent";
import ResearchConsistencyOverview from "@/components/research/consistency/ResearchConsistencyOverview";
import ResearchChainView from "@/components/research/consistency/ResearchChainView";
import MethodologyOverview from "@/components/research/consistency/MethodologyOverview";
import QuestionnaireOverview from "@/components/research/consistency/QuestionnaireOverview";
import DatasetOverview from "@/components/research/dataset/DatasetOverview";
import AnalysisOverview from "@/components/research/analysis/AnalysisOverview";
import BivariateAnalysisOverview from "@/components/research/analysis/BivariateAnalysisOverview";
import EconometricAnalysisOverview from "@/components/research/analysis/EconometricAnalysisOverview";
import ScientificWorkOverview from "@/components/research/scientific-work/ScientificWorkOverview";
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
    instruments,
    generateInstrument,
    updateInstrumentQuestionText,
    updateInstrumentQuestion,
    addInstrumentQuestion,
    deleteInstrumentQuestion,
    reorderInstrumentQuestion,
    acceptInstrument,
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

  function scrollToSection(sectionId: string) {
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
            Cette recherche n'existe pas ou n'est plus
            disponible.
          </p>

          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mt-6 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700"
          >
            Retour au Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
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
          <div className="grid gap-6 lg:grid-cols-2">
            {/* MÉTHODOLOGIE */}
            <ProjectModule
              icon="🧠"
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

            {/* QUESTIONNAIRE */}
            <ProjectModule
              icon="📝"
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

            {/* COLLECTE */}
            <ProjectModule
              icon="👥"
              title="Collecte"
              status={`${responseCount} réponse${responseCount > 1 ? "s" : ""}`}
              description="Les réponses apparaîtront ici une fois que votre questionnaire sera publié et partagé."
              actionLabel="Voir la collecte"
              onAction={() => scrollToSection("questionnaire-section")}
            />

            {/* ANALYSE */}
            <ProjectModule
              icon="📊"
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
          <div id="methodology-section">
            <MethodologyOverview
              project={scientificProject}
              onValidate={() => validateMethodology(scientificProject.id)}
            />
          </div>
          <ResearchChainView project={scientificProject} />
          <ResearchConsistencyOverview project={scientificProject} />

          {/* ============================================= */}
          {/* INSTRUMENT DE COLLECTE (P4)                    */}
          {/* ============================================= */}

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
            />
          </div>

          {/* ============================================= */}
          {/* DATASET / DONNÉES (P5)                         */}
          {/* ============================================= */}

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

          {/* ============================================= */}
          {/* ANALYSE STATISTIQUE DESCRIPTIVE (P6)           */}
          {/* ============================================= */}

          <div id="analysis-section">
            <AnalysisOverview project={scientificProject} dataset={datasets[scientificProject.id]} />
          </div>

          {/* ============================================= */}
          {/* ANALYSE BIVARIÉE (P7)                          */}
          {/* ============================================= */}

          <BivariateAnalysisOverview project={scientificProject} dataset={datasets[scientificProject.id]} />

          {/* ============================================= */}
          {/* MODÈLE ÉCONOMÉTRIQUE (P8)                      */}
          {/* ============================================= */}

          <EconometricAnalysisOverview project={scientificProject} dataset={datasets[scientificProject.id]} />

          {/* ============================================= */}
          {/* PRODUCTION SCIENTIFIQUE (P11)                  */}
          {/* ============================================= */}

          <ScientificWorkOverview
            project={scientificProject}
            dataset={datasets[scientificProject.id]}
            instrument={instruments[scientificProject.id]}
          />

          {/* ============================================= */}
          {/* DOCUMENT SCIENTIFIQUE FINAL (P12)              */}
          {/* ============================================= */}

          <ExportOverview
            project={scientificProject}
            dataset={datasets[scientificProject.id]}
            instrument={instruments[scientificProject.id]}
          />
        </>
      )}
    </div>
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
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {label}
      </p>

      <p className="mt-2 font-bold text-slate-900">
        {value}
      </p>
    </div>
  );
}

// ======================================================
// PROJECT MODULE
// ======================================================

function ProjectModule({
  icon,
  title,
  status,
  description,
  actionLabel,
  onAction,
  completed = false,
}: {
  icon: string;
  title: string;
  status: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  completed?: boolean;
}) {
  return (
    <div className="rounded-3xl border bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-2xl">
            {icon}
          </div>

          <div>
            <h2 className="text-xl font-bold text-slate-900">
              {title}
            </h2>

            <div className="mt-1 flex items-center gap-2">
              {completed && (
                <span className="text-green-600">
                  ✓
                </span>
              )}

              <span
                className={
                  completed
                    ? "text-sm font-semibold text-green-600"
                    : "text-sm font-semibold text-slate-500"
                }
              >
                {status}
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-5 leading-7 text-slate-600">
        {description}
      </p>

      <button
        type="button"
        onClick={onAction}
        className="mt-6 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-600 hover:text-blue-600"
      >
        {actionLabel} →
      </button>
    </div>
  );
}