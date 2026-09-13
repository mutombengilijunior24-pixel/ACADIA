"use client";

// ============================================================
// ACADIA — ANALYSE EN PROFONDEUR (10/09/2026)
//
// Déclenche POST /api/research/[id]/deep-analysis (A1+A2 réutilisés
// + orientations théoriques) et applique le résultat déjà persisté
// côté serveur à l'état local — ne relance jamais l'IA côté client.
// ============================================================

import { useState } from "react";
import { Loader2, Sparkles, ArrowRight } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import EntitlementGate from "@/components/research/billing/EntitlementGate";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";

const LOADING_STAGES = [
  "ACADIA construit vos variables...",
  "Il propose des hypothèses...",
  "Il identifie des théories mobilisables...",
  "Presque prêt...",
];

export default function DeepAnalysisSection({ project }: { project: ResearchProject }) {
  const { applyProjectUpdate } = useResearch();
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [error, setError] = useState<string | null>(null);

  if (project.variables.length > 0) return null;

  async function run() {
    setLoading(true);
    setError(null);
    setLoadingStage(0);
    const timer = setInterval(() => {
      setLoadingStage((i) => Math.min(i + 1, LOADING_STAGES.length - 1));
    }, 4000);

    try {
      const res = await fetch(`/api/research/${project.id}/deep-analysis`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ additionalNotes: notes.trim() || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "ACADIA n'a pas pu approfondir cette analyse pour le moment.");
        return;
      }
      applyProjectUpdate(project.id, data.project);
    } catch {
      setError("Impossible de contacter ACADIA. Vérifiez votre connexion et réessayez.");
    } finally {
      clearInterval(timer);
      setLoading(false);
    }
  }

  return (
    <section className="relative overflow-hidden rounded-3xl border border-acadia-blue-200 bg-white p-6 shadow-sm sm:p-8">
      <div
        className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, #93A7EE 0%, transparent 70%)" }}
      />
      <span className="inline-flex items-center gap-1.5 rounded-full bg-acadia-blue-50 px-3 py-1 text-xs font-bold text-acadia-blue">
        <Sparkles className="h-3.5 w-3.5" /> Prochaine étape
      </span>
      <h2 className="mt-3 text-xl font-bold text-acadia-navy">Analyser en profondeur mon sujet</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        ACADIA construit vos variables, propose des hypothèses et identifie des théories mobilisables pour votre
        sujet — à partir de ce que vous avez déjà écrit, et de ce que vous ajoutez ci-dessous si vous le souhaitez.
      </p>

      <EntitlementGate projectId={project.id} entitlementKey="RESEARCH_ANALYSIS">
        <label className="mt-5 block text-sm font-semibold text-slate-600" htmlFor="deep-analysis-notes">
          Avez-vous déjà des éléments pour votre recherche ? <span className="font-normal text-slate-400">(optionnel)</span>
        </label>
        <textarea
          id="deep-analysis-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading}
          rows={3}
          placeholder="Hypothèses déjà envisagées, théories que vous connaissez, données déjà collectées..."
          className="mt-1.5 w-full rounded-xl border border-slate-300 p-3 text-sm text-slate-900 focus:border-acadia-blue focus:outline-none disabled:opacity-60"
        />

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        <div className="mt-5">
          {loading ? (
            <div className="flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-acadia-blue" />
              <p className="text-sm font-medium text-acadia-navy transition-all duration-300">{LOADING_STAGES[loadingStage]}</p>
            </div>
          ) : (
            <button
              type="button"
              onClick={run}
              className="bg-acadia-gradient inline-flex items-center gap-2 rounded-xl px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-acadia-blue/25 transition hover:brightness-110 active:scale-[0.98]"
            >
              Analyser en profondeur mon sujet
              <ArrowRight className="h-4 w-4" />
            </button>
          )}
        </div>
      </EntitlementGate>
    </section>
  );
}
