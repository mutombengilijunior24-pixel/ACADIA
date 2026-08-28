"use client";

import { ArrowRight, ArrowDown } from "lucide-react";
import type { ResearchProject, ResearchVariable } from "@/lib/core/research/ResearchTypes";

interface ResearchChainViewProps {
  project: ResearchProject;
}

function findVariable(
  id: string,
  variables: ResearchVariable[]
): ResearchVariable | undefined {
  return variables.find((v) => v.id === id);
}

export default function ResearchChainView({ project }: ResearchChainViewProps) {
  const question = project.researchQuestions?.[0];
  const generalObjective = project.objectives.find((o) => o.role === "general");
  const specificObjectives = project.objectives.filter((o) => o.role === "specific");

  return (
    <div className="space-y-6">
      {/* ================================================= */}
      {/* CHAÎNE QUESTION → OBJECTIFS → VARIABLES → HYPOTHÈSES */}
      {/* ================================================= */}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">
          Vue scientifique
        </p>
        <h2 className="mt-1 text-lg font-bold text-acadia-navy">
          Question → Objectifs → Variables → Hypothèses
        </h2>

        <div className="mt-4 space-y-3">
          <ChainNode
            label="Question de recherche"
            content={question?.text ?? "À définir"}
            resolved={Boolean(question)}
          />
          <ChainArrowDown />
          <ChainNode
            label="Objectif général"
            content={generalObjective?.text ?? "À définir"}
            resolved={Boolean(generalObjective)}
          />
          <ChainArrowDown />
          <ChainNode
            label={`Objectifs spécifiques (${specificObjectives.length})`}
            content={
              specificObjectives.length > 0
                ? specificObjectives.map((o) => o.text).join(" · ")
                : "À définir"
            }
            resolved={specificObjectives.length > 0}
          />
          <ChainArrowDown />
          <ChainNode
            label={`Variables (${project.variables.length})`}
            content={
              project.variables.length > 0
                ? project.variables.map((v) => `${v.name} [${v.role}]`).join(" · ")
                : "À définir"
            }
            resolved={project.variables.length > 0}
          />
          <ChainArrowDown />
          <ChainNode
            label={`Hypothèses (${(project.hypotheses ?? []).length})`}
            content={
              (project.hypotheses ?? []).length > 0
                ? (project.hypotheses ?? []).map((h) => h.statement).join(" · ")
                : "Aucune hypothèse formulée"
            }
            resolved={(project.hypotheses ?? []).length > 0}
          />
        </div>
      </section>

      {/* ================================================= */}
      {/* RELATIONS ENTRE VARIABLES */}
      {/* ================================================= */}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">
          Relations entre variables
        </p>
        <h2 className="mt-1 text-lg font-bold text-acadia-navy">
          Variable X → Relation → Variable Y
        </h2>

        {(project.relations ?? []).length === 0 ? (
          <p className="mt-3 text-sm text-slate-400 italic">
            Aucune relation identifiée pour le moment.
          </p>
        ) : (
          <div className="mt-4 space-y-3">
            {(project.relations ?? []).map((relation) => {
              const fromVariable = findVariable(relation.from, project.variables);
              const toVariable = findVariable(relation.to, project.variables);
              const needsReview = relation.status === "needs_review";

              return (
                <div
                  key={relation.id}
                  className={`flex flex-col items-center gap-2 rounded-2xl border p-4 sm:flex-row sm:justify-center ${
                    needsReview
                      ? "border-amber-200 bg-amber-50/50"
                      : "border-slate-200/90 bg-slate-50/60"
                  }`}
                >
                  <span className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-acadia-navy shadow-2xs">
                    {fromVariable?.name ?? relation.from}
                  </span>
                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-acadia-blue sm:block" />
                  <ArrowDown className="h-4 w-4 shrink-0 text-acadia-blue sm:hidden" />
                  <span className="rounded-full bg-acadia-blue px-3 py-1 text-xs font-bold text-white">
                    {relation.relation}
                  </span>
                  <ArrowRight className="hidden h-4 w-4 shrink-0 text-acadia-blue sm:block" />
                  <ArrowDown className="h-4 w-4 shrink-0 text-acadia-blue sm:hidden" />
                  <span className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-acadia-navy shadow-2xs">
                    {toVariable?.name ?? relation.to}
                  </span>

                  {needsReview && (
                    <span className="text-2xs font-semibold text-amber-700 sm:ml-3">
                      ⚠ à confirmer
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function ChainNode({
  label,
  content,
  resolved,
}: {
  label: string;
  content: string;
  resolved: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${
        resolved ? "border-slate-200/90 bg-slate-50/60" : "border-dashed border-slate-200 bg-white"
      }`}
    >
      <p className="text-2xs font-bold tracking-wider text-slate-400 uppercase">{label}</p>
      <p className={`mt-1 text-sm ${resolved ? "font-semibold text-acadia-navy" : "italic text-slate-400"}`}>
        {content}
      </p>
    </div>
  );
}

function ChainArrowDown() {
  return (
    <div className="flex justify-center">
      <ArrowDown className="h-4 w-4 text-acadia-blue-light" />
    </div>
  );
}
