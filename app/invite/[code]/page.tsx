"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { GraduationCap, CheckCircle2, AlertTriangle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";

export default function InviteAcceptPage() {
  const params = useParams<{ code: string }>();
  const code = typeof params.code === "string" ? params.code : "";
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const [status, setStatus] = useState<"idle" | "accepting" | "accepted" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [supervisorName, setSupervisorName] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.push(`/login?next=${encodeURIComponent(`/invite/${code}`)}`);
    }
  }, [isLoading, user, code, router]);

  async function handleAccept() {
    setStatus("accepting");
    setError(null);
    try {
      const res = await fetch("/api/supervision/invitations/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus("error");
        setError(data.error ?? "Impossible d'accepter cette invitation.");
        return;
      }
      setSupervisorName(data.supervisor ? `${data.supervisor.firstName} ${data.supervisor.lastName}`.trim() : null);
      setStatus("accepted");
    } catch {
      setStatus("error");
      setError("Une erreur est survenue.");
    }
  }

  if (isLoading || !user) {
    return <div className="flex min-h-screen items-center justify-center text-slate-400">Chargement...</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-acadia-blue-50">
          <GraduationCap className="h-7 w-7 text-acadia-blue" />
        </div>

        {status === "accepted" ? (
          <>
            <CheckCircle2 className="mx-auto mt-4 h-8 w-8 text-emerald-500" />
            <h1 className="mt-3 text-xl font-bold text-acadia-navy">Invitation acceptée</h1>
            <p className="mt-2 text-sm text-slate-500">
              {supervisorName ? `${supervisorName} est maintenant votre directeur de recherche.` : "Votre directeur est maintenant associé à votre compte."}
            </p>
            <button
              type="button"
              onClick={() => router.push("/dashboard")}
              className="mt-6 rounded-xl bg-acadia-blue px-6 py-3 text-sm font-semibold text-white"
            >
              Aller à mon dashboard
            </button>
          </>
        ) : (
          <>
            <h1 className="mt-4 text-xl font-bold text-acadia-navy">Invitation d&apos;encadrement</h1>
            <p className="mt-2 text-sm text-slate-500">
              Un directeur de recherche vous invite à rejoindre son espace de supervision sur ACADIA.
            </p>

            {error && (
              <p className="mt-4 flex items-center justify-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-600">
                <AlertTriangle className="h-3.5 w-3.5" /> {error}
              </p>
            )}

            <div className="mt-6">
              <ResearchPrimaryButton onClick={handleAccept} disabled={status === "accepting"}>
                {status === "accepting" ? "Acceptation..." : "Accepter l'invitation"}
              </ResearchPrimaryButton>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
