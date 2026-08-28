"use client";

import type {
  GeneratedQuestionnaire,
  QuestionnaireQuestion,
  QuestionnaireSection,
} from "@/lib/core/questionnaire/QuestionnaireTypes";

import QuestionEditor from "./QuestionEditor";

type QuestionnaireEditorProps = {
  questionnaire: GeneratedQuestionnaire;

  selectedSection?: QuestionnaireSection;

  selectedQuestionId: string | null;

  onSelectQuestion: (id: string) => void;

  onUpdateQuestion: (
    question: QuestionnaireQuestion
  ) => void;

  onUpdateQuestionText: (
    questionId: string,
    text: string
  ) => void;

  onUpdateQuestionType: (
    questionId: string,
    type: QuestionnaireQuestion["type"]
  ) => void;

  onUpdateQuestionRequired: (
    questionId: string,
    required: boolean
  ) => void;

  onAddOption: (
    questionId: string
  ) => void;

  onUpdateOption: (
    questionId: string,
    optionValue: string,
    label: string
  ) => void;

  onRemoveOption: (
    questionId: string,
    optionValue: string
  ) => void;

  onDeleteQuestion: (
    id: string
  ) => void;

  onAddQuestion: (
    sectionId: string
  ) => void;
};

export default function QuestionnaireEditor({
  questionnaire,
  selectedSection,
  selectedQuestionId,
  onSelectQuestion,
  onUpdateQuestion,
  onUpdateQuestionText,
  onUpdateQuestionType,
  onUpdateQuestionRequired,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
  onDeleteQuestion,
  onAddQuestion,
}: QuestionnaireEditorProps) {
  if (!selectedSection) {
    return (
      <main className="min-w-0 flex-1 p-6 lg:p-10">
        <div className="mx-auto max-w-4xl rounded-3xl bg-white p-12 text-center shadow-sm">

          <h2 className="text-xl font-bold text-slate-900">
            Sélectionnez une section
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Choisissez une section dans le panneau de gauche.
          </p>

        </div>
      </main>
    );
  }

  return (
    <main className="min-w-0 flex-1 p-6 lg:p-10">

      <div className="mx-auto max-w-4xl">

        {/* =================================================
            EN-TÊTE DE SECTION
        ================================================= */}

        <div className="mb-8">

          <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
            Section du questionnaire
          </p>

          <h2 className="mt-2 text-3xl font-bold text-slate-900">
            {selectedSection.title}
          </h2>

          <p className="mt-2 text-slate-500">
            {selectedSection.description}
          </p>

          <div className="mt-4 flex flex-wrap gap-2">

            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
              {selectedSection.questions.length} question
              {selectedSection.questions.length > 1
                ? "s"
                : ""}
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              {selectedSection.type}
            </span>

          </div>

        </div>

        {/* =================================================
            QUESTIONS
        ================================================= */}

        <div className="space-y-5">

          {selectedSection.questions.length === 0 ? (
            <div className="rounded-3xl border-2 border-dashed border-slate-300 bg-white p-12 text-center">

              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 text-2xl">
                📝
              </div>

              <h3 className="mt-4 text-lg font-bold text-slate-900">
                Cette section est vide
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Ajoutez votre première question pour commencer.
              </p>

            </div>
          ) : (
            selectedSection.questions.map(
              (question) => (
                <div
                  key={question.id}
                  onClick={() =>
                    onSelectQuestion(question.id)
                  }
                  className={`rounded-3xl border bg-white p-6 shadow-sm transition ${
                    selectedQuestionId === question.id
                      ? "border-blue-500 ring-2 ring-blue-100"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >

                  <QuestionEditor
                    question={question}

                    onUpdate={
                      onUpdateQuestion
                    }

                    onDelete={() =>
                      onDeleteQuestion(
                        question.id
                      )
                    }

                    onUpdateText={(
                      text: string
                    ) =>
                      onUpdateQuestionText(
                        question.id,
                        text
                      )
                    }

                    onUpdateType={(
                      type: QuestionnaireQuestion["type"]
                    ) =>
                      onUpdateQuestionType(
                        question.id,
                        type
                      )
                    }

                    onUpdateRequired={(
                      required: boolean
                    ) =>
                      onUpdateQuestionRequired(
                        question.id,
                        required
                      )
                    }

                    onAddOption={() =>
                      onAddOption(
                        question.id
                      )
                    }

                    onUpdateOption={(
                      optionValue: string,
                      label: string
                    ) =>
                      onUpdateOption(
                        question.id,
                        optionValue,
                        label
                      )
                    }

                    onRemoveOption={(
                      optionValue: string
                    ) =>
                      onRemoveOption(
                        question.id,
                        optionValue
                      )
                    }
                  />

                </div>
              )
            )
          )}

        </div>

        {/* =================================================
            AJOUTER UNE QUESTION
        ================================================= */}

        <button
          type="button"
          onClick={() =>
            onAddQuestion(
              selectedSection.id
            )
          }
          className="mt-6 w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-5 text-sm font-bold text-slate-500 transition hover:border-blue-500 hover:bg-blue-50 hover:text-blue-600"
        >
          + Ajouter une question
        </button>

        {/* =================================================
            INFORMATIONS
        ================================================= */}

        <div className="mt-6 rounded-2xl bg-blue-50 p-5">

          <p className="text-sm font-bold text-blue-800">
            🧠 Intelligence méthodologique ACADIA
          </p>

          <p className="mt-2 text-sm leading-6 text-blue-700">
            Les modifications effectuées ici changent
            la formulation du questionnaire sans supprimer
            les informations méthodologiques associées aux
            questions.
          </p>

        </div>

      </div>

    </main>
  );
}