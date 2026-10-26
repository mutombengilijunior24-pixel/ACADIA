import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";

import { TutorRegister } from "@/components/stages/StageAccessViews";
import { STAGE_STATUS_LABELS, STAGE_TYPE_LABELS, type StageStatus } from "@/lib/core/stages/catalog";
import { formatDay } from "@/lib/core/stages/workflow";
import { tutorView } from "@/lib/server/stages/StageService";

// Lien personnel du maître de stage : jamais indexé, jamais transmis en « Referer » à un autre site.
export const metadata: Metadata = {
  title: "Présences du stagiaire — MNJ Stage Connect",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

function InvalidLink() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <div className="max-w-md rounded-3xl border border-slate-200 bg-white p-7 text-center">
        <ShieldAlert size={32} className="mx-auto text-amber-500" aria-hidden />
        <h1 className="mt-3 text-xl font-extrabold text-slate-900">Ce lien n&apos;est plus valide</h1>
        <p className="mt-2 text-sm text-slate-600">Il a expiré ou a été remplacé. Demandez un nouveau lien à l&apos;équipe MNJ Stage Connect.</p>
      </div>
    </main>
  );
}

export default async function TutorPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const data = await tutorView(token).catch(() => null);
  if (!data) return <InvalidLink />;
  const attendance = data.attendance.map((r) => ({ day: r.day, arrivalAt: r.arrivalAt.toISOString(), departureAt: r.departureAt?.toISOString() ?? null, activities: r.activities, tutorConfirmedAt: r.tutorConfirmedAt?.toISOString() ?? null }));
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-3xl space-y-5">
        <header className="rounded-3xl bg-gradient-to-br from-violet-700 via-indigo-700 to-sky-600 p-6 text-white sm:p-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-100">MNJ Stage Connect · Espace maître de stage</p>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">{data.student.name}</h1>
          <p className="mt-1 text-sm text-indigo-50">
            {STAGE_TYPE_LABELS[data.student.type]} · {data.student.university} · {data.student.faculty} · {data.student.department} · {data.student.level}
          </p>
          <p className="mt-3 text-sm text-indigo-50">
            Chez {data.company ?? "—"}
            {data.startDate && data.endDate ? `, du ${formatDay(data.startDate)} au ${formatDay(data.endDate)}` : ""} · {STAGE_STATUS_LABELS[data.status as StageStatus] ?? data.status}
          </p>
        </header>
        <p className="text-sm text-slate-600">
          Bonjour{data.tutorName ? ` ${data.tutorName}` : ""}. Le stagiaire signe chaque jour son arrivée et son départ dans ACADIA, et décrit sa journée. Confirmez les journées où il était effectivement présent : votre confirmation est horodatée et transmise à sa faculté avec le registre.
        </p>
        <TutorRegister token={token} attendance={attendance} today={data.today} />
      </div>
    </main>
  );
}
