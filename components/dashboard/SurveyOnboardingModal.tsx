"use client";

// ============================================================
// ACADIA SURVEY — Guide interactif de première connexion.
//
// Affiché uniquement lors du premier accès à /dashboard/survey (ou
// si ?onboarding=1 force sa réouverture, ex. juste après une
// inscription arrivée depuis /survey) — jamais à chaque connexion.
// Jamais bloquant : toujours fermable, jamais une étape obligatoire
// pour accéder au tableau de bord. Distinct de l'onboarding Research
// (clé localStorage séparée, contenu propre à Survey).
// ============================================================

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { X, Sparkles, FileEdit, ClipboardList, Share2, Users2, LineChart } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const SEEN_KEY = "acadia-survey-onboarding-seen";

const STEPS = [
  {
    icon: Sparkles,
    title: "Bienvenue dans ACADIA Survey",
    subtitle: "Construisez votre enquête et suivez vos résultats depuis un seul espace.",
  },
  {
    icon: FileEdit,
    title: "1. Créez votre enquête",
    subtitle: "Décrivez votre objectif, ACADIA structure vos premières questions.",
  },
  {
    icon: ClipboardList,
    title: "2. Construisez votre questionnaire",
    subtitle: "Modifiez, réorganisez et complétez vos questions librement.",
  },
  {
    icon: Share2,
    title: "3. Partagez votre lien",
    subtitle: "Un lien et un QR code générés automatiquement, prêts à diffuser.",
  },
  {
    icon: Users2,
    title: "4. Suivez les réponses",
    subtitle: "Consultez vos réponses en temps réel et filtrez-les à volonté.",
  },
  {
    icon: LineChart,
    title: "5. Analysez et interprétez",
    subtitle: "Des statistiques claires, et une lecture méthodologique avec ACADIA.",
  },
];

export default function SurveyOnboardingModal() {
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

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
    setStep(0);
  }

  if (!open) return null;

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;
  const isFirst = step === 0;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-acadia-navy/60 p-4" onClick={dismiss}>
      <div className="w-full max-w-md rounded-3xl bg-white p-7 text-center" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end">
          <button type="button" onClick={dismiss} aria-label="Fermer" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mx-auto -mt-2 flex h-14 w-14 items-center justify-center rounded-2xl bg-acadia-blue-50 text-acadia-blue">
          <current.icon className="h-6 w-6" />
        </div>
        <h2 className="mt-5 text-xl font-bold text-acadia-navy">{current.title}</h2>
        <p className="mt-2 text-sm text-slate-500">{current.subtitle}</p>

        <div className="mt-6 flex items-center justify-center gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s.title} className={`h-1.5 rounded-full transition-all ${i === step ? "w-5 bg-acadia-blue" : "w-1.5 bg-slate-200"}`} />
          ))}
        </div>

        <div className="mt-7 flex items-center justify-center gap-3">
          {!isFirst && !isLast && (
            <button type="button" onClick={dismiss} className="text-sm font-semibold text-slate-400 hover:text-slate-600">
              Passer
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? dismiss() : setStep((s) => s + 1))}
            className="rounded-xl bg-acadia-blue px-6 py-3 text-sm font-semibold text-white transition hover:bg-acadia-blue-dark"
          >
            {isFirst ? "Commencer" : isLast ? "Terminer" : "Suivant"}
          </button>
        </div>
      </div>
    </div>
  );
}
