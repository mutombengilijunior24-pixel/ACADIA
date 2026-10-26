"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, Building2, CheckCircle2, Circle, Clock3, CreditCard, FileText, HeartPulse, Loader2, MapPin, Phone, Rocket, School, ShieldCheck, Smartphone, Sparkles, Undo2, UserCheck } from "lucide-react";

import { isPaid, PAYMENT_METHODS, PAYMENT_STATE_LABELS, REQUIRED_DOCUMENTS, STAGE_PACK, STAGE_STATUS_LABELS, STAGE_STATUSES, STAGE_TYPE_LABELS, type StagePaymentState, type StageStatus } from "@/lib/core/stages/catalog";
import { facultyOf } from "@/lib/core/stages/report";
import { formatDay, nextStep, STEP_HOW } from "@/lib/core/stages/workflow";

import { StageAttendance } from "./StageAttendance";
import type { DossierJson } from "./types";

const PACK_ICONS = [HeartPulse, BadgeCheck, UserCheck, Building2, Clock3, School];
const METHOD_ICONS: Record<string, typeof Smartphone> = { mpesa: Smartphone, orange_money: Smartphone, airtel_money: Smartphone, carte: CreditCard };
const TIMELINE = STAGE_STATUSES.filter((s) => s !== "annule");

export function StatusPill({ status, payment }: { status: StageStatus; payment: StagePaymentState }) {
  return (
    <span className="flex flex-wrap gap-2">
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${status === "annule" ? "bg-slate-100 text-slate-600" : status === "en_attente" ? "bg-amber-100 text-amber-900" : "bg-emerald-100 text-emerald-900"}`}>
        {status === "en_attente" ? <Clock3 size={13} aria-hidden /> : <CheckCircle2 size={13} aria-hidden />} {STAGE_STATUS_LABELS[status]}
      </span>
      <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold ${isPaid(payment) ? "bg-emerald-100 text-emerald-900" : payment === "en_attente" ? "bg-sky-100 text-sky-900" : "bg-violet-100 text-violet-900"}`}>{PAYMENT_STATE_LABELS[payment]}</span>
    </span>
  );
}

const facts = (d: DossierJson) => ({ type: d.type, status: d.status, paymentStatus: d.paymentStatus, documentsReceived: d.documentsReceived, assignedCompany: d.assignedCompany, tutorName: d.tutorName, startDate: d.startDate, endDate: d.endDate });

