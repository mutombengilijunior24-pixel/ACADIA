"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";

import { computeDescriptiveStatistics, preparationKey, type DescriptiveReport } from "@/lib/core/analysis/descriptiveStatistics";
import { importFlowReducer, initialImportFlow } from "@/lib/core/data/flow";
import { importFile } from "@/lib/core/data/importer";
import { profileDataset } from "@/lib/core/data/profile";
import type { ImportOptions } from "@/lib/core/data/types";
import { buildUnderstanding } from "@/lib/core/data/understanding";
import type { GeneratedQuestionnaire } from "@/lib/core/questionnaire/QuestionnaireTypes";
import { useResearch } from "@/contexts/ResearchContext";

import DescriptivePanel from "./DescriptivePanel";
import InferentialPanel from "./InferentialPanel";
import { FileDropZone, FileSummary, PreviewStep } from "./ImportStep";
import ProfilePanel from "./ProfilePanel";
import ReadinessPanel from "./ReadinessPanel";
import ResearchPanel, { type StoredQuestionnaire } from "./ResearchPanel";
import VariablesPanel from "./VariablesPanel";
import { buttonClass } from "./ui";

type Tab = "profile" | "variables" | "research" | "readiness" | "descriptive" | "inferential";

const TABS: Array<{ key: Tab; label: string }> = [
  { key: "profile", label: "Profil" },
  { key: "variables", label: "Variables" },
  { key: "research", label: "Recherche" },
  { key: "readiness", label: "Préparation" },
  { key: "descriptive", label: "Analyse descriptive" },
  { key: "inferential", label: "Analyse statistique" },
];

/** Questionnaires ACADIA enregistrés dans ce navigateur (lecture seule, validation minimale de la forme). */
function readStoredQuestionnaires(): StoredQuestionnaire[] {
  const result: StoredQuestionnaire[] = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith("acadia-questionnaire-")) continue;
      try {
        const parsed = JSON.parse(localStorage.getItem(key) ?? "null") as GeneratedQuestionnaire | null;
        if (parsed && typeof parsed.title === "string" && Array.isArray(parsed.sections) && parsed.sections.every((s) => Array.isArray(s.questions))) {
          result.push({ key, questionnaire: parsed });
        }
      } catch {
        // Entrée illisible : ignorée.
      }
    }
  } catch {
    // Stockage indisponible (navigation privée, etc.).
  }
  return result;
}

