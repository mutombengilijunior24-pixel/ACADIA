"use client";

import type { DatasetProfile, ImportedDataset } from "@/lib/core/data/types";

import { STORAGE_LABELS, formatNumber, formatPercent } from "./labels";
import { Metric, Pill, Section, buttonClass } from "./ui";

const READINESS = {
  ready: { label: "Prêt", tone: "green" as const },
  ready_with_warnings: { label: "Prêt avec réserves", tone: "yellow" as const },
  not_ready: { label: "Non prêt", tone: "red" as const },
};

export default function ProfilePanel({
  dataset,
  profile,
  onExcludeDuplicates,
}: {
  dataset: ImportedDataset;
  profile: DatasetProfile;
  onExcludeDuplicates: (rows: number[]) => void;
}) {
  const readiness = READINESS[profile.readiness];
  const duplicates = profile.duplicateGroups.flatMap((group) => group.duplicateRows);

  return (
    <Section
      title="Profil des données"
      description="Calculé sur les observations importées, sans aucune modification. Cellule manquante = absente, vide, blanche, ou code de non-réponse que vous avez confirmé."
      action={<Pill tone={readiness.tone}>{readiness.label}</Pill>}
    >
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
        <Metric label="Lignes analysées" value={profile.rowCount.toLocaleString("fr-FR")} hint={profile.excludedRows ? `${profile.excludedRows} exclue(s)` : undefined} />
        <Metric label="Colonnes" value={profile.columnCount} />
        <Metric label="Cellules manquantes" value={profile.missingCells.toLocaleString("fr-FR")} hint={`${formatPercent(profile.missingCellRate)} des ${profile.totalCells.toLocaleString("fr-FR")} cellules`} />
        <Metric label="Lignes avec manquant" value={profile.rowsWithMissing.toLocaleString("fr-FR")} />
        <Metric label="Lignes vides" value={profile.emptyRows} tone={profile.emptyRows ? "warn" : undefined} />
        <Metric label="Doublons exacts" value={profile.exactDuplicateRows} tone={profile.exactDuplicateRows ? "warn" : undefined} />
        <Metric label="Colonnes ambiguës" value={profile.ambiguousColumns} tone={profile.ambiguousColumns ? "warn" : undefined} />
        <Metric label="Anomalies signalées" value={profile.anomalyCount} hint="invalides + atypiques + doublons + lignes vides + colonnes ambiguës" />
      </div>

      {profile.readinessReasons.length ? (
        <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-700">
          {profile.readinessReasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : null}

      {duplicates.length ? (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <p>
            Lignes identiques à une ligne précédente : {duplicates.slice(0, 10).map((row) => `ligne ${dataset.sourceRows[row]}`).join(", ")}
            {duplicates.length > 10 ? "…" : ""}. Deux répondants peuvent donner exactement les mêmes réponses : rien n&apos;est supprimé automatiquement.
          </p>
          <button type="button" className={`${buttonClass.secondary} mt-2`} onClick={() => onExcludeDuplicates(duplicates)}>
            Exclure ces lignes de l&apos;analyse (réversible)
          </button>
        </div>
      ) : null}

      <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {profile.columns.map((column) => (
          <article key={column.index} className="min-w-0 rounded-2xl border border-slate-200 p-4">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate font-semibold text-slate-900" title={column.originalHeader}>
                  {column.originalHeader.trim() || <em className="text-slate-400">(sans en-tête)</em>}
                </h3>
                <p className="truncate font-mono text-xs text-slate-500">{column.technicalName}</p>
              </div>
              <Pill tone={column.storageType === "ambiguous" ? "yellow" : "neutral"}>{STORAGE_LABELS[column.storageType]}</Pill>
            </div>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Renseignées</dt>
                <dd className="font-semibold tabular-nums">{column.present}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Manquantes</dt>
                <dd className="font-semibold tabular-nums">
                  {column.missing} <span className="text-xs font-normal text-slate-500">({formatPercent(column.missingRate)})</span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Distinctes</dt>
                <dd className="font-semibold tabular-nums">{column.distinct}</dd>
              </div>
            </dl>
            {column.numeric ? (
              <p className="mt-2 text-sm text-slate-700">
                Min {formatNumber(column.numeric.min)} · Max {formatNumber(column.numeric.max)} · Moyenne {formatNumber(column.numeric.mean)} · Médiane {formatNumber(column.numeric.median)}
              </p>
            ) : null}
            {column.dates ? (
              <p className="mt-2 text-sm text-slate-700">
                {column.dates.recognized} date(s) reconnue(s) ({formatPercent(column.dates.recognizedRate)})
                {column.dates.min ? ` · du ${column.dates.min} au ${column.dates.max}` : ""}
              </p>
            ) : null}
            {column.categories ? (
              <ul className="mt-2 space-y-0.5 text-sm text-slate-700">
                {column.categories.top.slice(0, 5).map((category) => (
                  <li key={category.value} className="flex justify-between gap-2">
                    <span className="truncate">{category.value}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {category.count} ({formatPercent(category.frequency)})
                    </span>
                  </li>
                ))}
                {column.categories.distinct > 5 ? <li className="text-xs text-slate-500">+ {column.categories.distinct - 5} autre(s) modalité(s)</li> : null}
              </ul>
            ) : column.examples.length && !column.numeric ? (
              <p className="mt-2 truncate text-sm text-slate-600">Ex. : {column.examples.slice(0, 3).join(" · ")}</p>
            ) : null}
            {column.warnings.length ? (
              <ul className="mt-3 space-y-1 text-xs text-amber-800">
                {column.warnings.map((warning) => (
                  <li key={warning}>⚠ {warning}</li>
                ))}
              </ul>
            ) : null}
          </article>
        ))}
      </div>
    </Section>
  );
}
