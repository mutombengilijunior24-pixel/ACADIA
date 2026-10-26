"use client";

import { useState } from "react";
import { BadgeCheck, CalendarCheck2, Clock3, Download, Loader2, LogIn, LogOut, NotebookPen } from "lucide-react";

import { buildDocx } from "@/lib/core/export/docx";
import { ACTIVITIES_MIN, ATTENDANCE_MIN_RATE } from "@/lib/core/stages/catalog";
import { duration, stageReportDocument, summaryLine, timeOf } from "@/lib/core/stages/report";
import { computeStatus, formatDay, formatDayTitle, summarizeAttendance } from "@/lib/core/stages/workflow";

import type { DossierJson } from "./types";

function download(bytes: Uint8Array, name: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const facts = (d: DossierJson) => ({ type: d.type, status: d.status, paymentStatus: d.paymentStatus, documentsReceived: d.documentsReceived, assignedCompany: d.assignedCompany, tutorName: d.tutorName, startDate: d.startDate, endDate: d.endDate });

/** Présences du jour, journal de stage et rapport : tout ce que l'étudiant écrit ici sert à son rapport et à la faculté. */
export function StageAttendance({ dossier, onChange }: { dossier: DossierJson; onChange: (d: DossierJson) => void }) {
  const [activities, setActivities] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const status = computeStatus(facts(dossier), dossier.today);
  const summary = summarizeAttendance(dossier.attendance, dossier.startDate, dossier.endDate, dossier.today);
  const todayRecord = dossier.attendance.find((r) => r.day === dossier.today) ?? null;
  const journal = [...dossier.attendance].sort((a, b) => b.day.localeCompare(a.day));
  const progress = summary.totalPlanned ? Math.min(100, Math.round((summary.complete / summary.totalPlanned) * 100)) : 0;

  const sign = async (body: { action: "arrivee" } | { action: "depart"; activities: string }) => {
    setBusy(true);
    setMessage(null);
    try {
      const send = () => fetch(`/api/stages/${dossier.id}/attendance`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      let res = await send();
      // Anti double-clic du serveur (moins d'une seconde entre deux actions) : une seule nouvelle tentative,
      // sans risque de doublon (une arrivée par jour, une journée clôturée n'est jamais réécrite).
      if (res.status === 429) {
        await new Promise((r) => window.setTimeout(r, 1000));
        res = await send();
      }
      const data = (await res.json().catch(() => ({}))) as { application?: DossierJson; error?: string };
      if (!res.ok || !data.application) setMessage(data.error ?? "La signature n'a pas pu être enregistrée.");
      else {
        onChange(data.application);
        if (body.action === "depart") setActivities("");
      }
    } catch {
      setMessage("Connexion impossible : réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  const report = () => {
    const doc = stageReportDocument(dossier, dossier.today);
    download(buildDocx(doc), `rapport-de-stage-${dossier.lastName.toLowerCase()}-${dossier.today}.docx`, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
  };

  return (
    <section className="sc-fade-up overflow-hidden rounded-3xl border border-violet-200 bg-white" aria-label="Mes présences et mon journal de stage">
      <div className="relative bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 p-5 text-white sm:p-7">
        <div className="sc-float pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-fuchsia-400/30 blur-3xl" aria-hidden />
        <p className="relative text-xs font-bold uppercase tracking-[0.16em] text-violet-100">Mes présences et mon journal</p>
        <h3 className="relative mt-1 text-2xl font-black">{status === "termine" ? "Stage terminé" : "Mon stage au quotidien"}</h3>
        <p className="relative mt-1 text-sm text-indigo-50">
          Du {dossier.startDate ? formatDay(dossier.startDate) : "?"} au {dossier.endDate ? formatDay(dossier.endDate) : "?"} — {dossier.assignedCompany}
        </p>
        <div className="relative mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/20">
            <div className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-white transition-all duration-700 ease-out" style={{ width: `${progress}%` }} />
          </div>
          <p className="mt-2 text-xs text-indigo-50">
            {summary.complete} journée(s) complète(s) sur {summary.totalPlanned} jour(s) ouvré(s) prévu(s) · {summary.confirmed} confirmée(s) par votre maître de stage
          </p>
        </div>
      </div>

      <div className="space-y-5 p-5 sm:p-7">
        {status === "en_stage" ? (
          <div className="sc-pop rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-violet-50 p-4 sm:p-5" aria-label="Aujourd'hui">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-violet-700">Aujourd&apos;hui · {formatDay(dossier.today)}</p>
            {!todayRecord ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-slate-700">Vous êtes arrivé(e) sur votre lieu de stage ? Signez votre présence : l&apos;heure est enregistrée par ACADIA.</p>
                <button type="button" disabled={busy} onClick={() => void sign({ action: "arrivee" })} className="sc-glow inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 px-6 text-sm font-black text-white disabled:opacity-70">
                  {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <LogIn size={18} aria-hidden />} Je signe mon arrivée
                </button>
              </div>
            ) : !todayRecord.departureAt ? (
              <div className="mt-3 space-y-3">
                <p className="inline-flex items-center gap-2 rounded-full bg-emerald-100 px-3 py-1 text-sm font-bold text-emerald-900">
                  <Clock3 size={15} aria-hidden /> Arrivée signée à {timeOf(todayRecord.arrivalAt)}
                </p>
                <label className="block text-sm">
                  <span className="mb-1.5 block font-semibold text-slate-800">En fin de journée : qu&apos;avez-vous fait aujourd&apos;hui ?</span>
                  <textarea
                    className="block min-h-28 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:text-sm"
                    value={activities}
                    onChange={(e) => setActivities(e.target.value)}
                    placeholder="Ex. J'ai participé au rapprochement bancaire du mois de septembre avec le comptable, puis j'ai saisi 25 factures fournisseurs dans le logiciel."
                  />
                  <span className="mt-1 block text-xs text-slate-500">{activities.trim().length} caractère(s) — au moins {ACTIVITIES_MIN}. Ce texte servira à votre rapport de stage.</span>
                </label>
                <button type="button" disabled={busy || activities.trim().length < ACTIVITIES_MIN} onClick={() => void sign({ action: "depart", activities })} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 px-6 text-sm font-black text-white shadow-lg shadow-indigo-500/30 disabled:opacity-50">
                  {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <LogOut size={18} aria-hidden />} Je clôture ma journée
                </button>
              </div>
            ) : (
              <p className="mt-3 inline-flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
                <BadgeCheck size={18} aria-hidden /> Journée clôturée : arrivée {timeOf(todayRecord.arrivalAt)}, départ {timeOf(todayRecord.departureAt)} ({duration(todayRecord)}). À demain !
              </p>
            )}
            {message ? (
              <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">
                {message}
              </p>
            ) : null}
          </div>
        ) : status === "place" ? (
          <p className="rounded-2xl bg-sky-50 p-4 text-sm text-sky-900">Vos présences s&apos;ouvriront le {dossier.startDate ? formatDay(dossier.startDate) : "jour du début"}.</p>
        ) : status === "termine" ? (
          <div className="rounded-2xl bg-emerald-50 p-4 text-sm text-emerald-900">
            <p className="font-bold">{summaryLine(summary)}</p>
            <p className="mt-1">
              {summary.inOrder
                ? "Votre stage est en ordre : votre faculté peut le vérifier auprès de MNJ Stage Connect."
                : `Le seuil de présence (${Math.round(ATTENDANCE_MIN_RATE * 100)} % des jours ouvrés) n'est pas atteint : rapprochez-vous de MNJ Stage Connect.`}
            </p>
          </div>
        ) : null}

        {dossier.attendance.length ? (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-dashed border-violet-300 bg-violet-50/50 p-4">
            <p className="flex items-start gap-2 text-sm text-violet-950">
              <NotebookPen size={18} className="mt-0.5 shrink-0 text-violet-600" aria-hidden />
              {status === "termine" ? "Votre rapport de stage est prêt à compléter : vos comptes rendus y sont repris jour par jour." : "Votre rapport se construit au fil des jours : téléchargez le projet à tout moment."}
            </p>
            <button type="button" onClick={report} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-bold text-white hover:bg-slate-700">
              <Download size={16} aria-hidden /> {status === "termine" ? "Mon rapport de stage (Word)" : "Projet de rapport (Word)"}
            </button>
          </div>
        ) : null}

        <div>
          <h4 className="flex items-center gap-2 text-base font-extrabold text-slate-900">
            <CalendarCheck2 size={18} className="text-violet-600" aria-hidden /> Mon journal de stage
          </h4>
          {journal.length ? (
            <ol className="mt-3 space-y-2">
              {journal.map((r, i) => (
                <li key={r.day} className="sc-fade-up rounded-2xl border border-slate-200 p-3 text-sm" style={{ animationDelay: `${Math.min(i, 8) * 40}ms` }}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-bold text-slate-900">{formatDayTitle(r.day)}</span>
                    <span className="flex flex-wrap gap-1.5 text-xs">
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
                        {timeOf(r.arrivalAt)} → {timeOf(r.departureAt)} {r.departureAt ? `(${duration(r)})` : ""}
                      </span>
                      {r.tutorConfirmedAt ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-900">Confirmée par l&apos;entreprise</span> : null}
                      {!r.departureAt && r.day < dossier.today ? <span className="rounded-full bg-amber-100 px-2.5 py-0.5 font-bold text-amber-900">Départ non signé</span> : null}
                    </span>
                  </div>
                  {r.activities ? <p className="mt-2 whitespace-pre-line text-slate-700">{r.activities}</p> : null}
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-2 text-sm text-slate-500">Aucune journée enregistrée pour l&apos;instant.</p>
          )}
          {summary.absent.length ? <p className="mt-3 text-xs text-slate-500">Jours ouvrés sans signature : {summary.absent.map((d) => new Date(`${d}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "short", timeZone: "UTC" })).join(", ")}.</p> : null}
        </div>
      </div>
    </section>
  );
}
