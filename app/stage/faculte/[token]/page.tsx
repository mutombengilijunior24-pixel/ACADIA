import type { Metadata } from "next";
import { CheckCircle2, ShieldAlert } from "lucide-react";

import { FacultyExport } from "@/components/stages/StageAccessViews";
import { ATTENDANCE_MIN_RATE, STAGE_STATUS_LABELS, type StageStatus } from "@/lib/core/stages/catalog";
import { duration, summaryLine, timeOf } from "@/lib/core/stages/report";
import { formatDayTitle, summarizeAttendance } from "@/lib/core/stages/workflow";
import { facultyView } from "@/lib/server/stages/StageService";

// Accès de lecture d'une faculté : jamais indexé, jamais transmis en « Referer » à un autre site.
export const metadata: Metadata = {
  title: "Registre des stages — MNJ Stage Connect",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function Invalid() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center">
        <ShieldAlert size={32} className="mx-auto text-amber-500" aria-hidden />
        <h1 className="mt-3 text-xl font-extrabold text-slate-900">Ce lien n&apos;est plus valide</h1>
        <p className="mt-2 text-sm text-slate-600">Il a expiré ou a été révoqué. Demandez un nouvel accès à l&apos;équipe MNJ Stage Connect.</p>
      </div>
    </main>
  );
}

export default async function FacultyPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await facultyView(token).catch(() => null);
  if (!data) return <Invalid />;
  const students = data.students.map((s) => ({ ...s, summary: summarizeAttendance(s.attendance, s.startDate, s.endDate, data.today) }));
  const inOrder = students.filter((s) => s.summary.inOrder).length;
  const title = `${data.facultyName} — ${data.university}`;
  const exportable = data.students.map((s) => ({
    name: s.name,
    studentNumber: s.studentNumber,
    department: s.department,
    level: s.level,
    company: s.company,
    startDate: s.startDate,
    endDate: s.endDate,
    attendance: s.attendance.map((r) => ({ day: r.day, arrivalAt: r.arrivalAt.toISOString(), departureAt: r.departureAt?.toISOString() ?? null, activities: r.activities, tutorConfirmedAt: r.tutorConfirmedAt?.toISOString() ?? null })),
  }));
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="rounded-3xl bg-gradient-to-br from-slate-950 via-violet-950 to-indigo-900 p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-fuchsia-200">MNJ Stage Connect · Espace faculté (lecture seule)</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-violet-100">
            Stages académiques : {students.length} étudiant(s), dont {inOrder} en ordre. Accès valable jusqu&apos;au {data.expiresAt.toLocaleDateString("fr-FR")}.
          </p>
          <div className="mt-4">
            <FacultyExport students={exportable} title={`Registre des stages — ${title}`} today={data.today} />
          </div>
        </header>
        <p className="text-sm text-slate-600">
          Les présences sont signées par l&apos;étudiant (heure enregistrée par le serveur d&apos;ACADIA) et confirmées par le maître de stage depuis son lien personnel. « En ordre » : stage terminé et présence d&apos;au moins {Math.round(ATTENDANCE_MIN_RATE * 100)} % des jours ouvrés (lundi à vendredi).
        </p>
        {students.length ? (
          <ul className="space-y-3">
            {students.map((s) => (
              <li key={s.id}>
                <details className="group rounded-3xl border border-slate-200 bg-white">
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-3 p-5">
                    <span>
                      <span className="block font-extrabold text-slate-900">
                        {s.name}
                        {s.studentNumber ? <span className="font-normal text-slate-500"> · {s.studentNumber}</span> : null}
                      </span>
                      <span className="block text-sm text-slate-600">
                        {s.department} · {s.level} · {s.company ?? "entreprise à déterminer"}
                        {s.startDate && s.endDate ? ` · du ${new Date(`${s.startDate}T12:00:00Z`).toLocaleDateString("fr-FR")} au ${new Date(`${s.endDate}T12:00:00Z`).toLocaleDateString("fr-FR")}` : ""}
                      </span>
                    </span>
                    <span className="flex flex-wrap items-center gap-2 text-xs font-bold">
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">{STAGE_STATUS_LABELS[s.status as StageStatus] ?? s.status}</span>
                      {s.summary.rate !== null ? <span className="rounded-full bg-violet-100 px-2.5 py-1 text-violet-900">Présence {Math.round(s.summary.rate * 100)} %</span> : null}
                      {s.summary.inOrder ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-900">
                          <CheckCircle2 size={13} aria-hidden /> En ordre
                        </span>
                      ) : null}
                    </span>
                  </summary>
                  <div className="space-y-3 border-t border-slate-100 p-5 text-sm">
                    <p className="text-slate-700">{summaryLine(s.summary)}</p>
                    {s.tutorName ? <p className="text-slate-600">Maître de stage : {s.tutorName}</p> : null}
                    {s.attendance.length ? (
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                          <thead className="text-xs uppercase text-slate-500">
                            <tr>
                              {["Jour", "Arrivée", "Départ", "Durée", "Entreprise", "Activités"].map((h) => (
                                <th key={h} scope="col" className="whitespace-nowrap px-2 py-2 font-semibold">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {s.attendance.map((r) => (
                              <tr key={r.day} className="border-t border-slate-100 align-top">
                                <td className="whitespace-nowrap px-2 py-2">{formatDayTitle(r.day)}</td>
                                <td className="px-2 py-2">{timeOf(r.arrivalAt)}</td>
                                <td className="px-2 py-2">{timeOf(r.departureAt)}</td>
                                <td className="whitespace-nowrap px-2 py-2">{duration(r)}</td>
                                <td className="px-2 py-2">{r.tutorConfirmedAt ? "Confirmée" : "—"}</td>
                                <td className="min-w-64 px-2 py-2 text-slate-700">{r.activities ?? "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="text-slate-500">Aucune présence signée pour l&apos;instant.</p>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-2xl bg-white p-6 text-sm text-slate-600">Aucun étudiant de cette faculté n&apos;est encore inscrit en stage académique.</p>
        )}
      </div>
    </main>
  );
}
