"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, RotateCcw, Sparkles, CheckCircle2, PenLine, AlertTriangle } from "lucide-react";
import { SUBMISSION_STATUS_LABEL, EVALUATION_STATUS_LABEL, confidenceLabel, formatScore, formatDate } from "@/components/teacher/teacherLabels";

interface ReviewCriterionScore {
  criterionId: string;
  name: string;
  score: number;
  maxScore: number;
  confidence: number | null;
  evidence: string | null;
  comment: string | null;
}

interface ReviewEvaluation {
  id: string;
  status: string;
  aiScore: number | null;
  humanScore: number | null;
  finalScore: number | null;
  confidence: number | null;
  aiModel: string | null;
  needsHumanReview: boolean;
  criterionScores: ReviewCriterionScore[];
  aiFeedback: string[];
  findings: string[];
  warnings: string[];
  limitations: string[];
}

interface ReviewQuestionItem {
  questionId: string;
  order: number;
  statement: string;
  type: string;
  maxScore: number;
  answerText: string | null;
  answerData: unknown;
  evaluation: ReviewEvaluation | null;
}

interface SubmissionReviewPayload {
  submissionId: string;
  status: string;
  version: number;
  submittedAt: string | null;
  student: { id: string; name: string; email: string };
  assignmentId: string;
  assignmentTitle: string;
  courseName: string;
  items: ReviewQuestionItem[];
  decidedCount: number;
  totalCount: number;
  allDecided: boolean;
  canFinalize: boolean;
  runningTotal: { score: number; maxScore: number } | null;
}

const DECIDED_STATUSES = new Set(["accepted", "modified", "rejected"]);

function renderAnswer(item: ReviewQuestionItem): string {
  if (item.answerText) return item.answerText;
  if (item.answerData && typeof item.answerData === "object") {
    const data = item.answerData as Record<string, unknown>;
    if (typeof data.selectedOptionId === "string") return `Option choisie : ${data.selectedOptionId}`;
    if (typeof data.value === "boolean") return data.value ? "Vrai" : "Faux";
    if (typeof data.value === "number") return String(data.value);
    if (typeof data.result === "number") return `Résultat : ${data.result}${data.formula ? ` (formule : ${data.formula})` : ""}`;
  }
  return "Aucune réponse.";
}

