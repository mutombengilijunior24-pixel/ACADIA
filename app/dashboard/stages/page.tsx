import type { Metadata } from "next";

import StageConnect from "@/components/stages/StageConnect";
import { STAGE_TYPES, type StageType } from "@/lib/core/stages/catalog";

export const metadata: Metadata = {
  title: "MNJ Stage Connect — ACADIA",
  description: "S'inscrire pour un stage académique ou professionnel et suivre son dossier.",
};

// « ?type=academique|professionnel » : arrivée depuis la page publique « Stages » (le formulaire s'ouvre directement).
export default async function StagesPage({ searchParams }: { searchParams: Promise<{ type?: string | string[] }> }) {
  const { type } = await searchParams;
  const initialType = STAGE_TYPES.find((t) => t === type) as StageType | undefined;
  return <StageConnect initialType={initialType} />;
}
