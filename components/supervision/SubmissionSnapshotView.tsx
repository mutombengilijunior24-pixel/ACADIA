"use client";

// ============================================================
// ACADIA — VUE EN LECTURE SEULE D'UNE SOUMISSION (P16)
//
// Ne réutilise PAS les composants d'édition existants
// (QuestionnaireOverview, MethodologyOverview) : ils appellent
// useResearch() en interne, câblé sur le navigateur courant — pas
// adapté à l'affichage d'un snapshot appartenant à un autre compte
// (voir ACADIA_P16_ARCHITECTURE.md §9). Seul ScientificChainStrip
// est 100% piloté par props et donc réellement réutilisé.
// ============================================================

import { buildMethodologyRecommendation } from "@/lib/core/methodology/MethodologyRecommendationEngine";
import ScientificChainStrip from "@/components/research/consistency/ScientificChainStrip";
import type { SubmissionSnapshot } from "@/lib/core/supervision/SupervisionTypes";

export default function SubmissionSnapshotView({ snapshot }: { snapshot: SubmissionSnapshot }) {
  const { project, instrument, theoreticalFramework } = snapshot;
  const recommendation = buildMethodologyRecommendation(project);

  const totalQuestions =
    instrument?.questionnaire?.sections.reduce((sum, s) => sum + s.questions.length, 0) ??
    instrument?.interviewGuide?.themes.length ??
    0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-4">
          <Info label="Domaine" value={project.domain} />
          <Info label="Niveau" value={project.level} />
          <Info label="Université" value={project.university} />
          <Info label="Type" value={project.researchType} />
        </div>
      </section>

      <ScientificChainStrip project={project} theoryEntries={theoreticalFramework} instrument={instrument} />

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Chaîne scientifique</p>
        <div className="mt-3 space-y-3 text-sm">
          <Field label="Problématique" value={project.problem?.statement} />
          <Field
            label={`Objectifs (${project.objectives.length})`}
            value={project.objectives.map((o) => o.text).join(" · ")}
          />
          <Field
            label={`Hypothèses (${project.hypotheses.filter((h) => h.status !== "rejected").length})`}
            value={project.hypotheses
              .filter((h) => h.status !== "rejected")
              .map((h) => h.statement)
              .join(" · ")}
          />
          <Field
            label={`Variables (${project.variables.length})`}
            value={project.variables.map((v) => `${v.name} [${v.role}]`).join(" · ")}
          />
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Méthodologie (proposition ACADIA)</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
          <Field label="Orientation" value={recommendation.orientation.value} />
          <Field label="Devis de recherche" value={recommendation.researchDesignType.value} />
          <Field label="Population" value={recommendation.population.value} />
          <Field label="Échantillonnage" value={recommendation.samplingMethod.value} />
        </div>
        <p className="mt-3 text-2xs text-slate-400">Préparation méthodologique : {recommendation.readinessPercent}%</p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Instrument de collecte</p>
        {instrument?.questionnaire ? (
          <p className="mt-2 text-sm text-slate-700">{totalQuestions} question(s) — statut : {instrument.status}</p>
        ) : instrument?.interviewGuide ? (
          <p className="mt-2 text-sm text-slate-700">{totalQuestions} thème(s) d&apos;entretien — statut : {instrument.status}</p>
        ) : (
          <p className="mt-2 text-sm text-slate-400 italic">Aucun instrument généré au moment de cette soumission.</p>
        )}
      </section>
    </div>
  );
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-2xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 text-sm font-semibold text-acadia-navy">{value || "—"}</p>
    </div>
  );
}

function Field({ label, value }: { label: string; value?: string }) {
  return (
    <p>
      <span className="font-semibold text-acadia-navy">{label} : </span>
      <span className="text-slate-600">{value || "À préciser"}</span>
    </p>
  );
}
