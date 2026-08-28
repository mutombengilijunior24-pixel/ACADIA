"use client";

// ============================================================
// ACADIA — SOUMETTRE UNE VERSION AU DIRECTEUR (P16)
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { Send, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { useSupervision } from "@/contexts/SupervisionContext";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { InstrumentRecord } from "@/contexts/ResearchContext";
import type { TheoreticalFrameworkEntry } from "@/lib/core/research/TheoreticalFrameworkTypes";

export default function SubmitVersionButton({
  researchId,
  project,
  instrument,
  theoreticalFramework,
}: {
  researchId: string;
  project: ResearchProject;
  instrument?: InstrumentRecord;
  theoreticalFramework: TheoreticalFrameworkEntry[];
}) {
  const { getMySupervisor, submitVersion } = useSupervision();
  const [open, setOpen] = useState(false);
  const [hasSupervisor, setHasSupervisor] = useState<boolean | null>(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; error?: string; emailStatus?: string } | null>(null);

  const checkSupervisor = useCallback(async () => {
    const supervisor = await getMySupervisor();
    setHasSupervisor(Boolean(supervisor));
  }, [getMySupervisor]);

  useEffect(() => {
    // Vérification serveur au montage — requête réseau asynchrone,
    // même justification que les autres hydratations de contexte.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    checkSupervisor();
  }, [checkSupervisor]);

  async function handleSubmit() {
    setSubmitting(true);
    const res = await submitVersion({ researchId, project, instrument, theoreticalFramework, studentMessage: message });
    setSubmitting(false);
    setResult(res.ok ? { ok: true, emailStatus: res.email.status } : { ok: false, error: res.error });
  }

  if (hasSupervisor === false) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-xl border border-acadia-blue px-4 py-2 text-sm font-semibold text-acadia-blue hover:bg-acadia-blue-50"
      >
        <Send className="h-4 w-4" /> Soumettre au directeur
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-acadia-navy/60 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-md rounded-3xl bg-white p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-acadia-navy">Soumettre cette version à votre directeur</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>

            {result?.ok ? (
              <div className="mt-4 space-y-2">
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" /> Version soumise avec succès.
                </div>
                {result.emailStatus === "not_configured" && (
                  <p className="flex items-center gap-1.5 text-xs text-slate-500">
                    <AlertTriangle className="h-3.5 w-3.5" /> Aucun email n&apos;a été envoyé (service email non configuré) — votre
                    directeur verra cette soumission directement dans son espace ACADIA.
                  </p>
                )}
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={3}
                  placeholder="Message pour votre directeur (optionnel)"
                  className="mt-4 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                />
                {result?.error && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-red-600">
                    <AlertTriangle className="h-3.5 w-3.5" /> {result.error}
                  </p>
                )}
                <div className="mt-4">
                  <ResearchPrimaryButton onClick={handleSubmit} disabled={submitting}>
                    {submitting ? "Envoi..." : "Confirmer la soumission"}
                  </ResearchPrimaryButton>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
