"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { buttonClass, Notice } from "@/components/data/ui";
import { parseSnapshot } from "@/lib/core/journey/persistence";

import JourneyWorkspace, { type SavedSession } from "./JourneyWorkspace";

/**
 * Ouvre le parcours : nouvelle interprétation (sans « s »), ou reprise d'une interprétation enregistrée
 * (« ?s=<id> »), chargée AVANT le montage pour initialiser toutes les décisions.
 */
export default function JourneyLoader({ sessionId }: { sessionId: string | null }) {
  const [state, setState] = useState<{ status: "loading" | "ready" | "error"; saved?: SavedSession; message?: string }>(() => (sessionId ? { status: "loading" } : { status: "ready" }));

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/journey/sessions/${sessionId}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { session?: { revision: number; title: string; payload: unknown; file: SavedSession["file"] }; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.session) {
          setState({ status: "error", message: data.error ?? "Interprétation introuvable." });
          return;
        }
        const snapshot = parseSnapshot(data.session.payload);
        if (!snapshot) {
          setState({ status: "error", message: "Cette interprétation a été enregistrée dans un format qui ne peut plus être relu." });
          return;
        }
        setState({ status: "ready", saved: { revision: data.session.revision, title: data.session.title, snapshot, file: data.session.file } });
      } catch {
        if (!cancelled) setState({ status: "error", message: "Connexion au serveur impossible." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (state.status === "loading")
    return (
      <p className="flex items-center gap-2 text-sm text-slate-700" role="status">
        <Loader2 size={18} className="animate-spin text-indigo-600" aria-hidden /> Ouverture de votre interprétation…
      </p>
    );
  if (state.status === "error")
    return (
      <Notice
        tone="error"
        title="Impossible d'ouvrir cette interprétation"
        action={
          <Link href="/dashboard/interpretations" className={buttonClass.secondary}>
            Mes interprétations
          </Link>
        }
      >
        {state.message}
      </Notice>
    );
  return <JourneyWorkspace key={sessionId ?? "new"} sessionId={state.saved ? sessionId : null} initial={state.saved ?? null} />;
}