export default function SubmissionReviewPage() {
  const params = useParams<{ id: string }>();
  const [review, setReview] = useState<SubmissionReviewPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [modifyingQuestionId, setModifyingQuestionId] = useState<string | null>(null);
  const [modifyScore, setModifyScore] = useState("");
  const [modifyFeedback, setModifyFeedback] = useState("");
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/assessment/submissions/${params.id}/review`);
      if (!res.ok) {
        if (res.status === 403) throw new Error("Cette copie ne vous appartient pas.");
        if (res.status === 404) throw new Error("Copie introuvable.");
        throw new Error("request_failed");
      }
      const data = await res.json();
      setReview(data.review);
    } catch (e) {
      setError(e instanceof Error && e.message !== "request_failed" ? e.message : "Impossible de charger cette copie.");
    }
  }, [params.id]);

  useEffect(() => {
    void (async () => {
      await load();
    })();
  }, [load]);

  async function decide(evaluationId: string, decision: "accept" | "modify", humanScore?: number, feedbackText?: string) {
    setActionError(null);
    setBusy(evaluationId);
    try {
      const res = await fetch(`/api/assessment/evaluations/${evaluationId}/decide`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, humanScore, feedbackText }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Action refusée par le serveur.");
      }
      setModifyingQuestionId(null);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Action refusée par le serveur.");
    } finally {
      setBusy(null);
    }
  }

  async function requestNewAnalysis() {
    setActionError(null);
    setBusy("regrade");
    try {
      const res = await fetch(`/api/assessment/submissions/${params.id}/grade`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      if (!res.ok) throw new Error("La nouvelle analyse a échoué.");
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "La nouvelle analyse a échoué.");
    } finally {
      setBusy(null);
    }
  }

  async function finalize() {
    setActionError(null);
    setBusy("finalize");
    try {
      const res = await fetch(`/api/assessment/submissions/${params.id}/finalize`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Impossible de finaliser la note.");
      }
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Impossible de finaliser la note.");
    } finally {
      setBusy(null);
    }
  }

  async function doReturn() {
    setActionError(null);
    setBusy("return");
    try {
      const res = await fetch(`/api/assessment/submissions/${params.id}/return`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error || "Impossible de retourner la copie.");
      }
      setConfirmReturn(false);
      await load();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Impossible de retourner la copie.");
    } finally {
      setBusy(null);
    }
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl rounded-3xl border border-rose-200 bg-rose-50 p-6 text-sm text-rose-700">{error}</div>
      </div>
    );
  }

  if (!review) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl text-center text-slate-400">Chargement...</div>
      </div>
    );
  }

  const statusBadge = SUBMISSION_STATUS_LABEL[review.status] ?? { label: review.status, className: "bg-slate-100 text-slate-600" };
  const canReturn = review.status === "submitted" || review.status === "under_review" || review.status === "graded";

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <Link href={`/dashboard/teacher/assignments/${review.assignmentId}/submissions`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-acadia-blue">
          <ArrowLeft className="h-4 w-4" /> Retour aux copies
        </Link>

        {actionError && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{actionError}</div>}

        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">{review.assignmentTitle}</p>
              <h1 className="mt-1 text-xl font-bold text-acadia-navy">{review.student.name}</h1>
              <p className="text-sm text-slate-500">
                {review.courseName} · Version {review.version} · Soumis le {formatDate(review.submittedAt)}
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-2xs font-semibold uppercase tracking-wide ${statusBadge.className}`}>{statusBadge.label}</span>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
            <div className="text-sm text-slate-600">
              <span className="font-semibold text-slate-900">{review.decidedCount}</span> / {review.totalCount} réponses décidées
              {review.runningTotal && (
                <span className="ml-3 font-semibold text-acadia-navy">Total en cours : {formatScore(review.runningTotal.score, review.runningTotal.maxScore)}</span>
              )}
            </div>
            <div className="ml-auto flex flex-wrap gap-2">
              <button
                type="button"
                onClick={requestNewAnalysis}
                disabled={busy !== null}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" /> Demander une nouvelle analyse
              </button>
              {review.canFinalize && (
                <button
                  type="button"
                  onClick={finalize}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-full bg-acadia-blue px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-acadia-blue/90 disabled:opacity-50"
                >
                  Finaliser la note
                </button>
              )}
              {canReturn && (
                <button
                  type="button"
                  onClick={() => setConfirmReturn(true)}
                  disabled={busy !== null}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RotateCcw className="h-4 w-4" /> Retourner la copie
                </button>
              )}
            </div>
          </div>
          <p className="mt-1 text-2xs text-slate-400">La nouvelle analyse relance ACADIA sur l&apos;ensemble de la copie ; une décision déjà prise n&apos;est jamais écrasée sauf via cette action.</p>
        </div>

        {review.items.map((item) => (
          <div key={item.questionId} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Question {item.order + 1} · {item.maxScore} pts</p>
            <p className="mt-1 font-semibold text-slate-900">{item.statement}</p>

            <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
              <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Réponse de l&apos;étudiant</p>
              <p className="mt-1 whitespace-pre-line">{renderAnswer(item)}</p>
            </div>

            {!item.evaluation && (
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-amber-50 p-3 text-sm text-amber-700">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Pas encore de correction pour cette réponse.
              </div>
            )}

            {item.evaluation && (
              <div className="mt-3 rounded-2xl border border-acadia-blue-100 bg-acadia-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-2xs font-bold uppercase tracking-wider text-acadia-blue">Proposition ACADIA</p>
                  <span className="text-2xs font-semibold text-slate-500">{EVALUATION_STATUS_LABEL[item.evaluation.status] ?? item.evaluation.status}</span>
                </div>
                <p className="mt-1 text-2xl font-bold text-acadia-navy">{formatScore(item.evaluation.aiScore, item.maxScore)}</p>
                <p className="text-xs text-slate-500">Confiance : {confidenceLabel(item.evaluation.confidence)}</p>

                {item.evaluation.aiFeedback.length > 0 && (
                  <div className="mt-2 text-sm text-slate-700">
                    <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Pourquoi ?</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {item.evaluation.aiFeedback.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {item.evaluation.findings.length > 0 && (
                  <div className="mt-2 text-sm text-slate-700">
                    <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Éléments détectés</p>
                    <ul className="mt-1 list-inside list-disc space-y-0.5">
                      {item.evaluation.findings.map((f, i) => (
                        <li key={i}>{f}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {item.evaluation.criterionScores.length > 0 && (
                  <div className="mt-2 space-y-1 text-sm">
                    <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Critères</p>
                    {item.evaluation.criterionScores.map((c) => (
                      <div key={c.criterionId} className="flex items-center justify-between rounded-lg bg-white px-2.5 py-1.5">
                        <span className="text-slate-700">{c.name}</span>
                        <span className="font-semibold text-slate-900">{formatScore(c.score, c.maxScore)}</span>
                      </div>
                    ))}
                  </div>
                )}

                {(item.evaluation.warnings.length > 0 || item.evaluation.limitations.length > 0) && (
                  <div className="mt-2 text-xs text-amber-700">
                    {[...item.evaluation.warnings, ...item.evaluation.limitations].map((w, i) => (
                      <p key={i}>⚠️ {w}</p>
                    ))}
                  </div>
                )}

                {item.evaluation.finalScore !== null && (
                  <p className="mt-3 rounded-xl bg-emerald-100 px-3 py-2 text-sm font-semibold text-emerald-800">
                    Note finale : {formatScore(item.evaluation.finalScore, item.maxScore)}
                  </p>
                )}

                {!DECIDED_STATUSES.has(item.evaluation.status) && (
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-acadia-blue-100 pt-3">
                    <button
                      type="button"
                      onClick={() => decide(item.evaluation!.id, "accept")}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-4 w-4" /> Accepter la proposition
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setModifyingQuestionId(item.questionId);
                        setModifyScore(item.evaluation ? String(item.evaluation.aiScore ?? "") : "");
                        setModifyFeedback("");
                      }}
                      disabled={busy !== null}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3.5 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <PenLine className="h-4 w-4" /> Modifier la note
                    </button>
                  </div>
                )}

                {modifyingQuestionId === item.questionId && (
                  <div className="mt-3 space-y-2 rounded-2xl border border-slate-200 bg-white p-3">
                    <p className="text-xs text-slate-500">Note proposée par ACADIA : {formatScore(item.evaluation.aiScore, item.maxScore)}</p>
                    <label className="block text-sm">
                      <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Votre note (sur {item.maxScore})</span>
                      <input
                        type="number"
                        min={0}
                        max={item.maxScore}
                        step={0.25}
                        value={modifyScore}
                        onChange={(e) => setModifyScore(e.target.value)}
                        className="mt-1 w-32 rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="text-2xs font-bold uppercase tracking-wider text-slate-400">Justification (optionnel)</span>
                      <textarea
                        value={modifyFeedback}
                        onChange={(e) => setModifyFeedback(e.target.value)}
                        rows={2}
                        className="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm"
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          const score = Number(modifyScore);
                          if (!Number.isFinite(score) || score < 0 || score > item.maxScore) {
                            setActionError(`La note doit être comprise entre 0 et ${item.maxScore}.`);
                            return;
                          }
                          decide(item.evaluation!.id, "modify", score, modifyFeedback || undefined);
                        }}
                        disabled={busy !== null}
                        className="rounded-full bg-acadia-blue px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-acadia-blue/90 disabled:opacity-50"
                      >
                        Valider la décision
                      </button>
                      <button type="button" onClick={() => setModifyingQuestionId(null)} className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">
                        Annuler
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}

        {confirmReturn && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-acadia-navy/40 p-4">
            <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-2xl">
              <p className="font-semibold text-slate-900">Retourner cette copie ?</p>
              <p className="mt-1 text-sm text-slate-500">Cette action rendra la correction visible à l&apos;étudiant.</p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmReturn(false)} className="rounded-full px-3.5 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50">
                  Annuler
                </button>
                <button type="button" onClick={doReturn} disabled={busy !== null} className="rounded-full bg-acadia-blue px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-acadia-blue/90 disabled:opacity-50">
                  Confirmer
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
