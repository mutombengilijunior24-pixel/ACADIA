"use client";

import type {
  QuestionnaireQuestion,
  QuestionnaireOption,
  QuestionType,
} from "@/lib/core/questionnaire/QuestionnaireTypes";

type QuestionEditorProps = {
  question: QuestionnaireQuestion;

  onUpdate: (
    question: QuestionnaireQuestion
  ) => void;

  onDelete: () => void;

  onUpdateText?: (
    text: string
  ) => void;

  onUpdateType?: (
    type: QuestionType
  ) => void;

  onUpdateRequired?: (
    required: boolean
  ) => void;

  onAddOption?: () => void;

  onUpdateOption?: (
    optionValue: string,
    label: string
  ) => void;

  onRemoveOption?: (
    optionValue: string
  ) => void;
};

const QUESTION_TYPES: {
  value: QuestionType;
  label: string;
  description: string;
}[] = [
  {
    value: "single_choice",
    label: "Choix unique",
    description:
      "Le répondant sélectionne une seule réponse.",
  },
  {
    value: "multiple_choice",
    label: "Choix multiples",
    description:
      "Le répondant peut sélectionner plusieurs réponses.",
  },
  {
    value: "likert",
    label: "Échelle de Likert",
    description:
      "Mesure le degré d'accord ou d'appréciation.",
  },
  {
    value: "yes_no",
    label: "Oui / Non",
    description:
      "Question fermée à deux modalités.",
  },
  {
    value: "number",
    label: "Numérique",
    description:
      "Réponse sous forme de valeur numérique.",
  },
  {
    value: "text",
    label: "Réponse ouverte",
    description:
      "Le répondant formule librement sa réponse.",
  },
];

