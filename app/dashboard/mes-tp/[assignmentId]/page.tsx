"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, CheckCircle2, Save } from "lucide-react";

interface StudentQuestion {
  id: string;
  order: number;
  statement: string;
  type: string;
  maxScore: number;
  instructions: string | null;
  content: unknown;
}

interface StoredAnswer {
  questionId: string;
  answerText: string | null;
  answerData: unknown;
}

interface SubmissionInfo {
  id: string;
  status: string;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Brouillon",
  submitted: "Soumis",
  under_review: "En revue par l'enseignant",
  graded: "Corrigé",
  returned: "Retourné",
};

export default function TakeAssignmentPage() {
  const params = useParams<{ assignmentId: string }>();
  const router = useRouter();
  const [assignmentTitle, setAssignmentTitle] = useState<string | null>(null);
  const [assignmentInstructions, setAssignmentInstructions] = useState<string | null>(null);
  const [submission, setSubmission] = useState<SubmissionInfo | null>(null);
  const [questions, setQuestions] = useState<StudentQuestion[] | null>(null);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [savedQuestionIds, setSavedQuestionIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [assignRes, subRes, qRes] = await Promise.all([
        fetch(`/api/assessment/assignments/${params.assignmentId}`),
        fetch(`/api/assessment/assignments/${params.assignmentId}/submissions`, { method: "POST" }),
        fetch(`/api/assessment/assignments/${params.assignmentId}/questions`),
      ]);
      if (!assignRes.ok || !subRes.ok || !qRes.ok) throw new Error("request_failed");
      const assignData = await assignRes.json();
      const subData = await subRes.json();
      const qData = await qRes.json();
      setAssignmentTitle(assignData.assignment.title);
      setAssignmentInstructions(assignData.assignment.instructions);
      setSubmission(subData.submission);
      setQuestions(qData.questions);

      const answersRes = await fetch(`/api/assessment/submissions/${subData.submission.id}/answers`);
      if (answersRes.ok) {
        const answersData = await answersRes.json();
        const initial: Record<string, unknown> = {};
        const saved = new Set<string>();
        for (const a of answersData.answers as StoredAnswer[]) {
          initial[a.questionId] = a.answerData ?? a.answerText ?? "";
          saved.add(a.questionId);
        }
        setValues(initial);
        setSavedQuestionIds(saved);
      }
    } catch {
      setError("Impossible de charger ce TP.");
    }
  }, [params.assignmentId]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function saveAnswer(q: StudentQuestion) {
    if (!submission) return;
    setError(null);
    setBusyQuestionId(q.id);
    try {
      const raw = values[q.id];
      const body: { questionId: string; answerText?: string; answerData?: unknown } = { questionId: q.id };
      if (q.type === "OPEN_TEXT" || q.type === "SHORT_ANSWER") {
        body.answerText = String(raw ?? "");
      } else if (q.type === "MULTIPLE_CHOICE") {
        body.answerData = { kind: "MULTIPLE_CHOICE", selectedOptionId: raw };
      } else if (q.type === "TRUE_FALSE") {
        body.answerData = { kind: "TRUE_FALSE", value: raw === "true" || raw === true };
      } else if (q.type === "NUMERIC") {
        body.answerData = { kind: "NUMERIC", value: Number(raw) };
      } else if (q.type === "CALCULATION") {
        body.answerData = { kind: "CALCULATION", ...((raw as object) ?? {}) };
      }

      const res = await fetch(`/api/assessment/submissions/${submission.id}/answers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Enregistrement refusé.");
      }
      setSavedQuestionIds((prev) => new Set(prev).add(q.id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Enregistrement refusé.");
    } finally {
      setBusyQuestionId(null);
    }
  }

  async function handleSubmit() {
    if (!submission) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/assessment/submissions/${submission.id}/submit`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Soumission refusée.");
      }
      router.push("/dashboard/mes-tp");
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Soumission refusée.");
    } finally {
      setSubmitting(false);
    }
  }

  if (error && !questions) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-3xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  if (!questions || !submission) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-3xl text-center text-slate-400">Chargement...</div>
      </div>
    );
  }

  const isDraft = submission.status === "draft";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link href="/dashboard/mes-tp" className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-acadia-blue">
          <ArrowLeft className="h-4 w-4" /> Mes TP
        </Link>

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <h1 className="text-xl font-bold text-acadia-navy">{assignmentTitle}</h1>
          {assignmentInstructions && <p className="mt-2 text-sm text-slate-600">{assignmentInstructions}</p>}
          <p className="mt-2 text-2xs font-semibold uppercase tracking-wide text-slate-400">Statut : {STATUS_LABEL[submission.status] ?? submission.status}</p>
        </div>

        {!isDraft && (
          <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
            Ce TP a déjà été soumis — vos réponses restent visibles ci-dessous mais ne sont plus modifiables.
          </div>
        )}

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{error}</div>}

        {questions.map((q) => (
          <div key={q.id} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Question {q.order + 1} · {q.maxScore} pts</p>
              {savedQuestionIds.has(q.id) && (
                <span className="inline-flex items-center gap-1 text-2xs font-semibold text-emerald-600">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Enregistrée
                </span>
              )}
            </div>
            <p className="mt-1 font-semibold text-slate-900">{q.statement}</p>
            {q.instructions && <p className="mt-1 text-sm text-slate-500">{q.instructions}</p>}

            <div className="mt-3">
              <QuestionInput
                question={q}
                value={values[q.id]}
                disabled={!isDraft}
                onChange={(v) => setValues((prev) => ({ ...prev, [q.id]: v }))}
              />
            </div>

            {isDraft && (
              <button
                type="button"
                onClick={() => saveAnswer(q)}
                disabled={busyQuestionId === q.id}
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Save className="h-4 w-4" /> Enregistrer
              </button>
            )}
          </div>
        ))}

        {isDraft && (
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            {submitError && <p className="mb-2 text-sm text-rose-600">{submitError}</p>}
            <p className="mb-3 text-sm text-slate-500">Pensez à enregistrer chaque réponse avant de soumettre. Une fois soumis, le TP ne peut plus être modifié.</p>
            <button type="button" onClick={handleSubmit} disabled={submitting} className="rounded-full bg-acadia-blue px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50">
              Soumettre le TP
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuestionInput({ question, value, disabled, onChange }: { question: StudentQuestion; value: unknown; disabled: boolean; onChange: (v: unknown) => void }) {
  const content = question.content as { kind?: string; options?: { id: string; text: string }[]; unit?: string } | null;

  if (question.type === "OPEN_TEXT" || question.type === "SHORT_ANSWER") {
    return (
      <textarea
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={question.type === "OPEN_TEXT" ? 5 : 2}
        className="w-full rounded-lg border border-slate-200 p-3 text-sm disabled:bg-slate-50"
      />
    );
  }

  if (question.type === "MULTIPLE_CHOICE" && content?.options) {
    const selected = (value as { selectedOptionId?: string } | string | undefined) as string | { selectedOptionId?: string } | undefined;
    const selectedId = typeof selected === "string" ? selected : selected?.selectedOptionId;
    return (
      <div className="space-y-2">
        {content.options.map((opt) => (
          <label key={opt.id} className="flex items-center gap-2 text-sm">
            <input type="radio" name={question.id} disabled={disabled} checked={selectedId === opt.id} onChange={() => onChange(opt.id)} />
            {opt.text}
          </label>
        ))}
      </div>
    );
  }

  if (question.type === "TRUE_FALSE") {
    const boolValue = typeof value === "object" && value !== null ? (value as { value?: boolean }).value : value === "true";
    return (
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" name={question.id} disabled={disabled} checked={boolValue === true} onChange={() => onChange("true")} /> Vrai
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name={question.id} disabled={disabled} checked={boolValue === false} onChange={() => onChange("false")} /> Faux
        </label>
      </div>
    );
  }

  if (question.type === "NUMERIC") {
    const numValue = typeof value === "object" && value !== null ? (value as { value?: number }).value : value;
    return (
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={typeof numValue === "number" || typeof numValue === "string" ? numValue : ""}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
        />
        {content?.unit && <span className="text-sm text-slate-400">{content.unit}</span>}
      </div>
    );
  }

  if (question.type === "CALCULATION") {
    const calc = (typeof value === "object" && value !== null ? value : {}) as { result?: number; formula?: string; reasoning?: string };
    return (
      <div className="space-y-2">
        <input
          type="number"
          placeholder="Résultat"
          value={calc.result ?? ""}
          onChange={(e) => onChange({ ...calc, result: e.target.value ? Number(e.target.value) : undefined })}
          disabled={disabled}
          className="w-40 rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
        />
        <input
          type="text"
          placeholder="Formule utilisée"
          value={calc.formula ?? ""}
          onChange={(e) => onChange({ ...calc, formula: e.target.value })}
          disabled={disabled}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-50"
        />
        <textarea
          placeholder="Raisonnement / étapes"
          value={calc.reasoning ?? ""}
          onChange={(e) => onChange({ ...calc, reasoning: e.target.value })}
          disabled={disabled}
          rows={3}
          className="w-full rounded-lg border border-slate-200 p-3 text-sm disabled:bg-slate-50"
        />
      </div>
    );
  }

  return null;
}