/** Suivi d'un dossier : étapes (et ce qui les déclenche), prochaine étape, documents, pack, placement, présences. */
export function StageDossier({ id, justCreated, onBack }: { id: string; justCreated: boolean; onBack: () => void }) {
  const [app, setApp] = useState<DossierJson | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [paying, setPaying] = useState(false);
  const [method, setMethod] = useState<string>("mpesa");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "info" | "success" | "warning"; text: string } | null>(null);
  const idempotency = useRef<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/stages/${id}`, { cache: "no-store" });
      const data = (await res.json().catch(() => ({}))) as { application?: DossierJson; error?: string };
      if (!res.ok || !data.application) setError(data.error ?? "Dossier introuvable.");
      else setApp(data.application);
    } catch {
      setError("Connexion impossible.");
    }
  }, [id]);

  useEffect(() => {
    // Chargement du dossier (requête réseau) à l'ouverture.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  // Paiement en attente de confirmation du fournisseur : vérification périodique (2 minutes au plus).
  useEffect(() => {
    if (app?.paymentStatus !== "en_attente") return;
    let n = 0;
    const timer = window.setInterval(() => {
      n += 1;
      void load();
      if (n >= 24) window.clearInterval(timer);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [app?.paymentStatus, load]);

  const pay = async () => {
    if (!app) return;
    idempotency.current ??= crypto.randomUUID();
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch(`/api/stages/${app.id}/checkout`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ method, idempotencyKey: idempotency.current }) });
      const data = (await res.json().catch(() => ({}))) as { state?: string; message?: string; instructions?: string | null; error?: string };
      if (!res.ok) {
        setNotice({ tone: "warning", text: data.error ?? "Le paiement n'a pas pu être lancé." });
        return;
      }
      await load();
      if (data.state === "unavailable") setNotice({ tone: "info", text: data.message ?? "" });
      else if (data.state === "already_paid") setNotice({ tone: "success", text: "Votre pack est déjà réglé." });
      else setNotice({ tone: "info", text: data.instructions ?? "Paiement lancé : validez-le sur votre téléphone. Votre dossier se met à jour dès la confirmation de l'opérateur." });
      setPaying(false);
    } catch {
      setNotice({ tone: "warning", text: "Connexion impossible : réessayez dans un instant." });
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    if (!app || !window.confirm("Annuler ce dossier ?")) return;
    const res = await fetch(`/api/stages/${app.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "cancel" }) });
    if (res.ok) onBack();
  };

  if (error) return <p className="rounded-2xl bg-rose-50 p-4 text-sm text-rose-800">{error}</p>;
  if (!app)
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
        <Loader2 size={18} className="animate-spin text-violet-600" aria-hidden /> Chargement de votre dossier…
      </p>
    );
  const step = TIMELINE.indexOf(app.status as (typeof TIMELINE)[number]);
  const paid = isPaid(app.paymentStatus);
  const next = nextStep(facts(app), app.today);
  const placed = step >= TIMELINE.indexOf("place");
  const live = app.status === "en_stage" || app.status === "termine" || app.status === "place";

  return (
    <div className="space-y-6">
      <button type="button" onClick={onBack} className="inline-flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900">
        <Undo2 size={16} aria-hidden /> Mes dossiers
      </button>

      {justCreated ? (
        <section className="sc-pop relative overflow-hidden rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-500 p-6 text-white shadow-[0_30px_70px_-35px_rgba(5,150,105,0.8)] sm:p-8" role="status" aria-label="Dossier enregistré">
          <div className="flex flex-wrap items-center gap-5">
            <span className="sc-ring relative flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-white/20">
              <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path className="sc-draw" d="M5 12.5l4.5 4.5L19 7.5" stroke="white" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </span>
            <div>
              <p className="text-2xl font-black">Dossier enregistré, {app.firstName}{" "}!</p>
              <p className="mt-1 text-emerald-50">Il est en attente d&apos;orientation : un conseiller MNJ l&apos;étudie et vous contacte. Voici ce qu&apos;il vous reste à faire.</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="sc-fade-up rounded-3xl border border-slate-200 bg-white p-5 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">{STAGE_TYPE_LABELS[app.type]}</p>
            <h2 className="mt-1 text-xl font-extrabold text-slate-900">
              {app.firstName} {app.lastName}
            </h2>
            <p className="text-sm text-slate-600">
              {app.university} · {facultyOf(app)} · {app.department} · {app.level}
            </p>
          </div>
          <StatusPill status={app.status} payment={app.paymentStatus} />
        </div>
        {app.status !== "annule" ? (
          <ol className="mt-6 grid gap-3 sm:grid-cols-6" aria-label="Suivi de votre dossier">
            {TIMELINE.map((s, i) => {
              const done = i < step;
              const current = i === step;
              return (
                <li key={s} className="sc-fade-up flex items-start gap-3 sm:flex-col sm:gap-2" style={{ animationDelay: `${i * 70}ms` }}>
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition ${done ? "bg-emerald-500 text-white" : current ? "sc-ring relative bg-gradient-to-br from-violet-600 to-indigo-600 text-white" : "bg-slate-100 text-slate-500"}`}>{done ? <CheckCircle2 size={18} aria-hidden /> : i + 1}</span>
                  <span>
                    <span className={`block text-xs font-bold leading-tight ${current ? "text-violet-800" : done ? "text-emerald-800" : "text-slate-500"}`}>{STAGE_STATUS_LABELS[s]}</span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-slate-500">{STEP_HOW[s]}</span>
                  </span>
                </li>
              );
            })}
          </ol>
        ) : null}
      </section>

      {app.status !== "annule" && next.student.length ? (
        <section className="sc-fade-up rounded-3xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 p-[2px]" style={{ animationDelay: "80ms" }} aria-label="Prochaine étape">
          <div className="flex flex-wrap items-start gap-3 rounded-[22px] bg-white p-4 sm:p-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
              <Sparkles size={20} aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Prochaine étape</p>
              <ul className="mt-1 space-y-1 text-sm font-semibold text-slate-900">
                {next.student.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {live ? <StageAttendance dossier={app} onChange={setApp} /> : null}

      {placed || app.assignedCompany ? (
        <section className="sc-fade-up grid gap-3 rounded-3xl border border-emerald-200 bg-emerald-50/60 p-5 sm:grid-cols-2 sm:p-6" aria-label="Mon lieu de stage">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Mon lieu de stage</p>
            <p className="mt-1 text-lg font-extrabold text-slate-900">{app.assignedCompany}</p>
            {app.companyAddress ? (
              <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-700">
                <MapPin size={15} className="mt-0.5 shrink-0" aria-hidden /> {app.companyAddress}
              </p>
            ) : null}
            {app.startDate && app.endDate ? <p className="mt-1 text-sm text-slate-700">Du {formatDay(app.startDate)} au {formatDay(app.endDate)}</p> : null}
          </div>
          {app.tutorName ? (
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-800">Mon maître de stage</p>
              <p className="mt-1 font-bold text-slate-900">
                {app.tutorName}
                {app.tutorRole ? <span className="font-normal text-slate-600"> — {app.tutorRole}</span> : null}
              </p>
              {app.tutorPhone ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-700">
                  <Phone size={14} aria-hidden /> {app.tutorPhone}
                </p>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {app.status !== "annule" ? (
        <section className={`grid items-start gap-5 ${paid ? "" : "lg:grid-cols-[1fr_1.15fr]"}`}>
          <div className="sc-fade-up space-y-3 rounded-3xl border border-slate-200 bg-white p-5 sm:p-6" style={{ animationDelay: "120ms" }}>
            <h3 className="flex items-center gap-2 text-lg font-extrabold text-slate-900">
              <FileText size={20} className="text-violet-600" aria-hidden /> Vos documents
            </h3>
            <p className="text-sm text-slate-600">Apportez-les au bureau MNJ Stage Connect ou envoyez-les à votre conseiller. Chaque document reçu est coché par l&apos;équipe.</p>
            <ul className="space-y-2">
              {REQUIRED_DOCUMENTS[app.type].map((d, i) => {
                const received = app.documentsReceived.includes(d.label);
                return (
                  <li key={d.label} className="sc-fade-up flex items-start gap-2 text-sm text-slate-800" style={{ animationDelay: `${200 + i * 60}ms` }}>
                    {received ? <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600" aria-hidden /> : <Circle size={18} className="mt-0.5 shrink-0 text-slate-300" aria-hidden />}
                    <span>
                      {d.label}
                      {d.optional ? <span className="text-slate-400"> (facultatif)</span> : null}
                      <span className={`ml-2 text-xs font-bold ${received ? "text-emerald-700" : "text-slate-400"}`}>{received ? "reçu" : "à remettre"}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>

          {!paid ? (
            <div className="sc-fade-up relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-900 p-5 text-white shadow-[0_30px_80px_-40px_rgba(76,29,149,0.9)] sm:p-7" style={{ animationDelay: "200ms" }} aria-label="Pack Stage Connect">
              <div className="sc-float pointer-events-none absolute -right-16 -top-16 h-52 w-52 rounded-full bg-fuchsia-500/30 blur-3xl" aria-hidden />
              <div className="relative flex flex-wrap items-end justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-200">Votre pack d&apos;accompagnement</p>
                  <h3 className="mt-1 text-2xl font-black">{STAGE_PACK.title}</h3>
                </div>
                <p className="text-right">
                  <span className="text-5xl font-black tracking-tight">{STAGE_PACK.priceUsd} $</span>
                  <span className="block text-xs text-violet-200">tout compris</span>
                </p>
              </div>
              <ul className="relative mt-5 space-y-3">
                {STAGE_PACK.items.map((item, i) => {
                  const Icon = PACK_ICONS[i % PACK_ICONS.length];
                  return (
                    <li key={item.title} className="sc-fade-up flex gap-3" style={{ animationDelay: `${300 + i * 80}ms` }}>
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/15">
                        <Icon size={18} className="text-fuchsia-200" aria-hidden />
                      </span>
                      <span>
                        <span className="block text-sm font-bold">{item.title}</span>
                        <span className="block text-xs leading-relaxed text-violet-100/90">{item.detail}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
              {paying ? (
                <div className="sc-slide-in relative mt-6 space-y-3 rounded-2xl bg-white p-4 text-slate-900">
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
                  <button type="button" onClick={() => void pay()} disabled={busy} className="sc-glow flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 text-sm font-black text-white disabled:opacity-70">
                    {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <ShieldCheck size={18} aria-hidden />} Payer {STAGE_PACK.priceUsd} $ en toute sécurité
                  </button>
                  <button type="button" onClick={() => setPaying(false)} className="w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800">
                    Plus tard
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setPaying(true)} disabled={app.paymentStatus === "en_attente"} className="sc-glow sc-shimmer group relative mt-6 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-amber-400 text-base font-black text-white transition disabled:opacity-70">
                  {app.paymentStatus === "en_attente" ? (
                    <>
                      <Loader2 size={18} className="animate-spin" aria-hidden /> Paiement en attente de confirmation
                    </>
                  ) : (
                    <>
                      <Rocket size={20} aria-hidden /> Je valide mon pack — {STAGE_PACK.priceUsd} $ <ArrowRight size={18} aria-hidden className="transition group-hover:translate-x-1.5" />
                    </>
                  )}
                </button>
              )}
              {notice ? <p className={`relative mt-3 rounded-xl p-3 text-sm ${notice.tone === "success" ? "bg-emerald-400/20 text-emerald-50" : notice.tone === "warning" ? "bg-amber-400/20 text-amber-50" : "bg-white/10 text-violet-50"}`} role="status">{notice.text}</p> : null}
            </div>
          ) : (
            <p className="inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
              <BadgeCheck size={18} aria-hidden /> {PAYMENT_STATE_LABELS[app.paymentStatus]} — votre accompagnement est activé.
            </p>
          )}
        </section>
      ) : (
        <p className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">Ce dossier est annulé.</p>
      )}

      {app.status !== "annule" && !paid ? (
        <button type="button" onClick={() => void cancel()} className="text-xs font-semibold text-slate-500 underline-offset-2 hover:text-rose-700 hover:underline">
          Annuler ce dossier
        </button>
      ) : null}
    </div>
  );
}