export default function QuestionEditor({
  question,
  onUpdate,
  onDelete,
  onUpdateText,
  onUpdateType,
  onUpdateRequired,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: QuestionEditorProps) {
  function update(
    changes: Partial<QuestionnaireQuestion>
  ) {
    onUpdate({
      ...question,
      ...changes,
    });
  }

  function handleTextChange(
    text: string
  ) {
    if (onUpdateText) {
      onUpdateText(text);
      return;
    }

    update({ text });
  }

  function handleTypeChange(
    type: QuestionType
  ) {
    if (onUpdateType) {
      onUpdateType(type);
      return;
    }

    update({ type });
  }

  function handleRequiredChange(
    required: boolean
  ) {
    if (onUpdateRequired) {
      onUpdateRequired(required);
      return;
    }

    update({ required });
  }

  function handleOptionChange(
    optionValue: string,
    label: string
  ) {
    if (onUpdateOption) {
      onUpdateOption(
        optionValue,
        label
      );
      return;
    }

    const options = (
      question.options ?? []
    ).map((option) =>
      option.value === optionValue
        ? {
            ...option,
            label,
          }
        : option
    );

    update({ options });
  }

  function handleRemoveOption(
    optionValue: string
  ) {
    if (onRemoveOption) {
      onRemoveOption(optionValue);
      return;
    }

    const options = (
      question.options ?? []
    ).filter(
      (option) =>
        option.value !== optionValue
    );

    update({ options });
  }

  const currentType =
    QUESTION_TYPES.find(
      (type) =>
        type.value === question.type
    );

  const supportsOptions =
    question.type ===
      "single_choice" ||
    question.type ===
      "multiple_choice";

  const isLikert =
    question.type === "likert";

  const isOpen =
    question.type === "text";

  const isNumber =
    question.type === "number";

  const isYesNo =
    question.type === "yes_no";

  return (
    <div
      onClick={(event) =>
        event.stopPropagation()
      }
    >
      {/* =====================================================
          EN-TÊTE
      ===================================================== */}

      <div className="flex items-start justify-between gap-4">

        <div>
          <div className="flex flex-wrap items-center gap-3">

            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
              Q{question.number}
            </span>

            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-bold uppercase text-blue-700">
              {currentType?.label ??
                question.type}
            </span>

          </div>

          {currentType && (
            <p className="mt-2 text-xs text-slate-400">
              {currentType.description}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg px-3 py-2 text-xs font-bold text-red-500 transition hover:bg-red-50"
        >
          Supprimer
        </button>

      </div>

      {/* =====================================================
          TEXTE DE LA QUESTION
      ===================================================== */}

      <div className="mt-6">

        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Question
        </label>

        <textarea
          value={question.text}
          onChange={(event) =>
            handleTextChange(
              event.target.value
            )
          }
          rows={3}
          className="mt-2 w-full rounded-xl border border-slate-200 p-4 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

      </div>

      {/* =====================================================
          TYPE DE QUESTION
      ===================================================== */}

      <div className="mt-5">

        <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
          Type de réponse
        </label>

        <select
          value={question.type}
          onChange={(event) =>
            handleTypeChange(
              event.target.value as QuestionType
            )
          }
          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        >
          {QUESTION_TYPES.map(
            (type) => (
              <option
                key={type.value}
                value={type.value}
              >
                {type.label}
              </option>
            )
          )}
        </select>

      </div>

      {/* =====================================================
          OBLIGATOIRE
      ===================================================== */}

      <label className="mt-5 flex cursor-pointer items-center gap-3">

        <input
          type="checkbox"
          checked={question.required}
          onChange={(event) =>
            handleRequiredChange(
              event.target.checked
            )
          }
          className="h-4 w-4 rounded border-slate-300"
        />

        <span className="text-sm font-semibold text-slate-700">
          Question obligatoire
        </span>

      </label>

      {/* =====================================================
          CHOIX DE RÉPONSE
      ===================================================== */}

      {supportsOptions && (
        <div className="mt-7">

          <div className="flex items-center justify-between gap-4">

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Modalités de réponse
              </label>

              <p className="mt-1 text-xs text-slate-400">
                Les modalités seront présentées
                directement au répondant.
              </p>
            </div>

            {onAddOption && (
              <button
                type="button"
                onClick={onAddOption}
                className="rounded-xl bg-blue-50 px-4 py-2 text-xs font-bold text-blue-700 transition hover:bg-blue-100"
              >
                + Ajouter
              </button>
            )}

          </div>

          <div className="mt-4 space-y-3">

            {(question.options ?? [])
              .map(
                (option) => (
                  <div
                    key={option.value}
                    className="flex items-center gap-3"
                  >

                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xs font-bold text-slate-500">
                      {option.value}
                    </div>

                    <input
                      value={option.label}
                      onChange={(event) =>
                        handleOptionChange(
                          option.value,
                          event.target.value
                        )
                      }
                      className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    />

                    {onRemoveOption && (
                      <button
                        type="button"
                        onClick={() =>
                          handleRemoveOption(
                            option.value
                          )
                        }
                        className="rounded-lg px-3 py-2 text-sm font-bold text-red-500 transition hover:bg-red-50"
                        title="Supprimer cette modalité"
                      >
                        ×
                      </button>
                    )}

                  </div>
                )
              )}

          </div>

          {(!question.options ||
            question.options.length ===
              0) && (
            <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-slate-50 p-5 text-center">

              <p className="text-sm text-slate-500">
                Aucune modalité définie.
              </p>

              {onAddOption && (
                <button
                  type="button"
                  onClick={onAddOption}
                  className="mt-3 text-sm font-bold text-blue-600 hover:text-blue-700"
                >
                  Ajouter une modalité
                </button>
              )}

            </div>
          )}

        </div>
      )}

      {/* =====================================================
          LIKERT
      ===================================================== */}

      {isLikert && (
        <div className="mt-7 rounded-2xl border border-blue-100 bg-blue-50 p-5">

          <p className="text-xs font-bold uppercase tracking-wider text-blue-700">
            Échelle de Likert
          </p>

          <p className="mt-2 text-sm text-blue-800">
            Cette question utilise une échelle
            standardisée permettant une
            codification statistique.
          </p>

          {question.scale &&
            question.scale.length > 0 && (
              <div className="mt-4 grid gap-2 sm:grid-cols-5">

                {question.scale.map(
                  (option) => (
                    <div
                      key={option.value}
                      className="rounded-xl bg-white p-3 text-center"
                    >
                      <p className="text-xs font-bold text-slate-400">
                        {option.value}
                      </p>

                      <p className="mt-1 text-xs font-medium text-slate-700">
                        {option.label}
                      </p>
                    </div>
                  )
                )}

              </div>
            )}

        </div>
      )}

      {/* =====================================================
          OUI / NON
      ===================================================== */}

      {isYesNo && (
        <div className="mt-7 rounded-2xl bg-slate-50 p-5">

          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Modalités automatiques
          </p>

          <div className="mt-3 flex gap-3">

            <span className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm">
              Oui
            </span>

            <span className="rounded-xl bg-white px-5 py-3 text-sm font-semibold text-slate-700 shadow-sm">
              Non
            </span>

          </div>

        </div>
      )}

      {/* =====================================================
          QUESTION NUMÉRIQUE
      ===================================================== */}

      {isNumber && (
        <div className="mt-7 rounded-2xl bg-slate-50 p-5">

          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Réponse numérique
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Le répondant devra fournir une
            valeur numérique. Cette réponse
            pourra être directement codifiée
            pour l'analyse statistique.
          </p>

        </div>
      )}

      {/* =====================================================
          QUESTION OUVERTE
      ===================================================== */}

      {isOpen && (
        <div className="mt-7 rounded-2xl bg-slate-50 p-5">

          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Réponse ouverte
          </p>

          <p className="mt-2 text-sm text-slate-600">
            Le répondant pourra formuler
            librement sa réponse.
          </p>

        </div>
      )}

      {/* =====================================================
          MÉTADONNÉES SCIENTIFIQUES
      ===================================================== */}

      <div className="mt-7 rounded-2xl bg-slate-50 p-5">

        <div className="flex items-center justify-between gap-4">

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-blue-600">
              Intelligence méthodologique
            </p>

            <p className="mt-1 text-xs text-slate-400">
              Traçabilité scientifique de la question
            </p>
          </div>

          <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-500">
            ACADIA
          </span>

        </div>

        <div className="mt-5 grid gap-5 md:grid-cols-2">

          <Metadata
            label="Variable"
            value={question.variable}
          />

          <Metadata
            label="Dimension"
            value={question.dimension}
          />

          <Metadata
            label="Indicateur"
            value={question.indicator}
          />

          <Metadata
            label="Objectif"
            value={question.objective}
          />

        </div>

      </div>

    </div>
  );
}

/* =========================================================
   METADATA
========================================================= */

function Metadata({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div>

      <p className="text-xs font-semibold text-slate-400">
        {label}
      </p>

      <p className="mt-1 text-sm font-medium text-slate-700">
        {value || "Non renseigné"}
      </p>

    </div>
  );
}