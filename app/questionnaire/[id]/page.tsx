"use client";

import { useEffect, useState } from "react";

import type {
  GeneratedQuestionnaire,
  QuestionnaireQuestion,
} from "@/lib/core/questionnaire/QuestionnaireTypes";

type Props = {
  params: Promise<{
    id: string;
  }>;
};

type AnswerValue =
  | string
  | string[]
  | number
  | null;

export default function PublicQuestionnairePage({
  params,
}: Props) {
  const [questionnaire, setQuestionnaire] =
    useState<GeneratedQuestionnaire | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState<string | null>(null);

  const [submitting, setSubmitting] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [submitError, setSubmitError] =
    useState<string | null>(null);

  useEffect(() => {
    async function loadQuestionnaire() {
      try {
        const { id } = await params;

        const storageKey =
          `acadia-questionnaire-${id}`;

        const stored =
          localStorage.getItem(storageKey);

        if (!stored) {
          setError(
            "Ce questionnaire n'existe pas ou n'est plus disponible."
          );

          setLoading(false);

          return;
        }

        const parsed =
          JSON.parse(
            stored
          ) as GeneratedQuestionnaire;

        setQuestionnaire(parsed);
      } catch (error) {
        console.error(
          "Erreur lors du chargement du questionnaire :",
          error
        );

        setError(
          "Impossible de charger ce questionnaire."
        );
      } finally {
        setLoading(false);
      }
    }

    loadQuestionnaire();
  }, [params]);

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    if (!questionnaire) {
      return;
    }

    setSubmitError(null);

    const formData =
      new FormData(event.currentTarget);

    const answers: {
      questionId: string;
      value: AnswerValue;
    }[] = [];

    const missingQuestions: string[] = [];

    const questions =
      questionnaire.sections.flatMap(
        (section) =>
          section.questions
      );

    for (const question of questions) {
      let value: AnswerValue = null;

      if (
        question.type ===
        "multiple_choice"
      ) {
        const values =
          formData.getAll(
            question.id
          );

        value =
          values.length > 0
            ? values.map(String)
            : [];

      } else {
        const rawValue =
          formData.get(
            question.id
          );

        if (
          rawValue !== null &&
          rawValue !== ""
        ) {
          if (
            question.type ===
            "number"
          ) {
            value =
              Number(rawValue);
          } else {
            value =
              String(rawValue);
          }
        }
      }

      const isEmpty =
        value === null ||
        value === "" ||
        (Array.isArray(value) &&
          value.length === 0);

      if (
        question.required &&
        isEmpty
      ) {
        missingQuestions.push(
          `Question ${question.number}`
        );
      }

      answers.push({
        questionId:
          question.id,
        value,
      });
    }

    if (
      missingQuestions.length > 0
    ) {
      setSubmitError(
        `Veuillez répondre aux questions obligatoires : ${missingQuestions.join(
          ", "
        )}.`
      );

      return;
    }

    setSubmitting(true);

    try {
      const { id } = await params;

      const response =
        await fetch(
          `/api/questionnaire/${id}/responses`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              questionnaireId: id,
              answers,
            }),
          }
        );

      const data =
        await response.json();

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.message ||
            "Impossible d'enregistrer les réponses."
        );
      }

      setSubmitted(true);

      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
    } catch (error) {
      console.error(
        "Erreur lors de l'envoi :",
        error
      );

      setSubmitError(
        "Une erreur est survenue lors de l'enregistrement de vos réponses. Veuillez réessayer."
      );
    } finally {
      setSubmitting(false);
    }
  }

  /* =====================================================
     CHARGEMENT
  ===================================================== */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100">
        <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600" />

          <p className="mt-5 font-semibold text-slate-700">
            Chargement du questionnaire...
          </p>
        </div>
      </main>
    );
  }

  /* =====================================================
     ERREUR
  ===================================================== */

  if (
    error ||
    !questionnaire
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6">
        <div className="max-w-lg rounded-3xl bg-white p-10 text-center shadow-sm">
          <div className="text-5xl">
            📋
          </div>

          <h1 className="mt-5 text-2xl font-bold text-slate-900">
            Questionnaire indisponible
          </h1>

          <p className="mt-3 text-slate-500">
            {error}
          </p>
        </div>
      </main>
    );
  }

  /* =====================================================
     SUCCÈS
  ===================================================== */

  if (submitted) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 px-6 py-10">
        <div className="w-full max-w-2xl rounded-3xl bg-white p-10 text-center shadow-sm">

          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-4xl text-green-600">
            ✓
          </div>

          <p className="mt-7 text-xs font-bold uppercase tracking-wider text-blue-600">
            ACADIA — Questionnaire d'enquête
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Merci pour votre participation
          </h1>

          <p className="mx-auto mt-4 max-w-xl leading-7 text-slate-600">
            Votre réponse a été enregistrée
            avec succès.
          </p>

          <div className="mt-8 rounded-2xl bg-green-50 p-5 text-sm text-green-700">
            Votre contribution a bien été
            prise en compte dans le cadre de
            cette étude.
          </div>

        </div>
      </main>
    );
  }

  /* =====================================================
     QUESTIONNAIRE
  ===================================================== */

  return (
    <main className="min-h-screen bg-slate-100 px-4 py-8 sm:px-6">

      <div className="mx-auto max-w-3xl">

        {/* HEADER */}

        <header className="rounded-3xl bg-white p-8 shadow-sm">

          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
            ACADIA — Questionnaire d'enquête
          </p>

          <h1 className="mt-3 text-2xl font-bold leading-tight text-slate-900 sm:text-3xl">
            {questionnaire.title}
          </h1>

          <p className="mt-4 leading-7 text-slate-600">
            {questionnaire.description}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">

            <span className="rounded-full bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700">
              {questionnaire.totalQuestions} questions
            </span>

            <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
              Environ{" "}
              {questionnaire.estimatedDuration}{" "}
              min
            </span>

          </div>

        </header>

        {/* INTRODUCTION */}

        <section className="mt-6 rounded-3xl bg-white p-8 shadow-sm">

          <h2 className="text-xl font-bold text-slate-900">
            Bienvenue
          </h2>

          <p className="mt-3 leading-7 text-slate-600">
            Merci de prendre quelques minutes
            pour participer à cette enquête.
            Vos réponses seront utilisées
            uniquement dans le cadre de
            l'étude présentée ci-dessus.
          </p>

          <p className="mt-3 leading-7 text-slate-600">
            Répondez aux questions selon votre
            expérience et votre perception.
            Il n'y a pas de bonne ou de mauvaise
            réponse.
          </p>

        </section>

        {/* FORMULAIRE */}

        <form
          onSubmit={handleSubmit}
          className="mt-6 space-y-6"
        >

          {questionnaire.sections
            .filter(
              (section) =>
                section.questions.length > 0
            )
            .map((section) => (

              <section
                key={section.id}
                className="rounded-3xl bg-white p-8 shadow-sm"
              >

                <div className="border-b border-slate-100 pb-5">

                  <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                    Section
                  </p>

                  <h2 className="mt-2 text-xl font-bold text-slate-900">
                    {section.title}
                  </h2>

                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    {section.description}
                  </p>

                </div>

                <div className="mt-6 space-y-8">

                  {section.questions.map(
                    (question) => (
                      <PublicQuestion
                        key={question.id}
                        question={question}
                      />
                    )
                  )}

                </div>

              </section>

            ))}

          {/* ERREUR */}

          {submitError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
              {submitError}
            </div>
          )}

          {/* SUBMIT */}

          <div className="rounded-3xl bg-white p-8 shadow-sm">

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-2xl bg-blue-600 px-6 py-4 text-base font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting
                ? "Enregistrement..."
                : "Envoyer mes réponses"}
            </button>

            <p className="mt-4 text-center text-xs text-slate-400">
              Vos réponses seront traitées
              dans le cadre de cette étude.
            </p>

          </div>

        </form>

      </div>
    </main>
  );
}

