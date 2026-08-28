"use client";

import { journey } from "../../../data/workflow";
import JourneyCard from "./JourneyCard";

type JourneyStep = {
  id: number;
  step: string;
  icon: string;
  title: string;
  description: string;
  status: "completed" | "locked" | "current";
  locked: boolean;
};

export default function JourneyCarousel() {
  const steps: JourneyStep[] = journey.map((item) => ({
    ...item,
    status: item.status as JourneyStep["status"],
  }));

  return (
    <div className="relative mt-20">

      {/* Dégradé gauche */}

      <div
        className="
          pointer-events-none
          absolute
          left-0
          top-0
          z-10
          h-full
          w-24
          bg-gradient-to-r
          from-slate-50
          to-transparent
        "
      />

      {/* Dégradé droite */}

      <div
        className="
          pointer-events-none
          absolute
          right-0
          top-0
          z-10
          h-full
          w-24
          bg-gradient-to-l
          from-slate-50
          to-transparent
        "
      />

      {/* Carrousel */}

      <div
        className="
          flex
          w-max
          gap-8
          overflow-x-auto
          px-2
          pb-8
          pt-4
          snap-x
          snap-mandatory
          scroll-smooth
          scrollbar-hide
        "
      >
        {steps.map((step) => (
          <div
            key={step.id}
            className="
              min-w-[360px]
              snap-center
              first:ml-2
              last:pr-6
            "
          >
            <JourneyCard
              id={step.id}
              step={step.step}
              icon={step.icon}
              title={step.title}
              description={step.description}
              status={step.status}
              locked={step.locked}
            />
          </div>
        ))}
      </div>

      {/* Texte d'aide */}

      <p className="mt-10 text-center text-sm text-slate-500">
        Faites glisser les cartes pour découvrir toutes les étapes de
        votre parcours académique.
      </p>

    </div>
  );
}