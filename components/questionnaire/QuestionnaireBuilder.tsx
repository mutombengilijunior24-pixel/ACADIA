"use client";

import { useMemo, useState } from "react";

import type {
  GeneratedQuestionnaire,
  QuestionnaireQuestion,
  QuestionnaireOption,
} from "@/lib/core/questionnaire/QuestionnaireTypes";

import {
  publishQuestionnaire,
  closeQuestionnaire,
} from "@/lib/core/questionnaire/QuestionnairePublication";

import QuestionnaireSidebar from "./QuestionnaireSidebar";
import QuestionnaireEditor from "./QuestionnaireEditor";
import QuestionnairePreview from "./QuestionnairePreview";
import QuestionnaireToolbar from "./QuestionnaireToolbar";

type BuilderMode = "edit" | "preview";

type Props = {
  questionnaire: GeneratedQuestionnaire;
};

export default function QuestionnaireBuilder({
  questionnaire: initialQuestionnaire,
}: Props) {
  /* =====================================================
     ÉTAT PRINCIPAL DU BUILDER
  ===================================================== */

  const [questionnaire, setQuestionnaire] =
    useState<GeneratedQuestionnaire>(
      initialQuestionnaire
    );

  const [mode, setMode] =
    useState<BuilderMode>("edit");

  const [selectedSectionId, setSelectedSectionId] =
    useState<string>(
      initialQuestionnaire.sections[0]?.id ?? ""
    );

  const [selectedQuestionId, setSelectedQuestionId] =
    useState<string | null>(null);


  /* =====================================================
     PUBLICATION
  ===================================================== */

  function handlePublish() {
    const publishedQuestionnaire =
      publishQuestionnaire(questionnaire);

    const publicId =
      publishedQuestionnaire.publication?.publicId;

    if (!publicId) {
      console.error(
        "ACADIA : impossible de publier le questionnaire."
      );

      return;
    }

    /*
     * Pour notre prototype,
     * localStorage joue le rôle
     * de petite base de données.
     */

    localStorage.setItem(
      `acadia-questionnaire-${publicId}`,
      JSON.stringify(
        publishedQuestionnaire
      )
    );

    /*
     * Mettre à jour l'état du Builder.
     */

    setQuestionnaire(
      publishedQuestionnaire
    );
  }


  /* =====================================================
     FERMER LA COLLECTE
  ===================================================== */

  function handleCloseCollection() {
    setQuestionnaire((previous) =>
      closeQuestionnaire(previous)
    );
  }


  /* =====================================================
     SECTION ACTIVE
  ===================================================== */

  const selectedSection = useMemo(() => {
    return questionnaire.sections.find(
      (section) =>
        section.id === selectedSectionId
    );
  }, [
    questionnaire.sections,
    selectedSectionId,
  ]);


  /* =====================================================
     UTILITAIRE
     Trouver une question
  ===================================================== */

  function findQuestion(
    questionId: string
  ): QuestionnaireQuestion | undefined {
    for (const section of questionnaire.sections) {
      const question =
        section.questions.find(
          (item) =>
            item.id === questionId
        );

      if (question) {
        return question;
      }
    }

    return undefined;
  }


  /* =====================================================
     MODIFIER UNE QUESTION
  ===================================================== */

  function updateQuestion(
    updatedQuestion: QuestionnaireQuestion
  ) {
    setQuestionnaire((previous) => ({
      ...previous,

      sections:
        previous.sections.map(
          (section) => ({
            ...section,

            questions:
              section.questions.map(
                (question) =>
                  question.id ===
                  updatedQuestion.id
                    ? updatedQuestion
                    : question
              ),
          })
        ),
    }));
  }


  /* =====================================================
     MODIFIER PARTIELLEMENT UNE QUESTION
  ===================================================== */

  function updateQuestionFields(
    questionId: string,
    updates: Partial<QuestionnaireQuestion>
  ) {
    setQuestionnaire((previous) => ({
      ...previous,

      sections:
        previous.sections.map(
          (section) => ({
            ...section,

            questions:
              section.questions.map(
                (question) =>
                  question.id === questionId
                    ? {
                        ...question,
                        ...updates,
                      }
                    : question
              ),
          })
        ),
    }));
  }


  /* =====================================================
     MODIFIER LE TEXTE
  ===================================================== */

  function updateQuestionText(
    questionId: string,
    text: string
  ) {
    updateQuestionFields(
      questionId,
      {
        text,
      }
    );
  }


  /* =====================================================
     MODIFIER LE TYPE
  ===================================================== */

  function updateQuestionType(
    questionId: string,
    type: QuestionnaireQuestion["type"]
  ) {
    updateQuestionFields(
      questionId,
      {
        type,
      }
    );
  }


  /* =====================================================
     MODIFIER OBLIGATOIRE
  ===================================================== */

  function updateQuestionRequired(
    questionId: string,
    required: boolean
  ) {
    updateQuestionFields(
      questionId,
      {
        required,
      }
    );
  }


  /* =====================================================
     AJOUTER UNE MODALITÉ
  ===================================================== */

  function addOption(
    questionId: string
  ) {
    setQuestionnaire((previous) => ({
      ...previous,

      sections:
        previous.sections.map(
          (section) => ({
            ...section,

            questions:
              section.questions.map(
                (question) => {
                  if (
                    question.id !==
                    questionId
                  ) {
                    return question;
                  }

                  const options =
                    question.options ?? [];

                  const index =
                    options.length + 1;

                  const newOption:
                    QuestionnaireOption = {
                      label:
                        `Nouvelle réponse ${index}`,

                      value:
                        `option_${index}_${Date.now()}`,
                    };

                  return {
                    ...question,

                    options: [
                      ...options,
                      newOption,
                    ],
                  };
                }
              ),
          })
        ),
    }));
  }


  /* =====================================================
     MODIFIER UNE MODALITÉ
  ===================================================== */

  function updateOption(
    questionId: string,
    optionValue: string,
    label: string
  ) {
    setQuestionnaire((previous) => ({
      ...previous,

      sections:
        previous.sections.map(
          (section) => ({
            ...section,

            questions:
              section.questions.map(
                (question) => {
                  if (
                    question.id !==
                    questionId
                  ) {
                    return question;
                  }

                  return {
                    ...question,

                    options:
                      (
                        question.options ??
                        []
                      ).map(
                        (option) =>
                          option.value ===
                          optionValue
                            ? {
                                ...option,
                                label,
                              }
                            : option
                      ),
                  };
                }
              ),
          })
        ),
    }));
  }


  /* =====================================================
     SUPPRIMER UNE MODALITÉ
  ===================================================== */

  function removeOption(
    questionId: string,
    optionValue: string
  ) {
    setQuestionnaire((previous) => ({
      ...previous,

      sections:
        previous.sections.map(
          (section) => ({
            ...section,

            questions:
              section.questions.map(
                (question) => {
                  if (
                    question.id !==
                    questionId
                  ) {
                    return question;
                  }

                  return {
                    ...question,

                    options:
                      (
                        question.options ??
                        []
                      ).filter(
                        (option) =>
                          option.value !==
                          optionValue
                      ),
                  };
                }
              ),
          })
        ),
    }));
  }


  /* =====================================================
     SUPPRIMER UNE QUESTION
  ===================================================== */

  function deleteQuestion(
    questionId: string
  ) {
    setQuestionnaire((previous) => {
      let questionNumber = 1;

      const sections =
        previous.sections.map(
          (section) => ({
            ...section,

            questions:
              section.questions
                .filter(
                  (question) =>
                    question.id !==
                    questionId
                )
                .map(
                  (question) => ({
                    ...question,

                    number:
                      questionNumber++,
                  })
                ),
          })
        );

      return {
        ...previous,

        sections,

        totalQuestions:
          questionNumber - 1,
      };
    });

    setSelectedQuestionId(null);
  }


  /* =====================================================
     AJOUTER UNE QUESTION
  ===================================================== */

  function addQuestion(
    sectionId: string
  ) {
    setQuestionnaire((previous) => {
      const total =
        previous.totalQuestions + 1;

      const newQuestion:
        QuestionnaireQuestion = {
          id:
            `custom-${Date.now()}`,

          number: total,

          sectionId,

          type: "text",

          text:
            "Nouvelle question",

          required: false,

          variable: "",

          dimension: "",

          indicator: "",

          objective: "",

          options: [],
        };

      return {
        ...previous,

        totalQuestions: total,

        sections:
          previous.sections.map(
            (section) => {
              if (
                section.id !==
                sectionId
              ) {
                return section;
              }

              return {
                ...section,

                questions: [
                  ...section.questions,
                  newQuestion,
                ],
              };
            }
          ),
      };
    });
  }


  /* =====================================================
     SÉLECTIONNER UNE QUESTION
  ===================================================== */

  function selectQuestion(
    questionId: string
  ) {
    setSelectedQuestionId(
      questionId
    );
  }


  /* =====================================================
     CHANGER DE SECTION
  ===================================================== */

  function selectSection(
    sectionId: string
  ) {
    setSelectedSectionId(
      sectionId
    );

    setSelectedQuestionId(null);
  }


  /* =====================================================
     RENDU
  ===================================================== */

  return (
    <div className="min-h-screen bg-slate-100">

      {/* =================================================
          BARRE SUPÉRIEURE
      ================================================= */}

      <QuestionnaireToolbar
        questionnaire={questionnaire}
        mode={mode}
        onModeChange={setMode}
        onPublish={handlePublish}
        onCloseCollection={
          handleCloseCollection
        }
      />


      {/* =================================================
          MODE ÉDITION
      ================================================= */}

      {mode === "edit" ? (

        <div className="mx-auto flex max-w-7xl">

          {/* SIDEBAR */}

          <QuestionnaireSidebar
            sections={
              questionnaire.sections
            }

            selectedSectionId={
              selectedSectionId
            }

            selectedQuestionId={
              selectedQuestionId
            }

            onSelectSection={
              selectSection
            }

            onSelectQuestion={
              selectQuestion
            }
          />


          {/* ÉDITEUR */}

          <QuestionnaireEditor
            questionnaire={
              questionnaire
            }

            selectedSection={
              selectedSection
            }

            selectedQuestionId={
              selectedQuestionId
            }

            onSelectQuestion={
              selectQuestion
            }

            onUpdateQuestion={
              updateQuestion
            }

            onUpdateQuestionText={
              updateQuestionText
            }

            onUpdateQuestionType={
              updateQuestionType
            }

            onUpdateQuestionRequired={
              updateQuestionRequired
            }

            onAddOption={
              addOption
            }

            onUpdateOption={
              updateOption
            }

            onRemoveOption={
              removeOption
            }

            onDeleteQuestion={
              deleteQuestion
            }

            onAddQuestion={
              addQuestion
            }
          />

        </div>

      ) : (

        /* =================================================
           MODE PRÉVISUALISATION
        ================================================= */

        <QuestionnairePreview
          questionnaire={
            questionnaire
          }
        />

      )}

    </div>
  );
}