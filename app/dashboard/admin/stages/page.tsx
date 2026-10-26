import type { Metadata } from "next";

import StageCrm from "@/components/stages/StageCrm";

export const metadata: Metadata = {
  title: "Stage Connect (CRM) — ACADIA",
  description: "Suivi des candidats MNJ Stage Connect : segmentation, étapes, paiements et export Excel.",
};

// L'accès est contrôlé par requireAdmin() sur chaque route /api/admin/stages ; la page affiche le refus le cas échéant.
export default function AdminStagesPage() {
  return <StageCrm />;
}
