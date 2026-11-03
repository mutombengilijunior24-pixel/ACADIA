import type { Metadata } from "next";

import ReferenceChecker from "@/components/references/ReferenceChecker";

export const metadata: Metadata = {
  title: "Vérifier mes références — ACADIA",
  description: "Forme APA 7, existence dans les bases bibliographiques ouvertes et fidélité des citations.",
};

export default function ReferencesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
      <ReferenceChecker />
    </div>
  );
}
