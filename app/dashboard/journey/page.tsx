import type { Metadata } from "next";

import JourneyLoader from "@/components/journey/JourneyLoader";

export const metadata: Metadata = {
  title: "Parcours guidé — ACADIA",
  description: "De la question de recherche à l'interprétation : compréhension, données, plan d'analyse, calculs et conclusions.",
};

export default async function JourneyPage({ searchParams }: { searchParams: Promise<{ s?: string | string[] }> }) {
  const { s } = await searchParams;
  // « ?s=<id> » : reprise d'une interprétation enregistrée ; sinon, nouvelle interprétation.
  const sessionId = typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s) ? s : null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <JourneyLoader key={sessionId ?? "new"} sessionId={sessionId} />
    </div>
  );
}
