"use client";

import type { QuestionnaireSection } from "@/lib/core/questionnaire/QuestionnaireTypes";

type QuestionnaireSidebarProps = {
  sections: QuestionnaireSection[];
  selectedSectionId: string;
  selectedQuestionId: string | null;
  onSelectSection: (id: string) => void;
  onSelectQuestion: (id: string) => void;
};

export default function QuestionnaireSidebar({
  sections,
  selectedSectionId,
  selectedQuestionId,
  onSelectSection,
  onSelectQuestion,
}: QuestionnaireSidebarProps) {
  return (
    <aside className="hidden w-80 shrink-0 border-r border-slate-200 bg-white lg:block">
      <div className="sticky top-[73px] max-h-[calc(100vh-73px)] overflow-y-auto p-5">

        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Structure du questionnaire
          </p>

          <p className="mt-1 text-sm text-slate-500">
            Naviguez entre les sections et les questions.
          </p>
        </div>

        <div className="space-y-2">
          {sections.map((section, sectionIndex) => {
            const isSelected =
              selectedSectionId === section.id;

            return (
              <div key={section.id}>

                <button
                  type="button"
                  onClick={() =>
                    onSelectSection(section.id)
                  }
                  className={`w-full rounded-xl p-3 text-left transition ${
                    isSelected
                      ? "bg-blue-50 text-blue-700"
                      : "text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">

                    <span
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        isSelected
                          ? "bg-blue-600 text-white"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {sectionIndex + 1}
                    </span>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">
                        {section.title}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        {section.questions.length} question
                        {section.questions.length !== 1
                          ? "s"
                          : ""}
                      </p>
                    </div>

                  </div>
                </button>

                {isSelected && (
                  <div className="ml-5 mt-2 space-y-1 border-l border-slate-200 pl-3">

                    {section.questions.map(
                      (question) => {
                        const questionSelected =
                          selectedQuestionId ===
                          question.id;

                        return (
                          <button
                            key={question.id}
                            type="button"
                            onClick={() =>
                              onSelectQuestion(
                                question.id
                              )
                            }
                            className={`w-full rounded-lg px-3 py-2 text-left text-xs transition ${
                              questionSelected
                                ? "bg-blue-600 text-white"
                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            }`}
                          >
                            <span className="mr-2 font-bold">
                              Q{question.number}
                            </span>

                            <span>
                              {question.text}
                            </span>
                          </button>
                        );
                      }
                    )}

                  </div>
                )}

              </div>
            );
          })}
        </div>

      </div>
    </aside>
  );
}