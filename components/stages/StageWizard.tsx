"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, GraduationCap, Loader2, Plus, Sparkles, Target, UserRound, X } from "lucide-react";

import { FACULTY_BY_ID, STAGE_TYPE_LABELS, stageApplicationSchema, type StageApplicationInput, type StageType } from "@/lib/core/stages/catalog";

import { ParcoursStep } from "./StageParcours";


export interface WizardForm {
  lastName: string;
  postName: string;
  firstName: string;
  phone: string;
  email: string;
  university: string;
  institutionId: string;
  faculty: string;
  facultyName: string;
  department: string;
  level: string;
  studentNumber: string;
  graduationYear: string;
  skills: string[];
  objectives: string;
  preferredCompany: string;
  preferredCity: string;
  startMonth: string;
  consent: boolean;
}

const STEPS: Array<{ title: string; icon: typeof UserRound; fields: Array<keyof WizardForm> }> = [
  { title: "Identité", icon: UserRound, fields: ["lastName", "postName", "firstName", "phone", "email"] },
  { title: "Parcours", icon: GraduationCap, fields: ["university", "institutionId", "faculty", "facultyName", "department", "level", "studentNumber", "graduationYear"] },
  { title: "Projet de stage", icon: Target, fields: ["skills", "objectives", "preferredCompany", "preferredCity", "startMonth"] },
  { title: "Validation", icon: Check, fields: ["consent"] },
];

const toInput = (type: StageType, f: WizardForm) => ({ ...f, type, graduationYear: f.graduationYear ? Number(f.graduationYear) : null });

const field = "block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:text-sm";

function Field({ label, error, hint, optional, children }: { label: string; error?: string; hint?: string; optional?: boolean; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1.5 flex items-center gap-2 font-semibold text-slate-800">
        {label}
        {optional ? <span className="text-xs font-normal text-slate-400">facultatif</span> : null}
      </span>
      {children}
      {error ? <span className="mt-1 block text-xs font-medium text-rose-600">{error}</span> : hint ? <span className="mt-1 block text-xs text-slate-500">{hint}</span> : null}
    </label>
  );
}

