"use client";

import type {
  GeneratedQuestionnaire,
  QuestionnaireSection,
  QuestionnaireQuestion,
} from "@/lib/core/questionnaire/QuestionnaireTypes";

type QuestionnairePreviewProps = {
  questionnaire: GeneratedQuestionnaire;
};

export default function QuestionnairePreview({
  questionnaire,
}: QuestionnairePreviewProps) {
  return (
    <aside className="w-full bg-slate-50 p-6 lg:w-[420px] lg:border-l lg:border-slate-200">
      <div className="sticky top-6">

        {/* HEADER */}
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Aperçu
          </p>

          <h2 className="mt-2 text-xl font-bold text-slate-900">
            Questionnaire final
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Voici ce que verra le répondant.
          </p>
        </div>

        {/* CARTE DU QUESTIONNAIRE */}
        <div className="max-h-[calc(100vh-150px)] overflow-y-auto rounded-3xl bg-white shadow-sm">

          {/* TITRE */}
          <div className="border-b border-slate-200 p-6">

            <h3 className="text-lg font-bold leading-7 text-slate-900">
              {questionnaire.title}
            </h3>

            <p className="mt-3 text-sm leading-6 text-slate-500">
              {questionnaire.description}
            </p>

            <div className="mt-4 flex flex-wrap gap-2">

              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
                {questionnaire.totalQuestions} questions
              </span>

              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">
                ≈ {questionnaire.estimatedDuration} min
              </span>

            </div>

          </div>

          {/* SECTIONS */}
          <div className="divide-y divide-slate-100">

            {questionnaire.sections.map(
              (section) => (
                <PreviewSection
                  key={section.id}
                  section={section}
                />
              )
            )}

          </div>

          {/* FIN */}
          <div className="border-t border-slate-200 bg-slate-50 p-6 text-center">

            <p className="text-sm font-semibold text-slate-700">
              Fin du questionnaire
            </p>

            <p className="mt-1 text-xs text-slate-500">
              Merci pour votre participation.
            </p>

          </div>

        </div>

      </div>
    </aside>
  );
}

/* =====================================================
   SECTION PREVIEW
===================================================== */

function PreviewSection({
  section,
}: {
  section: QuestionnaireSection;
}) {
  return (
    <section className="p-6">

      <div className="mb-5">

        <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
          Section
        </p>

        <h4 className="mt-1 font-bold text-slate-900">
          {section.title}
        </h4>

        {section.description && (
          <p className="mt-1 text-xs leading-5 text-slate-500">
            {section.description}
          </p>
        )}

      </div>

      <div className="space-y-6">

        {section.questions.map(
          (question) => (
            <PreviewQuestion
              key={question.id}
              question={question}
            />
          )
        )}

      </div>

    </section>
  );
}

/* =====================================================
   QUESTION PREVIEW
===================================================== */

function PreviewQuestion({
  question,
}: {
  question: QuestionnaireQuestion;
}) {
  return (
    <div>

      {/* QUESTION */}
      <div className="flex gap-3">

        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
          {question.number}
        </span>

        <div className="min-w-0 flex-1">

          <p className="text-sm font-semibold leading-6 text-slate-900">
            {question.text}

            {question.required && (
              <span className="ml-1 text-red-500">
                *
              </span>
            )}
          </p>

        </div>

      </div>

      {/* LIKERT */}
      {question.scale &&
        question.scale.length > 0 && (
          <div className="mt-3 space-y-2 pl-10">

            {question.scale.map(
              (option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                >
                  <input
                    type="radio"
                    name={`preview-${question.id}`}
                    disabled
                    className="h-3.5 w-3.5"
                  />

                  <span className="text-xs text-slate-600">
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
          <div className="mt-3 space-y-2 pl-10">

            {question.options.map(
              (option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2"
                >

                  <input
                    type={
                      question.type ===
                      "multiple_choice"
                        ? "checkbox"
                        : "radio"
                    }
                    name={`preview-${question.id}`}
                    disabled
                    className="h-3.5 w-3.5"
                  />

                  <span className="text-xs text-slate-600">
                    {option.label}
                  </span>

                </label>
              )
            )}

          </div>
        )}

      {/* TEXT */}
      {question.type === "text" && (
        <div className="mt-3 pl-10">

          <div className="h-20 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-400">
            Votre réponse...
          </div>

        </div>
      )}

      {/* NUMBER */}
      {question.type === "number" && (
        <div className="mt-3 pl-10">

          <div className="rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-400">
            Entrez un nombre...
          </div>

        </div>
      )}

    </div>
  );
}