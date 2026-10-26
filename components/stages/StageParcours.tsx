"use client";

import { useMemo, useState, type ReactNode } from "react";
import { Building2, Check, Info, MapPin, Search } from "lucide-react";

import { FACULTIES, FACULTY_BY_ID, LEVELS } from "@/lib/core/stages/catalog";
import { INSTITUTION_BY_ID, INSTITUTIONS, institutionLabel, sourceNote, type Institution } from "@/lib/core/stages/institutions";

import type { WizardForm } from "./StageWizard";

const field = "block w-full rounded-2xl border border-slate-200 bg-white/90 px-4 py-3 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:text-sm";
const normalize = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Choice({ selected, onSelect, children, delay = 0, name }: { selected: boolean; onSelect: () => void; children: ReactNode; delay?: number; name: string }) {
  return (
    <label className={`sc-fade-up sc-lift flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 text-sm ${selected ? "border-violet-500 bg-violet-50 font-semibold text-violet-950 ring-2 ring-violet-200" : "border-slate-200 bg-white text-slate-700"}`} style={{ animationDelay: `${delay}ms` }}>
      <input type="radio" name={name} className="sr-only" checked={selected} onChange={onSelect} />
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${selected ? "border-violet-600 bg-violet-600" : "border-slate-300"}`} aria-hidden>
        {selected ? <Check size={12} className="text-white" /> : null}
      </span>
      <span className="min-w-0">{children}</span>
    </label>
  );
}

function FieldError({ text }: { text?: string }) {
  return text ? <p className="mt-1 text-xs font-medium text-rose-600">{text}</p> : null;
}

/** Étape « Parcours » : l'établissement d'abord, puis ce qu'il organise réellement (facultés, filières, options). */
export function ParcoursStep({ form, patch, errors }: { form: WizardForm; patch: (p: Partial<WizardForm>) => void; errors: Record<string, string> }) {
  const [query, setQuery] = useState("");
  const [other, setOther] = useState(!form.institutionId && !!form.university);
  const institution: Institution | undefined = INSTITUTION_BY_ID[form.institutionId];
  const matches = useMemo(() => {
    const q = normalize(query.trim());
    return INSTITUTIONS.filter((i) => !q || normalize(`${i.acronym} ${i.name ?? ""} ${i.city}`).includes(q));
  }, [query]);
  const units = institution?.units;
  const unit = units?.find((u) => u.name === form.facultyName);
  const generic = FACULTY_BY_ID[form.faculty];
  const note = institution ? sourceNote(institution) : null;
  const unitLabel = institution?.unitLabel ?? "Faculté";
  const programLabel = institution?.programLabel ?? "Filière ou département";

  const chooseInstitution = (i: Institution) => {
    setOther(false);
    patch({ institutionId: i.id, university: institutionLabel(i), faculty: "", facultyName: "", department: "" });
  };

  return (
    <>
      <h2 className="text-xl font-extrabold text-slate-900">Votre parcours</h2>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">Votre université ou institut</legend>
        {institution && !other ? (
          <div className="sc-pop flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-violet-600 to-indigo-600 p-4 text-white shadow-lg shadow-violet-500/25">
            <span className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 text-sm font-black">{institution.acronym.slice(0, 4)}</span>
              <span>
                <span className="block font-bold">{institution.name ?? institution.acronym}</span>
                <span className="flex items-center gap-1 text-xs text-violet-100">
                  <MapPin size={12} aria-hidden /> {institution.city}
                </span>
              </span>
            </span>
            <button type="button" onClick={() => patch({ institutionId: "", university: "", faculty: "", facultyName: "", department: "" })} className="rounded-xl bg-white/15 px-3 py-2 text-xs font-bold hover:bg-white/25">
              Changer
            </button>
          </div>
        ) : other ? (
          <div className="space-y-2">
            <input className={field} value={form.university} onChange={(e) => patch({ university: e.target.value, institutionId: "" })} placeholder="Nom complet de votre établissement" aria-label="Nom de votre établissement" />
            <button type="button" onClick={() => setOther(false)} className="text-xs font-semibold text-violet-700 hover:underline">
              Revenir à la liste des établissements
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <label className="relative block">
              <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
              <input className={`${field} pl-10`} value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher : ISC, UNILU, Kinshasa…" aria-label="Rechercher votre établissement" />
            </label>
            <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {matches.map((i, n) => (
                <button key={i.id} type="button" onClick={() => chooseInstitution(i)} className="sc-fade-up sc-lift flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left hover:border-violet-300" style={{ animationDelay: `${n * 25}ms` }}>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-xs font-black text-violet-700">{i.acronym.slice(0, 5)}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-bold text-slate-900">{i.name ?? i.acronym}</span>
                    <span className="block text-xs text-slate-500">
                      {i.city}
                      {i.coverage === "programmes" ? " · filières officielles" : i.coverage === "facultes" ? " · facultés officielles" : ""}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setOther(true)} className="inline-flex items-center gap-2 text-sm font-semibold text-violet-700 hover:underline">
              <Building2 size={16} aria-hidden /> Mon établissement n&apos;est pas dans la liste
            </button>
          </div>
        )}
        <FieldError text={errors.university} />
      </fieldset>

      {(institution || (other && form.university.trim().length >= 2)) && (
        <fieldset key={form.institutionId || "autre"} className="sc-slide-in">
          <legend className="mb-2 text-sm font-semibold text-slate-800">{units ? unitLabel : "Faculté"}</legend>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {units
              ? units.map((u, i) => (
                  <Choice key={u.name} name="unit" selected={form.facultyName === u.name} onSelect={() => patch({ facultyName: u.name, faculty: u.facultyId, department: "" })} delay={i * 30}>
                    {u.name}
                  </Choice>
                ))
              : FACULTIES.map((f, i) => (
                  <Choice key={f.id} name="faculty" selected={form.faculty === f.id && !form.facultyName} onSelect={() => patch({ faculty: f.id, facultyName: "", department: "" })} delay={i * 30}>
                    {f.label}
                  </Choice>
                ))}
          </div>
          <FieldError text={errors.faculty} />
          {note ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
              <Info size={13} className="mt-0.5 shrink-0" aria-hidden /> {note}
            </p>
          ) : institution?.coverage === "aucune" ? (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-slate-500">
              <Info size={13} className="mt-0.5 shrink-0" aria-hidden /> Les filières de cet établissement ne sont pas encore répertoriées : choisissez la faculté la plus proche et écrivez votre filière.
            </p>
          ) : null}
        </fieldset>
      )}

      {form.faculty ? (
        <div key={form.facultyName || form.faculty} className="sc-slide-in space-y-2">
          {unit?.programs ? (
            <fieldset>
              <legend className="mb-2 text-sm font-semibold text-slate-800">{programLabel}</legend>
              <div className="flex flex-wrap gap-2">
                {unit.programs.map((p, i) => (
                  <label key={p} className={`sc-fade-up flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold transition ${form.department === p ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/30" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`} style={{ animationDelay: `${i * 25}ms` }}>
                    <input type="radio" name="program" className="sr-only" checked={form.department === p} onChange={() => patch({ department: p })} />
                    {p}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <label className="block text-sm">
              <span className="mb-1.5 block font-semibold text-slate-800">{programLabel}</span>
              <input className={field} list="sc-departments" value={form.department} onChange={(e) => patch({ department: e.target.value })} placeholder={generic?.departments[0] ? `Ex. ${generic.departments[0]}` : "Votre filière"} />
              <datalist id="sc-departments">
                {(generic?.departments ?? []).map((d) => (
                  <option key={d} value={d} />
                ))}
              </datalist>
            </label>
          )}
          <FieldError text={errors.department} />
        </div>
      ) : null}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">Niveau ou promotion</legend>
        <div className="flex flex-wrap gap-2">
          {LEVELS.map((l) => (
            <label key={l} className={`flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-semibold transition ${form.level === l ? "bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-md shadow-violet-500/30" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
              <input type="radio" name="level" className="sr-only" checked={form.level === l} onChange={() => patch({ level: l })} />
              {l}
            </label>
          ))}
        </div>
        <FieldError text={errors.level} />
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1.5 flex items-center gap-2 font-semibold text-slate-800">
            Matricule <span className="text-xs font-normal text-slate-400">facultatif</span>
          </span>
          <input className={field} value={form.studentNumber} onChange={(e) => patch({ studentNumber: e.target.value })} placeholder="Votre numéro d'étudiant" />
          <span className="mt-1 block text-xs text-slate-500">Il permet à votre faculté de vous retrouver dans le registre des stages.</span>
        </label>
        {form.level === "Diplômé(e)" ? (
          <label className="block text-sm">
            <span className="mb-1.5 block font-semibold text-slate-800">Année de fin d&apos;études</span>
            <input className={field} type="number" inputMode="numeric" min={1980} max={2100} value={form.graduationYear} onChange={(e) => patch({ graduationYear: e.target.value })} placeholder="Ex. 2024" />
            <FieldError text={errors.graduationYear} />
          </label>
        ) : null}
      </div>
    </>
  );
}
