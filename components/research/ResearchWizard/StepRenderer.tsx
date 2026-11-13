"use client";

import StepTitle from "./StepTitle";
import StepField from "./StepField";
import StepLevelUniversity from "./StepLevelUniversity";
import StepDirector from "./StepDirector";

interface Props {
  currentStep: number;
}

/** « Nouvelle recherche » en 4 étapes : sujet, domaine, niveau et université, puis directeur — et dès qu'il est choisi, récolter ou interpréter. */
export default function StepRenderer({ currentStep }: Props) {
  switch (currentStep) {
    case 0:
      return <StepTitle />;
    case 1:
      return <StepField />;
    case 2:
      return <StepLevelUniversity />;
    default:
      return <StepDirector />;
  }
}
