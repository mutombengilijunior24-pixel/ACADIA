"use client";

import { CheckCircle2, AlertTriangle, XCircle, HelpCircle } from "lucide-react";
import { checkResearchConsistency, computeResearchIntegrityReadiness } from "@/lib/core/research/ResearchConsistencyEngine";
import type {
  ConsistencySeverity,
  ConsistencyCheckItem,
  ResearchIntegrityLevel,
} from "@/lib/core/research/ResearchConsistencyEngine";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import { useResearch } from "@/contexts/ResearchContext";
import TheoreticalFrameworkSection from "./TheoreticalFrameworkSection";
import TheoreticalOrientationsSection from "./TheoreticalOrientationsSection";
import ResearchGoalsSection from "./ResearchGoalsSection";
import HypothesisStructureSection from "./HypothesisStructureSection";
import VariableValidationSection from "./VariableValidationSection";
import ScientificChainStrip from "./ScientificChainStrip";

interface ResearchConsistencyOverviewProps {
  project: ResearchProject;
}

const INTEGRITY_STYLES: Record<ResearchIntegrityLevel, string> = {
  incomplete: "bg-red-50 text-red-700",
  in_preparation: "bg-amber-50 text-amber-700",
  almost_ready: "bg-acadia-blue-50 text-acadia-blue",
  ready_for_review: "bg-emerald-50 text-emerald-700",
};

const SEVERITY_ICON: Record<ConsistencySeverity, typeof CheckCircle2> = {
  pass: CheckCircle2,
  warning: AlertTriangle,
  needs_review: HelpCircle,
  error: XCircle,
};

const SEVERITY_COLOR: Record<ConsistencySeverity, string> = {
  pass: "text-emerald-600",
  warning: "text-amber-500",
  needs_review: "text-acadia-blue",
  error: "text-rose-600",
};

function worstSeverity(items: ConsistencyCheckItem[]): ConsistencySeverity {
  if (items.some((i) => i.severity === "error")) return "error";
  if (items.some((i) => i.severity === "needs_review")) return "needs_review";
  if (items.some((i) => i.severity === "warning")) return "warning";
  return "pass";
}

