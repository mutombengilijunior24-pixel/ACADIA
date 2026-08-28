"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { Sparkles, Copy, Check, MessageCircle, GitCompare, CheckCircle2, XCircle } from "lucide-react";
import { useSupervision } from "@/contexts/SupervisionContext";
import SubmissionSnapshotView from "@/components/supervision/SubmissionSnapshotView";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";
import type { Submission, SupervisorBrief, RevisionComparison, Correction, FeedbackSectionEntry, FeedbackSectionState } from "@/lib/core/supervision/SupervisionTypes";

const FEEDBACK_SECTIONS = [
  "Sujet",
  "Problématique",
  "Objectifs",
  "Hypothèses",
  "Littérature",
  "Méthodologie",
  "Questionnaire",
  "Données",
  "Analyse",
  "Résultats",
  "Discussion",
  "Conclusion",
];

const STATE_LABEL: Record<FeedbackSectionState, string> = { ok: "OK", a_corriger: "À corriger", bloquant: "Bloquant" };
const STATE_COLOR: Record<FeedbackSectionState, string> = {
  ok: "bg-emerald-50 text-emerald-700",
  a_corriger: "bg-amber-50 text-amber-700",
  bloquant: "bg-rose-50 text-rose-700",
};

export default function SupervisorReviewPage() {
  const params = useParams<{ submissionId: string }>();
  const submissionId = typeof params.submissionId === "string" ? params.submissionId : "";
  const router = useRouter();
  const { getSubmissionDetail, getBrief, getComparison, sendFeedback, updateSubmissionStatus, updateCorrectionStatus } = useSupervision();

  const [submission, setSubmission] = useState<Submission | null>(null);
  const [studentName, setStudentName] = useState("");
  const [corrections, setCorrections] = useState<Correction[]>([]);
  const [brief, setBrief] = useState<SupervisorBrief | null>(null);
  const [comparison, setComparison] = useState<RevisionComparison | null>(null);
  const [comparisonReason, setComparisonReason] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [sections, setSections] = useState<FeedbackSectionEntry[]>(
    FEEDBACK_SECTIONS.map((label) => ({ sectionId: label.toLowerCase(), label, state: "ok" as FeedbackSectionState }))
  );
  const [globalEvaluation, setGlobalEvaluation] = useState("");
  const [sending, setSending] = useState(false);
  const [sentText, setSentText] = useState<string | null>(null);
  const [sentEmailStatus, setSentEmailStatus] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const detail = await getSubmissionDetail(submissionId);
    if (detail) {
      setSubmission(detail.submission);
      setCorrections(detail.corrections as Correction[]);
      setStudentName(detail.student ? `${detail.student.firstName} ${detail.student.lastName}`.trim() : "Étudiant");
    }
    const briefData = await getBrief(submissionId);
    setBrief(briefData as SupervisorBrief);

    const comparisonData = (await getComparison(submissionId)) as { comparison: RevisionComparison | null; reason?: string } | RevisionComparison | null;
    if (comparisonData && "comparison" in (comparisonData as object)) {
      const typed = comparisonData as { comparison: RevisionComparison | null; reason?: string };
      setComparison(typed.comparison);
      setComparisonReason(typed.reason ?? null);
    } else {
      setComparison(comparisonData as RevisionComparison | null);
    }
    setLoading(false);
  }, [submissionId, getSubmissionDetail, getBrief, getComparison]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function setSectionState(index: number, state: FeedbackSectionState) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, state } : s)));
  }

  function setSectionComment(index: number, comment: string) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, comment } : s)));
  }

  async function handleSend() {
    setSending(true);
    const result = await sendFeedback({ submissionId, globalEvaluation, sections });
    setSentText(result.feedbackText);
    setSentEmailStatus(result.email.status);
    setSending(false);
    await load();
  }

  function handleCopy() {
    if (!sentText) return;
    navigator.clipboard.writeText(sentText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleValidate() {
    await updateSubmissionStatus(submissionId, "accepted");
    await load();
  }

  async function handleRequestRevision() {
    await updateSubmissionStatus(submissionId, "revision_required");
    await load();
  }

  async function handleResolveCorrection(id: string) {
    await updateCorrectionStatus(id, "resolved");
    await load();
  }

  if (loading || !submission) {
    return <div className="p-8 text-center text-slate-400">Chargement...</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-6">
      <div>
        <button type="button" onClick={() => router.push("/dashboard/supervisor")} className="text-sm font-semibold text-slate-500 hover:text-acadia-blue">
          ← Mes étudiants
        </button>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-acadia-blue">{studentName}</p>
            <h1 className="mt-1 text-2xl font-bold text-acadia-navy">{submission.snapshot.project.title}</h1>
            <p className="mt-1 text-sm text-slate-500">
              Version {submission.version} · {submission.snapshot.project.level ?? "Niveau non précisé"} ·{" "}
              {new Date(submission.submittedAt).toLocaleDateString("fr-FR")}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRequestRevision}
              className="inline-flex items-center gap-2 rounded-xl border border-amber-300 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-50"
            >
              <XCircle className="h-4 w-4" /> Demander une révision
            </button>
            <button
              type="button"
              onClick={handleValidate}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="h-4 w-4" /> Valider cette version
            </button>
          </div>
        </div>
        {submission.studentMessage && (
          <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600">« {submission.studentMessage} »</p>
        )}
      </div>

      {/* RÉSUMÉ ACADIA */}
      {brief && (
        <section className="rounded-3xl border border-acadia-blue-100 bg-acadia-blue-50/40 p-6">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-acadia-blue">
            <Sparkles className="h-3.5 w-3.5" /> Résumé ACADIA
          </p>
          <p
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-bold ${
              brief.overallState === "solide"
                ? "bg-emerald-100 text-emerald-700"
                : brief.overallState === "a_verifier"
                ? "bg-amber-100 text-amber-700"
                : "bg-rose-100 text-rose-700"
            }`}
          >
            {brief.overallState === "solide" ? "🟢 Solide" : brief.overallState === "a_verifier" ? "🟠 À vérifier" : "🔴 Bloquant"}
            {" · "}
            {brief.progressPercent}% de préparation structurelle
          </p>

          {brief.inconsistencies.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-slate-500">Incohérences détectées</p>
              <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                {brief.inconsistencies.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}
          {brief.incompleteSections.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-slate-500">Sections incomplètes</p>
              <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                {brief.incompleteSections.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}
          {brief.importantQuestions.length > 0 && (
            <div className="mt-3">
              <p className="text-xs font-bold text-slate-500">Questions importantes</p>
              <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
                {brief.importantQuestions.map((i) => (
                  <li key={i}>{i}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="mt-3 text-2xs italic text-slate-400">{brief.disclaimer}</p>
        </section>
      )}

      {/* COMPARAISON */}
      {comparison ? (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-acadia-blue">
            <GitCompare className="h-3.5 w-3.5" /> Comparaison avec la version précédente
          </p>
          <ComparisonList title="Ajouté" items={comparison.added} />
          <ComparisonList title="Retiré" items={comparison.removed} />
          <ComparisonList title="Modifié" items={comparison.modified} />
          <ComparisonList title="Corrections potentiellement traitées" items={comparison.potentiallyResolved} />
          <ComparisonList title="Corrections toujours ouvertes" items={comparison.unresolved} />
        </section>
      ) : (
        comparisonReason && <p className="text-sm text-slate-400 italic">{comparisonReason}</p>
      )}

      {/* CORRECTIONS PRÉCÉDENTES */}
      {corrections.length > 0 && (
        <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Corrections précédentes</p>
          <div className="mt-3 space-y-2">
            {corrections.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-acadia-navy">{c.section}</p>
                  <p className="text-xs text-slate-500">{c.description}</p>
                </div>
                {c.status === "open" ? (
                  <button
                    type="button"
                    onClick={() => handleResolveCorrection(c.id)}
                    className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100"
                  >
                    Marquer résolue
                  </button>
                ) : (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-2xs font-semibold text-slate-500">{c.status}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* VERSION ACTUELLE */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase tracking-wider text-acadia-blue">Version actuelle</p>
        <SubmissionSnapshotView snapshot={submission.snapshot} />
      </div>

      {/* VOTRE FEEDBACK */}
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Votre feedback</p>

        <label className="mt-3 block text-sm font-semibold text-slate-600">
          Évaluation générale / prochaine étape
          <textarea
            value={globalEvaluation}
            onChange={(e) => setGlobalEvaluation(e.target.value)}
            rows={3}
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="Ex. : Corriger la justification de l'échantillonnage puis soumettre la version 3."
          />
        </label>

        <div className="mt-4 space-y-2">
          {sections.map((section, index) => (
            <div key={section.sectionId} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-acadia-navy">{section.label}</span>
                <div className="flex gap-1.5">
                  {(["ok", "a_corriger", "bloquant"] as FeedbackSectionState[]).map((state) => (
                    <button
                      key={state}
                      type="button"
                      onClick={() => setSectionState(index, state)}
                      className={`rounded-full px-2.5 py-1 text-2xs font-bold ${
                        section.state === state ? STATE_COLOR[state] : "bg-slate-50 text-slate-400"
                      }`}
                    >
                      {STATE_LABEL[state]}
                    </button>
                  ))}
                </div>
              </div>
              {section.state !== "ok" && (
                <input
                  value={section.comment ?? ""}
                  onChange={(e) => setSectionComment(index, e.target.value)}
                  placeholder="Commentaire (optionnel)"
                  className="mt-2 w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-5">
          <ResearchPrimaryButton onClick={handleSend} disabled={sending}>
            {sending ? "Envoi..." : "Envoyer le feedback"}
          </ResearchPrimaryButton>
        </div>

        {sentText && (
          <div className="mt-4 rounded-2xl bg-slate-50 p-4">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-500">Feedback enregistré dans ACADIA</p>
              <div className="flex gap-2">
                <button type="button" onClick={handleCopy} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-2xs font-semibold text-acadia-blue shadow-sm">
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />} Copier le feedback
                </button>
                <a
                  href={`https://wa.me/?text=${encodeURIComponent(sentText)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-2xs font-semibold text-emerald-600 shadow-sm"
                >
                  <MessageCircle className="h-3.5 w-3.5" /> Copier pour WhatsApp
                </a>
              </div>
            </div>
            <pre className="mt-2 whitespace-pre-wrap text-xs text-slate-600">{sentText}</pre>
            {sentEmailStatus === "not_configured" && (
              <p className="mt-3 text-2xs text-slate-500">
                Aucun email n&apos;a été envoyé automatiquement (service email non configuré) — l&apos;étudiant verra ce feedback dans
                son espace ACADIA ; utilisez la copie ou WhatsApp ci-dessus si vous souhaitez le prévenir directement.
              </p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function ComparisonList({ title, items }: { title: string; items: { label: string; detail?: string }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mt-3">
      <p className="text-xs font-bold text-slate-500">{title}</p>
      <ul className="mt-1 list-inside list-disc text-sm text-slate-600">
        {items.map((item) => (
          <li key={item.label}>
            {item.label}
            {item.detail ? ` — ${item.detail}` : ""}
          </li>
        ))}
      </ul>
    </div>
  );
}
