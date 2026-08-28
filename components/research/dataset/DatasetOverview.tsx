"use client";

import { useState } from "react";
import { Database, Sparkles } from "lucide-react";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";
import { checkDatasetQuality, computeDatasetReadiness } from "@/lib/core/dataset/DatasetEngine";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";
import DatasetTable from "./DatasetTable";
import DatasetDictionary from "./DatasetDictionary";
import DatasetQuality from "./DatasetQuality";
import ObservationEditor from "./ObservationEditor";

type ObservationValues = Dataset["rows"][number]["values"];

interface DatasetOverviewProps {
  project: ResearchProject;
  dataset?: Dataset;
  onGenerate: () => void;
  onAddObservation: (values: ObservationValues) => void;
  onUpdateValue: (rowId: string, columnId: string, value: ObservationValues[string]) => void;
  onDeleteObservation: (rowId: string) => void;
}

type Tab = "table" | "dictionary" | "quality";

export default function DatasetOverview({
  project,
  dataset,
  onGenerate,
  onAddObservation,
  onUpdateValue,
  onDeleteObservation,
}: DatasetOverviewProps) {
  const [tab, setTab] = useState<Tab>("table");
  const [addingObservation, setAddingObservation] = useState(false);

  if (!dataset) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">
          Dataset / Préparation des données
        </p>
        <h2 className="mt-1 text-lg font-bold text-acadia-navy">Aucun dataset généré pour le moment</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          ACADIA peut construire la structure de données (colonnes, dictionnaire des variables) à partir de
          l&apos;instrument de collecte déjà accepté — aucune analyse statistique n&apos;a lieu à ce stade.
        </p>
        <div className="mt-4">
          <ResearchPrimaryButton onClick={onGenerate}>
            <Sparkles className="h-4 w-4" />
            Créer le dataset
          </ResearchPrimaryButton>
        </div>
      </section>
    );
  }

  const quality = checkDatasetQuality(dataset);
  const readiness = computeDatasetReadiness(dataset, quality);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
            <Database className="h-3.5 w-3.5" /> Dataset / Préparation des données
          </p>
          <h2 className="mt-1 text-lg font-bold text-acadia-navy">{dataset.name}</h2>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            readiness.analyzable
              ? "bg-emerald-50 text-emerald-700"
              : "bg-amber-50 text-amber-700"
          }`}
        >
          {readiness.label}
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-6">
        <div>
          <span className="text-3xl font-extrabold text-acadia-blue">{dataset.rows.length}</span>
          <span className="ml-2 text-sm text-slate-500">observation(s)</span>
        </div>
        <div>
          <span className="text-3xl font-extrabold text-acadia-blue">{dataset.columns.length}</span>
          <span className="ml-2 text-sm text-slate-500">variable(s)</span>
        </div>
      </div>

      <ReadinessChecklist readiness={readiness} />

      {/* ONGLETS */}
      <div className="mt-6 flex gap-2 border-b border-slate-200">
        <TabButton label="Tableau" active={tab === "table"} onClick={() => setTab("table")} />
        <TabButton
          label="Dictionnaire des données"
          active={tab === "dictionary"}
          onClick={() => setTab("dictionary")}
        />
        <TabButton
          label={`Qualité${quality.errorCount + quality.warningCount > 0 ? ` (${quality.errorCount + quality.warningCount})` : ""}`}
          active={tab === "quality"}
          onClick={() => setTab("quality")}
        />
      </div>

      <div className="mt-5">
        {tab === "table" && (
          <>
            <div className="mb-4">
              <ResearchPrimaryButton onClick={() => setAddingObservation(true)}>
                + Ajouter une observation
              </ResearchPrimaryButton>
            </div>
            <DatasetTable
              dataset={dataset}
              onUpdateValue={onUpdateValue}
              onDeleteObservation={onDeleteObservation}
            />
          </>
        )}
        {tab === "dictionary" && <DatasetDictionary dataset={dataset} project={project} />}
        {tab === "quality" && <DatasetQuality quality={quality} />}
      </div>

      {addingObservation && (
        <ObservationEditor
          dataset={dataset}
          onSave={(values) => {
            onAddObservation(values);
            setAddingObservation(false);
          }}
          onCancel={() => setAddingObservation(false)}
        />
      )}
    </section>
  );
}


function ReadinessChecklist({
  readiness,
}: {
  readiness: ReturnType<typeof computeDatasetReadiness>;
}) {
  const items: { label: string; ok: boolean }[] = [
    { label: "Variables structurées", ok: readiness.variablesStructured },
    { label: "Questions reliées", ok: readiness.questionsLinked },
    { label: "Dictionnaire disponible", ok: readiness.dictionaryAvailable },
    { label: "Observations saisies", ok: readiness.hasObservations },
    { label: "Données analysables", ok: readiness.analyzable },
  ];

  return (
    <div className="mt-5 flex flex-wrap gap-x-6 gap-y-2 rounded-2xl bg-slate-50/70 p-4">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <span className={item.ok ? "text-emerald-600" : "text-amber-500"}>{item.ok ? "✓" : "⚠"}</span>
          {item.label}
        </span>
      ))}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px border-b-2 px-3 py-2 text-sm font-semibold transition ${
        active
          ? "border-acadia-blue text-acadia-blue"
          : "border-transparent text-slate-400 hover:text-slate-600"
      }`}
    >
      {label}
    </button>
  );
}
