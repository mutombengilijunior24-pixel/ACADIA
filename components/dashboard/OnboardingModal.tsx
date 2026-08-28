"use client";

// ============================================================
// P13.12 — Onboarding de première connexion. Jamais bloquant :
// toujours fermable, jamais une étape obligatoire pour accéder au
// tableau de bord.
// ============================================================

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { X, Sparkles, FolderOpen, Compass } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useResearch } from "@/contexts/ResearchContext";

const SEEN_KEY = "acadia-onboarding-seen";

export default function OnboardingModal() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { researches } = useResearch();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;
    const seen = typeof window !== "undefined" && localStorage.getItem(`${SEEN_KEY}:${user.id}`);
    const forced = searchParams.get("onboarding") === "1";
    // Lit localStorage (indisponible au premier rendu serveur) et l'URL —
    // une synchronisation avec l'extérieur, pas un recalcul de props.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (forced || !seen) setOpen(true);
  }, [user, searchParams]);

  function dismiss() {
    if (user) localStorage.setItem(`${SEEN_KEY}:${user.id}`, "1");
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-acadia-navy/60 p-4" onClick={dismiss}>
      <div className="w-full max-w-lg rounded-3xl bg-white p-7" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-acadia-blue">Bienvenue dans ACADIA.</p>
            <h2 className="mt-1 text-xl font-bold text-acadia-navy">Que souhaitez-vous faire ?</h2>
          </div>
          <button type="button" onClick={dismiss} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6 space-y-3">
          <button
            type="button"
            onClick={() => {
              dismiss();
              router.push("/dashboard/research/new");
            }}
            className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-acadia-blue hover:bg-acadia-blue-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-acadia-blue-50 text-acadia-blue">
              <Sparkles className="h-5 w-5" />
            </span>
            <span>
              <p className="text-sm font-bold text-acadia-navy">Commencer une nouvelle recherche</p>
              <p className="text-xs text-slate-500">ACADIA vous guide dès le choix de votre sujet.</p>
            </span>
          </button>

          <button
            type="button"
            disabled={researches.length === 0}
            onClick={() => {
              dismiss();
              router.push("/dashboard/research");
            }}
            className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-acadia-blue hover:bg-acadia-blue-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
              <FolderOpen className="h-5 w-5" />
            </span>
            <span>
              <p className="text-sm font-bold text-acadia-navy">Continuer une recherche</p>
              <p className="text-xs text-slate-500">
                {researches.length > 0 ? "Reprenez là où vous vous étiez arrêté." : "Aucune recherche en cours pour le moment."}
              </p>
            </span>
          </button>

          <a
            href="/#workflow"
            onClick={dismiss}
            className="flex w-full items-center gap-4 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-acadia-blue hover:bg-acadia-blue-50"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Compass className="h-5 w-5" />
            </span>
            <span>
              <p className="text-sm font-bold text-acadia-navy">Découvrir ACADIA</p>
              <p className="text-xs text-slate-500">Comprendre le cheminement avant de commencer.</p>
            </span>
          </a>
        </div>
      </div>
    </div>
  );
}
