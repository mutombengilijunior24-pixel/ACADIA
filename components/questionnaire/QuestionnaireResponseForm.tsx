"use client";

import { useState } from "react";

import type {
  GeneratedQuestionnaire,
  QuestionnaireQuestion,
} from "@/lib/core/questionnaire/QuestionnaireTypes";

type Props = {
  questionnaire: GeneratedQuestionnaire;
};

type Answers = Record<
  string,
  string | string[] | number
>;

export default function QuestionnaireResponseForm({
  questionnaire,
}: Props) {
  const [answers, setAnswers] =
    useState<Answers>({});

  const [submitting, setSubmitting] =
    useState(false);

  const [submitted, setSubmitted] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  function updateAnswer(
    questionId: string,
    value: string | string[] | number
  ) {
    setAnswers((previous) => ({
      ...previous,
      [questionId]: value,
    }));
  }

  function toggleMultipleChoice(
    questionId: string,
    value: string
  ) {
    const current =
      answers[questionId];

    const currentValues =
      Array.isArray(current)
        ? current
        : [];

    const exists =
      currentValues.includes(value);

    const next = exists
      ? currentValues.filter(
          (item) => item !== value
        )
      : [
          ...currentValues,
          value,
        ];

    updateAnswer(
      questionId,
      next
    );
  }

  function validateRequiredQuestions() {
    const missing =
      questionnaire.sections
        .flatMap(
          (section) =>
            section.questions
        )
        .filter((question) => {
          if (!question.required) {
            return false;
          }

          const answer =
            answers[question.id];

          if (
            answer === undefined ||
            answer === null ||
            answer === ""
          ) {
            return true;
          }

          if (
            Array.isArray(answer) &&
            answer.length === 0
          ) {
            return true;
          }

          return false;
        });

    return missing;
  }

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError(null);

    const missing =
      validateRequiredQuestions();

    if (missing.length > 0) {
      setError(
        `Veuillez répondre aux ${missing.length} question(s) obligatoire(s).`
      );

      return;
    }

    setSubmitting(true);

    try {
      const response =
        await fetch(
          `/api/questionnaire/${questionnaire.id}/responses`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              answers:
                Object.entries(
                  answers
                ).map(
                  ([questionId, value]) => ({
                    questionId,
                    value,
                  })
                ),
            }),
          }
        );

      const data =
        await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message ||
            "Erreur lors de l'envoi."
        );
      }

      setSubmitted(true);
    } catch (error) {
      console.error(error);

      setError(
        "Une erreur est survenue lors de l'envoi de vos réponses. Veuillez réessayer."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100 text-3xl">
          ✓
        </div>

        <h2 className="mt-6 text-2xl font-bold text-slate-900">
          Merci pour votre participation
        </h2>

        <p className="mx-auto mt-3 max-w-xl text-slate-600">
          Votre réponse a été enregistrée
          avec succès.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-8"
    >
      {questionnaire.sections.map(
        (section) => (
          <section
            key={section.id}
            className="overflow-hidden rounded-3xl bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 bg-slate-50 p-7">
              <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Section
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                {section.title}
              </h2>

              <p className="mt-2 text-slate-600">
                {section.description}
              </p>
            </div>

            <div className="divide-y divide-slate-100">
              {section.questions.map(
                (question) => (
                  <QuestionResponse
                    key={question.id}
                    question={question}
                    value={
                      answers[
                        question.id
                      ]
                    }
                    onChange={(
                      value
                    ) =>
                      updateAnswer(
                        question.id,
                        value
                      )
                    }
                    onToggleMultiple={
                      toggleMultipleChoice
                    }
                  />
                )
              )}
            </div>
          </section>
        )
      )}

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="w-full rounded-2xl bg-blue-600 px-8 py-5 text-lg font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting
          ? "Enregistrement..."
          : "Envoyer mes réponses"}
      </button>
    </form>
  );
}

function QuestionResponse({
  question,
  value,
  onChange,
  onToggleMultiple,
}: {
  question: QuestionnaireQuestion;
  value:
    | string
    | string[]
    | number
    | undefined;
  onChange: (
    value: string | number
  ) => void;
  onToggleMultiple: (
    questionId: string,
    value: string
  ) => void;
}) {
  return (
    <div className="p-7">
      <div className="flex gap-4">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">
          {question.number}
        </span>

        <div className="flex-1">
          <h3 className="font-semibold leading-7 text-slate-900">
            {question.text}

            {question.required && (
              <span className="ml-1 text-red-500">
                *
              </span>
            )}
          </h3>

          {question.type ===
            "text" ||
          question.type ===
            "long_text" ? (
            <textarea
              rows={
                question.type ===
                "long_text"
                  ? 5
                  : 3
              }
              value={
                typeof value ===
                "string"
                  ? value
                  : ""
              }
              onChange={(event) =>
                onChange(
                  event.target.value
                )
              }
              className="mt-5 w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          ) : null}

          {question.type ===
            "number" && (
            <input
              type="number"
              value={
                value ?? ""
              }
              onChange={(event) =>
                onChange(
                  Number(
                    event.target.value
                  )
                )
              }
              className="mt-5 w-full rounded-xl border border-slate-200 p-4 outline-none focus:border-blue-500"
            />
          )}

          {question.type ===
            "yes_no" && (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: "Oui",
                  value: "yes",
                },
                {
                  label: "Non",
                  value: "no",
                },
              ].map(
                (option) => (
                  <label
                    key={
                      option.value
                    }
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-blue-500"
                  >
                    <input
                      type="radio"
                      name={
                        question.id
                      }
                      checked={
                        value ===
                        option.value
                      }
                      onChange={() =>
                        onChange(
                          option.value
                        )
                      }
                    />

                    {
                      option.label
                    }
                  </label>
                )
              )}
            </div>
          )}

          {(question.type ===
            "single_choice" ||
            question.type ===
              "likert" ||
            question.type ===
              "frequency" ||
            question.type ===
              "importance") && (
            <div className="mt-5 space-y-3">
              {(
                question.options ??
                question.scale ??
                []
              ).map(
                (option) => (
                  <label
                    key={
                      option.value
                    }
                    className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-blue-500 hover:bg-blue-50"
                  >
                    <input
                      type="radio"
                      name={
                        question.id
                      }
                      value={
                        option.value
                      }
                      checked={
                        value ===
                        option.value
                      }
                      onChange={() =>
                        onChange(
                          option.value
                        )
                      }
                    />

                    <span>
                      {
                        option.label
                      }
                    </span>
                  </label>
                )
              )}
            </div>
          )}

          {question.type ===
            "multiple_choice" && (
            <div className="mt-5 space-y-3">
              {(
                question.options ??
                []
              ).map(
                (option) => {
                  const selected =
                    Array.isArray(
                      value
                    ) &&
                    value.includes(
                      option.value
                    );

                  return (
                    <label
                      key={
                        option.value
                      }
                      className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-4 hover:border-blue-500 hover:bg-blue-50"
                    >
                      <input
                        type="checkbox"
                        checked={
                          selected
                        }
                        onChange={() =>
                          onToggleMultiple(
                            question.id,
                            option.value
                          )
                        }
                      />

                      <span>
                        {
                          option.label
                        }
                      </span>
                    </label>
                  );
                }
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}