import type { Metadata } from "next";

import InterpretationsList from "@/components/journey/InterpretationsList";

export const metadata: Metadata = {
  title: "Mes interprétations — ACADIA",
  description: "Reprendre une interprétation de données enregistrée dans votre compte.",
};

export default function InterpretationsPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <InterpretationsList />
    </div>
  );
}
