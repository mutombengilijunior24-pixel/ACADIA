"use client";

import { useEffect } from "react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[ACADIA] Erreur non interceptée dans un segment de route :", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 text-center">
      <p className="text-sm font-bold uppercase tracking-wide text-red-600">Une erreur est survenue</p>
      <h1 className="mt-3 text-2xl font-bold text-acadia-navy">Quelque chose s&apos;est mal passé</h1>
      <p className="mt-2 max-w-md text-sm text-slate-500">
        Aucune donnée n&apos;a été perdue. Vous pouvez réessayer, ou revenir au tableau de bord si le problème
        persiste.
      </p>
      {error.digest && <p className="mt-2 text-xs text-slate-400">Référence : {error.digest}</p>}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={reset}
          className="rounded-xl bg-acadia-blue px-5 py-2.5 text-sm font-semibold text-white hover:bg-acadia-blue/90"
        >
          Réessayer
        </button>
        <a
          href="/dashboard"
          className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-acadia-navy hover:bg-slate-100"
        >
          Tableau de bord
        </a>
      </div>
    </div>
  );
}
