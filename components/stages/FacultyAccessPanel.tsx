"use client";

import { useCallback, useEffect, useState } from "react";
import { Copy, KeyRound, Loader2, School, ShieldOff } from "lucide-react";

import type { AccessJson } from "./StageCrmDetail";

interface Scope {
  university: string;
  facultyName: string;
  count: number;
}

const input = "min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100";

/** Accès des facultés : un lien de lecture par (établissement, faculté), à durée limitée, révocable, montré une seule fois. */
export function FacultyAccessPanel() {
  const [scopes, setScopes] = useState<Scope[]>([]);
  const [accesses, setAccesses] = useState<AccessJson[]>([]);
  const [choice, setChoice] = useState("");
  const [days, setDays] = useState(90);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  // Heure de référence pour « expiré », fixée à chaque chargement (rendu pur).
  const [now, setNow] = useState(0);

  const load = useCallback(async () => {
    const res = await fetch("/api/admin/stages/access", { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as { scopes?: Scope[]; accesses?: AccessJson[]; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Accès impossible.");
    return data;
  }, []);

  useEffect(() => {
    let cancelled = false;
    void load()
      .then((data) => {
        if (cancelled) return;
        setScopes(data.scopes ?? []);
        setAccesses(data.accesses ?? []);
        setNow(Date.now());
      })
      .catch((e: Error) => !cancelled && setMessage(e.message));
    return () => {
      cancelled = true;
    };
  }, [load]);

  const refresh = async () => {
    const data = await load();
    setScopes(data.scopes ?? []);
    setAccesses(data.accesses ?? []);
    setNow(Date.now());
  };

  const create = async () => {
    const scope = scopes[Number(choice)];
    if (!scope) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/stages/access", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ university: scope.university, facultyName: scope.facultyName, days }) });
      const data = (await res.json().catch(() => ({}))) as { path?: string; error?: string };
      if (!res.ok || !data.path) setMessage(data.error ?? "Accès impossible à créer.");
      else {
        setLink(`${window.location.origin}${data.path}`);
        await refresh();
      }
    } catch {
      setMessage("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (id: string) => {
    if (!window.confirm("Révoquer cet accès ? Le lien cessera immédiatement de fonctionner.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/stages/access/${id}`, { method: "DELETE" });
      if (!res.ok) setMessage("Révocation impossible.");
      await refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6" aria-label="Accès des facultés">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
            <School size={20} className="text-violet-600" aria-hidden /> Accès des facultés
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">Chaque faculté consulte, en lecture seule, ses étudiants en stage académique : entreprise, dates, présences signées, journées confirmées et comptes rendus. Chaque consultation est tracée.</p>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[16rem] flex-1 text-xs font-semibold text-slate-600">
          Faculté
          <select className={`${input} mt-1 w-full`} value={choice} onChange={(e) => setChoice(e.target.value)}>
            <option value="">{scopes.length ? "Choisir l'établissement et la faculté" : "Aucun dossier académique pour l'instant"}</option>
            {scopes.map((s, i) => (
              <option key={`${s.university}|${s.facultyName}`} value={i}>
                {s.facultyName} — {s.university} ({s.count})
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs font-semibold text-slate-600">
          Validité
          <select className={`${input} mt-1`} value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[30, 90, 180, 365].map((n) => (
              <option key={n} value={n}>
                {n} jours
              </option>
            ))}
          </select>
        </label>
        <button type="button" disabled={busy || choice === ""} onClick={() => void create()} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-50">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <KeyRound size={16} aria-hidden />} Créer l&apos;accès
        </button>
      </div>
      {link ? (
        <div className="sc-pop space-y-1 rounded-2xl bg-violet-50 p-3">
          <p className="text-xs font-semibold text-violet-900">Lien à transmettre à la faculté (affiché une seule fois) :</p>
          <div className="flex items-center gap-2">
            <input className={`${input} w-full font-mono text-xs`} readOnly value={link} aria-label="Lien d'accès de la faculté" onFocus={(e) => e.target.select()} />
            <button type="button" onClick={() => void navigator.clipboard?.writeText(link)} className="rounded-lg bg-violet-600 p-2 text-white" aria-label="Copier le lien de la faculté">
              <Copy size={16} aria-hidden />
            </button>
          </div>
        </div>
      ) : null}
      {message ? (
        <p className="text-sm text-rose-700" role="alert">
          {message}
        </p>
      ) : null}
      {accesses.length ? (
        <ul className="divide-y divide-slate-100 text-sm">
          {accesses.map((a) => {
            const expired = now > 0 && Date.parse(a.expiresAt) < now;
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  <span className="font-semibold text-slate-900">{a.label}</span>
                  <span className="block text-xs text-slate-500">
                    {a.revokedAt ? "Révoqué" : expired ? "Expiré" : `Valable jusqu'au ${new Date(a.expiresAt).toLocaleDateString("fr-FR")}`}
                    {a.lastUsedAt ? ` · dernière consultation le ${new Date(a.lastUsedAt).toLocaleDateString("fr-FR")}` : " · jamais consulté"}
                  </span>
                </span>
                {!a.revokedAt && !expired ? (
                  <button type="button" disabled={busy} onClick={() => void revoke(a.id)} className="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-bold text-rose-700">
                    <ShieldOff size={14} aria-hidden /> Révoquer
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </section>
  );
}
