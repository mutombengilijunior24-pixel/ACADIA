"use client";

// ============================================================
// ACADIA — RATTACHER SON COMPTE À SON NOM (vue directeur)
//
// Le directeur choisit son nom dans la liste des directeurs ; l'équipe
// ACADIA valide. Ensuite, son canevas actif s'applique automatiquement
// aux étudiants qui l'ont choisi — à chaque modification.
// ============================================================

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Clock, Link2, Loader2 } from "lucide-react";

interface LinkState {
  link: { directorId: string; label: string; status: "demande" | "valide"; requestedAt: string | null } | null;
  choices: { id: string; label: string; institution: string | null }[];
  studentProjects: number;
  hasActiveCanevas: boolean;
}

export default function DirectoryLinkCard({ compact = false }: { compact?: boolean }) {
  const [state, setState] = useState<LinkState | null>(null);
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = useCallback(async (init?: RequestInit) => {
    try {
      const res = await fetch("/api/supervision/directory-link", { cache: "no-store", ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
      const body = (await res.json().catch(() => ({}))) as LinkState & { error?: string };
      if (!res.ok) {
        setError(body.error ?? `Erreur ${res.status}`);
        return;
      }
      setError(null);
      setState(body);
    } catch {
      setError("Connexion au serveur impossible.");
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void apply();
  }, [apply]);

  async function act(init: RequestInit) {
    setBusy(true);
    await apply(init);
    setBusy(false);
  }

  const box = "rounded-3xl border bg-white p-6 shadow-sm";
  if (!state) {
    return error ? <div className={`${box} border-red-200 text-sm text-red-700`}>{error}</div> : null;
  }

  const { link } = state;

  if (link?.status === "valide") {
    return (
      <div className={`${box} border-emerald-200`}>
        <p className="flex items-center gap-2 text-sm font-bold text-emerald-800">
          <CheckCircle2 className="h-5 w-5" /> Votre compte est rattaché à « {link.label} »
        </p>
        {state.hasActiveCanevas ? (
          <p className="mt-2 text-sm text-slate-600">
            Votre canevas actif s&apos;applique automatiquement aux étudiants qui vous ont choisi ({state.studentProjects} projet
            {state.studentProjects > 1 ? "s" : ""}). Chaque modification leur parvient aussitôt.
          </p>
        ) : (
          <p className="mt-2 text-sm text-amber-800">
            Vous n&apos;avez pas encore de canevas actif : vos étudiants ({state.studentProjects} projet{state.studentProjects > 1 ? "s" : ""}) suivent pour l&apos;instant la
            logique générale d&apos;ACADIA.
          </p>
        )}
        {!compact && (
          <Link href="/dashboard/supervisor/canevas" className="mt-4 inline-flex rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            {state.hasActiveCanevas ? "Ajuster mon canevas" : "Définir mon canevas"}
          </Link>
        )}
      </div>
    );
  }

  if (link?.status === "demande") {
    return (
      <div className={`${box} border-amber-200`}>
        <p className="flex items-center gap-2 text-sm font-bold text-amber-800">
          <Clock className="h-5 w-5" /> Demande de rattachement à « {link.label} » envoyée
        </p>
        <p className="mt-2 text-sm text-slate-600">
          L&apos;équipe ACADIA vérifie votre identité. Dès la validation, votre canevas s&apos;appliquera automatiquement aux étudiants qui vous ont
          choisi.
        </p>
        <button type="button" disabled={busy} onClick={() => void act({ method: "DELETE" })} className="mt-4 text-sm font-semibold text-slate-500 hover:text-red-600">
          Annuler la demande
        </button>
        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className={`${box} border-acadia-blue-100`}>
      <p className="flex items-center gap-2 text-sm font-bold text-acadia-navy">
        <Link2 className="h-5 w-5 text-acadia-blue" /> Rattachez votre compte à votre nom
      </p>
      <p className="mt-2 text-sm text-slate-600">
        Les étudiants vous choisissent dans la liste des directeurs. Indiquez quel nom est le vôtre : une fois votre demande validée par l&apos;équipe
        ACADIA, votre canevas s&apos;appliquera automatiquement à leur travail.
      </p>
      {state.choices.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">Votre nom n&apos;est pas dans la liste : contactez l&apos;équipe ACADIA pour qu&apos;il y soit ajouté.</p>
      ) : (
        <div className="mt-4 flex flex-col gap-2 sm:flex-row">
          <select value={choice} onChange={(e) => setChoice(e.target.value)} className="flex-1 rounded-xl border border-slate-300 px-3 py-2.5 text-sm" aria-label="Votre nom dans la liste des directeurs">
            <option value="">Choisissez votre nom</option>
            {state.choices.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
                {c.institution ? ` — ${c.institution}` : ""}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!choice || busy}
            onClick={() => void act({ method: "POST", body: JSON.stringify({ directorId: choice }) })}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-acadia-blue px-4 py-2.5 text-sm font-semibold text-white hover:brightness-110 disabled:opacity-50"
          >
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Demander le rattachement
          </button>
        </div>
      )}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
