import type { Metadata } from "next";

import JourneyLoader from "@/components/journey/JourneyLoader";
import { isDedicatedEngine } from "@/lib/core/journey/kinds";
import { journeySeed } from "@/lib/core/research/workflow";

export const metadata: Metadata = {
  title: "Parcours guidé — ACADIA",
  description: "De la question de recherche à l'interprétation : compréhension, données, plan d'analyse, calculs et conclusions.",
};

type Param = string | string[] | undefined;

export default async function JourneyPage({ searchParams }: { searchParams: Promise<{ s?: Param; moteur?: Param; domaine?: Param; specialite?: Param }> }) {
  const { s, moteur, domaine, specialite } = await searchParams;
  // « ?s=<id> » : reprise d'une interprétation enregistrée (son moteur est lu avec elle) ;
  // sinon, nouvelle interprétation : parcours général, ou moteur dédié avec « ?moteur=finance » / « ?moteur=econometrie ».
  const sessionId = typeof s === "string" && /^[0-9a-f-]{36}$/i.test(s) ? s : null;
  const engine = !sessionId && isDedicatedEngine(moteur) ? moteur : null;
  // « ?domaine=…&specialite=… » : domaine et spécialité déjà choisis dans « Nouvelle recherche » (pré-sélectionnés, à confirmer).
  const seed = !sessionId && !engine ? journeySeed(domaine, specialite) : null;
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <JourneyLoader key={sessionId ?? `new:${engine ?? "survey"}:${seed?.specialty ?? ""}`} sessionId={sessionId} engine={engine} seed={seed} />
    </div>
  );
}
