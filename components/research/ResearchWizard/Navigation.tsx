"use client";

import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import ResearchPrimaryButton from "./brand/ResearchPrimaryButton";

interface Props {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrevious: () => void;
  isNextDisabled?: boolean;
  nextLabel?: string;
}

export default function Navigation({
  currentStep,
  totalSteps,
  onNext,
  onPrevious,
  isNextDisabled = false,
  nextLabel = "Continuer",
}: Props) {
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === totalSteps - 1;

  return (
    <div className="mt-8 flex items-center justify-between gap-4 border-t border-slate-100 pt-6">
      {/* Bouton Précédent */}
      <button
        type="button"
        onClick={onPrevious}
        disabled={isFirstStep}
        aria-label="Étape précédente"
        className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold transition-all duration-150 ${
          isFirstStep
            ? "cursor-not-allowed border border-slate-150 bg-slate-50 text-slate-300 opacity-50"
            : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/30"
        }`}
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Précédent</span>
      </button>

      {/* Bouton Suivant ou Terminer */}
      {!isLastStep ? (
        <ResearchPrimaryButton onClick={onNext} disabled={isNextDisabled}>
          <span>{nextLabel}</span>
          <ArrowRight className="h-4 w-4" />
        </ResearchPrimaryButton>
      ) : (
        <div className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-400 italic">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
          Dernière étape — validez ci-dessus
        </div>
      )}
    </div>
  );
}