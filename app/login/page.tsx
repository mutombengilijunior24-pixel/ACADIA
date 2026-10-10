"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, Eye, EyeOff } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";
import { useAuth } from "@/contexts/AuthContext";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      const next = searchParams.get("next");
      router.push(next && next.startsWith("/dashboard") ? next : "/dashboard");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthShell
      title="Content de vous revoir."
      subtitle="Continuez votre recherche là où vous l'avez laissée."
      footer={
        <>
          Pas encore de compte ?{" "}
          <Link href={searchParams.get("next")?.startsWith("/dashboard") ? `/register?next=${encodeURIComponent(searchParams.get("next")!)}` : "/register"} className="font-semibold text-acadia-blue hover:underline">
            Créer un compte
          </Link>
        </>
      }
    >
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

        <label className="block text-sm font-semibold text-slate-600">
          Mot de passe
          <div className="relative mt-1.5">
            <input
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 pr-11 text-sm font-normal text-acadia-navy focus:border-acadia-blue focus:outline-none"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              aria-label={showPassword ? "Masquer le mot de passe" : "Afficher le mot de passe"}
              className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 hover:text-acadia-blue"
            >
              {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
        </label>

        <div className="flex justify-end">
          <Link href="/forgot-password" className="text-xs font-semibold text-acadia-blue hover:underline">
            Mot de passe oublié ?
          </Link>
        </div>

        {error && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">{error}</p>}

        <ResearchPrimaryButton type="submit" size="lg" disabled={submitting} className="w-full">
          <LogIn className="h-4 w-4" /> {submitting ? "Connexion..." : "Se connecter"}
        </ResearchPrimaryButton>
      </form>
    </AuthShell>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
