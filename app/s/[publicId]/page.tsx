"use client";

// ============================================================
// ACADIA SURVEY — Page publique du répondant
//
// Aucune authentification, aucun dashboard, aucun menu administrateur.
// Réutilise exclusivement /api/s/[publicId] et /api/s/[publicId]/responses
// (aucun second système de collecte). Le frontend n'affiche jamais une
// confirmation avant la réponse réelle du serveur. Un brouillon local
// (réponses + position) est conservé pour survivre à une navigation ou
// une coupure réseau — jamais de donnée sensible au-delà de ce que le
// répondant a lui-même saisi, et toujours effacé après soumission.
// ============================================================

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import Logo from "@/components/shared/Logo";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2, Send } from "lucide-react";
import type { SurveyCategory, SurveyQuestion } from "@/lib/core/survey/SurveyTypes";

interface PublicSurvey {
  id: string;
  publicId: string;
  title: string;
  description?: string;
  institution?: string;
  institutionLogoUrl?: string;
  isAnonymous: boolean;
  categories: SurveyCategory[];
  questions: SurveyQuestion[];
}

interface AnswerValue {
  optionId?: string;
  optionIds?: string[];
  valueText?: string;
}

type Answers = Record<string, AnswerValue>;

interface Draft {
  categoryId?: string;
  answers: Answers;
  index: number;
  submissionKey?: string;
}

type Phase = "loading" | "unavailable" | "welcome" | "flow" | "success";

function draftKey(publicId: string) {
  return `acadia_survey_draft_${publicId}`;
}

