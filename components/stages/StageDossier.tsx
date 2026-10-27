"use client";

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Circle, Clock3, FileText, Loader2, MapPin, Phone, Sparkles, Undo2 } from "lucide-react";

import { isPaid, PAYMENT_STATE_LABELS, REQUIRED_DOCUMENTS, STAGE_STATUS_LABELS, STAGE_STATUSES, STAGE_TYPE_LABELS, type StagePaymentState, type StageStatus } from "@/lib/core/stages/catalog";
import { facultyOf } from "@/lib/core/stages/report";
import { formatDay, nextStep, STEP_HOW } from "@/lib/core/stages/workflow";

import { StageAttendance } from "./StageAttendance";
import { StageOptionsCard } from "./StageOptionsCard";
import type { DossierJson } from "./types";

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

          <StageOptionsCard app={app} onReload={load} />
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
