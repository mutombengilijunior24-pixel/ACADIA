"use client";

import { useState } from "react";
import Link from "next/link";
import { Mail } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetLink, setResetLink] = useState<string | null | undefined>(undefined);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setResetLink(undefined);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json();
    setSubmitting(false);
    setResetLink(data.resetLink ?? null);
  }

  return (
    <AuthShell
      title="Mot de passe oublié ?"
      subtitle="Indiquez votre adresse email pour réinitialiser votre mot de passe."
      footer={
        <Link href="/login" className="font-semibold text-acadia-blue hover:underline">
          Retour à la connexion
        </Link>
      }
    >
      {resetLink === undefined ? (
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="block text-sm font-semibold text-slate-600">
            Adresse email
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none"
              placeholder="vous@universite.cd"
            />
          </label>

          <ResearchPrimaryButton type="submit" size="lg" disabled={submitting} className="w-full">
            <Mail className="h-4 w-4" /> {submitting ? "Vérification..." : "Envoyer le lien de réinitialisation"}
          </ResearchPrimaryButton>
        </form>
      ) : resetLink ? (
        <div className="space-y-3 text-sm text-slate-600">
          <p className="rounded-xl bg-amber-50 px-3 py-2.5 text-xs text-amber-700">
            Aucun service d&apos;email n&apos;est encore connecté en version bêta — voici directement votre lien de
            réinitialisation, valable 1 heure.
          </p>
          <Link href={resetLink} className="block rounded-xl bg-acadia-blue-50 px-3 py-2.5 text-center text-sm font-semibold text-acadia-blue hover:underline">
            Réinitialiser mon mot de passe →
          </Link>
        </div>
      ) : (
        <p className="rounded-xl bg-slate-50 px-3 py-2.5 text-sm text-slate-600">
          Si un compte existe avec cette adresse, un lien de réinitialisation vient d&apos;être préparé. Vérifiez
          l&apos;adresse saisie et réessayez si nécessaire.
        </p>
      )}
    </AuthShell>
  );
}
