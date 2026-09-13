"use client";

import { useState } from "react";
import {
  CheckCircle2,
  AlertTriangle,
  Pencil,
  Sparkles,
  Trash2,
  ChevronUp,
  ChevronDown,
  Plus,
  X,
  Loader2,
  ArrowRight,
  Upload,
} from "lucide-react";
import { analyzeInstrument } from "@/lib/core/questionnaire/QuestionnaireGenerationEngine";
import {
  LIKERT_OPTIONS,
  FREQUENCY_OPTIONS,
  YES_NO_OPTIONS,
} from "@/lib/core/questionnaire/QuestionnaireEngine";
import {
  computeQuestionnaireGenerationReadiness,
  buildQuestionnaireGenerationSummary,
} from "@/lib/core/questionnaire/QuestionnaireReadiness";
import { explainQuestion, type QuestionExplanation } from "@/lib/core/questionnaire/QuestionnaireTraceability";
import { HelpCircle } from "lucide-react";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type {
  GeneratedQuestionnaire,
  QuestionnaireQuestion,
  QuestionnaireOption,
  QuestionType,
  InterviewGuide,
} from "@/lib/core/questionnaire/QuestionnaireTypes";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";
import { useResearch } from "@/contexts/ResearchContext";

interface AddQuestionPayload {
  text: string;
  type: QuestionType;
  variableId?: string;
  dimensionId?: string;
  indicatorId?: string;
  variable?: string;
  dimension?: string;
  indicator?: string;
}

interface QuestionnaireOverviewProps {
  project: ResearchProject;
  questionnaire?: GeneratedQuestionnaire;
  interviewGuide?: InterviewGuide;
  status: "draft" | "accepted";
  onGenerate: () => Promise<void>;
  onEditQuestion: (questionId: string, text: string) => void;
  onUpdateQuestion: (questionId: string, patch: Partial<QuestionnaireQuestion>) => void;
  onAddQuestion: (sectionId: string, payload: AddQuestionPayload) => void;
  onDeleteQuestion: (questionId: string) => void;
  onReorderQuestion: (questionId: string, direction: "up" | "down") => void;
  onAccept: () => void;
  onContinue?: () => void;
  onImport?: (questionnaire: GeneratedQuestionnaire) => void;
}

