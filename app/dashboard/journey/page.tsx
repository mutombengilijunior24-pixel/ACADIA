import type { Metadata } from "next";

import JourneyWorkspace from "@/components/journey/JourneyWorkspace";

export const metadata: Metadata = {
  title: "Parcours guidé — ACADIA",
  description: "De la question de recherche à l'interprétation : compréhension, données, plan d'analyse, calculs et conclusions.",
};

export default function JourneyPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <JourneyWorkspace />
    </div>
  );
}
