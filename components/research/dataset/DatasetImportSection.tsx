"use client";

// ============================================================
// ACADIA — IMPORT DE DONNÉES PROPRES (Missions 4-7, bloc 1)
//
// Point d'entrée du parcours "j'ai déjà mes données" : import CSV,
// contrôle de qualité, correspondance colonnes ↔ variables/questions.
// Distinct du dataset généré depuis le questionnaire ACADIA
// (DatasetOverview.tsx) mais partage la même colonne de
// persistance — voir setImportedDataset dans ResearchContext, qui
// tient l'état local à jour pour que la synchronisation globale
// débouncée ne l'efface pas silencieusement.
// ============================================================

import { useCallback, useRef, useState } from "react";
import { CheckCircle2, XCircle, Loader2, UploadCloud, AlertTriangle } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import type { Dataset, DatasetQualityItem, DatasetColumn } from "@/lib/core/dataset/DatasetTypes";
import DatasetQuality from "./DatasetQuality";

interface MappingCandidate {
  questionId: string;
  questionText: string;
  variableId?: string;
  dimensionId?: string;
  indicatorId?: string;
  confidence: number;
  reasons: string[];
}

interface DatasetMappingSuggestion {
  columnId: string;
  columnLabel: string;
  best: MappingCandidate | null;
  alternatives: MappingCandidate[];
}

const MAPPING_STATUS_LABEL: Record<string, string> = {
  proposed: "Proposée par ACADIA — à valider",
  confirmed: "Confirmée",
  user_modified: "Modifiée par vous",
  rejected: "Rejetée",
  unknown: "Aucune correspondance trouvée",
};

