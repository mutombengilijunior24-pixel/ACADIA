import type { Metadata } from "next";

import DirectorsAdmin from "@/components/admin/DirectorsAdmin";

export const metadata: Metadata = {
  title: "Directeurs de mémoire — ACADIA",
  description: "Administration : annuaire des directeurs de mémoire proposés aux étudiants.",
};

// L'accès est contrôlé par requireAdmin() sur /api/admin/directors ; la page affiche le refus le cas échéant.
export default function AdminDirectorsPage() {
  return <DirectorsAdmin />;
}