export default function DataWorkspace() {
  const [state, dispatch] = useReducer(importFlowReducer, initialImportFlow);
  const [tab, setTab] = useState<Tab>("profile");
  const [questionnaires, setQuestionnaires] = useState<StoredQuestionnaire[]>([]);
  const [questionnaireKey, setQuestionnaireKey] = useState<string | null>(null);
  const [report, setReport] = useState<DescriptiveReport | null>(null);
  const [ordinalMeanColumns, setOrdinalMeanColumns] = useState<number[]>([]);
  const fileRef = useRef<File | null>(null);
  const readToken = useRef(0);
  const { currentResearch, currentProject, sample } = useResearch();

  useEffect(() => {
    // Lecture différée : le stockage local n'est disponible qu'après le rendu côté client.
    const timer = window.setTimeout(() => setQuestionnaires(readStoredQuestionnaires()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const read = async (file: File, options: ImportOptions) => {
    const token = ++readToken.current;
    dispatch({ type: "read_started", options });
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await importFile(file.name, bytes, options);
    // Un fichier remplacé entre-temps : ce résultat est ignoré.
    if (token === readToken.current) dispatch({ type: "read_finished", result });
  };

  const onFile = (file: File) => {
    fileRef.current = file;
    setReport(null);
    setOrdinalMeanColumns([]);
    dispatch({ type: "select_file", file: { name: file.name, size: file.size, lastModified: file.lastModified } });
    void read(file, {});
  };

  const replace = () => {
    readToken.current += 1;
    fileRef.current = null;
    setReport(null);
    setOrdinalMeanColumns([]);
    dispatch({ type: "reset" });
  };

  const selectedQuestionnaire = questionnaires.find((item) => item.key === questionnaireKey)?.questionnaire ?? null;

  const profile = useMemo(() => (state.step === "prepared" ? profileDataset(state.dataset, state.preparation) : null), [state]);
  const understanding = useMemo(
    () =>
      state.step === "prepared" && profile
        ? buildUnderstanding({
            dataset: state.dataset,
            profile,
            preparation: state.preparation,
            project: currentProject,
            researchData: currentResearch.title.trim() ? currentResearch : null,
            questionnaire: selectedQuestionnaire,
            sampleSize: currentResearch.populationSize ? sample.sampleSize : null,
          })
        : null,
    [state, profile, currentProject, currentResearch, selectedQuestionnaire, sample],
  );

  return (
    <div className="space-y-6">
      <header className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-700 via-indigo-600 to-sky-500 p-6 text-white shadow-xl shadow-indigo-900/10 sm:p-8">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <p className="relative text-xs font-bold uppercase tracking-[0.18em] text-indigo-100">Données de recherche</p>
        <h1 className="relative mt-2 text-2xl font-extrabold sm:text-4xl">Importer, contrôler et comprendre vos données</h1>
        <p className="relative mt-3 max-w-3xl text-sm leading-relaxed text-indigo-50 sm:text-base">
          Importation, profilage et classification des variables. Analyses descriptives et tests statistiques (Chi², test t de Welch, corrélations, ANOVA) ; la régression multiple n’est pas encore disponible.
        </p>
        <p className="relative mt-4 inline-flex rounded-full bg-white/15 px-3 py-1 text-xs font-medium text-white ring-1 ring-white/25">
          Données conservées dans ce navigateur uniquement — perdues si vous quittez ou rechargez la page
        </p>
      </header>

      {state.step === "empty" ? <FileDropZone onFile={onFile} /> : null}

      {state.step === "reading" || state.step === "preview" ? (
        <PreviewStep
          state={state}
          onOptions={(options) => fileRef.current && void read(fileRef.current, options)}
          onReplace={replace}
          onConfirm={() => {
            dispatch({ type: "confirm" });
            setTab("profile");
          }}
        />
      ) : null}

      {state.step === "prepared" && profile && understanding ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <FileSummary file={state.file} format={state.dataset.format} />
            <div className="flex flex-wrap gap-2">
              <button type="button" className={buttonClass.secondary} onClick={() => dispatch({ type: "back_to_preview" })}>
                Revoir la lecture
              </button>
              <button type="button" className={buttonClass.secondary} onClick={replace}>
                Importer un autre fichier
              </button>
            </div>
          </div>

          <nav className="-mx-1 overflow-x-auto px-1" aria-label="Étapes de préparation">
            <div className="flex w-max gap-2">
              {TABS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  aria-current={tab === item.key ? "page" : undefined}
                  onClick={() => setTab(item.key)}
                  className={`min-h-11 rounded-full px-4 text-sm font-semibold transition ${tab === item.key ? "bg-gradient-to-r from-indigo-600 to-blue-600 text-white shadow-sm shadow-indigo-600/20" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </nav>

          {tab === "profile" ? (
            <ProfilePanel
              dataset={state.dataset}
              profile={profile}
              onExcludeDuplicates={(rows) => dispatch({ type: "operation", input: { type: "exclude_rows", rows, reason: "doublons exacts confirmés par l'utilisateur" } })}
            />
          ) : null}
          {tab === "variables" ? (
            <VariablesPanel
              understanding={understanding}
              profile={profile}
              onConfirmType={(column, statisticalType) => dispatch({ type: "operation", input: { type: "set_statistical_type", column, statisticalType } })}
              onRole={(column, role) => dispatch({ type: "operation", input: { type: "set_role", column, role } })}
              onMissingCodes={(column, values) => dispatch({ type: "operation", input: { type: "declare_missing_codes", column, values } })}
            />
          ) : null}
          {tab === "research" ? (
            <ResearchPanel
              understanding={understanding}
              questionnaires={questionnaires}
              selectedQuestionnaire={selectedQuestionnaire}
              onSelectQuestionnaire={setQuestionnaireKey}
              project={currentProject}
              onMapping={(column, mapping) => dispatch({ type: "operation", input: { type: "set_mapping", column, mapping } })}
            />
          ) : null}
          {tab === "descriptive" ? (
            <DescriptivePanel
              report={report}
              stale={!!report && report.preparationKey !== preparationKey(state.preparation, { ordinalMeanColumns })}
              readyCount={understanding.variables.filter((variable) => variable.analysisReady).length}
              onRun={() => setReport(computeDescriptiveStatistics(state.dataset, state.preparation, understanding.variables, { ordinalMeanColumns }))}
              ordinalMeanColumns={ordinalMeanColumns}
              onToggleOrdinalMean={(column) =>
                setOrdinalMeanColumns((columns) => (columns.includes(column) ? columns.filter((c) => c !== column) : [...columns, column]))
              }
            />
          ) : null}
          {/* Toujours monté (masqué hors de l'onglet) : les choix et résultats survivent aux changements d'onglet. */}
          <div hidden={tab !== "inferential"}>
            <InferentialPanel key={state.dataset.importId} dataset={state.dataset} preparation={state.preparation} variables={understanding.variables} />
          </div>
          {tab === "readiness" ? (
            <ReadinessPanel
              dataset={state.dataset}
              understanding={understanding}
              preparation={state.preparation}
              onConfirmStructure={(family) => dispatch({ type: "operation", input: { type: "confirm_structure", family } })}
              onUndo={(operationId) => dispatch({ type: "undo", operationId })}
            />
          ) : null}
        </>
      ) : null}
    </div>
  );
}
