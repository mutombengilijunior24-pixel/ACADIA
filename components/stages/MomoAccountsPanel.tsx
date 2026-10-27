"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Save, Smartphone, Trash2 } from "lucide-react";

import { formatMsisdn, MOMO_OPERATORS, operatorFromNumber, type MomoAccount } from "@/lib/core/stages/momo";

/** Numéros affichés lisiblement (« +243 85 644 5612 ») ; le serveur les enregistre normalisés. */
const displayed = (list: MomoAccount[]) => list.map((a) => ({ ...a, number: formatMsisdn(a.number) }));

const input = "min-h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800 focus:border-violet-400 focus:outline-none focus:ring-4 focus:ring-violet-100";

/** Numéros Mobile Money de MNJ affichés aux étudiants pour le paiement déclaré (modifiables sans déploiement). */
export function MomoAccountsPanel() {
  const [accounts, setAccounts] = useState<MomoAccount[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/admin/stages/settings", { cache: "no-store" })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { momoAccounts?: MomoAccount[]; error?: string };
        if (cancelled) return;
        if (!res.ok) setMessage(data.error ?? "Réglages indisponibles.");
        setAccounts(displayed(data.momoAccounts ?? []));
      })
      .catch(() => !cancelled && setMessage("Connexion impossible."));
    return () => {
      cancelled = true;
    };
  }, []);

  const update = (i: number, patch: Partial<MomoAccount>) => setAccounts((list) => (list ?? []).map((a, j) => (j === i ? { ...a, ...patch } : a)));

  const save = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/stages/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ momoAccounts: accounts ?? [] }) });
      const data = (await res.json().catch(() => ({}))) as { momoAccounts?: MomoAccount[]; error?: string };
      if (!res.ok || !data.momoAccounts) setMessage(data.error ?? "Enregistrement impossible.");
      else {
        setAccounts(displayed(data.momoAccounts));
        setMessage("Numéros enregistrés : ils s'affichent désormais aux étudiants.");
      }
    } catch {
      setMessage("Connexion impossible.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6" aria-label="Numéros Mobile Money de MNJ">
      <div>
        <h2 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
          <Smartphone size={20} className="text-violet-600" aria-hidden /> Numéros Mobile Money de MNJ
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">Les étudiants envoient leur paiement sur ces numéros, puis déclarent le numéro de transaction ; vous confirmez chaque paiement après l&apos;avoir vu arriver sur le téléphone.</p>
      </div>
      {accounts === null ? (
        <p className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 size={16} className="animate-spin" aria-hidden /> Chargement…
        </p>
      ) : (
        <>
          <ul className="space-y-2">
            {accounts.map((a, i) => (
              <li key={i} className="flex flex-wrap items-end gap-2 rounded-2xl border border-slate-100 p-3">
                <label className="text-xs font-semibold text-slate-600">
                  Opérateur
                  <select className={`${input} mt-1 block`} value={a.operator} onChange={(e) => update(i, { operator: e.target.value as MomoAccount["operator"] })} aria-label={`Opérateur du numéro ${i + 1}`}>
                    {MOMO_OPERATORS.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs font-semibold text-slate-600">
                  Numéro
                  <input
                    className={`${input} mt-1 block w-48 tabular-nums`}
                    value={a.number}
                    onChange={(e) => update(i, { number: e.target.value })}
                    onBlur={(e) => {
                      const op = operatorFromNumber(e.target.value);
                      update(i, { number: formatMsisdn(e.target.value), ...(op ? { operator: op } : {}) });
                    }}
                    inputMode="tel"
                    aria-label={`Numéro ${i + 1}`}
                  />
                </label>
                <label className="min-w-[12rem] flex-1 text-xs font-semibold text-slate-600">
                  Nom affiché lors de l&apos;envoi
                  <input className={`${input} mt-1 block w-full`} value={a.name} onChange={(e) => update(i, { name: e.target.value })} aria-label={`Titulaire du numéro ${i + 1}`} />
                </label>
                <label className="flex min-h-10 items-center gap-2 text-sm text-slate-700">
                  <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={a.active} onChange={(e) => update(i, { active: e.target.checked })} /> Affiché
                </label>
                <button type="button" onClick={() => setAccounts((list) => (list ?? []).filter((_, j) => j !== i))} className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-600" aria-label={`Supprimer le numéro ${i + 1}`}>
                  <Trash2 size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setAccounts((list) => [...(list ?? []), { operator: "orange_money", number: "", name: "", active: true }])} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 px-4 text-sm font-bold text-slate-700 hover:bg-slate-50" disabled={(accounts?.length ?? 0) >= 6}>
              <Plus size={16} aria-hidden /> Ajouter un numéro
            </button>
            <button type="button" onClick={() => void save()} disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 text-sm font-bold text-white disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Save size={16} aria-hidden />} Enregistrer les numéros
            </button>
          </div>
        </>
      )}
      {message ? (
        <p className="text-sm text-slate-700" role="status">
          {message}
        </p>
      ) : null}
    </section>
  );
}
