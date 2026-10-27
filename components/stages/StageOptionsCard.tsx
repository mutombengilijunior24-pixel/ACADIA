"use client";

import { useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Check, CreditCard, HeartPulse, Loader2, Rocket, ShieldCheck, Smartphone, UserCheck } from "lucide-react";

import { DEFAULT_STAGE_OPTIONS, isPaid, normalizeOptions, optionsLabel, optionsTotal, paidOptions, PAYMENT_METHODS, PAYMENT_STATE_LABELS, STAGE_OPTIONS, type StageOptionId } from "@/lib/core/stages/catalog";

import type { DossierJson } from "./types";

const METHOD_ICONS: Record<string, typeof Smartphone> = { mpesa: Smartphone, orange_money: Smartphone, airtel_money: Smartphone, carte: CreditCard };
const OPTION_ICONS: Record<StageOptionId, typeof UserCheck> = { recommandation: UserCheck, assurance: HeartPulse };

/** Choix de l'accompagnement (recommandation 17 $ cochée d'office, assurance 10 $) et paiement du total. */
export function StageOptionsCard({ app, onReload }: { app: DossierJson; onReload: () => Promise<void> }) {
  const [selected, setSelected] = useState<StageOptionId[]>(() => (app.packOptions.length ? normalizeOptions(app.packOptions) : DEFAULT_STAGE_OPTIONS));
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<string>("mpesa");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "success" | "warning"; text: string } | null>(null);
  // Une clé d'idempotence par choix d'options : un double clic ne crée jamais deux paiements, un nouveau choix en crée un nouveau.
  const idempotency = useRef<{ options: string; key: string } | null>(null);
  const total = optionsTotal(selected);

  if (isPaid(app.paymentStatus)) {
    const active = paidOptions(app);
    return (
      <section className="sc-fade-up space-y-2 rounded-3xl border border-emerald-200 bg-emerald-50 p-5" aria-label="Votre accompagnement">
        <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-900">
          <BadgeCheck size={18} aria-hidden /> {PAYMENT_STATE_LABELS[app.paymentStatus]} — {optionsLabel(active)} ({optionsTotal(active)} $)
        </p>
        <ul className="grid gap-1.5 text-sm text-emerald-950 sm:grid-cols-2">
          {STAGE_OPTIONS.filter((o) => active.includes(o.id)).flatMap((o) => o.items.map((item) => (
            <li key={item.title} className="flex items-start gap-1.5">
              <Check size={15} className="mt-0.5 shrink-0" aria-hidden /> {item.title}
            </li>
          )))}
        </ul>
      </section>
    );
  }

  const toggle = (id: StageOptionId) => {
    setNotice(null);
    setSelected((s) => normalizeOptions(s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  };

  const pay = async () => {
    const options = selected.join("+");
    if (idempotency.current?.options !== options) idempotency.current = { options, key: crypto.randomUUID() };
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/stages/${app.id}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, idempotencyKey: idempotency.current.key, options: selected }) });
      const data = (await res.json().catch(() => ({}))) as { state?: string; message?: string; instructions?: string | null; error?: string };
      if (!res.ok) {
        setNotice({ tone: "warning", text: data.error ?? "Le paiement n'a pas pu être lancé." });
        return;
      }
      await onReload();
      if (data.state === "unavailable") setNotice({ tone: "info", text: data.message ?? "" });
      else if (data.state === "already_paid") setNotice({ tone: "success", text: "Votre accompagnement est déjà réglé." });
      else setNotice({ tone: "info", text: data.instructions ?? "Paiement lancé : validez-le sur votre téléphone. Votre dossier se met à jour dès la confirmation de l'opérateur." });
      setPaying(false);
    } catch {
      setNotice({ tone: "warning", text: "Connexion impossible : réessayez dans un instant." });
    } finally {
      setBusy(false);
    }
  };

  const pending = app.paymentStatus === "en_attente";
  return (
    <section className="sc-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-900 p-5 text-white shadow-[0_30px_80px_-40px_rgba(76,29,149,0.9)] sm:p-7" style={{ animationDelay: "200ms" }} aria-label="Votre accompagnement">
      <div className="sc-float pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-fuchsia-500/30 blur-3xl" aria-hidden />
      <div className="relative">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-200">Votre accompagnement</p>
        <h3 className="mt-1 text-2xl font-black">Choisissez ce qu&apos;il vous faut</h3>
      </div>

      <div className="relative mt-5 space-y-3" role="group" aria-label="Options d'accompagnement">
        {STAGE_OPTIONS.map((o, i) => {
          const on = selected.includes(o.id);
          const Icon = OPTION_ICONS[o.id];
          return (
            <button
              key={o.id}
              type="button"
              role="checkbox"
              aria-checked={on}
              disabled={pending || busy}
              onClick={() => toggle(o.id)}
              className={`sc-fade-up group w-full rounded-2xl p-4 text-left transition duration-300 disabled:cursor-not-allowed ${on ? "bg-white text-slate-900 shadow-lg shadow-fuchsia-500/20 ring-2 ring-fuchsia-400" : "bg-white/5 text-white ring-1 ring-white/15 hover:bg-white/10"}`}
              style={{ animationDelay: `${280 + i * 90}ms` }}
            >
              <span className="flex items-start gap-3">
                <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border-2 transition ${on ? "border-fuchsia-600 bg-fuchsia-600" : "border-white/40"}`} aria-hidden>
                  {on ? <Check size={15} className="sc-pop text-white" /> : null}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-extrabold">
                      <Icon size={18} className={on ? "text-fuchsia-600" : "text-fuchsia-200"} aria-hidden /> {o.title}
                    </span>
                    <span className={`rounded-full px-3 py-1 text-sm font-black ${on ? "bg-fuchsia-100 text-fuchsia-800" : "bg-white/10 text-white"}`}>{o.priceUsd} $</span>
                  </span>
                  <span className={`mt-2 block space-y-1 text-xs leading-relaxed ${on ? "text-slate-600" : "text-violet-100/80"}`}>
                    {o.items.map((item) => (
                      <span key={item.title} className="block">
                        <span className="font-semibold">{item.title}</span> — {item.detail}
                      </span>
                    ))}
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative mt-5 flex items-end justify-between gap-3 border-t border-white/10 pt-4">
        <p className="text-sm text-violet-100">{selected.length ? `Total : ${optionsLabel(selected)}` : "Choisissez au moins une option."}</p>
        <p className="shrink-0 text-right">
          <span key={total} className="sc-pop inline-block whitespace-nowrap text-5xl font-black tracking-tight">{total}&nbsp;$</span>
        </p>
      </div>

      {paying ? (
        <div className="sc-slide-in relative mt-5 space-y-3 rounded-2xl bg-white p-4 text-slate-900">
          <p className="text-sm font-bold">Choisissez votre moyen de paiement</p>
          <div className="grid grid-cols-2 gap-2">
            {PAYMENT_METHODS.map((m) => {
              const Icon = METHOD_ICONS[m.id] ?? Smartphone;
              return (
                <label key={m.id} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold transition ${method === m.id ? "border-violet-500 bg-violet-50 text-violet-900 ring-2 ring-violet-200" : "border-slate-200 hover:border-violet-300"}`}>
                  <input type="radio" name="sc-method" className="sr-only" checked={method === m.id} onChange={() => setMethod(m.id)} />
                  <Icon size={18} aria-hidden /> {m.label}
                </label>
              );
            })}
          </div>
          <button type="button" onClick={() => void pay()} disabled={busy || !selected.length} className="sc-glow flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 text-sm font-black text-white disabled:opacity-70">
            {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ShieldCheck size={18} aria-hidden />} Payer {total} $ en toute sécurité
          </button>
          <button type="button" onClick={() => setPaying(false)} className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800">
            Modifier mon choix
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setPaying(true)} disabled={pending || !selected.length} className="sc-glow sc-shimmer group relative mt-5 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 text-base font-black text-white transition disabled:opacity-60">
          {pending ? (
            <>
              <Loader2 size={18} className="animate-spin" aria-hidden /> Paiement en attente de confirmation
            </>
          ) : (
            <>
              <Rocket size={20} aria-hidden /> Je valide — {total} $ <ArrowRight size={18} aria-hidden className="transition group-hover:translate-x-1.5" />
            </>
          )}
        </button>
      )}
      {notice ? <p className={`relative mt-3 rounded-xl p-3 text-sm ${notice.tone === "success" ? "bg-emerald-400/20 text-emerald-50" : notice.tone === "warning" ? "bg-amber-400/20 text-amber-50" : "bg-white/10 text-violet-50"}`} role="status">{notice.text}</p> : null}
    </section>
  );
}
