"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, ClipboardList, CheckCircle2 } from "lucide-react";
import { useSupervision } from "@/contexts/SupervisionContext";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";
import type { SupervisionCanevas, WorkType } from "@/lib/core/supervision/SupervisionTypes";

const DEFAULT_STEPS = [
  "Sujet",
  "Problématique",
  "Objectifs",
  "Hypothèses",
  "Revue de littérature",
  "Méthodologie",
  "Questionnaire",
  "Collecte",
  "Analyse",
  "Résultats",
  "Discussion",
  "Conclusion",
  "Bibliographie",
  "Version finale",
];

const WORK_TYPE_LABELS: Record<WorkType, string> = {
  memoire_licence: "Mémoire de Licence",
  memoire_master: "Mémoire de Master",
  travail_fin_cycle: "Travail de fin de cycle",
  dissertation: "Dissertation",
  autre: "Autre",
};

export default function SupervisorCanevasPage() {
  const { listCanevas, createCanevas, updateCanevas } = useSupervision();
  const [list, setList] = useState<SupervisionCanevas[] | null>(null);
  const [academicYear, setAcademicYear] = useState("2026-2027");
  const [faculty, setFaculty] = useState("Sciences Économiques et de Gestion");
  const [department, setDepartment] = useState("");
  const [workTypes, setWorkTypes] = useState<WorkType[]>(["memoire_master"]);
  const [steps, setSteps] = useState<string[]>(DEFAULT_STEPS);
  const [newStep, setNewStep] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setList(await listCanevas());
  }, [listCanevas]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function toggleWorkType(type: WorkType) {
    setWorkTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]));
  }

  function removeStep(index: number) {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }

  function addStep() {
    if (!newStep.trim()) return;
    setSteps((prev) => [...prev, newStep.trim()]);
    setNewStep("");
  }

  async function handleSave() {
    setSaving(true);
    await createCanevas({
      academicYear,
      faculty,
      department: department || undefined,
      workTypes,
      steps: steps.map((name, order) => ({ name, order, required: true })),
    });
    setSaving(false);
    await load();
  }

  async function handleActivate(id: string) {
    await updateCanevas(id, { isActive: true });
    await load();
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <p className="flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wider text-acadia-blue">
          <ClipboardList className="h-4 w-4" /> Canevas académique
        </p>
        <h1 className="mt-1 text-2xl font-bold text-acadia-navy">Votre cadre de supervision</h1>
        <p className="mt-2 text-sm text-slate-500">
          Ce canevas décrit les étapes que vous attendez de vos étudiants pour une année académique donnée. Il
          vient au-dessus du moteur scientifique d&apos;ACADIA — il ne le remplace jamais.
        </p>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm font-semibold text-slate-600">
            Année académique
            <input
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-600">
            Faculté
            <input
              value={faculty}
              onChange={(e) => setFaculty(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-semibold text-slate-600 sm:col-span-2">
            Département
            <input
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="Ex. Économie"
              className="mt-1.5 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            />
          </label>
        </div>

        <p className="mt-5 text-sm font-semibold text-slate-600">Types de travaux</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {(Object.keys(WORK_TYPE_LABELS) as WorkType[]).map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleWorkType(type)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                workTypes.includes(type) ? "bg-acadia-blue text-white" : "bg-slate-100 text-slate-500"
              }`}
            >
              {WORK_TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        <p className="mt-5 text-sm font-semibold text-slate-600">Étapes du canevas</p>
        <div className="mt-2 space-y-2">
          {steps.map((step, index) => (
            <div key={`${step}-${index}`} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2">
              <span className="w-6 shrink-0 text-xs font-bold text-slate-400">{index + 1}.</span>
              <span className="flex-1 text-sm text-slate-700">{step}</span>
              <button type="button" onClick={() => removeStep(index)} className="rounded-lg p-1 text-slate-400 hover:bg-red-50 hover:text-red-500">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-2">
          <input
            value={newStep}
            onChange={(e) => setNewStep(e.target.value)}
            placeholder="Ajouter une étape personnalisée"
            className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm"
          />
          <button type="button" onClick={addStep} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600">
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-6">
          <ResearchPrimaryButton onClick={handleSave} disabled={saving}>
            {saving ? "Enregistrement..." : "Enregistrer ce canevas"}
          </ResearchPrimaryButton>
        </div>
      </div>

      {list && list.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-bold text-acadia-navy">Vos canevas enregistrés</p>
          <div className="mt-3 space-y-2">
            {list.map((c) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-acadia-navy">{c.academicYear}</p>
                  <p className="text-xs text-slate-500">{c.steps.length} étape(s) · {c.faculty}</p>
                </div>
                {c.isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-2xs font-semibold text-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Actif
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleActivate(c.id)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Activer
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