export default function DatasetImportSection({ researchId }: { researchId: string }) {
  const { datasets, setImportedDataset } = useResearch();
  const dataset = datasets[researchId];

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [quality, setQuality] = useState<DatasetQualityItem[] | null>(null);

  const [suggestions, setSuggestions] = useState<DatasetMappingSuggestion[] | null>(null);
  const [hasQuestionnaire, setHasQuestionnaire] = useState(true);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestionsError, setSuggestionsError] = useState<string | null>(null);
  const [applyingColumnId, setApplyingColumnId] = useState<string | null>(null);

  const loadSuggestions = useCallback(async () => {
    setLoadingSuggestions(true);
    setSuggestionsError(null);
    try {
      const res = await fetch(`/api/research/${researchId}/dataset/mapping/suggestions`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSuggestionsError(data.error ?? "Impossible de calculer les correspondances.");
        return;
      }
      setSuggestions(data.suggestions ?? []);
      setHasQuestionnaire(Boolean(data.hasQuestionnaire));
    } catch {
      setSuggestionsError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setLoadingSuggestions(false);
    }
  }, [researchId]);

  async function handleUpload(file: File) {
    if (uploading) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/research/${researchId}/dataset/import`, { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUploadError(data.error ?? "Impossible d'importer ce fichier.");
        return;
      }
      const importedDataset = data.dataset as Dataset;
      setImportedDataset(researchId, importedDataset);
      setQuality(data.quality ?? []);
      setSuggestions(null);
      loadSuggestions();
    } catch {
      setUploadError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setUploading(false);
    }
  }

  async function applyMapping(column: DatasetColumn, action: "confirm" | "reject", candidate?: MappingCandidate) {
    setApplyingColumnId(column.id);
    try {
      const res = await fetch(`/api/research/${researchId}/dataset/mapping`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          columnId: column.id,
          action,
          ...(action === "confirm" && candidate
            ? {
                variableId: candidate.variableId,
                dimensionId: candidate.dimensionId,
                indicatorId: candidate.indicatorId,
                sourceQuestionId: candidate.questionId,
              }
            : {}),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSuggestionsError(data.error ?? "Impossible d'enregistrer cette correspondance.");
        return;
      }
      setImportedDataset(researchId, data.dataset as Dataset);
    } catch {
      setSuggestionsError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setApplyingColumnId(null);
    }
  }

  return (
    <section id="dataset-import-section" className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Missions 4-7</p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">Importer mes propres données</h2>
      <p className="mt-1 text-sm text-slate-500">
        Vous avez déjà collecté vos données ailleurs (terrain, Google Forms, KoboCollect...) ? Importez-les
        directement en CSV pour passer au plan d&apos;analyse, à l&apos;interprétation et à la conclusion — sans
        repasser par le questionnaire ACADIA.
      </p>

      {!dataset ? (
        <div className="mt-5 rounded-2xl border-2 border-dashed border-slate-300 p-8 text-center">
          {uploading ? (
            <div className="flex flex-col items-center gap-2 text-slate-500">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Import en cours...</p>
            </div>
          ) : (
            <>
              <UploadCloud className="mx-auto h-8 w-8 text-slate-400" />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="mt-3 inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-acadia-blue-dark"
              >
                Choisir un fichier CSV
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleUpload(file);
                  e.target.value = "";
                }}
              />
              <p className="mt-4 text-2xs text-slate-400">CSV — 10 Mo maximum, 20 000 lignes maximum</p>
            </>
          )}
          {uploadError && (
            <div className="mt-5 flex flex-col items-center gap-2 rounded-xl bg-red-50 px-4 py-3">
              <p className="text-xs font-semibold text-red-600">{uploadError}</p>
              <button type="button" onClick={() => setUploadError(null)} className="text-xs font-semibold text-red-600 underline">
                Réessayer
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="mt-5 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-acadia-blue-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-acadia-blue">{dataset.name}</p>
              <p className="text-xs text-acadia-blue/80">
                {dataset.rows.length} ligne{dataset.rows.length > 1 ? "s" : ""} · {dataset.columns.length} colonne
                {dataset.columns.length > 1 ? "s" : ""}
              </p>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs font-semibold text-acadia-blue underline"
            >
              Réimporter un fichier (remplace ce dataset)
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
                e.target.value = "";
              }}
            />
          </div>

          {quality && quality.length > 0 && (
            <div>
              <p className="mb-2 text-2xs font-bold tracking-wider text-slate-400 uppercase">Contrôle de qualité</p>
              <DatasetQuality
                quality={{
                  items: quality,
                  errorCount: quality.filter((i) => i.severity === "error").length,
                  warningCount: quality.filter((i) => i.severity === "warning" || i.severity === "needs_review").length,
                }}
              />
            </div>
          )}

          <div>
            <div className="flex items-center justify-between">
              <p className="text-2xs font-bold tracking-wider text-slate-400 uppercase">
                Correspondance colonnes → variables
              </p>
              {!suggestions && !loadingSuggestions && (
                <button type="button" onClick={loadSuggestions} className="text-xs font-semibold text-acadia-blue hover:underline">
                  Calculer les correspondances
                </button>
              )}
            </div>

            {loadingSuggestions && (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-500">
                <Loader2 className="h-4 w-4 animate-spin" /> Analyse des colonnes en cours...
              </p>
            )}

            {suggestionsError && <p className="mt-2 text-xs text-red-600">{suggestionsError}</p>}

            {!hasQuestionnaire && suggestions && (
              <p className="mt-2 rounded-xl bg-amber-50 p-3 text-xs text-amber-800">
                Aucun questionnaire ACADIA n&apos;existe pour ce projet — les correspondances ne peuvent pas être
                proposées automatiquement. Vous pouvez tout de même passer au plan d&apos;analyse ; les colonnes
                resteront simplement non associées à vos variables.
              </p>
            )}

            {suggestions && suggestions.length > 0 && (
              <div className="mt-3 space-y-2">
                {dataset.columns.map((column) => {
                  const suggestion = suggestions.find((s) => s.columnId === column.id);
                  const status = column.mappingStatus ?? "unknown";
                  const isPending = status === "proposed" || status === "unknown";
                  const isApplying = applyingColumnId === column.id;

                  return (
                    <div key={column.id} className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-3.5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold text-acadia-navy">{column.label}</p>
                          <span
                            className={`mt-1 inline-block rounded-full px-2 py-0.5 text-2xs font-semibold ${
                              status === "confirmed" || status === "user_modified"
                                ? "bg-emerald-50 text-emerald-700"
                                : status === "rejected"
                                  ? "bg-red-50 text-red-600"
                                  : "bg-amber-50 text-amber-700"
                            }`}
                          >
                            {MAPPING_STATUS_LABEL[status]}
                          </span>
                        </div>
                        {isPending && suggestion?.best && (
                          <div className="flex shrink-0 items-center gap-1.5">
                            {isApplying ? (
                              <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => applyMapping(column, "confirm", suggestion.best!)}
                                  aria-label="Confirmer la correspondance"
                                  className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => applyMapping(column, "reject")}
                                  aria-label="Rejeter la correspondance"
                                  className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                                >
                                  <XCircle className="h-4 w-4" />
                                </button>
                              </>
                            )}
                          </div>
                        )}
                      </div>
                      {suggestion?.best && isPending && (
                        <p className="mt-2 text-xs text-slate-500">
                          Proposition : « {suggestion.best.questionText} » (confiance{" "}
                          {Math.round(suggestion.best.confidence * 100)}%)
                        </p>
                      )}
                      {!suggestion?.best && isPending && (
                        <p className="mt-2 text-xs text-slate-400 italic">
                          Aucune correspondance trouvée automatiquement pour cette colonne.
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="flex items-start gap-2 text-xs text-slate-500">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
              Une fois vos données prêtes, générez le plan d&apos;analyse ci-dessous — ACADIA proposera les tests
              statistiques adaptés à vos variables et hypothèses, jamais l&apos;inverse.
            </p>
          </div>
        </div>
      )}
    </section>
  );
}
