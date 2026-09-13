"use client";

import { CheckCircle2, XCircle, BookOpen } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";

/**
 * Orientations théoriques proposées par l'analyse en profondeur
 * (10/09/2026) — même patron d'acceptation/rejet que les variables et
 * hypothèses. Toujours présentées comme des pistes à confronter à la
 * vraie littérature, jamais comme des théories déjà validées pour ce
 * travail.
 */
export default function TheoreticalOrientationsSection({ project }: { project: ResearchProject }) {
  const { updateTheoreticalOrientationStatus } = useResearch();
  const researchId = project.id;

  const orientations = (project.theoreticalOrientations ?? []).filter((o) => o.status !== "rejected");
  if (orientations.length === 0) return null;

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-acadia-blue uppercase">
        <BookOpen className="h-3.5 w-3.5" /> Théories mobilisables
      </p>
      <h2 className="mt-1 text-lg font-bold text-acadia-navy">Pistes théoriques proposées par ACADIA</h2>
      <p className="mt-1 text-sm text-slate-500">
        À confronter à la littérature réelle de votre domaine — jamais une théorie déjà validée pour votre travail.
        Si une piste vous semble pertinente, enregistrez-la avec sa vraie référence dans le cadre théorique ci-dessous.
      </p>

      <div className="mt-4 space-y-2">
        {orientations.map((orientation) => {
          const isProposed = orientation.status === "proposed";
          return (
            <div key={orientation.id} className="rounded-2xl border border-slate-200/90 bg-slate-50/60 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-acadia-navy">{orientation.theory}</p>
                  <p className="mt-1 text-sm text-slate-600">{orientation.reason}</p>
                </div>
                {isProposed && (
                  <div className="flex shrink-0 gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateTheoreticalOrientationStatus(researchId, orientation.id, "accepted")}
                      aria-label="Retenir"
                      className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => updateTheoreticalOrientationStatus(researchId, orientation.id, "rejected")}
                      aria-label="Écarter"
                      className="rounded-lg bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                    >
                      <XCircle className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
              <span
                className={`mt-2 inline-block rounded-full px-2 py-0.5 text-2xs font-semibold ${
                  isProposed ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
                }`}
              >
                {isProposed ? "Proposée par ACADIA — à confronter à la littérature" : "Retenue par le chercheur"}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