export default function QuestionnaireOverview({
  project,
  questionnaire,
  interviewGuide,
  status,
  onGenerate,
  onEditQuestion,
  onUpdateQuestion,
  onAddQuestion,
  onDeleteQuestion,
  onReorderQuestion,
  onAccept,
  onContinue,
  onImport,
}: QuestionnaireOverviewProps) {

  const { theoreticalFramework } = useResearch();
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importText, setImportText] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleGenerate() {
    setIsGenerating(true);
    setGenerationError(null);
    try {
      await onGenerate();
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : "ACADIA n'a pas pu générer le questionnaire pour le moment.");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleImport() {
    if (!importFile && !importText.trim()) return;
    setIsImporting(true);
    setImportError(null);
    try {
      const res = importFile
        ? await fetch(`/api/research/${project.id}/questionnaire/import`, {
            method: "POST",
            body: (() => {
              const formData = new FormData();
              formData.set("file", importFile);
              return formData;
            })(),
          })
        : await fetch(`/api/research/${project.id}/questionnaire/import`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ text: importText.trim() }),
          });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setImportError(data.error ?? "ACADIA n'a pas pu importer ce questionnaire.");
        return;
      }
      onImport?.(data.questionnaire);
    } catch {
      setImportError("Impossible de contacter ACADIA. Vérifiez votre connexion et réessayez.");
    } finally {
      setIsImporting(false);
    }
  }

  if (!questionnaire && !interviewGuide) {
    const readiness = computeQuestionnaireGenerationReadiness(project);
    const summary = buildQuestionnaireGenerationSummary(project, theoreticalFramework[project.id] ?? []);

    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">
          Instrument de collecte
        </p>
        <h2 className="mt-1 text-lg font-bold text-acadia-navy">
          Aucun instrument généré pour le moment
        </h2>
        <p className="mt-2 max-w-xl text-sm text-slate-500">
          ACADIA peut construire un questionnaire (ou un guide d&apos;entretien si l&apos;orientation est
          qualitative) à partir des variables, dimensions et indicateurs déjà opérationnalisés — jamais à
          partir du seul titre.
        </p>

        <div className="mt-4 grid gap-x-6 gap-y-2 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-2">
          <p><strong className="text-acadia-navy">Sujet :</strong> {summary.subject || "—"}</p>
          <p><strong className="text-acadia-navy">Niveau :</strong> {summary.level || "À préciser"}</p>
          <p className="sm:col-span-2"><strong className="text-acadia-navy">Problématique :</strong> {summary.problem || "À préciser"}</p>
          <p><strong className="text-acadia-navy">Objectifs :</strong> {summary.objectives.length}</p>
          <p><strong className="text-acadia-navy">Hypothèses :</strong> {summary.hypotheses.length}</p>
          <p><strong className="text-acadia-navy">Variables :</strong> {summary.variables.length > 0 ? summary.variables.join(", ") : "—"}</p>
          <p><strong className="text-acadia-navy">Indicateurs :</strong> {summary.indicatorCount}</p>
          <p><strong className="text-acadia-navy">Population :</strong> {summary.population || "À préciser"}</p>
          <p><strong className="text-acadia-navy">Cadre théorique :</strong> {summary.theoryCount > 0 ? `${summary.theoryCount} entrée(s)` : "À préciser"}</p>
        </div>

        {readiness.ready ? (
          <p className="mt-3 text-sm font-medium text-acadia-navy">
            ACADIA va construire les questions à partir de ces éléments.
          </p>
        ) : (
          <p className="mt-3 flex items-start gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Éléments manquants avant génération : {readiness.missing.join(", ")}.
          </p>
        )}

        {generationError && <p className="mt-3 text-sm text-red-600">{generationError}</p>}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {isGenerating ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-acadia-blue" />
              <p className="text-sm font-medium text-acadia-navy">ACADIA formule vos questions...</p>
            </div>
          ) : (
            <>
              <ResearchPrimaryButton onClick={handleGenerate} disabled={!readiness.ready}>
                <Sparkles className="h-4 w-4" />
                Générer mon questionnaire
              </ResearchPrimaryButton>
              {onImport && (
                <button
                  type="button"
                  onClick={() => setShowImport((v) => !v)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-acadia-navy hover:bg-slate-50"
                >
                  <Upload className="h-4 w-4" />
                  Importer mon questionnaire
                </button>
              )}
            </>
          )}
        </div>

        {onImport && showImport && !isGenerating && (
          <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-4">
            <p className="text-sm text-slate-600">
              Collez le texte de votre questionnaire, ou déposez un fichier Word (.docx) — ACADIA le transformera en
              questions éditables, sans en inventer aucune.
            </p>
            <textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportFile(null);
              }}
              disabled={isImporting}
              rows={5}
              placeholder="Collez ici le texte de vos questions..."
              className="mt-3 w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-acadia-blue focus:outline-none disabled:opacity-60"
            />
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".docx"
                disabled={isImporting}
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  setImportFile(file);
                  if (file) setImportText("");
                }}
                className="text-xs text-slate-500"
              />
              {importFile && <span className="text-xs font-semibold text-acadia-navy">{importFile.name}</span>}
            </div>
            {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
            <div className="mt-3">
              {isImporting ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-acadia-blue" />
                  <p className="text-sm font-medium text-acadia-navy">ACADIA analyse votre questionnaire...</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={!importFile && !importText.trim()}
                  className="rounded-xl bg-acadia-blue px-4 py-2 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
                >
                  Importer
                </button>
              )}
            </div>
          </div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      {questionnaire && (
        <QuestionnaireInstrument
          project={project}
          questionnaire={questionnaire}
          status={status}
          onEditQuestion={onEditQuestion}
          onUpdateQuestion={onUpdateQuestion}
          onAddQuestion={onAddQuestion}
          onDeleteQuestion={onDeleteQuestion}
          onReorderQuestion={onReorderQuestion}
          onAccept={onAccept}
          onContinue={onContinue}
        />
      )}
      {interviewGuide && <InterviewGuideView guide={interviewGuide} />}
    </div>
  );
}