/* =====================================================
   QUESTION PUBLIQUE
===================================================== */

function PublicQuestion({
  question,
}: {
  question: QuestionnaireQuestion;
}) {
  return (
    <div>

      <div className="flex items-start gap-3">

        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
          {question.number}
        </span>

        <div className="flex-1">

          <label className="text-base font-semibold leading-7 text-slate-900">

            {question.text}

            {question.required && (
              <span className="ml-1 text-red-500">
                *
              </span>
            )}

          </label>

          {/* LIKERT / ECHELLES */}

          {(question.scale &&
            question.scale.length > 0) && (

            <div className="mt-4 space-y-2">

              {question.scale.map(
                (option) => (

                  <label
                    key={option.value}
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-blue-400 hover:bg-blue-50"
                  >

                    <input
                      type="radio"
                      name={question.id}
                      value={option.value}
                      className="h-4 w-4"
                    />

                    <span className="text-sm text-slate-700">
                      {option.label}
                    </span>

                  </label>

                )
              )}

            </div>
          )}

          {/* OPTIONS */}

          {question.options &&
            question.options.length > 0 && (

              <div className="mt-4 space-y-2">

                {question.options.map(
                  (option) => (

                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-blue-400 hover:bg-blue-50"
                    >

                      <input
                        type={
                          question.type ===
                          "multiple_choice"
                            ? "checkbox"
                            : "radio"
                        }
                        name={question.id}
                        value={option.value}
                        className="h-4 w-4"
                      />

                      <span className="text-sm text-slate-700">
                        {option.label}
                      </span>

                    </label>

                  )
                )}

              </div>
            )}

          {/* TEXTE */}

          {(question.type ===
            "text" ||
            question.type ===
              "long_text") && (

            <textarea
              name={question.id}
              rows={
                question.type ===
                "long_text"
                  ? 5
                  : 3
              }
              placeholder="Votre réponse..."
              className="mt-4 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

          )}

          {/* NOMBRE */}

          {question.type ===
            "number" && (

            <input
              type="number"
              name={question.id}
              className="mt-4 w-full rounded-xl border border-slate-200 p-4 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

          )}

        </div>

      </div>

    </div>
  );
}