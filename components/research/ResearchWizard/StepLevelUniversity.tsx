"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, GraduationCap } from "lucide-react";

import { useResearch } from "@/contexts/ResearchContext";
import { INSTITUTIONS, institutionLabel } from "@/lib/core/stages/institutions";
import { STUDY_LEVELS } from "@/lib/core/research/workflow";
import ResearchOptionCard from "./brand/ResearchOptionCard";
import ResearchStepHeader from "./brand/ResearchStepHeader";

const OTHER = "__autre__";
const LABELS = INSTITUTIONS.map((i) => institutionLabel(i));

/** Libellé de la liste correspondant à un acronyme ou à un nom saisi (sinon null). */
function knownLabel(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (!v) return null;
  const i = INSTITUTIONS.find((x) => x.acronym.toLowerCase() === v || x.name?.toLowerCase() === v || institutionLabel(x).toLowerCase() === v);
  return i ? institutionLabel(i) : null;
}

export default function StepLevelUniversity() {
  const { currentResearch, updateCurrentResearch } = useResearch();
  const university = currentResearch.university ?? "";
  const [other, setOther] = useState(() => Boolean(university) && !LABELS.includes(university));
  const prefilled = useRef(false);

  // Pré-remplissage depuis l'inscription (niveau, institution) : jamais par-dessus une saisie.
  useEffect(() => {
    if (prefilled.current) return;
    prefilled.current = true;
    if (currentResearch.level && currentResearch.university) return;
    let cancelled = false;
    fetch("/api/auth/student-profile", { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { profile: { studyLevel: string | null; institution: string | null } | null } | null) => {
        if (cancelled || !body?.profile) return;
        const level = body.profile.studyLevel ?? "";
        if (!currentResearch.level && (STUDY_LEVELS as readonly string[]).includes(level)) updateCurrentResearch("level", level);
        const inst = (body.profile.institution ?? "").trim();
        if (!currentResearch.university && inst) {
          const label = knownLabel(inst);
          updateCurrentResearch("university", label ?? inst);
          if (!label) setOther(true);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
    // Une seule lecture à l'ouverture de l'étape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectValue = other ? OTHER : LABELS.includes(university) ? university : "";
  const inputClass =
    "w-full rounded-2xl border border-slate-300 px-4 py-3.5 text-base text-slate-900 placeholder:text-slate-400 focus:border-acadia-blue focus:outline-none focus:ring-3 focus:ring-acadia-blue/15 transition shadow-2xs";

  return (
    <div className="space-y-6">
      <ResearchStepHeader step={2} category="Cadrage" title="Votre niveau et votre université" description="Ils permettent de vous proposer d'abord les directeurs de votre université." />

      <div>
        <p className="mb-3 text-sm font-semibold text-acadia-navy">Niveau d&apos;études</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {STUDY_LEVELS.map((level) => (
            <ResearchOptionCard key={level} icon={GraduationCap} title={level} selected={currentResearch.level === level} onClick={() => updateCurrentResearch("level", level)} />
          ))}
        </div>
      </div>

      <label className="block">
        <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-acadia-navy">
          <Building2 className="h-4 w-4 text-slate-400" /> Université ou institut
        </span>
        <select
          value={selectValue}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setOther(true);
              updateCurrentResearch("university", "");
            } else {
              setOther(false);
              updateCurrentResearch("university", e.target.value);
            }
          }}
          className={inputClass}
        >
          <option value="">Choisissez votre université</option>
          {LABELS.map((label) => (
            <option key={label} value={label}>
              {label}
            </option>
          ))}
          <option value={OTHER}>Autre établissement</option>
        </select>
      </label>

      {other && (
        <label className="block">
          <span className="mb-2 block text-sm font-semibold text-acadia-navy">Nom de votre établissement</span>
          <input value={university} maxLength={160} onChange={(e) => updateCurrentResearch("university", e.target.value)} placeholder="Nom complet de l'établissement" className={inputClass} />
        </label>
      )}
    </div>
  );
}
