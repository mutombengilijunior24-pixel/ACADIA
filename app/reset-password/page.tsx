"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { KeyRound } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, newPassword }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setError(data.error ?? "Réinitialisation impossible.");
      return;
    }
    setDone(true);
  }

  if (!token) {
    return (
      <AuthShell title="Lien invalide" subtitle="Ce lien de réinitialisation est incomplet.">
        <Link href="/forgot-password" className="font-semibold text-acadia-blue hover:underline">
          Redemander un lien →
        </Link>
      </AuthShell>
    );
  }

  if (done) {
    return (
      <AuthShell title="Mot de passe mis à jour." subtitle="Vous pouvez maintenant vous connecter.">
        <Link href="/login" className="font-semibold text-acadia-blue hover:underline">
          Se connecter →
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Choisir un nouveau mot de passe" subtitle="Ce lien n'est valable qu'une seule fois.">
      <form onSubmit={handleSubmit} className="space-y-4">
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
            placeholder="8 caractères minimum"
          />
        </label>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

        <ResearchPrimaryButton type="submit" size="lg" disabled={submitting} className="w-full">
          <KeyRound className="h-4 w-4" /> {submitting ? "Mise à jour..." : "Mettre à jour le mot de passe"}
        </ResearchPrimaryButton>
      </form>
    </AuthShell>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
