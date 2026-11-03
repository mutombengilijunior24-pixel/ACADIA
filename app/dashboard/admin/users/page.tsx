import type { Metadata } from "next";

import UsersAdmin from "@/components/admin/UsersAdmin";

export const metadata: Metadata = {
  title: "Comptes inscrits — ACADIA",
  description: "Administration : comptes inscrits, recherche et export.",
};

// L'accès est contrôlé par requireAdmin() sur /api/admin/users ; la page affiche le refus le cas échéant.
export default function AdminUsersPage() {
  return <UsersAdmin />;
}
