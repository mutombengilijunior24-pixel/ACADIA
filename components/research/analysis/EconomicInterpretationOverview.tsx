"use client";

import { AlertTriangle, BookOpen } from "lucide-react";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { EconometricModel } from "@/lib/core/analysis/EconometricModelTypes";
import { interpretEconometricModel } from "@/lib/core/analysis/EconomicInterpretationEngine";
import AnnotatedBlock from "./AnnotatedBlock";

interface EconomicInterpretationOverviewProps {
  project: ResearchProject;
  model: EconometricModel;
  isStale?: boolean;
}

/**
 * P9 — INTERPRÉTATION ÉCONOMIQUE.
 *
 * Répond à « Que montrent les données ? ». Distincte de P10
 * (ScientificDiscussionOverview) qui répond à « Comment comprendre
 * ces résultats dans le cadre scientifique de la recherche ? ».
 *
 * Opère directement sur l'EconometricModel déjà estimé par P8 —
 * aucune donnée dupliquée, aucun nouveau calcul statistique ici.
 */
export default function EconomicInterpretationOverview({ project, model, isStale }: EconomicInterpretationOverviewProps) {
  const interpretation = interpretEconometricModel(model, project);

  if (!interpretation.available) {
    return (
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
          <BookOpen className="h-3.5 w-3.5" /> Interprétation économique
        </p>
        <p className="mt-3 flex items-start gap-1.5 text-sm text-amber-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {interpretation.unavailableReason}
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
        <BookOpen className="h-3.5 w-3.5" /> Interprétation économique
      </p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">{project.title}</h2>

      {isStale && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" /> Les données ont été modifiées depuis cette interprétation. Une
          nouvelle analyse est recommandée.
        </p>
      )}

      {/* P9.5 — LECTURE GLOBALE DU MODÈLE */}
      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <AnnotatedBlock
          researchId={project.id}
          blockId={interpretation.modelSummary.id}
          title={interpretation.modelSummary.title}
          statements={interpretation.modelSummary.statements}
        />
        <AnnotatedBlock
          researchId={project.id}
          blockId={interpretation.modelLimitations.id}
          title={interpretation.modelLimitations.title}
          statements={interpretation.modelLimitations.statements}
        />
      </div>

      {/* P9.3 — LECTURE PAR COEFFICIENT (structure A-F) */}
      <div className="mt-6">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Lecture par variable</p>
        <div className="mt-3 space-y-4">
          {interpretation.coefficients.map((c) => (
            <div key={c.id} className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-acadia-navy">{c.label}</p>
                <span className="rounded-full bg-white px-2.5 py-0.5 text-2xs font-semibold text-slate-500 ring-1 ring-slate-200">
                  {c.role === "principal" ? "Variable principale" : "Variable de contrôle"}
                </span>
              </div>

              <dl className="mt-3 space-y-2 text-sm">
                <Row label="A. Résultat statistique" value={c.statisticalResult} mono />
                <Row label="B. Interprétation" value={c.interpretation} />
                <Row label="C. Significativité" value={c.significance} />
                <Row label="D. Sens économique" value={c.economicMeaning} />
                <Row label="E. Importance économique" value={c.economicImportanceNote} />
                {c.hypothesisNote && <Row label="F. Lien avec l'hypothèse" value={c.hypothesisNote} />}
              </dl>
            </div>
          ))}
        </div>
      </div>

      {/* P9.4 — DIAGNOSTICS EXPLIQUÉS */}
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {interpretation.diagnostics.vif.length > 0 && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Multicolinéarité (VIF)</p>
            <ul className="mt-2 space-y-1">
              {interpretation.diagnostics.vif.map((v) => (
                <li key={v} className="text-xs text-slate-600">
                  {v}
                </li>
              ))}
            </ul>
          </div>
        )}
        {interpretation.diagnostics.heteroscedasticity && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Hétéroscédasticité</p>
            <p className="mt-2 text-xs text-slate-600">{interpretation.diagnostics.heteroscedasticity}</p>
          </div>
        )}
        {interpretation.diagnostics.normality && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Normalité des résidus</p>
            <p className="mt-2 text-xs text-slate-600">{interpretation.diagnostics.normality}</p>
          </div>
        )}
        {interpretation.diagnostics.influentialObservations.length > 0 && (
          <div className="rounded-2xl border border-slate-200/90 bg-white p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Observations influentes</p>
            <ul className="mt-2 space-y-1">
              {interpretation.diagnostics.influentialObservations.map((o) => (
                <li key={o} className="text-xs text-amber-600">
                  {o}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <p className="mt-6 rounded-xl bg-amber-50/70 p-3 text-2xs text-amber-700">
        Cette section décrit ce que les données montrent statistiquement — jamais une preuve de causalité. La mise
        en perspective scientifique (hypothèse, cadre théorique, littérature, limites) se poursuit dans la section
        « Discussion scientifique » ci-dessous.
      </p>
    </section>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-2xs font-bold uppercase tracking-wider text-slate-400">{label}</dt>
      <dd className={`mt-0.5 text-slate-700 ${mono ? "font-mono text-xs" : "text-sm"}`}>{value}</dd>
    </div>
  );
}
