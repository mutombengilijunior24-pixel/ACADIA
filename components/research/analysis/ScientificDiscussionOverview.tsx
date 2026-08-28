"use client";

import { AlertTriangle, Landmark } from "lucide-react";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset } from "@/lib/core/dataset/DatasetTypes";
import type { EconometricModel } from "@/lib/core/analysis/EconometricModelTypes";
import { buildScientificDiscussion } from "@/lib/core/analysis/ScientificDiscussionEngine";
import type { LimitationItem, ResultDiscussion } from "@/lib/core/analysis/ScientificDiscussionTypes";
import AnnotatedBlock from "./AnnotatedBlock";

interface ScientificDiscussionOverviewProps {
  project: ResearchProject;
  dataset?: Dataset;
  model: EconometricModel | null;
  isStale?: boolean;
}

/**
 * P10 — DISCUSSION SCIENTIFIQUE.
 *
 * Répond à « Comment comprendre ces résultats dans le cadre
 * scientifique de la recherche ? » — distincte de P9 (« que
 * montrent les données ? »). Le cadre théorique et la littérature
 * ne sont JAMAIS inventés : ResearchProject ne possède aucun champ
 * théorie/littérature aujourd'hui, ces sections affichent donc
 * systématiquement leur état « non renseigné ».
 */
export default function ScientificDiscussionOverview({ project, dataset, model, isStale }: ScientificDiscussionOverviewProps) {
  const discussion = buildScientificDiscussion(project, dataset, model);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
        <Landmark className="h-3.5 w-3.5" /> Discussion scientifique
      </p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">{project.title}</h2>

      {isStale && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-amber-600">
          <AlertTriangle className="h-3.5 w-3.5" /> Les données ont été modifiées depuis cette discussion. Une
          nouvelle analyse est recommandée.
        </p>
      )}

      {discussion.results.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500">
          Aucun résultat disponible pour construire une discussion scientifique à ce stade — générez d&apos;abord
          un dataset et une analyse ci-dessus.
        </p>
      ) : (
        discussion.results.map((result, i) => <ResultDiscussionBlock key={i} researchId={project.id} result={result} />)
      )}

      {/* CADRE THÉORIQUE (P10.2) — jamais inventé */}
      <div className="mt-6 rounded-2xl bg-slate-50/70 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Cadre théorique</p>
        <p className="mt-1.5 text-sm text-slate-600">
          {discussion.theoryStatus === "none_registered"
            ? "Le cadre théorique n'est pas suffisamment renseigné pour produire une confrontation théorique fiable."
            : "Cadre théorique enregistré."}
        </p>
      </div>

      {/* LITTÉRATURE (P10.3) — jamais inventée */}
      <div className="mt-4 rounded-2xl bg-slate-50/70 p-4">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Comparaison avec la littérature</p>
        {discussion.literature.length === 0 ? (
          <p className="mt-1.5 text-sm text-slate-600">
            À compléter. Aucune référence bibliographique structurée n&apos;est encore enregistrée pour ce projet.
          </p>
        ) : (
          <ul className="mt-2 space-y-1">
            {discussion.literature.map((ref) => (
              <li key={ref.id} className="text-sm text-slate-700">
                {ref.author} ({ref.year}) — {ref.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* LIMITES (P10.6) */}
      {discussion.limitations.length > 0 && (
        <div className="mt-6">
          <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">Limites</p>
          <div className="mt-3 space-y-2">
            {discussion.limitations.map((l) => (
              <LimitationRow key={l.id} item={l} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ResultDiscussionBlock({ researchId, result }: { researchId: string; result: ResultDiscussion }) {
  return (
    <div className="mt-5 rounded-2xl border border-acadia-blue-100 bg-acadia-blue-50/30 p-4">
      <p className="text-sm font-bold text-acadia-navy">{result.resultRef}</p>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <AnnotatedBlock
          researchId={researchId}
          blockId={result.resultSummary.id}
          title={result.resultSummary.title}
          statements={result.resultSummary.statements}
          validateLabel="Valider cette discussion"
          compact
        />
        <AnnotatedBlock
          researchId={researchId}
          blockId={result.economicInterpretation.id}
          title={result.economicInterpretation.title}
          statements={result.economicInterpretation.statements}
          validateLabel="Valider cette discussion"
          compact
        />
        <AnnotatedBlock
          researchId={researchId}
          blockId={result.hypothesisConfrontation.id}
          title={result.hypothesisConfrontation.title}
          statements={result.hypothesisConfrontation.statements}
          validateLabel="Valider cette discussion"
          compact
        />
        <AnnotatedBlock
          researchId={researchId}
          blockId={result.theoreticalConfrontation.id}
          title={result.theoreticalConfrontation.title}
          statements={result.theoreticalConfrontation.statements}
          validateLabel="Valider cette discussion"
          compact
        />
        <AnnotatedBlock
          researchId={researchId}
          blockId={result.literatureComparison.id}
          title={result.literatureComparison.title}
          statements={result.literatureComparison.statements}
          validateLabel="Valider cette discussion"
          compact
        />
        <AnnotatedBlock
          researchId={researchId}
          blockId={result.context.id}
          title={result.context.title}
          statements={result.context.statements}
          validateLabel="Valider cette discussion"
          compact
        />
        <AnnotatedBlock
          researchId={researchId}
          blockId={result.scientificImplication.id}
          title={result.scientificImplication.title}
          statements={result.scientificImplication.statements}
          validateLabel="Valider cette discussion"
          compact
        />
        {result.practicalImplication && (
          <AnnotatedBlock
            researchId={researchId}
            blockId={result.practicalImplication.id}
            title={result.practicalImplication.title}
            statements={result.practicalImplication.statements}
            validateLabel="Valider cette discussion"
            compact
          />
        )}
      </div>
    </div>
  );
}

function LimitationRow({ item }: { item: LimitationItem }) {
  const isDetected = item.severity === "detected";
  return (
    <div
      className={`flex items-start gap-2 rounded-xl p-3 text-xs ${
        isDetected ? "bg-amber-50 text-amber-700" : "bg-slate-50 text-slate-600"
      }`}
    >
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <div>
        <p className="font-semibold">
          {item.category} — {isDetected ? "limite détectée" : "risque potentiel"}
        </p>
        <p className="mt-0.5">{item.description}</p>
      </div>
    </div>
  );
}
