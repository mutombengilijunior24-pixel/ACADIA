"use client";

import { allQuestions, mappingFromQuestion } from "@/lib/core/data/research";
import type { ColumnMapping, UnderstandingState } from "@/lib/core/data/types";
import type { GeneratedQuestionnaire } from "@/lib/core/questionnaire/QuestionnaireTypes";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";

import { PROVENANCE_LABELS } from "./labels";
import { Pill, Section, buttonClass, inputClass } from "./ui";

export interface StoredQuestionnaire {
  key: string;
  questionnaire: GeneratedQuestionnaire;
}

const PROVENANCE_TONE = { explicit: "green", proposed: "yellow", inferred: "blue", unknown: "neutral" } as const;

export default function ResearchPanel({
  understanding,
  questionnaires,
  selectedQuestionnaire,
  onSelectQuestionnaire,
  project,
  onMapping,
}: {
  understanding: UnderstandingState;
  questionnaires: StoredQuestionnaire[];
  selectedQuestionnaire: GeneratedQuestionnaire | null;
  onSelectQuestionnaire: (key: string | null) => void;
  project: ResearchProject | null;
  onMapping: (column: number, mapping: ColumnMapping | null) => void;
}) {
  const questions = selectedQuestionnaire ? allQuestions(selectedQuestionnaire) : [];

  const assignQuestion = (column: number, questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (!question) return onMapping(column, null);
    onMapping(column, mappingFromQuestion(column, question, "user", "high", ["Association choisie par l'utilisateur."], project));
  };
  const assignVariable = (column: number, variableId: string) => {
    const variable = project?.variables.find((v) => v.id === variableId);
    if (!variable) return onMapping(column, null);
    onMapping(column, {
      column,
      variable: variable.name,
      researchVariableId: variable.id,
      source: "user",
      confidence: "high",
      confirmed: true,
      reasons: ["Association manuelle à une variable de recherche (questionnaire externe)."],
    });
  };

  return (
    <Section
      title="Contexte de la recherche"
      description="ACADIA distingue ce que vous avez fourni, ce qu'il a proposé sans confirmation, et ce qui manque. Rien n'est complété à votre place."
    >
      <dl className="grid gap-2 sm:grid-cols-2">
        {understanding.facts.map((fact) => (
          <div key={fact.key} className="min-w-0 rounded-2xl bg-slate-50 p-3">
            <dt className="flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-slate-500">
              {fact.label}
              <Pill tone={PROVENANCE_TONE[fact.provenance]}>{PROVENANCE_LABELS[fact.provenance]}</Pill>
            </dt>
            <dd className="mt-1 break-words text-sm text-slate-800">{fact.value ?? <span className="text-slate-400">{fact.note}</span>}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Questionnaire ACADIA associé</span>
          <select className={inputClass} value={selectedQuestionnaire ? questionnaires.find((q) => q.questionnaire === selectedQuestionnaire)?.key ?? "" : ""} onChange={(event) => onSelectQuestionnaire(event.target.value || null)}>
            <option value="">{questionnaires.length ? "Aucun (questionnaire externe)" : "Aucun questionnaire ACADIA disponible dans ce navigateur"}</option>
            {questionnaires.map((item) => (
              <option key={item.key} value={item.key}>
                {item.questionnaire.title} ({item.questionnaire.totalQuestions} questions)
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-[40rem] w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-3 py-2 font-semibold">Colonne</th>
              <th className="px-3 py-2 font-semibold">Correspondance</th>
              <th className="px-3 py-2 font-semibold">Associer</th>
            </tr>
          </thead>
          <tbody>
            {understanding.variables
              .filter((variable) => variable.effectiveType !== "unclassified")
              .map((variable) => {
                const mapping = variable.mapping;
                return (
                  <tr key={variable.column} className="border-t border-slate-100 align-top">
                    <td className="max-w-[14rem] px-3 py-2">
                      <span className="block truncate font-medium text-slate-900">{variable.originalHeader.trim() || variable.technicalName}</span>
                    </td>
                    <td className="px-3 py-2">
                      {mapping ? (
                        <div className="space-y-1">
                          <p className="text-slate-800">
                            {mapping.questionNumber ? `Q${mapping.questionNumber} · ` : ""}
                            {mapping.variable ? `variable « ${mapping.variable} »` : "sans variable"}
                            {mapping.dimension ? ` · dimension « ${mapping.dimension} »` : ""}
                            {mapping.indicator ? ` · indicateur « ${mapping.indicator} »` : ""}
                          </p>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Pill tone={mapping.confirmed ? "green" : "yellow"}>{mapping.confirmed ? "Confirmée" : "Proposée — à confirmer"}</Pill>
                            {!mapping.confirmed ? (
                              <button type="button" className={buttonClass.ghost} onClick={() => onMapping(variable.column, { ...mapping, source: "user", confirmed: true, confidence: "high" })}>
                                Confirmer
                              </button>
                            ) : null}
                            <button type="button" className={buttonClass.ghost} onClick={() => onMapping(variable.column, null)}>
                              Retirer
                            </button>
                          </div>
                          {!mapping.confirmed ? <p className="text-xs text-slate-500">{mapping.reasons.join(" ")}</p> : null}
                        </div>
                      ) : (
                        <span className="text-slate-400">Aucune</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {selectedQuestionnaire ? (
                        <select aria-label={`Question associée à ${variable.technicalName}`} className={inputClass} value="" onChange={(event) => event.target.value && assignQuestion(variable.column, event.target.value)}>
                          <option value="">Choisir une question…</option>
                          {questions.map((question) => (
                            <option key={question.id} value={question.id}>
                              Q{question.number} — {question.text.slice(0, 70)}
                            </option>
                          ))}
                        </select>
                      ) : project?.variables.length ? (
                        <select aria-label={`Variable associée à ${variable.technicalName}`} className={inputClass} value="" onChange={(event) => event.target.value && assignVariable(variable.column, event.target.value)}>
                          <option value="">Choisir une variable de recherche…</option>
                          {project.variables.map((researchVariable) => (
                            <option key={researchVariable.id} value={researchVariable.id}>
                              {researchVariable.name}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <span className="text-xs text-slate-400">Ni questionnaire ni variable de recherche disponible</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </Section>
  );
}
