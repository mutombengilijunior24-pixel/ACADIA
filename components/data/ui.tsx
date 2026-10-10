import type { ReactNode } from "react";

/** Éléments visuels partagés (Données, Analyse statistique, Parcours guidé). */

export type Tone = "neutral" | "blue" | "green" | "yellow" | "red";

const TONES: Record<Tone, string> = {
  neutral: "bg-slate-100 text-slate-700 ring-slate-200/70",
  blue: "bg-indigo-50 text-indigo-700 ring-indigo-100",
  green: "bg-emerald-50 text-emerald-700 ring-emerald-100",
  yellow: "bg-amber-50 text-amber-800 ring-amber-200/70",
  red: "bg-rose-50 text-rose-700 ring-rose-100",
};

export function Pill({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`inline-flex max-w-full shrink-0 items-center rounded-full px-2.5 py-0.5 text-left text-xs font-semibold ring-1 ring-inset ${TONES[tone]}`}>{children}</span>;
}

export function Section({ title, description, children, action }: { title: string; description?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200/80 bg-white/95 p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_12px_32px_-16px_rgba(15,23,42,0.14)] backdrop-blur sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold tracking-tight text-slate-900 sm:text-xl">{title}</h2>
          {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-500">{description}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function Metric({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: "warn" }) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200/70 bg-gradient-to-br from-white to-slate-50 p-3">
      <span className={`absolute inset-y-0 left-0 w-1 ${tone === "warn" ? "bg-amber-400" : "bg-indigo-400/70"}`} aria-hidden />
      <p className="break-words pl-1 text-xs font-medium uppercase leading-snug tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 pl-1 font-[family-name:var(--font-display)] text-xl font-bold tabular-nums ${tone === "warn" ? "text-amber-700" : "text-slate-900"}`}>{value}</p>
      {hint ? <p className="mt-0.5 pl-1 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export type NoticeTone = "info" | "success" | "warning" | "error" | "stale";

const NOTICE: Record<NoticeTone, { box: string; label: string }> = {
  info: { box: "border-indigo-200 bg-indigo-50 text-indigo-950", label: "Information" },
  success: { box: "border-emerald-200 bg-emerald-50 text-emerald-950", label: "C'est fait" },
  warning: { box: "border-amber-300 bg-amber-50 text-amber-950", label: "À vérifier" },
  error: { box: "border-rose-300 bg-rose-50 text-rose-950", label: "Action impossible" },
  stale: { box: "border-amber-300 bg-amber-50 text-amber-950", label: "Résultats périmés" },
};

/** Message d'état homogène (information, succès, avertissement, erreur, résultats périmés). */
export function Notice({ tone = "info", title, children, action, id }: { tone?: NoticeTone; title?: string; children: ReactNode; action?: ReactNode; id?: string }) {
  return (
    <div id={id} className={`flex flex-wrap items-start justify-between gap-3 rounded-xl border p-3 text-sm ${NOTICE[tone].box}`} role={tone === "error" ? "alert" : "status"}>
      <div className="min-w-0 flex-1 break-words">
        <p className="font-semibold">{title ?? NOTICE[tone].label}</p>
        <div className="mt-0.5 leading-relaxed">{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export const buttonClass = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-blue-600 px-4 text-sm font-semibold text-white shadow-sm shadow-indigo-600/20 transition hover:from-indigo-700 hover:to-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:from-slate-300 disabled:to-slate-300 disabled:shadow-none",
  secondary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-50",
  ghost: "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40",
};

export const inputClass =
  "block min-h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-base text-slate-900 shadow-sm transition placeholder:text-slate-400 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-100 sm:text-sm";

export function IssueList({ issues }: { issues: Array<{ code: string; severity: "error" | "warning" | "info"; message: string }> }) {
  if (issues.length === 0) return null;
  const tone = { error: "border-rose-200 bg-rose-50 text-rose-800", warning: "border-amber-200 bg-amber-50 text-amber-900", info: "border-slate-200 bg-slate-50 text-slate-700" };
  const label = { error: "Erreur", warning: "Attention", info: "Information" };
  return (
    <ul className="space-y-2">
      {issues.map((issue, index) => (
        <li key={`${issue.code}-${index}`} className={`rounded-xl border p-3 text-sm ${tone[issue.severity]}`} role={issue.severity === "error" ? "alert" : undefined}>
          <span className="font-semibold">{label[issue.severity]} : </span>
          {issue.message}
        </li>
      ))}
    </ul>
  );
}
