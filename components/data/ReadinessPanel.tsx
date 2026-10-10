"use client";

import { Undo2 } from "lucide-react";

import { describeOperation } from "@/lib/core/data/preparation";
import type { DataStructureFamily, ImportedDataset, PreparationState, UnderstandingState } from "@/lib/core/data/types";

import { CONFIDENCE_LABELS, STRUCTURE_LABELS } from "./labels";
import { Pill, Section, buttonClass } from "./ui";

export default function ReadinessPanel({
  dataset,
  understanding,
  preparation,
  onConfirmStructure,
  onUndo,
}: {
  dataset: ImportedDataset;
  understanding: UnderstandingState;
  preparation: PreparationState;
  onConfirmStructure: (family: DataStructureFamily | null) => void;
  onUndo: (operationId: string) => void;
}) {
  const relevant = understanding.variables.filter((v) => v.effectiveType !== "unclassified").length;

  return (
    <div className="space-y-5">
      <Section
        title="État de préparation"
        description="La préparation peut réussir même si des décisions méthodologiques restent ouvertes. Le choix d'une analyse ne sera possible qu'une fois ces décisions prises (chantier suivant)."
        action={
          <div className="flex flex-wrap gap-1.5">
            <Pill tone={understanding.dataPrepared ? "green" : "red"}>{understanding.dataPrepared ? "Données préparées" : "Données non exploitables"}</Pill>
            <Pill tone={understanding.readyForAnalysisSelection ? "green" : "yellow"}>
              {understanding.readyForAnalysisSelection ? "Prêt pour le choix des analyses" : "Décisions à prendre"}
            </Pill>
          </div>
        }
      >
        <p className="text-sm text-slate-700">
          {understanding.analysisReadyColumns} colonne(s) sur {relevant} ont un type certain ou confirmé et pourront être utilisées par les futurs moteurs d&apos;analyse. Aucun test statistique n&apos;est calculé à cette étape.
        </p>

        <h3 className="mt-5 text-sm font-semibold text-slate-900">Structure des données (proposition révisable)</h3>
        <ul className="mt-2 space-y-2">
          {understanding.structure.map((candidate) => (
            <li key={candidate.family} className="flex flex-wrap items-start justify-between gap-2 rounded-2xl bg-slate-50 p-3 text-sm">
              <div className="min-w-0">
                <p className="font-medium text-slate-900">
                  {STRUCTURE_LABELS[candidate.family]} <span className="text-xs font-normal text-slate-500">· {CONFIDENCE_LABELS[candidate.confidence]}</span>
                </p>
                <ul className="mt-1 text-xs text-slate-600">
                  {candidate.evidence.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
              {candidate.status === "confirmed" ? (
                <Pill tone="green">Confirmée</Pill>
              ) : (
                <button type="button" className={buttonClass.secondary} onClick={() => onConfirmStructure(candidate.family)}>
                  Confirmer
                </button>
              )}
            </li>
          ))}
        </ul>
        {understanding.confirmedStructure ? (
          <button type="button" className={`${buttonClass.ghost} mt-2`} onClick={() => onConfirmStructure(null)}>
            Remettre la structure en question
          </button>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          <List title="Questions à résoudre" items={understanding.questionsForUser} empty="Aucune question en suspens." tone="text-slate-800" />
          <List title="Ambiguïtés" items={understanding.ambiguities} empty="Aucune ambiguïté." tone="text-amber-800" />
          <List title="Informations manquantes" items={understanding.missingInformation} empty="Aucune information manquante." tone="text-slate-600" />
        </div>
      </Section>

      <Section title="Journal des décisions" description="Chaque décision est horodatée et réversible. Les données importées ne sont jamais modifiées.">
        {preparation.operations.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune décision pour le moment.</p>
        ) : (
          <ol className="space-y-2">
            {[...preparation.operations].reverse().map((operation) => (
              <li key={operation.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3 text-sm">
                <span className="min-w-0 text-slate-800">
                  {describeOperation(operation, dataset)}
                  <span className="ml-2 text-xs text-slate-500">{new Date(operation.at).toLocaleTimeString("fr-FR")}</span>
                </span>
                <button type="button" className={buttonClass.ghost} onClick={() => onUndo(operation.id)}>
                  <Undo2 size={16} aria-hidden /> Annuler
                </button>
              </li>
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

function List({ title, items, empty, tone }: { title: string; items: string[]; empty: string; tone: string }) {
  return (
    <div className="min-w-0">
      <h3 className="text-sm font-semibold text-slate-900">
        {title} ({items.length})
      </h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-slate-500">{empty}</p>
      ) : (
        <ul className={`mt-1 space-y-1 text-sm ${tone}`}>
          {items.map((item) => (
            <li key={item}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
