"use client";

// ============================================================
// ACADIA SURVEY — Nouvelle enquête
//
// Deux chemins : "Travailler avec ACADIA" (formulaire guidé, génère un
// questionnaire structuré via le moteur méthodologique IA — voir
// lib/core/survey/SurveyGenerationEngine.ts et
// lib/ai/openai/SurveyQuestionnaireAI.ts) et "Importer un
// questionnaire" (extraction + restructuration d'un document DOCX).
// La génération peut échouer (OpenAI indisponible, réponse invalide) :
// jamais de bouton figé — erreur claire + bouton "Réessayer" toujours
// disponibles.
// ============================================================

import { Suspense, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles, FileUp, X, Plus, Loader2, Wand2, Check } from "lucide-react";
import type { ExtractedQuestion, ExtractedQuestionnaire, ExtractedQuestionType } from "@/lib/ai/openai/SurveyDocumentAI";

type Mode = "choice" | "guided" | "import";

const TOTAL_STEPS = 5;

const TYPE_LABELS: Record<ExtractedQuestionType, string> = {
  short_text: "Texte court",
  long_text: "Texte long",
  single_choice: "Choix unique",
  multiple_choice: "Choix multiple",
  scale: "Échelle",
  boolean: "Oui / Non",
  number: "Nombre",
  age: "Âge",
  date: "Date",
  institution: "Institution",
  faculty: "Faculté / École",
  level: "Niveau d'étude",
  category: "Catégorie du répondant",
};

interface RestructurePair {
  original: ExtractedQuestion;
  proposed: ExtractedQuestion;
  changed: boolean;
}

// Purement visuel : une seule requête réelle est envoyée au serveur —
// ces intitulés ne prétendent jamais représenter des étapes backend
// distinctes, seulement faire patienter pendant le traitement réel.
const PROCESSING_STEPS = [
  "ACADIA analyse votre demande...",
  "ACADIA structure les thèmes...",
  "ACADIA prépare les questions...",
  "ACADIA vérifie la cohérence...",
];

function NewSurveyForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams.get("mode") === "import" ? "import" : searchParams.get("mode") === "guided" ? "guided" : "choice";

  const [mode, setMode] = useState<Mode>(initialMode as Mode);
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [problem, setProblem] = useState("");
  const [targetAudience, setTargetAudience] = useState("");
  const [institution, setInstitution] = useState("");
  const [categories, setCategories] = useState<string[]>(["Étudiant", "Enseignant"]);
  const [newCategory, setNewCategory] = useState("");
  const [measure, setMeasure] = useState({ institution: true, faculty: true, level: true, age: true, sex: true });
  const [targetResponses, setTargetResponses] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(true);

  // Importer un questionnaire (DOCX)
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [importUploading, setImportUploading] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importTitle, setImportTitle] = useState("");
  const [importQuestions, setImportQuestions] = useState<ExtractedQuestion[] | null>(null);
  const [restructuring, setRestructuring] = useState(false);
  const [restructurePairs, setRestructurePairs] = useState<RestructurePair[] | null>(null);
  const [acceptedProposals, setAcceptedProposals] = useState<Record<number, boolean>>({});
  const [creatingImport, setCreatingImport] = useState(false);

  function addCategory() {
    const v = newCategory.trim();
    if (v && !categories.includes(v)) setCategories([...categories, v]);
    setNewCategory("");
  }

  async function handleImportUpload(file: File) {
    if (importUploading) return;
    setImportUploading(true);
    setImportError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/survey/import", { method: "POST", body: formData });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(data.error ?? "Impossible d'analyser ce document.");
        return;
      }
      const questionnaire = data.questionnaire as ExtractedQuestionnaire;
      setImportTitle(questionnaire.title);
      setImportQuestions(questionnaire.questions);
      setRestructurePairs(null);
      setAcceptedProposals({});
    } catch {
      setImportError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setImportUploading(false);
    }
  }

  async function handleRestructure() {
    if (restructuring || !importQuestions) return;
    setRestructuring(true);
    setImportError(null);
    try {
      const res = await fetch("/api/survey/import/restructure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questions: importQuestions }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(data.error ?? "Impossible de restructurer ce questionnaire.");
        return;
      }
      const pairs = data.pairs as RestructurePair[];
      setRestructurePairs(pairs);
      const defaults: Record<number, boolean> = {};
      pairs.forEach((p, i) => {
        defaults[i] = p.changed;
      });
      setAcceptedProposals(defaults);
    } catch {
      setImportError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setRestructuring(false);
    }
  }

  function finalImportQuestions(): ExtractedQuestion[] {
    if (!restructurePairs) return importQuestions ?? [];
    return restructurePairs.map((p, i) => (acceptedProposals[i] ? p.proposed : p.original));
  }

  async function handleCreateFromImport() {
    if (creatingImport) return;
    setCreatingImport(true);
    setImportError(null);
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imported: { title: importTitle, questions: finalImportQuestions() } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(data.error ?? "Impossible de créer l'enquête pour le moment.");
        return;
      }
      router.push(`/dashboard/survey/${data.survey.id}`);
    } catch {
      setImportError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      setCreatingImport(false);
    }
  }

  async function handleCreate() {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    setProcessingStep(0);
    const interval = setInterval(() => {
      setProcessingStep((s) => Math.min(s + 1, PROCESSING_STEPS.length - 1));
    }, 900);
    try {
      const res = await fetch("/api/survey", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: {
            title,
            objective,
            problem: problem || undefined,
            targetAudience: targetAudience || undefined,
            institution: institution || undefined,
            categories,
            measure,
            isAnonymous,
            targetResponses: targetResponses ? Number(targetResponses) : undefined,
          },
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Impossible de créer l'enquête pour le moment.");
        return;
      }
      router.push(`/dashboard/survey/${data.survey.id}`);
    } catch {
      setError("Impossible de contacter le serveur. Vérifiez votre connexion et réessayez.");
    } finally {
      clearInterval(interval);
      setSubmitting(false);
    }
  }

  if (mode === "choice") {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <Link href="/dashboard/survey" className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-acadia-blue">
            <ArrowLeft className="h-3.5 w-3.5" /> Retour
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-acadia-navy sm:text-3xl">Nouvelle enquête</h1>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setMode("import")}
              className="rounded-3xl border border-slate-200 bg-white p-6 text-left transition hover:border-acadia-blue hover:bg-acadia-blue-50/40"
            >
              <FileUp className="h-6 w-6 text-acadia-blue" />
              <p className="mt-4 font-bold text-acadia-navy">Importer un questionnaire</p>
              <p className="mt-1 text-sm text-slate-500">À partir d&apos;un document existant (Word).</p>
            </button>
            <button
              type="button"
              onClick={() => setMode("guided")}
              className="rounded-3xl border border-slate-200 bg-white p-6 text-left transition hover:border-acadia-blue hover:bg-acadia-blue-50/40"
            >
              <Sparkles className="h-6 w-6 text-acadia-blue" />
              <p className="mt-4 font-bold text-acadia-navy">Travailler avec ACADIA</p>
              <p className="mt-1 text-sm text-slate-500">ACADIA vous accompagne pour structurer votre enquête.</p>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === "import") {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-3xl">
          <button
            type="button"
            onClick={() => (importQuestions ? setImportQuestions(null) : setMode("choice"))}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-acadia-blue"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Retour
          </button>
          <h1 className="mt-4 text-2xl font-bold text-acadia-navy sm:text-3xl">Importer votre questionnaire</h1>

          {!importQuestions ? (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleImportUpload(file);
              }}
              className={`mt-8 rounded-3xl border-2 border-dashed p-10 text-center transition ${dragOver ? "border-acadia-blue bg-acadia-blue-50/40" : "border-slate-300 bg-white"}`}
            >
              {importUploading ? (
                <div className="flex flex-col items-center gap-3 text-acadia-blue">
                  <Loader2 className="h-8 w-8 animate-spin" />
                  <p className="text-sm font-semibold">ACADIA analyse votre questionnaire...</p>
                </div>
              ) : (
                <>
                  <FileUp className="mx-auto h-10 w-10 text-slate-300" />
                  <p className="mt-4 font-semibold text-slate-700">Déposez votre fichier ici</p>
                  <p className="mt-1 text-sm text-slate-500">ou</p>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-acadia-blue-dark"
                  >
                    Choisir un fichier
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleImportUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <p className="mt-4 text-2xs text-slate-400">DOCX — 8 Mo maximum</p>
                </>
              )}
              {importError && (
                <div className="mt-5 flex flex-col items-center gap-2 rounded-xl bg-red-50 px-4 py-3">
                  <p className="text-xs font-semibold text-red-600">{importError}</p>
                  <button type="button" onClick={() => setImportError(null)} className="text-xs font-semibold text-red-600 underline">
                    Réessayer
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-8 space-y-6">
              <div className="rounded-2xl bg-acadia-blue-50 px-4 py-3 text-sm font-semibold text-acadia-blue">
                ACADIA a identifié {importQuestions.length} question{importQuestions.length > 1 ? "s" : ""}.
              </div>

              <label className="block text-sm font-semibold text-slate-600">
                Titre de l&apos;enquête
                <input value={importTitle} onChange={(e) => setImportTitle(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-acadia-blue focus:outline-none" />
              </label>

              {!restructurePairs ? (
                <div className="space-y-3">
                  {importQuestions.map((q, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <p className="text-sm font-semibold text-acadia-navy">{q.text}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-2xs text-slate-500">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 font-semibold">{TYPE_LABELS[q.type]}</span>
                        {q.options.length > 0 && <span>{q.options.length} option{q.options.length > 1 ? "s" : ""}</span>}
                        {q.required && <span className="font-semibold text-acadia-blue">Obligatoire</span>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-slate-600">Proposition ACADIA</p>
                  {restructurePairs.map((p, i) => (
                    <div key={i} className="rounded-2xl border border-slate-200 bg-white p-4">
                      {p.changed ? (
                        <>
                          <p className="text-2xs font-semibold uppercase tracking-wide text-slate-400">Question originale</p>
                          <p className="text-sm text-slate-500 line-through decoration-slate-300">{p.original.text}</p>
                          <p className="mt-2 text-2xs font-semibold uppercase tracking-wide text-acadia-blue">Proposition ACADIA</p>
                          <p className="text-sm font-semibold text-acadia-navy">{p.proposed.text}</p>
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() => setAcceptedProposals((prev) => ({ ...prev, [i]: true }))}
                              className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-2xs font-semibold ${acceptedProposals[i] ? "bg-acadia-blue text-white" : "border border-slate-200 text-slate-600"}`}
                            >
                              <Check className="h-3 w-3" /> Accepter
                            </button>
                            <button
                              type="button"
                              onClick={() => setAcceptedProposals((prev) => ({ ...prev, [i]: false }))}
                              className={`rounded-lg px-3 py-1.5 text-2xs font-semibold ${!acceptedProposals[i] ? "bg-slate-900 text-white" : "border border-slate-200 text-slate-600"}`}
                            >
                              Conserver l&apos;originale
                            </button>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm font-semibold text-acadia-navy">{p.original.text}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {importError && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{importError}</p>}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={restructuring}
                  onClick={handleRestructure}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  {restructuring ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                  {restructuring ? "ACADIA restructure vos questions..." : "Restructurer avec ACADIA"}
                </button>
                <button
                  type="button"
                  disabled={creatingImport || !importTitle.trim()}
                  onClick={handleCreateFromImport}
                  className="inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-6 py-3 text-sm font-semibold text-white hover:bg-acadia-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creatingImport ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
                  {creatingImport ? "Création en cours..." : "Créer l'enquête"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // mode === "guided"
  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-2xl">
        <button type="button" onClick={() => (step === 0 ? setMode("choice") : setStep((s) => s - 1))} className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-acadia-blue">
          <ArrowLeft className="h-3.5 w-3.5" /> {step === 0 ? "Retour" : "Étape précédente"}
        </button>

        <h1 className="mt-4 text-2xl font-bold text-acadia-navy">Travaillons ensemble sur votre enquête</h1>
        <p className="mt-1 text-sm text-slate-500">Étape {step + 1} / {TOTAL_STEPS}</p>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-acadia-blue transition-all" style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%` }} />
        </div>

        <div className="mt-8 rounded-3xl border border-slate-200 bg-white p-6 sm:p-8">
          {step === 0 && (
            <div className="space-y-5">
              <label className="block text-sm font-semibold text-slate-600">
                Quel est le titre de votre enquête ?
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-acadia-blue focus:outline-none" placeholder="Ex. Révision des maquettes curriculaires" />
              </label>
              <label className="block text-sm font-semibold text-slate-600">
                Quel est l&apos;objectif principal de l&apos;enquête ?
                <textarea value={objective} onChange={(e) => setObjective(e.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-acadia-blue focus:outline-none" />
              </label>
              <label className="block text-sm font-semibold text-slate-600">
                Quel problème cherchez-vous à comprendre ? <span className="font-normal text-slate-400">(optionnel)</span>
                <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-acadia-blue focus:outline-none" />
              </label>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <label className="block text-sm font-semibold text-slate-600">
                Qui sont les personnes ciblées ?
                <input value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-acadia-blue focus:outline-none" placeholder="Ex. Étudiants et enseignants de la faculté" />
              </label>
              <label className="block text-sm font-semibold text-slate-600">
                Quelle institution / organisation concerne l&apos;enquête ? <span className="font-normal text-slate-400">(optionnel)</span>
                <input value={institution} onChange={(e) => setInstitution(e.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-acadia-blue focus:outline-none" />
              </label>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="text-sm font-semibold text-slate-600">Quelles catégories de personnes doivent répondre ?</p>
              <div className="flex flex-wrap gap-2">
                {categories.map((c) => (
                  <span key={c} className="inline-flex items-center gap-1.5 rounded-full bg-acadia-blue-50 px-3 py-1.5 text-xs font-semibold text-acadia-blue">
                    {c}
                    <button type="button" onClick={() => setCategories(categories.filter((x) => x !== c))} aria-label={`Retirer ${c}`}>
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addCategory())}
                  placeholder="Ajouter une catégorie"
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-acadia-blue focus:outline-none"
                />
                <button type="button" onClick={addCategory} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-slate-600">Quelles informations souhaitez-vous mesurer ?</p>
              {([
                ["institution", "Institution"],
                ["faculty", "Faculté / École"],
                ["level", "Niveau d'étude"],
                ["age", "Âge"],
                ["sex", "Sexe"],
              ] as const).map(([key, label]) => (
                <label key={key} className="flex items-center gap-3 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    checked={measure[key]}
                    onChange={(e) => setMeasure({ ...measure, [key]: e.target.checked })}
                    className="h-4 w-4 rounded border-slate-300 text-acadia-blue focus:ring-acadia-blue"
                  />
                  {label}
                </label>
              ))}
              <label className="flex items-center gap-3 pt-2 text-sm text-slate-700">
                <input type="checkbox" checked={isAnonymous} onChange={(e) => setIsAnonymous(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-acadia-blue focus:ring-acadia-blue" />
                L&apos;enquête doit être anonyme
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-5">
              <label className="block text-sm font-semibold text-slate-600">
                Combien de réponses souhaitez-vous obtenir ? <span className="font-normal text-slate-400">(optionnel)</span>
                <input
                  type="number"
                  min={1}
                  value={targetResponses}
                  onChange={(e) => setTargetResponses(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-acadia-blue focus:outline-none"
                  placeholder="Ex. 2000"
                />
              </label>
              <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                <p className="font-semibold text-acadia-navy">Récapitulatif</p>
                <p className="mt-2">« {title || "Titre à définir"} »</p>
                <p className="mt-1 text-xs text-slate-400">Catégories : {categories.join(", ") || "aucune"}</p>
              </div>
              {submitting && (
                <div className="flex items-center gap-3 rounded-xl bg-acadia-blue-50 px-4 py-3 text-sm font-semibold text-acadia-blue">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin" /> {PROCESSING_STEPS[processingStep]}
                </div>
              )}
              {error && (
                <div className="flex flex-col items-start gap-2 rounded-xl bg-red-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs font-semibold text-red-600">{error}</p>
                  <button
                    type="button"
                    onClick={handleCreate}
                    className="shrink-0 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-100"
                  >
                    Réessayer
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end">
          {step < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              disabled={step === 0 && !title.trim()}
              onClick={() => setStep((s) => s + 1)}
              className="inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-6 py-3 text-sm font-semibold text-white transition hover:bg-acadia-blue-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Continuer <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              type="button"
              disabled={submitting || !title.trim()}
              onClick={handleCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-acadia-blue px-6 py-3 text-sm font-semibold text-white transition hover:bg-acadia-blue-dark disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {submitting ? "Génération en cours..." : "Générer le questionnaire"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function NewSurveyPage() {
  return (
    <Suspense>
      <NewSurveyForm />
    </Suspense>
  );
}
