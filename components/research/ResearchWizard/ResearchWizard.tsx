"use client";

import { useEffect, useState } from "react";

import { useResearch } from "@/contexts/ResearchContext";
import { canContinue, missingFor, WIZARD_TOTAL_STEPS } from "@/lib/core/research/workflow";
import ProgressBar from "./ProgressBar";
import StepRenderer from "./StepRenderer";
import Navigation from "./Navigation";
import LiveSummary from "./LiveSummary";

export default function ResearchWizard() {
  const { currentResearch, currentProject, resetCurrentResearch } = useResearch();
  const [currentStep, setCurrentStep] = useState(0);

  // Une recherche déjà enregistrée (projet créé) ne pré-remplit jamais la suivante ;
  // une saisie en cours, non enregistrée, est conservée.
  useEffect(() => {
    if (currentProject) resetCurrentResearch();
    // À l'ouverture de l'assistant uniquement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Une étape obligatoire incomplète bloque « Continuer » : on ne passe jamais sans sujet, ni sans spécialité.
  const ready = canContinue(currentStep, currentResearch);
  const missing = missingFor(currentStep, currentResearch);

  const handleNext = () => {
    if (!ready) return;
    setCurrentStep((previousStep) => Math.min(previousStep + 1, WIZARD_TOTAL_STEPS - 1));
  };

  const handlePrevious = () => {
    setCurrentStep((previousStep) => Math.max(previousStep - 1, 0));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
      <ProgressBar currentStep={currentStep} totalSteps={WIZARD_TOTAL_STEPS} />

      <div className="grid items-start gap-5 lg:grid-cols-3 lg:gap-6">
        <main className="min-w-0 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 shadow-sm shadow-slate-900/5 sm:p-10">
            <StepRenderer currentStep={currentStep} />

            <Navigation
              currentStep={currentStep}
              totalSteps={WIZARD_TOTAL_STEPS}
              onNext={handleNext}
              onPrevious={handlePrevious}
              isNextDisabled={!ready}
              nextLabel="Continuer"
            />
            {missing ? (
              <p className="mt-3 text-right text-xs font-medium text-amber-700" role="status">
                {missing}
              </p>
            ) : null}
          </div>
        </main>

        <aside className="min-w-0 lg:col-span-1">
          <LiveSummary />
        </aside>
      </div>
    </div>
  );
}
