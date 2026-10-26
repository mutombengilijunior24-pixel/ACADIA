"use client";

import "./stage-connect.css";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Download, Loader2 } from "lucide-react";

import { buildWorkbook } from "@/lib/core/export/xlsx";
import { duration, registerSheets, timeOf, type RegisterStudent } from "@/lib/core/stages/report";
import { formatDay, formatDayTitle } from "@/lib/core/stages/workflow";

import type { AttendanceJson } from "./types";

/** Registre du stagiaire vu par son maître de stage : confirmation des journées signées. */
export function TutorRegister({ token, attendance, today }: { token: string; attendance: AttendanceJson[]; today: string }) {
  const router = useRouter();
  const pending = attendance.filter((r) => !r.tutorConfirmedAt && r.day <= today);
  const [selected, setSelected] = useState<string[]>(pending.map((r) => r.day));
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const confirm = async (days: string[]) => {
    if (!days.length) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/stage-access/tuteur/${token}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ days }) });
      const data = (await res.json().catch(() => ({}))) as { confirmed?: number; error?: string };
      if (!res.ok) setMessage(data.error ?? "La confirmation n'a pas pu être enregistrée.");
      else {
        setMessage(`${data.confirmed ?? 0} journée(s) confirmée(s). Merci !`);
        router.refresh();
      }
    } catch {
      setMessage("Connexion impossible : réessayez dans un instant.");
    } finally {
      setBusy(false);
    }
  };

  const sorted = [...attendance].sort((a, b) => b.day.localeCompare(a.day));
  return (
    <div className="space-y-4">
      {pending.length ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-violet-50 p-4">
          <p className="text-sm font-semibold text-violet-950">{pending.length} journée(s) signée(s) par le stagiaire attendent votre confirmation.</p>
          <button type="button" disabled={busy || !selected.length} onClick={() => void confirm(selected)} className="sc-glow inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-5 text-sm font-black text-white disabled:opacity-60">
            {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <BadgeCheck size={16} aria-hidden />} Confirmer les journées cochées ({selected.length})
          </button>
        </div>
      ) : (
        <p className="rounded-2xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">Toutes les journées signées sont confirmées.</p>
      )}
      {message ? (
        <p className="rounded-xl bg-slate-100 p-3 text-sm text-slate-800" role="status">
          {message}
        </p>
      ) : null}
      <ol className="space-y-2">
        {sorted.map((r) => {
          const canConfirm = !r.tutorConfirmedAt && r.day <= today;
          return (
            <li key={r.day} className="rounded-2xl border border-slate-200 bg-white p-4 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 font-bold text-slate-900">
                  {canConfirm ? <input type="checkbox" className="h-4 w-4 accent-violet-600" checked={selected.includes(r.day)} onChange={(e) => setSelected((s) => (e.target.checked ? [...s, r.day] : s.filter((d) => d !== r.day)))} aria-label={`Confirmer le ${formatDay(r.day)}`} /> : null}
                  {formatDayTitle(r.day)}
                </label>
                <span className="flex flex-wrap gap-1.5 text-xs">
                  <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-semibold text-slate-700">
                    {timeOf(r.arrivalAt)} → {timeOf(r.departureAt)} {r.departureAt ? `(${duration(r)})` : ""}
                  </span>
                  {r.tutorConfirmedAt ? <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 font-bold text-emerald-900">Confirmée</span> : null}
                </span>
              </div>
              {r.activities ? <p className="mt-2 whitespace-pre-line text-slate-700">{r.activities}</p> : <p className="mt-2 text-slate-400">Journée pas encore décrite par le stagiaire.</p>}
            </li>
          );
        })}
      </ol>
      {!sorted.length ? <p className="text-sm text-slate-500">Le stagiaire n&apos;a encore signé aucune journée.</p> : null}
    </div>
  );
}

/** Export Excel du registre de la faculté (synthèse + présences jour par jour). */
export function FacultyExport({ students, title, today }: { students: RegisterStudent[]; title: string; today: string }) {
  const exportXlsx = () => {
    const bytes = buildWorkbook(registerSheets(students, title, today));
    const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `registre-stages-${today}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  return (
    <button type="button" onClick={exportXlsx} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-bold text-violet-800 shadow-sm hover:bg-violet-50">
      <Download size={16} aria-hidden /> Registre complet (Excel)
    </button>
  );
}