export default function ResearchConsistencyOverview({
  project,
}: ResearchConsistencyOverviewProps) {
  const { theoreticalFramework, instruments } = useResearch();
  const theoryEntries = theoreticalFramework[project.id] ?? [];
  const result = checkResearchConsistency(project, theoryEntries);
  const integrity = computeResearchIntegrityReadiness(result.score);

  const categories = Array.from(
    new Set(result.checks.map((c) => c.category))
  );

  return (
    <div className="space-y-6">
      {/* ================================================= */}
      {/* CHAÎNE SCIENTIFIQUE (P15) */}
      {/* ================================================= */}

      <ScientificChainStrip project={project} theoryEntries={theoryEntries} instrument={instruments[project.id]} />

      {/* ================================================= */}
      {/* RESEARCH INTEGRITY READINESS */}
      {/* ================================================= */}

      <section className="rounded-3xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-2xs font-bold uppercase tracking-wider text-slate-400">Research Integrity Readiness</p>
            <p className="mt-1 text-2xl font-extrabold text-acadia-navy">
              {integrity.score}
              <span className="text-sm font-medium text-slate-400"> / 100</span>
            </p>
          </div>
          <span className={`rounded-full px-3 py-1 text-xs font-bold ${INTEGRITY_STYLES[integrity.level]}`}>{integrity.label}</span>
        </div>
        <p className="mt-2 text-2xs text-slate-400">
          Mesure la préparation structurelle de la chaîne scientifique (problématique, objectifs, cadre théorique,
          hypothèses, variables, indicateurs, questionnaire, méthodologie) — jamais la qualité scientifique du
          travail.
        </p>
      </section>

      {/* ================================================= */}
      {/* QUESTION DE RECHERCHE & OBJECTIFS */}
      {/* ================================================= */}

      <ResearchGoalsSection project={project} />

      {/* ================================================= */}
      {/* CADRE THÉORIQUE */}
      {/* ================================================= */}

      <TheoreticalOrientationsSection project={project} />

      <TheoreticalFrameworkSection researchId={project.id} variables={project.variables} />

      {/* ================================================= */}
      {/* STRUCTURE DES HYPOTHÈSES */}
      {/* ================================================= */}

      <HypothesisStructureSection project={project} />

      {/* ================================================= */}
      {/* RESEARCH HEALTH */}
      {/* ================================================= */}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">
          Research Health
        </p>
        <h2 className="mt-1 text-lg font-bold text-acadia-navy">
          Santé du projet
        </h2>

        <ul className="mt-4 space-y-2.5">
          {categories.map((category) => {
            const items = result.checks.filter((c) => c.category === category);
            const severity = worstSeverity(items);
            const Icon = SEVERITY_ICON[severity];
            const nonPass = items.filter((i) => i.severity !== "pass");
            const label =
              nonPass.length > 0
                ? nonPass[0].message
                : `${category} en ordre.`;
            const suggestion = nonPass.find((i) => i.suggestion)?.suggestion;

            return (
              <li key={category} className="flex items-start gap-2.5 text-sm">
                <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLOR[severity]}`} />
                <span className="text-slate-700">
                  <strong className="font-semibold text-acadia-navy">{category}</strong>
                  {" — "}
                  {label}
                  {suggestion && (
                    <span className="mt-0.5 block text-xs text-slate-500">À faire : {suggestion}</span>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ================================================= */}
      {/* OPÉRATIONNALISATION */}
      {/* ================================================= */}

      <VariableValidationSection project={project} />

      {/* ================================================= */}
      {/* COHÉRENCE SCIENTIFIQUE */}
      {/* ================================================= */}

      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">
          Cohérence scientifique
        </p>
        <h2 className="mt-1 text-lg font-bold text-acadia-navy">
          Research Consistency Check
        </h2>

        <div className="mt-4 flex flex-wrap gap-3 text-sm font-semibold">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
            <CheckCircle2 className="h-3.5 w-3.5" /> {result.score.pass} PASS
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-3 py-1 text-amber-700">
            <AlertTriangle className="h-3.5 w-3.5" /> {result.score.warning} WARNING
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-acadia-blue-50 px-3 py-1 text-acadia-blue">
            <HelpCircle className="h-3.5 w-3.5" /> {result.score.needsReview} NEEDS REVIEW
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-rose-50 px-3 py-1 text-rose-700">
            <XCircle className="h-3.5 w-3.5" /> {result.score.error} ERROR
          </span>
        </div>

        {result.checks.filter((c) => c.severity !== "pass").length > 0 && (
          <ul className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            {result.checks
              .filter((c) => c.severity !== "pass")
              .map((check) => {
                const Icon = SEVERITY_ICON[check.severity];
                return (
                  <li key={check.id} className="flex items-start gap-2.5 text-xs sm:text-sm">
                    <Icon className={`mt-0.5 h-3.5 w-3.5 shrink-0 ${SEVERITY_COLOR[check.severity]}`} />
                    <span className="text-slate-600">
                      {check.message}
                      {check.suggestion && (
                        <span className="mt-0.5 block text-slate-400">À faire : {check.suggestion}</span>
                      )}
                    </span>
                  </li>
                );
              })}
          </ul>
        )}
      </section>

      {/* ================================================= */}
      {/* ECONOMETRIC READINESS */}
      {/* ================================================= */}

      <section className="rounded-3xl border border-acadia-navy/10 bg-acadia-navy p-6">
        <p className="text-xs font-bold tracking-wider text-acadia-blue-light uppercase">
          Econometric Readiness
        </p>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-extrabold text-white">{result.readiness.score}</span>
          <span className="text-sm text-white/60">éléments prêts</span>
        </div>
        <p className="mt-1 text-2xs text-white/50">
          Préparation structurelle uniquement — ne mesure pas la qualité scientifique.
        </p>

        <ul className="mt-4 space-y-2">
          {result.readiness.items.map((item) => (
            <li key={item.label} className="flex items-center gap-2.5 text-sm">
              {item.met ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-acadia-blue-light" />
              ) : (
                <AlertTriangle className="h-4 w-4 shrink-0 text-white/40" />
              )}
              <span className={item.met ? "text-white" : "text-white/60"}>
                {item.detail ?? item.label}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