function loadDraft(publicId: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(draftKey(publicId));
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function saveDraft(publicId: string, draft: Draft) {
  try {
    window.localStorage.setItem(draftKey(publicId), JSON.stringify(draft));
  } catch {
    // Stockage local indisponible (navigation privée, quota) — sans
    // conséquence : seule la réponse confirmée par le serveur compte.
  }
}

function clearDraft(publicId: string) {
  try {
    window.localStorage.removeItem(draftKey(publicId));
  } catch {
    // Rien à faire si le stockage local est indisponible.
  }
}

function isVisible(question: SurveyQuestion, categoryId?: string): boolean {
  if (!question.visibleForCategoryIds || question.visibleForCategoryIds.length === 0) return true;
  return categoryId ? question.visibleForCategoryIds.includes(categoryId) : false;
}

function isAnswered(question: SurveyQuestion, answer?: AnswerValue): boolean {
  if (!answer) return false;
  if (question.type === "multiple_choice") return Boolean(answer.optionIds && answer.optionIds.length > 0);
  if (question.type === "single_choice" || question.type === "scale" || question.type === "category") return Boolean(answer.optionId);
  return Boolean(answer.valueText && answer.valueText.trim().length > 0);
}

function resolveCategoryId(question: SurveyQuestion, optionId: string | undefined, categories: SurveyCategory[]): string | undefined {
  if (!optionId) return undefined;
  const option = question.options.find((o) => o.id === optionId);
  if (!option) return undefined;
  return categories.find((c) => c.label === option.label)?.id;
}

function estimateDuration(questionCount: number): string {
  const minutes = Math.max(1, Math.round((questionCount * 20) / 60));
  return `Environ ${minutes} minute${minutes > 1 ? "s" : ""}`;
}

function ChoiceOption({
  name,
  type,
  checked,
  label,
  onChange,
}: {
  name: string;
  type: "radio" | "checkbox";
  checked: boolean;
  label: string;
  onChange: () => void;
}) {
  return (
    <label className="flex min-h-[3rem] cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition has-[:checked]:border-acadia-blue has-[:checked]:bg-acadia-blue-50 has-[:checked]:text-acadia-blue">
      <input type={type} name={name} checked={checked} onChange={onChange} className="h-4 w-4 shrink-0 accent-acadia-blue" />
      <span className="min-w-0 break-words">{label}</span>
    </label>
  );
}

function QuestionField({ question, value, onChange }: { question: SurveyQuestion; value: AnswerValue; onChange: (v: AnswerValue) => void }) {
  switch (question.type) {
    case "short_text":
    case "institution":
    case "faculty":
    case "level":
      return (
        <input
          type="text"
          value={value.valueText ?? ""}
          onChange={(e) => onChange({ valueText: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-base focus:border-acadia-blue focus:outline-none"
          placeholder="Votre réponse"
        />
      );
    case "long_text":
      return (
        <textarea
          value={value.valueText ?? ""}
          onChange={(e) => onChange({ valueText: e.target.value })}
          rows={5}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-base focus:border-acadia-blue focus:outline-none"
          placeholder="Votre réponse"
        />
      );
    case "number":
    case "age":
      return (
        <input
          type="number"
          inputMode="numeric"
          value={value.valueText ?? ""}
          onChange={(e) => onChange({ valueText: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-base focus:border-acadia-blue focus:outline-none"
          placeholder={question.type === "age" ? "Âge" : "Nombre"}
        />
      );
    case "date":
      return (
        <input
          type="date"
          value={value.valueText ?? ""}
          onChange={(e) => onChange({ valueText: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-base focus:border-acadia-blue focus:outline-none"
        />
      );
    case "boolean":
      return (
        <div className="grid grid-cols-2 gap-3">
          {["Oui", "Non"].map((label) => (
            <ChoiceOption key={label} name={question.id} type="radio" checked={value.valueText === label} label={label} onChange={() => onChange({ valueText: label })} />
          ))}
        </div>
      );
    case "single_choice":
    case "scale":
    case "category":
      return (
        <div className="space-y-2.5">
          {question.options.map((o) => (
            <ChoiceOption key={o.id} name={question.id} type="radio" checked={value.optionId === o.id} label={o.label} onChange={() => onChange({ optionId: o.id })} />
          ))}
        </div>
      );
    case "multiple_choice":
      return (
        <div className="space-y-2.5">
          {question.options.map((o) => {
            const checked = value.optionIds?.includes(o.id) ?? false;
            return (
              <ChoiceOption
                key={o.id}
                name={question.id}
                type="checkbox"
                checked={checked}
                label={o.label}
                onChange={() => {
                  const current = value.optionIds ?? [];
                  const next = checked ? current.filter((id) => id !== o.id) : [...current, o.id];
                  onChange({ optionIds: next });
                }}
              />
            );
          })}
        </div>
      );
    default:
      return null;
  }
}

function CenteredCard({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-10">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-10">{children}</div>
    </div>
  );
}

export default function SurveyPublicPage() {
  const params = useParams<{ publicId: string }>();
  const publicId = params.publicId;

  const [phase, setPhase] = useState<Phase>("loading");
  const [message, setMessage] = useState("Cette enquête n'est pas disponible.");
  const [survey, setSurvey] = useState<PublicSurvey | null>(null);

  const [categoryId, setCategoryId] = useState<string | undefined>(undefined);
  const [answers, setAnswers] = useState<Answers>({});
  const [index, setIndex] = useState(0);
  const [fieldError, setFieldError] = useState<string | null>(null);

  // Identifie cette tentative de soumission de façon stable, y compris à
  // travers un double clic, une coupure réseau ou une réponse serveur
  // perdue : généré une seule fois par tentative (pas par requête), envoyé
  // à l'identique à chaque nouvel essai — voir /api/s/[publicId]/responses
  // pour la vérification d'idempotence côté serveur.
  const [submissionKey, setSubmissionKey] = useState<string>("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateNotice, setDuplicateNotice] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`/api/s/${publicId}`, { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setMessage(data.error ?? "Cette enquête n'est pas disponible.");
          setPhase("unavailable");
          return;
        }
        setSurvey(data.survey);

        const draft = loadDraft(publicId);
        if (draft && (draft.index > 0 || Object.keys(draft.answers).length > 0)) {
          setCategoryId(draft.categoryId);
          setAnswers(draft.answers);
          setIndex(draft.index);
          setSubmissionKey(draft.submissionKey || crypto.randomUUID());
          setPhase("flow");
        } else {
          setSubmissionKey(crypto.randomUUID());
          setPhase("welcome");
        }
      } catch {
        setMessage("Cette enquête n'est pas disponible pour le moment. Vérifiez votre connexion et réessayez.");
        setPhase("unavailable");
      }
    })();
  }, [publicId]);

  const visibleQuestions = useMemo(() => {
    if (!survey) return [];
    return survey.questions.filter((q) => isVisible(q, categoryId));
  }, [survey, categoryId]);

  useEffect(() => {
    if (phase !== "flow" || !survey) return;
    saveDraft(publicId, { categoryId, answers, index, submissionKey });
  }, [phase, survey, publicId, categoryId, answers, index, submissionKey]);

  if (phase === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Loader2 className="h-6 w-6 animate-spin text-acadia-blue" />
      </div>
    );
  }

  if (phase === "unavailable") {
    return (
      <CenteredCard>
        <Logo variant="mark" className="mx-auto h-11 w-11" />
        <p className="mt-6 text-lg font-bold text-acadia-navy">{message}</p>
        <p className="mt-2 text-sm text-slate-500">Contactez l&apos;organisateur de cette enquête pour plus d&apos;informations.</p>
      </CenteredCard>
    );
  }

  if (phase === "success") {
    return (
      <CenteredCard>
        {survey?.institutionLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- image d'institution servie dynamiquement par /api/survey/logo/[documentId]
          <img src={survey.institutionLogoUrl} alt={survey.institution ?? "Logo de l'institution"} className="mx-auto h-12 w-auto max-w-[160px] object-contain" />
        ) : (
          <Logo variant="full" className="mx-auto h-auto w-32" />
        )}
        <CheckCircle2 className="mx-auto mt-6 h-12 w-12 text-emerald-500" />
        <p className="mt-4 text-lg font-bold text-acadia-navy">Merci pour votre participation.</p>
        <p className="mt-2 text-sm text-slate-500">Votre réponse a bien été enregistrée.</p>
        <p className="mt-2 text-sm text-slate-500">
          Votre participation contribue à mieux comprendre les besoins et les expériences des participants.
        </p>
        <span className="mt-4 inline-flex rounded-full bg-emerald-50 px-3 py-1 text-2xs font-bold uppercase tracking-wide text-emerald-700">
          Enquête terminée
        </span>
        {survey?.institutionLogoUrl && <p className="mt-4 text-2xs text-slate-300">Une enquête créée avec ACADIA</p>}

        <div className="mt-8 border-t border-slate-100 pt-6">
          <p className="text-xs text-slate-400">Vous souhaitez vous aussi créer une enquête ?</p>
          <Link
            href="/"
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-acadia-blue hover:underline"
          >
            Découvrir ACADIA <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </CenteredCard>
    );
  }

  if (duplicateNotice) {
    return (
      <CenteredCard>
        <Logo variant="mark" className="mx-auto h-11 w-11" />
        <p className="mt-6 text-lg font-bold text-acadia-navy">Réponse déjà enregistrée</p>
        <p className="mt-2 text-sm text-slate-500">{duplicateNotice}</p>
      </CenteredCard>
    );
  }

  if (!survey) return null;

  if (phase === "flow" && visibleQuestions.length === 0) {
    return (
      <CenteredCard>
        <Logo variant="mark" className="mx-auto h-11 w-11" />
        <p className="mt-6 text-lg font-bold text-acadia-navy">Cette enquête n&apos;est pas disponible.</p>
        <p className="mt-2 text-sm text-slate-500">Contactez l&apos;organisateur de cette enquête pour plus d&apos;informations.</p>
      </CenteredCard>
    );
  }

  if (phase === "welcome") {
    return (
      <CenteredCard>
        {survey.institutionLogoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- image d'institution servie dynamiquement par /api/survey/logo/[documentId]
          <img src={survey.institutionLogoUrl} alt={survey.institution ?? "Logo de l'institution"} className="mx-auto h-14 w-auto max-w-[180px] object-contain" />
        ) : (
          <Logo variant="full" className="mx-auto h-auto w-32" />
        )}
        <h1 className="mt-6 text-xl font-bold text-acadia-navy sm:text-2xl">{survey.title}</h1>
        {survey.description && <p className="mt-3 text-sm text-slate-500">{survey.description}</p>}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-2xs">
          {survey.institution && <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">{survey.institution}</span>}
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">{estimateDuration(survey.questions.length)}</span>
          <span className="rounded-full bg-slate-100 px-3 py-1.5 font-semibold text-slate-600">
            {survey.questions.length} question{survey.questions.length > 1 ? "s" : ""}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setPhase("flow")}
          className="mt-8 flex w-full items-center justify-center gap-2 rounded-2xl bg-acadia-blue px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-acadia-blue-dark"
        >
          Commencer <ArrowRight className="h-4 w-4" />
        </button>
        <p className="mt-4 text-2xs text-slate-400">
          {survey.isAnonymous ? "Vos réponses sont anonymes." : "Vos réponses sont traitées de façon confidentielle."}
        </p>
        {survey.institutionLogoUrl && <p className="mt-3 text-2xs text-slate-300">Une enquête créée avec ACADIA</p>}
      </CenteredCard>
    );
  }

  // phase === "flow"
  const question = visibleQuestions[Math.min(index, visibleQuestions.length - 1)];
  const total = visibleQuestions.length;
  const isLast = index === total - 1;
  const currentAnswer = answers[question.id] ?? {};

  function updateAnswer(v: AnswerValue) {
    setFieldError(null);
    setAnswers((prev) => ({ ...prev, [question.id]: v }));
    if (question.type === "category") {
      const resolved = resolveCategoryId(question, v.optionId, survey!.categories);
      setCategoryId(resolved);
    }
  }

  function validateCurrent(): boolean {
    if (question.required && !isAnswered(question, answers[question.id])) {
      setFieldError("Cette question est obligatoire.");
      return false;
    }
    return true;
  }

  function goNext() {
    if (!validateCurrent()) return;
    setFieldError(null);
    setIndex((i) => Math.min(i + 1, total - 1));
  }

  function goPrevious() {
    setFieldError(null);
    setIndex((i) => Math.max(0, i - 1));
  }

  async function handleSubmit() {
    if (submitting) return;
    if (!validateCurrent()) return;

    for (let i = 0; i < visibleQuestions.length; i++) {
      const q = visibleQuestions[i];
      if (q.required && !isAnswered(q, answers[q.id])) {
        setIndex(i);
        setFieldError("Cette question est obligatoire.");
        return;
      }
    }

    let institution: string | undefined;
    let faculty: string | undefined;
    let level: string | undefined;
    let age: number | undefined;
    for (const q of visibleQuestions) {
      const a = answers[q.id];
      if (!a?.valueText) continue;
      if (q.type === "institution") institution = a.valueText;
      if (q.type === "faculty") faculty = a.valueText;
      if (q.type === "level") level = a.valueText;
      if (q.type === "age") age = Number(a.valueText) || undefined;
    }

    const payload = {
      categoryId,
      institution,
      faculty,
      level,
      age,
      submissionKey,
      answers: visibleQuestions
        .filter((q) => isAnswered(q, answers[q.id]))
        .map((q) => ({ questionId: q.id, ...answers[q.id] })),
    };

    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch(`/api/s/${survey!.publicId}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 201) {
        clearDraft(publicId);
        setPhase("success");
        return;
      }
      if (res.status === 409) {
        clearDraft(publicId);
        setDuplicateNotice(data.error ?? "Une réponse a déjà été enregistrée depuis cet appareil pour cette enquête.");
        return;
      }
      if (res.status === 410) {
        clearDraft(publicId);
        setMessage(data.error ?? "Cette enquête n'est plus disponible.");
        setPhase("unavailable");
        return;
      }
      setSubmitError("Nous n'avons pas pu enregistrer votre réponse.");
    } catch {
      setSubmitError("Nous n'avons pas pu enregistrer votre réponse.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-6 sm:py-10">
      <div className="mx-auto w-full max-w-md">
        <div className="flex items-center gap-2.5">
          {survey.institutionLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- image d'institution servie dynamiquement par /api/survey/logo/[documentId]
            <img src={survey.institutionLogoUrl} alt={survey.institution ?? "Logo de l'institution"} className="h-7 w-auto max-w-[80px] object-contain" />
          ) : (
            <Logo variant="mark" className="h-7 w-7" />
          )}
          <p className="min-w-0 truncate text-xs font-semibold text-slate-500">{survey.title}</p>
        </div>

        <div className="mt-5 flex items-center justify-between text-xs font-semibold text-slate-400">
          <span>Question {index + 1} sur {total}</span>
          <span>{Math.round(((index + 1) / total) * 100)}%</span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
          <div className="h-full rounded-full bg-acadia-blue transition-all" style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>

        <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6">
          <p className="text-base font-semibold text-acadia-navy">
            {question.text}
            {question.required && <span className="ml-1 text-red-500">*</span>}
          </p>
          <div className="mt-4">
            <QuestionField question={question} value={currentAnswer} onChange={updateAnswer} />
          </div>
          {fieldError && <p className="mt-3 text-xs font-semibold text-red-600">{fieldError}</p>}
        </div>

        {submitError && (
          <div className="mt-4 rounded-xl bg-red-50 px-3 py-2.5">
            <p className="text-xs font-semibold text-red-600">{submitError}</p>
            <p className="mt-1 text-2xs text-red-500">Vos réponses sont conservées. Vous pouvez réessayer.</p>
            <button type="button" onClick={handleSubmit} disabled={submitting} className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-2xs font-semibold text-white hover:bg-red-700 disabled:opacity-50">
              Réessayer
            </button>
          </div>
        )}

        <div className="mt-5 flex items-center justify-between gap-3">
          {index > 0 ? (
            <button
              type="button"
              onClick={goPrevious}
              disabled={submitting}
              className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" /> Précédent
            </button>
          ) : (
            <span />
          )}

          {isLast ? (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-acadia-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-acadia-blue-dark disabled:cursor-not-allowed disabled:opacity-60 sm:flex-initial"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Enregistrement de votre réponse...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" /> Terminer l&apos;enquête
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-acadia-blue px-5 py-3 text-sm font-semibold text-white transition hover:bg-acadia-blue-dark sm:flex-initial"
            >
              Suivant <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
