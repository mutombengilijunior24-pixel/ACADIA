"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, GraduationCap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSupervision } from "@/contexts/SupervisionContext";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";

export default function SettingsPage() {
  const { user, refresh } = useAuth();
  const { becomeSupervisor } = useSupervision();
  const router = useRouter();
  const [becoming, setBecoming] = useState(false);

  async function handleBecomeSupervisor() {
    setBecoming(true);
    await becomeSupervisor();
    await refresh();
    setBecoming(false);
    router.push("/dashboard/supervisor");
  }

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSubmitting(true);
    const res = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Une erreur est survenue.");
      return;
    }
    setSuccess(true);
    setCurrentPassword("");
    setNewPassword("");
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-acadia-blue">Paramètres</p>
        <h1 className="mt-1 text-2xl font-bold text-acadia-navy">Votre compte</h1>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Profil</p>
        <p className="mt-2 text-sm text-slate-700">
          {user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "..."}
        </p>
        <p className="text-sm text-slate-500">{user?.email}</p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Rôle</p>
        {user?.role === "supervisor" ? (
          <p className="mt-2 text-sm text-slate-600">
            Votre compte est un compte <strong className="text-acadia-navy">directeur de recherche</strong>.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">
              Vous encadrez des étudiants ? Passez votre compte en directeur de recherche pour accéder à l&apos;espace
              de supervision. Aucune vérification institutionnelle n&apos;existe encore — c&apos;est une déclaration
              volontaire de votre part.
            </p>
            <button
              type="button"
              onClick={handleBecomeSupervisor}
              disabled={becoming}
              className="mt-4 inline-flex items-center gap-2 rounded-xl border border-acadia-blue px-4 py-2.5 text-sm font-semibold text-acadia-blue hover:bg-acadia-blue-50"
            >
              <GraduationCap className="h-4 w-4" /> {becoming ? "Activation..." : "Devenir directeur de recherche"}
            </button>
          </>
        )}
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Changer le mot de passe</p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <label className="block text-sm font-semibold text-slate-600">
            Mot de passe actuel
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-600">
            Nouveau mot de passe
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none"
            />
          </label>

          {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}
          {success && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Mot de passe mis à jour.</p>}

          <ResearchPrimaryButton type="submit" disabled={submitting}>
            <KeyRound className="h-4 w-4" /> {submitting ? "Mise à jour..." : "Mettre à jour le mot de passe"}
          </ResearchPrimaryButton>
        </form>
      </div>
    </div>
  );
}