/** Inscription MNJ Stage Connect en quatre étapes, validées une à une. */
export function StageWizard({ type, initial, onCancel, onSubmitted }: { type: StageType; initial: Partial<WizardForm>; onCancel: () => void; onSubmitted: (application: { id: string }) => void }) {
  const [form, setForm] = useState<WizardForm>({ lastName: "", postName: "", firstName: "", phone: "", email: "", university: "", institutionId: "", faculty: "", facultyName: "", department: "", level: "", studentNumber: "", graduationYear: "", skills: [], objectives: "", preferredCompany: "", preferredCity: "", startMonth: "", consent: false, ...initial });
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [customSkill, setCustomSkill] = useState("");
  const [sending, setSending] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const set = <K extends keyof WizardForm>(key: K, value: WizardForm[K]) => setForm((f) => ({ ...f, [key]: value }));
  const faculty = FACULTY_BY_ID[form.faculty];
  const suggestions = useMemo(() => [...new Set([...(faculty?.skills ?? []), ...form.skills])], [faculty, form.skills]);

  const validate = (fields: Array<keyof WizardForm>): boolean => {
    const parsed = stageApplicationSchema.safeParse({ ...toInput(type, form), consent: fields.includes("consent") ? form.consent : true });
    const found: Record<string, string> = {};
    if (!parsed.success) for (const issue of parsed.error.issues) {
      const key = String(issue.path[0]);
      if (fields.includes(key as keyof WizardForm) && !found[key]) found[key] = issue.message;
    }
    setErrors(found);
    return !Object.keys(found).length;
  };
  const go = (next: number) => {
    if (next > step && !validate(STEPS[step].fields)) return;
    setDirection(next > step ? 1 : -1);
    setStep(next);
    setServerError(null);
  };
  const submit = async () => {
    if (!validate(STEPS.flatMap((s) => s.fields))) return;
    setSending(true);
    setServerError(null);
    try {
      const res = await fetch("/api/stages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(toInput(type, form)) });
      const data = (await res.json().catch(() => ({}))) as { application?: { id: string }; error?: string };
      if (!res.ok || !data.application) {
        setServerError(data.error ?? "Votre dossier n'a pas pu être envoyé.");
        return;
      }
      onSubmitted(data.application);
    } catch {
      setServerError("Connexion impossible : vérifiez votre réseau et réessayez.");
    } finally {
      setSending(false);
    }
  };
  const toggleSkill = (skill: string) => set("skills", form.skills.includes(skill) ? form.skills.filter((s) => s !== skill) : [...form.skills, skill].slice(0, 12));
  const addCustom = () => {
    const s = customSkill.trim();
    if (s.length >= 2 && !form.skills.includes(s)) set("skills", [...form.skills, s].slice(0, 12));
    setCustomSkill("");
  };

  return (
    <div className="sc-fade-up overflow-hidden rounded-3xl border border-violet-100 bg-white shadow-[0_30px_80px_-40px_rgba(76,29,149,0.45)]">
      <div className="bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-500 px-5 py-5 text-white sm:px-8">
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-violet-100">MNJ Stage Connect · {STAGE_TYPE_LABELS[type]}</p>
          <button type="button" onClick={onCancel} className="rounded-full p-1.5 text-white/80 transition hover:bg-white/15 hover:text-white" aria-label="Fermer le formulaire">
            <X size={18} aria-hidden />
          </button>
        </div>
        <ol className="mt-4 grid grid-cols-4 gap-2" aria-label="Étapes de l'inscription">
          {STEPS.map((s, i) => {
            const Icon = s.icon;
            const state = i < step ? "done" : i === step ? "current" : "todo";
            return (
              <li key={s.title} className="min-w-0">
                <div className={`h-1.5 overflow-hidden rounded-full bg-white/25`}>
                  <div className="h-full rounded-full bg-white transition-all duration-500 ease-out" style={{ width: state === "todo" ? "0%" : state === "current" ? "50%" : "100%" }} />
                </div>
                <p className={`mt-2 flex items-center gap-1.5 truncate text-xs font-semibold ${state === "todo" ? "text-white/60" : "text-white"}`} aria-current={state === "current" ? "step" : undefined}>
                  <Icon size={14} aria-hidden className="shrink-0" /> <span className="truncate">{s.title}</span>
                </p>
              </li>
            );
          })}
        </ol>
      </div>

      <div key={step} className={`space-y-5 px-5 py-6 sm:px-8 ${direction > 0 ? "sc-slide-in" : "sc-slide-back"}`}>
        {step === 0 ? (
          <>
            <h2 className="text-xl font-extrabold text-slate-900">Faisons connaissance</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Nom" error={errors.lastName}>
                <input className={field} value={form.lastName} onChange={(e) => set("lastName", e.target.value)} autoComplete="family-name" placeholder="Ex. Mutombo" />
              </Field>
              <Field label="Post-nom" error={errors.postName} optional>
                <input className={field} value={form.postName} onChange={(e) => set("postName", e.target.value)} placeholder="Ex. Ngili" />
              </Field>
              <Field label="Prénom" error={errors.firstName}>
                <input className={field} value={form.firstName} onChange={(e) => set("firstName", e.target.value)} autoComplete="given-name" placeholder="Ex. Junior" />
              </Field>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Téléphone (WhatsApp de préférence)" error={errors.phone} hint="Nous vous contactons sur ce numéro pour votre orientation.">
                <input className={field} value={form.phone} onChange={(e) => set("phone", e.target.value)} inputMode="tel" autoComplete="tel" placeholder="+243 81 234 5678" />
              </Field>
              <Field label="Adresse e-mail" error={errors.email}>
                <input className={field} value={form.email} onChange={(e) => set("email", e.target.value)} inputMode="email" autoComplete="email" placeholder="vous@universite.cd" />
              </Field>
            </div>
          </>
        ) : null}

        {step === 1 ? <ParcoursStep form={form} patch={(p) => setForm((f) => ({ ...f, ...p }))} errors={errors} /> : null}

        {step === 2 ? (
          <>
            <h2 className="text-xl font-extrabold text-slate-900">Ce que vous voulez apprendre</h2>
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-800">Compétences à acquérir pendant le stage</legend>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s, i) => {
                  const on = form.skills.includes(s);
                  return (
                    <button key={s} type="button" onClick={() => toggleSkill(s)} aria-pressed={on} className={`sc-fade-up inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition ${on ? "bg-violet-600 text-white shadow-md shadow-violet-500/30" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:ring-violet-300"}`} style={{ animationDelay: `${i * 25}ms` }}>
                      {on ? <Check size={14} aria-hidden /> : <Plus size={14} aria-hidden />} {s}
                    </button>
                  );
                })}
              </div>
              <div className="mt-2 flex gap-2">
                <input className={`${field} max-w-sm`} value={customSkill} onChange={(e) => setCustomSkill(e.target.value)} onKeyDown={(e) => (e.key === "Enter" ? (e.preventDefault(), addCustom()) : undefined)} placeholder="Autre compétence…" aria-label="Ajouter une autre compétence" />
                <button type="button" onClick={addCustom} className="rounded-2xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-700">
                  Ajouter
                </button>
              </div>
              {errors.skills ? <p className="mt-1 text-xs font-medium text-rose-600">{errors.skills}</p> : null}
            </fieldset>
            <Field label="Vos objectifs de stage" error={errors.objectives} hint={`${form.objectives.trim().length} caractère(s) — dites ce que vous voulez apprendre et pourquoi.`}>
              <textarea className={`${field} min-h-28`} value={form.objectives} onChange={(e) => set("objectives", e.target.value)} placeholder="Ex. Je souhaite faire mon stage pour apprendre la tenue de la comptabilité et l'analyse financière dans une entreprise commerciale, afin de préparer mon mémoire." />
            </Field>
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Entreprise souhaitée" optional>
                <input className={field} value={form.preferredCompany} onChange={(e) => set("preferredCompany", e.target.value)} placeholder="Si vous en visez une" />
              </Field>
              <Field label="Ville souhaitée" optional>
                <input className={field} value={form.preferredCity} onChange={(e) => set("preferredCity", e.target.value)} placeholder="Ex. Lubumbashi" />
              </Field>
              <Field label="Début souhaité" optional error={errors.startMonth}>
                <input className={field} type="month" value={form.startMonth} onChange={(e) => set("startMonth", e.target.value)} />
              </Field>
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h2 className="flex items-center gap-2 text-xl font-extrabold text-slate-900">
              <Sparkles size={20} className="text-violet-600" aria-hidden /> Tout est prêt
            </h2>
            <dl className="grid gap-3 rounded-2xl bg-gradient-to-br from-violet-50 to-sky-50 p-4 text-sm sm:grid-cols-2">
              {[
                ["Stage", STAGE_TYPE_LABELS[type]],
                ["Nom complet", [form.lastName, form.postName, form.firstName].filter(Boolean).join(" ")],
                ["Contact", `${form.phone} · ${form.email}`],
                ["Université", form.university],
                ["Faculté et filière", `${form.facultyName || faculty?.label || ""} — ${form.department}`],
                ["Matricule", form.studentNumber || "—"],
                ["Niveau", `${form.level}${form.graduationYear ? ` (fin en ${form.graduationYear})` : ""}`],
                ["Compétences visées", form.skills.join(", ")],
                ["Entreprise souhaitée", form.preferredCompany || "À proposer par MNJ"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-violet-700">{k}</dt>
                  <dd className="mt-0.5 break-words text-slate-900">{v}</dd>
                </div>
              ))}
            </dl>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 p-3 text-sm text-slate-700">
              <input type="checkbox" className="mt-0.5 h-4 w-4 accent-violet-600" checked={form.consent} onChange={(e) => set("consent", e.target.checked)} />
              <span>J&apos;accepte que MNJ Stage Connect utilise ces informations pour étudier mon dossier, m&apos;orienter et me présenter aux entreprises partenaires. Elles ne sont jamais vendues ni publiées.</span>
            </label>
            {errors.consent ? <p className="text-xs font-medium text-rose-600">{errors.consent}</p> : null}
          </>
        ) : null}

        {serverError ? (
          <p className="rounded-2xl bg-rose-50 p-3 text-sm text-rose-800" role="alert">
            {serverError}
          </p>
        ) : null}

        <div className="flex items-center justify-between gap-3 pt-2">
          <button type="button" onClick={() => (step === 0 ? onCancel() : go(step - 1))} className="inline-flex min-h-12 items-center gap-2 rounded-2xl px-4 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
            <ArrowLeft size={16} aria-hidden /> {step === 0 ? "Retour" : "Précédent"}
          </button>
          {step < STEPS.length - 1 ? (
            <button type="button" onClick={() => go(step + 1)} className="group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 px-6 text-sm font-bold text-white shadow-lg shadow-violet-500/30 transition hover:shadow-violet-500/50">
              Continuer <ArrowRight size={16} aria-hidden className="transition group-hover:translate-x-1" />
            </button>
          ) : (
            <button type="button" onClick={() => void submit()} disabled={sending} className="sc-glow group inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 px-6 text-sm font-bold text-white transition disabled:opacity-70">
              {sending ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Check size={16} aria-hidden />} Envoyer mon dossier
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export type { StageApplicationInput };