// ============================================================
// QUESTIONNAIRE (quantitatif / partie quantitative du mixte)
// ============================================================

function QuestionnaireInstrument({
  project,
  questionnaire,
  status,
  onEditQuestion,
  onUpdateQuestion,
  onAddQuestion,
  onDeleteQuestion,
  onReorderQuestion,
  onAccept,
  onContinue,
}: {
  project: ResearchProject;
  questionnaire: GeneratedQuestionnaire;
  status: "draft" | "accepted";
  onEditQuestion: (questionId: string, text: string) => void;
  onUpdateQuestion: (questionId: string, patch: Partial<QuestionnaireQuestion>) => void;
  onAddQuestion: (sectionId: string, payload: AddQuestionPayload) => void;
  onDeleteQuestion: (questionId: string) => void;
  onReorderQuestion: (questionId: string, direction: "up" | "down") => void;
  onAccept: () => void;
  onContinue?: () => void;
}) {

  const { matrix } = analyzeInstrument(project, questionnaire);

  const totalIndicators = matrix?.totalIndicators ?? 0;
  const coveredIndicators = matrix
    ? matrix.variables.reduce(
        (sum, v) =>
          sum +
          v.dimensions.reduce(
            (dSum, d) => dSum + d.indicators.filter((i) => i.questions.length > 0).length,
            0
          ),
        0
      )
    : 0;
  const coverageRate = totalIndicators > 0 ? Math.round((coveredIndicators / totalIndicators) * 100) : 100;

  const totalQuestions = questionnaire?.sections.reduce((sum, s) => sum + s.questions.length, 0) ?? 0;
  const needsReviewCount =
    questionnaire?.sections.reduce((sum, s) => sum + s.questions.filter((q) => q.status === "needs_review").length, 0) ?? 0;
  const coveredVariableCount = new Set(
    (questionnaire?.sections.flatMap((s) => s.questions.map((q) => q.variableId).filter(Boolean)) ?? []) as string[]
  ).size;

  return (
    <>
      {/* COUVERTURE */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">
          Instrument de collecte
        </p>
        <h2 className="mt-1 text-lg font-bold text-acadia-navy">{project.title}</h2>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div>
            <span className="text-3xl font-extrabold text-acadia-blue">
              {coveredIndicators} / {totalIndicators}
            </span>
            <span className="ml-2 text-sm text-slate-500">indicateurs couverts</span>
          </div>
          <span className="rounded-full bg-acadia-blue-50 px-3 py-1 text-sm font-bold text-acadia-blue">
            {coverageRate}%
          </span>
          {status === "accepted" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Accepté par le chercheur
            </span>
          )}
        </div>

        <p className="mt-3 text-xs text-slate-500">
          {totalQuestions} question(s) · {coveredVariableCount} variable(s) couverte(s)
        </p>

        {totalIndicators - coveredIndicators > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {totalIndicators - coveredIndicators} indicateur(s) non couvert(s) par une question.
          </p>
        )}

        {needsReviewCount > 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
            <AlertTriangle className="h-3.5 w-3.5" />
            {needsReviewCount} question(s) nécessitent votre vérification.
          </p>
        )}
      </section>

      {/* SECTIONS */}
      {questionnaire.sections
        .map((section) => (
          <section key={section.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">{section.title}</p>
            <p className="mt-1 text-sm text-slate-500">{section.description}</p>

            <div className="mt-4 space-y-4">
              {section.questions.map((question, index) => (
                <QuestionCard
                  key={question.id}
                  question={question}
                  explanation={explainQuestion(project, question)}
                  isFirst={index === 0}
                  isLast={index === section.questions.length - 1}
                  onEdit={onEditQuestion}
                  onUpdate={onUpdateQuestion}
                  onDelete={onDeleteQuestion}
                  onReorder={onReorderQuestion}
                />
              ))}
            </div>

            <AddQuestionForm
              project={project}
              sectionId={section.id}
              onAdd={onAddQuestion}
            />
          </section>
        ))}

      {status !== "accepted" && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <ResearchPrimaryButton size="lg" onClick={onAccept}>
            Valider le questionnaire
          </ResearchPrimaryButton>
          <p className="max-w-md text-center text-2xs text-slate-400">
            Valider signifie que vous acceptez cet instrument — pas qu&apos;ACADIA garantit sa validité
            scientifique. Vous pouvez encore le modifier ensuite.
          </p>
        </div>
      )}
      {status === "accepted" && (
        <div className="flex flex-col items-center gap-2 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-center text-2xs text-slate-400">
            Instrument validé par le chercheur. Les avertissements éventuels restent visibles ci-dessus —
            la validation n&apos;efface jamais un signal de vigilance.
          </p>
          {onContinue && (
            <button
              type="button"
              onClick={onContinue}
              className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-acadia-blue px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
            >
              Étape suivante : collecter mes données <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      {status === "accepted" && <PublishQuestionnaireSection projectId={project.id} />}
    </>
  );
}


// ============================================================
// PUBLICATION EN LIEN PUBLIC (Bloc C, 11/09/2026)
//
// Convertit et publie via le pipeline Survey déjà mature
// (POST /api/research/[id]/questionnaire/publish, qui réutilise
// createSurvey + publishSurvey) — le logo, les statistiques et
// l'export des réponses restent gérés depuis la page Survey
// existante plutôt que dupliqués ici.
// ============================================================

function PublishQuestionnaireSection({ projectId }: { projectId: string }) {
  const [isPublishing, setIsPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ surveyId: string; publicUrl: string; excludedCount: number } | null>(null);
  const [copied, setCopied] = useState(false);

  async function handlePublish() {
    setIsPublishing(true);
    setError(null);
    try {
      const res = await fetch(`/api/research/${projectId}/questionnaire/publish`, { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "ACADIA n'a pas pu publier ce questionnaire pour le moment.");
        return;
      }
      setResult(data);
    } catch {
      setError("Impossible de contacter ACADIA. Vérifiez votre connexion et réessayez.");
    } finally {
      setIsPublishing(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${result.publicUrl}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Copie best-effort : l'échec silencieux laisse le lien affiché,
      // copiable manuellement.
    }
  }

  if (result) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/60 p-6 text-center">
        <p className="text-sm font-semibold text-emerald-800">Votre questionnaire est en ligne.</p>
        <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
          <code className="rounded-lg bg-white px-3 py-1.5 text-sm text-acadia-navy">{result.publicUrl}</code>
          <button
            type="button"
            onClick={handleCopy}
            className="rounded-lg bg-acadia-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
          >
            {copied ? "Copié !" : "Copier le lien"}
          </button>
        </div>
        {result.excludedCount > 0 && (
          <p className="mt-2 text-xs text-amber-700">
            {result.excludedCount} question(s) conditionnelle(s) n&apos;ont pas été incluses — ce mode n&apos;est pas
            encore pris en charge par les enquêtes en ligne.
          </p>
        )}
        <a
          href={`/dashboard/survey/${result.surveyId}`}
          className="mt-3 inline-block text-xs font-semibold text-acadia-blue hover:underline"
        >
          Ajouter un logo, suivre les réponses et exporter →
        </a>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-slate-300 bg-white p-6 text-center">
      <p className="max-w-md text-sm text-slate-600">
        Transformez ce questionnaire en lien partageable — vous pourrez ensuite y ajouter votre logo et suivre les
        réponses en temps réel.
      </p>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {isPublishing ? (
        <div className="mt-1 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-acadia-blue" />
          <p className="text-sm font-medium text-acadia-navy">Publication en cours...</p>
        </div>
      ) : (
        <button
          type="button"
          onClick={handlePublish}
          className="mt-1 inline-flex items-center gap-1.5 rounded-xl bg-acadia-blue px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Générer le lien public
        </button>
      )}
    </div>
  );
}


// ============================================================
// LISTE DES TYPES DE QUESTION DISPONIBLES À L'ÉDITION
// ============================================================

const QUESTION_TYPE_OPTIONS: { value: QuestionType; label: string }[] = [
  { value: "likert", label: "Échelle de Likert" },
  { value: "frequency", label: "Fréquence" },
  { value: "single_choice", label: "Choix unique" },
  { value: "multiple_choice", label: "Choix multiples" },
  { value: "yes_no", label: "Oui / Non" },
  { value: "number", label: "Numérique" },
  { value: "percentage", label: "Pourcentage" },
  { value: "date", label: "Date" },
  { value: "text", label: "Réponse ouverte (courte)" },
  { value: "long_text", label: "Réponse ouverte (longue)" },
  { value: "conditional", label: "Conditionnelle (affichée selon une réponse précédente)" },
];

function defaultOptionsForType(type: QuestionType): {
  options?: QuestionnaireOption[];
  scale?: QuestionnaireOption[];
} {
  switch (type) {
    case "likert":
      return { scale: LIKERT_OPTIONS, options: undefined };
    case "frequency":
      return { scale: FREQUENCY_OPTIONS, options: undefined };
    case "yes_no":
      return { options: YES_NO_OPTIONS, scale: undefined };
    default:
      return {};
  }
}


// ============================================================
// CARTE QUESTION — traçabilité + édition complète (P4-FINAL)
// ============================================================

function QuestionCard({
  question,
  explanation,
  isFirst,
  isLast,
  onEdit,
  onUpdate,
  onDelete,
  onReorder,
}: {
  question: QuestionnaireQuestion;
  explanation: QuestionExplanation;
  isFirst: boolean;
  isLast: boolean;
  onEdit: (questionId: string, text: string) => void;
  onUpdate: (questionId: string, patch: Partial<QuestionnaireQuestion>) => void;
  onDelete: (questionId: string) => void;
  onReorder: (questionId: string, direction: "up" | "down") => void;
}) {
  const [editingText, setEditingText] = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);
  const [draft, setDraft] = useState(question.text);
  const [editingOptions, setEditingOptions] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const traceable = Boolean(question.variableId && question.dimensionId && question.indicatorId);
  const needsReview = question.status === "needs_review";
  const typeIncoherent = traceable && needsReview;

  const optionField: "options" | "scale" | null =
    question.options ? "options" : question.scale ? "scale" : null;

  function handleTypeChange(newType: QuestionType) {
    const patch: Partial<QuestionnaireQuestion> = { type: newType };
    const defaults = defaultOptionsForType(newType);

    if (defaults.scale) {
      patch.scale = defaults.scale;
      patch.options = undefined;
    } else if (defaults.options) {
      patch.options = defaults.options;
      patch.scale = undefined;
    } else if (
      (newType === "single_choice" || newType === "multiple_choice") &&
      !(question.options && question.options.length > 0)
    ) {
      patch.options = [
        { value: `option_1_${Date.now()}`, label: "Modalité 1" },
        { value: `option_2_${Date.now() + 1}`, label: "Modalité 2" },
      ];
      patch.scale = undefined;
    }

    onUpdate(question.id, patch);
  }

  function patchOptionList(next: QuestionnaireOption[]) {
    if (!optionField) return;
    onUpdate(question.id, { [optionField]: next } as Partial<QuestionnaireQuestion>);
  }

  function handleAddOption() {
    const list = (question.options ?? question.scale ?? []);
    const field = optionField ?? "options";
    const index = list.length + 1;
    const next = [
      ...list,
      { label: `Nouvelle modalité ${index}`, value: `option_${index}_${Date.now()}` },
    ];
    onUpdate(question.id, { [field]: next } as Partial<QuestionnaireQuestion>);
  }

  function handleUpdateOptionLabel(value: string, label: string) {
    patchOptionList((question.options ?? question.scale ?? []).map((o) =>
      o.value === value ? { ...o, label } : o
    ));
  }

  function handleRemoveOption(value: string) {
    patchOptionList((question.options ?? question.scale ?? []).filter((o) => o.value !== value));
  }

  function handleMoveOption(value: string, direction: "up" | "down") {
    const list = [...(question.options ?? question.scale ?? [])];
    const index = list.findIndex((o) => o.value === value);
    const target = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target], list[index]];
    patchOptionList(list);
  }

  const supportsOptions =
    question.type === "single_choice" || question.type === "multiple_choice";
  const supportsScale = question.type === "likert" || question.type === "frequency" || question.type === "yes_no";

  return (
    <div
      className={`rounded-2xl border p-4 ${
        typeIncoherent
          ? "border-amber-300 bg-amber-50/70"
          : traceable
          ? "border-slate-200/90 bg-slate-50/60"
          : "border-amber-200 bg-amber-50/50"
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-2xs font-bold tracking-wider text-slate-400 uppercase">
          Question {question.number}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onReorder(question.id, "up")}
            disabled={isFirst}
            className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-acadia-blue disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Déplacer vers le haut"
          >
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onReorder(question.id, "down")}
            disabled={isLast}
            className="rounded-md p-1 text-slate-400 hover:bg-white hover:text-acadia-blue disabled:cursor-not-allowed disabled:opacity-30"
            aria-label="Déplacer vers le bas"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>

          {!traceable ? (
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-amber-600">
              <AlertTriangle className="h-3 w-3" /> À vérifier (sans lien scientifique établi)
            </span>
          ) : typeIncoherent ? (
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-amber-600">
              <AlertTriangle className="h-3 w-3" /> Type modifié — incohérent avec l&apos;indicateur mesuré
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Question cohérente
            </span>
          )}

          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
            aria-label="Supprimer la question"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {confirmingDelete && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-xl bg-red-50 p-3">
          <p className="text-xs font-medium text-red-700">
            Supprimer définitivement cette question ?
            {traceable && " Elle mesure actuellement un indicateur — sa suppression pourra rendre cet indicateur non couvert."}
          </p>
          <div className="flex shrink-0 gap-2">
            <button
              type="button"
              onClick={() => onDelete(question.id)}
              className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
            >
              Supprimer
            </button>
            <button
              type="button"
              onClick={() => setConfirmingDelete(false)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              Annuler
            </button>
          </div>
        </div>
      )}

      {editingText ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-acadia-blue focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                onEdit(question.id, draft);
                setEditingText(false);
              }}
              className="rounded-lg bg-acadia-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft(question.text);
                setEditingText(false);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-1.5 flex items-start justify-between gap-3">
          <p className="text-sm font-medium text-acadia-navy">{question.text}</p>
          <button
            type="button"
            onClick={() => setEditingText(true)}
            className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-white hover:text-acadia-blue"
            aria-label="Modifier le texte de la question"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* TYPE + OBLIGATOIRE */}
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-1.5 text-2xs font-semibold text-slate-500">
          Type :
          <select
            value={question.type}
            onChange={(e) => handleTypeChange(e.target.value as QuestionType)}
            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-2xs font-semibold text-slate-700 focus:border-acadia-blue focus:outline-none"
          >
            {QUESTION_TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>

        {question.type === "conditional" && (
          <input
            value={question.conditionOn ?? ""}
            onChange={(e) => onUpdate(question.id, { conditionOn: e.target.value })}
            placeholder="Ex. : si Q5 = Oui"
            className="min-w-[10rem] flex-1 rounded-lg border border-slate-200 px-2 py-1 text-2xs text-slate-700 focus:border-acadia-blue focus:outline-none"
          />
        )}

        <label className="flex cursor-pointer items-center gap-1.5 text-2xs font-semibold text-slate-500">
          <input
            type="checkbox"
            checked={question.required}
            onChange={(e) => onUpdate(question.id, { required: e.target.checked })}
            className="h-3.5 w-3.5 rounded border-slate-300"
          />
          Obligatoire
        </label>
      </div>

      {/* MODALITÉS DE RÉPONSE */}
      {(question.options || question.scale) && (
        <div className="mt-2.5">
          {!editingOptions ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {(question.options ?? question.scale ?? []).map((opt) => (
                <span
                  key={opt.value}
                  className="rounded-full bg-white px-2.5 py-0.5 text-2xs text-slate-600 ring-1 ring-slate-200"
                >
                  {opt.label}
                </span>
              ))}
              {(supportsOptions || supportsScale) && (
                <button
                  type="button"
                  onClick={() => setEditingOptions(true)}
                  className="text-2xs font-semibold text-acadia-blue hover:underline"
                >
                  Modifier les modalités
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2 rounded-xl bg-white p-3 ring-1 ring-slate-200">
              {(question.options ?? question.scale ?? []).map((opt, idx, arr) => (
                <div key={opt.value} className="flex items-center gap-1.5">
                  <input
                    value={opt.label}
                    onChange={(e) => handleUpdateOptionLabel(opt.value, e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs text-slate-800 focus:border-acadia-blue focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => handleMoveOption(opt.value, "up")}
                    disabled={idx === 0}
                    className="rounded-md p-1 text-slate-400 hover:text-acadia-blue disabled:opacity-30"
                    aria-label="Monter cette modalité"
                  >
                    <ChevronUp className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleMoveOption(opt.value, "down")}
                    disabled={idx === arr.length - 1}
                    className="rounded-md p-1 text-slate-400 hover:text-acadia-blue disabled:opacity-30"
                    aria-label="Descendre cette modalité"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(opt.value)}
                    className="rounded-md p-1 text-red-400 hover:bg-red-50"
                    aria-label="Supprimer cette modalité"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="text-2xs font-semibold text-acadia-blue hover:underline"
                >
                  + Ajouter une modalité
                </button>
                <button
                  type="button"
                  onClick={() => setEditingOptions(false)}
                  className="text-2xs font-semibold text-slate-500 hover:underline"
                >
                  Terminer
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {traceable && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => setShowExplanation((v) => !v)}
            className="inline-flex items-center gap-1 text-2xs font-semibold text-acadia-blue hover:underline"
          >
            <HelpCircle className="h-3 w-3" />
            {showExplanation ? "Masquer l'explication" : "Pourquoi cette question ?"}
          </button>

          {showExplanation && (
            <div className="mt-2 space-y-1 rounded-xl bg-white p-3 text-2xs text-slate-600 ring-1 ring-slate-200">
              {explanation.measure && (
                <p><strong className="text-acadia-navy">Mesure :</strong> {explanation.measure}</p>
              )}
              <p><strong className="text-acadia-navy">Indicateur :</strong> {explanation.indicator ?? question.indicator}</p>
              <p><strong className="text-acadia-navy">Dimension :</strong> {explanation.dimension ?? question.dimension}</p>
              <p><strong className="text-acadia-navy">Variable :</strong> {explanation.variable ?? question.variable}</p>
              {explanation.hypothesis && (
                <p><strong className="text-acadia-navy">Hypothèse liée :</strong> {explanation.hypothesis}</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}


// ============================================================
// AJOUTER UNE QUESTION (P4-FINAL, A3)
// ============================================================

function AddQuestionForm({
  project,
  sectionId,
  onAdd,
}: {
  project: ResearchProject;
  sectionId: string;
  onAdd: (sectionId: string, payload: AddQuestionPayload) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [type, setType] = useState<QuestionType>("text");
  const [variableId, setVariableId] = useState("");
  const [dimensionId, setDimensionId] = useState("");
  const [indicatorId, setIndicatorId] = useState("");

  const variable = project.variables.find((v) => v.id === variableId);
  const dimension = variable?.dimensions.find((d) => d.id === dimensionId);
  const indicator = dimension?.indicators.find((i) => i.id === indicatorId);

  function reset() {
    setText("");
    setType("text");
    setVariableId("");
    setDimensionId("");
    setIndicatorId("");
    setOpen(false);
  }

  function handleSubmit() {
    if (!text.trim()) return;

    onAdd(sectionId, {
      text: text.trim(),
      type,
      variableId: variable?.id,
      dimensionId: dimension?.id,
      indicatorId: indicator?.id,
      variable: variable?.name,
      dimension: dimension?.name,
      indicator: indicator?.name,
    });

    reset();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-4 inline-flex items-center gap-1.5 rounded-xl border border-dashed border-slate-300 px-3 py-2 text-xs font-semibold text-acadia-blue hover:border-acadia-blue hover:bg-acadia-blue-50"
      >
        <Plus className="h-3.5 w-3.5" /> Ajouter une question
      </button>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50/60 p-4">
      <p className="text-2xs font-bold tracking-wider text-slate-400 uppercase">Nouvelle question</p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={2}
        placeholder="Rédigez la question…"
        className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-900 focus:border-acadia-blue focus:outline-none"
      />

      <div className="flex flex-wrap gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType)}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:border-acadia-blue focus:outline-none"
        >
          {QUESTION_TYPE_OPTIONS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          value={variableId}
          onChange={(e) => {
            setVariableId(e.target.value);
            setDimensionId("");
            setIndicatorId("");
          }}
          className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:border-acadia-blue focus:outline-none"
        >
          <option value="">Question générale / descriptive (sans lien)</option>
          {project.variables.map((v) => (
            <option key={v.id} value={v.id}>
              Variable — {v.name}
            </option>
          ))}
        </select>

        {variable && (
          <select
            value={dimensionId}
            onChange={(e) => {
              setDimensionId(e.target.value);
              setIndicatorId("");
            }}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:border-acadia-blue focus:outline-none"
          >
            <option value="">— Dimension —</option>
            {variable.dimensions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        )}

        {dimension && (
          <select
            value={indicatorId}
            onChange={(e) => setIndicatorId(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:border-acadia-blue focus:outline-none"
          >
            <option value="">— Indicateur —</option>
            {dimension.indicators.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {!indicator && (
        <p className="text-2xs text-amber-600">
          ⚠ Sans variable/dimension/indicateur sélectionné, cette question sera marquée « à vérifier » —
          ACADIA n&apos;invente jamais de lien scientifique.
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!text.trim()}
          className="rounded-lg bg-acadia-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ajouter la question
        </button>
        <button
          type="button"
          onClick={reset}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600"
        >
          Annuler
        </button>
      </div>
    </div>
  );
}


// ============================================================
// GUIDE D'ENTRETIEN (qualitatif / partie qualitative du mixte)
// ============================================================

function InterviewGuideView({ guide }: { guide: InterviewGuide }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Guide d&apos;entretien</p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">{guide.title}</h2>
      <p className="mt-1 text-sm text-slate-500">{guide.description}</p>

      <div className="mt-4 space-y-4">
        {guide.themes.map((theme, index) => (
          <div key={theme.id} className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4">
            <p className="text-2xs font-bold tracking-wider text-slate-400 uppercase">
              Thème {index + 1} — {theme.theme}
            </p>
            <p className="mt-1.5 text-sm font-medium text-acadia-navy">{theme.mainQuestion}</p>
            {theme.followUps.length > 0 && (
              <ul className="mt-2 space-y-1">
                {theme.followUps.map((f) => (
                  <li key={f} className="text-xs text-slate-500">
                    ↳ {f}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
