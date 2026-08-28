"use client";

import StepWelcome from "./StepWelcome";
import StepTitle from "./StepTitle";
import StepDomain from "./StepDomain";
import StepLevel from "./StepLevel";
import StepUniversity from "./StepUniversity";
import StepResearchType from "./StepResearchType";
import StepProblem from "./StepProblem";
import StepObjective from "./StepObjective";
import StepObjectives from "./StepObjectives";
import StepPopulation from "./StepPopulation";
import StepPopulationSize from "./StepPopulationSize";
import StepLocation from "./StepLocation";
import StepCollectionMethod from "./StepCollectionMethod";
import StepAnalysis from "./StepAnalysis";
import MethodologySummary from "./MethodologySummary";

interface Props {
  currentStep: number;
}

export default function StepRenderer({ currentStep }: Props) {
  switch (currentStep) {
    case 0:
      return <StepWelcome />;

    case 1:
      return <StepTitle />;

    case 2:
      return <StepDomain />;

    case 3:
      return <StepLevel />;

    case 4:
      return <StepUniversity />;

    case 5:
      return <StepResearchType />;

    case 6:
      return <StepProblem />;

    case 7:
      return <StepObjective />;

    case 8:
      return <StepObjectives />;

    case 9:
      return <StepPopulation />;

    case 10:
      return <StepPopulationSize />;

    case 11:
      return <StepLocation />;

    case 12:
      return <StepCollectionMethod />;

    case 13:
      return <StepAnalysis />;

    case 14:
      return <MethodologySummary />;

    default:
      return (
        <div className="rounded-3xl border bg-white p-10 shadow-sm">
          <h2 className="text-3xl font-bold">
            Étape introuvable
          </h2>

          <p className="mt-4 text-slate-500">
            Cette étape n'existe pas.
          </p>
        </div>
      );
  }
}