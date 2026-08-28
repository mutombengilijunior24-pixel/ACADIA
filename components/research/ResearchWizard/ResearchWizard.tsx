"use client";

import { useState } from "react";
import ProgressBar from "./ProgressBar";
import StepRenderer from "./StepRenderer";
import Navigation from "./Navigation";
import LiveSummary from "./LiveSummary";

const TOTAL_STEPS = 15;

export default function ResearchWizard() {
  const [currentStep, setCurrentStep] = useState(0);

  const handleNext = () => {
    setCurrentStep((previousStep) =>
      Math.min(previousStep + 1, TOTAL_STEPS - 1)
    );
  };

  const handlePrevious = () => {
    setCurrentStep((previousStep) => Math.max(previousStep - 1, 0));
  };

  return (
    <div className="mx-auto max-w-7xl space-y-5 sm:space-y-6">
      {/* BARRE DE PROGRESSION */}
      <ProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />

      {/* CONTENU PRINCIPAL & RÉSUMÉ */}
      <div className="grid gap-5 lg:grid-cols-3 lg:gap-6 items-start">
        {/* WIZARD CARD & NAVIGATION */}
        <main className="min-w-0 lg:col-span-2">
          <div className="rounded-2xl border border-slate-200/70 bg-white p-6 sm:p-10 shadow-sm shadow-slate-900/5">
            <StepRenderer currentStep={currentStep} />

            <Navigation
              currentStep={currentStep}
              totalSteps={TOTAL_STEPS}
              onNext={handleNext}
              onPrevious={handlePrevious}
              nextLabel={currentStep === 0 ? "Commencer ma recherche" : "Continuer"}
            />
          </div>
        </main>

        {/* RÉSUMÉ EN DIRECT */}
        <aside className="min-w-0 lg:col-span-1">
          <LiveSummary />
        </aside>
      </div>
    </div>
  );
}