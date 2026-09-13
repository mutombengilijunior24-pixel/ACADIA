"use client";

// ============================================================
// ACADIA — SECTION REPLIABLE (Bloc E, Temps 2, 11/09/2026)
//
// Réduit la densité visuelle de la page projet (~17 composants
// majeurs affichés simultanément en une seule colonne) sans
// toucher à la logique métier : un simple conteneur repliable,
// réutilisable, qui n'invente aucun état — le statut affiché
// dans l'en-tête (badge) est fourni par l'appelant, calculé à
// partir de l'état réel du projet.
// ============================================================

import { ChevronDown, CheckCircle2, Clock, Circle } from "lucide-react";
import type { StageStatus } from "./ResearchStageProgress";

interface CollapsibleSectionProps {
  id?: string;
  title: string;
  summary?: string;
  status: StageStatus;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

const STATUS_ICON: Record<StageStatus, typeof CheckCircle2> = {
  done: CheckCircle2,
  current: Clock,
  upcoming: Circle,
};

const STATUS_COLOR: Record<StageStatus, string> = {
  done: "text-emerald-600",
  current: "text-acadia-blue",
  upcoming: "text-slate-400",
};

export default function CollapsibleSection({ id, title, summary, status, open, onToggle, children }: CollapsibleSectionProps) {
  const Icon = STATUS_ICON[status];

  return (
    <section id={id} className={`rounded-3xl border border-slate-200 bg-white shadow-sm ${status === "upcoming" ? "opacity-70" : ""}`}>
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-center justify-between gap-3 rounded-3xl px-6 py-4 text-left hover:bg-slate-50/60"
      >
        <span className="flex items-center gap-2.5">
          <Icon className={`h-5 w-5 shrink-0 ${STATUS_COLOR[status]}`} />
          <span>
            <span className="block text-base font-bold text-acadia-navy">{title}</span>
            {!open && summary && <span className="mt-0.5 block text-xs text-slate-400">{summary}</span>}
          </span>
        </span>
        <ChevronDown className={`h-5 w-5 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && <div className="space-y-6 px-6 pb-6">{children}</div>}
    </section>
  );
}
