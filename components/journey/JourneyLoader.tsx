"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";

import { buttonClass, Notice } from "@/components/data/ui";
import EconometricsWorkspace, { type SavedEconSession } from "@/components/econometrics/EconometricsWorkspace";
import FinanceWorkspace, { type SavedFinanceSession } from "@/components/finance/FinanceWorkspace";
import { parseEconSnapshot } from "@/lib/core/econometrics/persistence";
import { parseFinanceSnapshot } from "@/lib/core/finance/persistence";
import type { DedicatedEngine, EngineHandoff } from "@/lib/core/journey/kinds";
import { parseSnapshot } from "@/lib/core/journey/persistence";

import JourneyWorkspace, { type SavedSession } from "./JourneyWorkspace";

type LoaderState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; kind: "survey"; saved: SavedSession | null }
  | { status: "ready"; kind: "finance"; saved: SavedFinanceSession | null }
  | { status: "ready"; kind: "econometrie"; saved: SavedEconSession | null };

/**
 * Ouvre le parcours : nouvelle interprétation (parcours général, ou moteur dédié avec « ?moteur=finance » ou
 * « ?moteur=econometrie »), ou reprise d'une interprétation enregistrée (« ?s=<id> »), chargée AVANT le montage
 * pour initialiser toutes les décisions, dans le moteur avec lequel elle a été créée.
 */
export default function JourneyLoader({ sessionId, engine = null }: { sessionId: string | null; engine?: DedicatedEngine | null }) {
  const [state, setState] = useState<LoaderState>(() => (sessionId ? { status: "loading" } : { status: "ready", kind: engine ?? "survey", saved: null }) as LoaderState);
  // Moteur dédié ouvert depuis le parcours général (nouvelle interprétation, avec le domaine et le sujet).
  const [handoff, setHandoff] = useState<EngineHandoff | null>(null);

  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch(`/api/journey/sessions/${sessionId}`, { cache: "no-store" });
        const data = (await res.json().catch(() => ({}))) as { session?: { kind?: string; revision: number; title: string; payload: unknown; file: SavedSession["file"] }; error?: string };
        if (cancelled) return;
        if (!res.ok || !data.session) {
          setState({ status: "error", message: data.error ?? "Interprétation introuvable." });
          return;
        }
        const unreadable = { status: "error" as const, message: "Cette interprétation a été enregistrée dans un format qui ne peut plus être relu." };
        if (data.session.kind === "finance") {
          const snapshot = parseFinanceSnapshot(data.session.payload);
          setState(snapshot ? { status: "ready", kind: "finance", saved: { revision: data.session.revision, title: data.session.title, snapshot } } : unreadable);
          return;
        }
        if (data.session.kind === "econometrie") {
          const snapshot = parseEconSnapshot(data.session.payload);
          setState(snapshot ? { status: "ready", kind: "econometrie", saved: { revision: data.session.revision, title: data.session.title, snapshot } } : unreadable);
          return;
        }
        const snapshot = parseSnapshot(data.session.payload);
        setState(snapshot ? { status: "ready", kind: "survey", saved: { revision: data.session.revision, title: data.session.title, snapshot, file: data.session.file } } : unreadable);
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
  if (handoff) return handoff.engine === "econometrie" ? <EconometricsWorkspace key="handoff" sessionId={null} initial={null} handoff={handoff} /> : <FinanceWorkspace key="handoff" sessionId={null} initial={null} handoff={handoff} />;
  if (state.kind === "finance") return <FinanceWorkspace key={sessionId ?? "new"} sessionId={state.saved ? sessionId : null} initial={state.saved} />;
  if (state.kind === "econometrie") return <EconometricsWorkspace key={sessionId ?? "new"} sessionId={state.saved ? sessionId : null} initial={state.saved} />;
  return (
    <JourneyWorkspace
      key={sessionId ?? "new"}
      sessionId={state.saved ? sessionId : null}
      initial={state.saved}
      onSwitchEngine={(next) => {
        // Nouvelle interprétation dans le moteur dédié ; l'adresse permet de rouvrir ce moteur.
        window.history.replaceState(null, "", `/dashboard/journey?moteur=${next.engine}`);
        setHandoff(next);
      }}
    />
  );
}
