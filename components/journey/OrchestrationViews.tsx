"use client";

import { useState } from "react";
import { BarChart3, Briefcase, Layers } from "lucide-react";

import { buttonClass, inputClass, Notice, Pill, Section } from "@/components/data/ui";
import {
  CONFIDENCE_LABELS,
  DOMAINS,
  NATURE_LABELS,
  OBJECTIVE_KIND_LABELS,
  ORIGIN_LABELS,
  ROUTE_STATUS_LABELS,
  SOURCE_LABELS,
  specialtiesFor,
  specialtyOf,
  STRUCTURE_LABELS,
  UNIT_LABELS,
  type AnalysisUnit,
  type Characteristic,
  type ClassificationOverrides,
  type ClassificationSheet,
  type DomainId,
  type ObservationStructure,
  type RouteStatus,
  type Routing,
  type SourceType,
  type SpecialtyId,
} from "@/lib/core/orchestrator";

/* ================================================================= */
/* 1. Domaine et spécialité                                            */
/* ================================================================= */

const DOMAIN_ICON: Record<DomainId, typeof Briefcase> = { management: Briefcase, economics: BarChart3, interdisciplinary: Layers };

export function DomainStep({
  domain,
  specialty,
  secondary,
  onChange,
  onConfirm,
  confirmed,
}: {
  domain: DomainId | null;
  specialty: SpecialtyId | null;
  secondary: SpecialtyId[];
  onChange: (next: { domain: DomainId | null; specialty: SpecialtyId | null; secondary: SpecialtyId[] }) => void;
  onConfirm: () => void;
  confirmed: boolean;
}) {
  const [attempted, setAttempted] = useState(false);
  const specialties = domain ? specialtiesFor(domain) : [];
  const others = [...specialtiesFor("management"), ...specialtiesFor("economics")].filter((s) => s.id !== specialty);
  return (
    <Section title="1. Mon domaine et ma spécialité" description="La perspective scientifique de votre étude. Elle oriente l'interprétation des résultats ; les méthodes dépendent de vos objectifs et de vos données. Vous pourrez la modifier à tout moment sans perdre vos données.">
      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-800">Domaine d&apos;étude</legend>
        <div className="grid gap-2 md:grid-cols-3">
          {DOMAINS.map((d) => {
            const Icon = DOMAIN_ICON[d.id];
            const active = domain === d.id;
            return (
              <label key={d.id} className={`flex cursor-pointer gap-3 rounded-2xl p-4 text-sm ring-1 transition ${active ? "bg-indigo-50 ring-2 ring-indigo-400" : "bg-white ring-slate-200 hover:ring-slate-300"}`}>
                <input type="radio" name="domain" className="sr-only" checked={active} onChange={() => onChange({ domain: d.id, specialty: d.id === "interdisciplinary" ? "interdisciplinary_other" : null, secondary })} />
                <Icon size={22} className={active ? "text-indigo-600" : "text-slate-400"} aria-hidden />
                <span>
                  <span className="block font-semibold text-slate-900">{d.label}</span>
                  <span className="block text-slate-600">{d.description}</span>
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>
      {domain && domain !== "interdisciplinary" ? (
        <fieldset className="mt-5">
          <legend className="mb-2 text-sm font-semibold text-slate-800">Spécialité</legend>
          <div className="flex flex-wrap gap-2">
            {specialties.map((s) => (
              <label key={s.id} className={`flex min-h-11 cursor-pointer items-center rounded-full px-4 text-sm font-medium ring-1 transition ${specialty === s.id ? "bg-indigo-600 text-white ring-indigo-600" : "bg-white text-slate-700 ring-slate-200 hover:ring-slate-300"}`}>
                <input type="radio" name="specialty" className="sr-only" checked={specialty === s.id} onChange={() => onChange({ domain, specialty: s.id, secondary: secondary.filter((x) => x !== s.id) })} />
                {s.label}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      {specialty ? (
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">Ajouter une spécialité secondaire (facultatif)</summary>
          <div className="mt-2 flex flex-wrap gap-3">
            {others.map((s) => (
              <label key={s.id} className="flex min-h-9 items-center gap-2">
                <input type="checkbox" className="h-4 w-4" checked={secondary.includes(s.id)} onChange={(e) => onChange({ domain, specialty, secondary: e.target.checked ? [...secondary, s.id] : secondary.filter((x) => x !== s.id) })} />
                {s.label}
              </label>
            ))}
          </div>
        </details>
      ) : null}
      {specialty ? <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">{specialtyOf(specialty)?.perspective}</p> : null}
      <div className="mt-5 space-y-3">
        {attempted && !specialty ? (
          <Notice tone="error" title="Choix incomplet">
            {domain ? "Choisissez votre spécialité." : "Choisissez votre domaine d'étude."}
          </Notice>
        ) : null}
        <button
          type="button"
          className={buttonClass.primary}
          onClick={() => {
            if (!specialty) {
              setAttempted(true);
              return;
            }
            onConfirm();
          }}
        >
          {confirmed ? "Continuer : mon sujet de recherche" : "Confirmer et continuer"}
        </button>
      </div>
    </Section>
  );
}

/* ================================================================= */
/* Fiche de classification                                             */
/* ================================================================= */

const ORIGIN_TONE: Record<Characteristic<unknown>["origin"], "green" | "blue" | "yellow" | "neutral"> = { user: "green", file: "blue", inferred: "yellow", proposed: "neutral" };

function Trait<T>({ label, value, text }: { label: string; value: Characteristic<T>; text: string }) {
  return (
    <li className="rounded-xl p-3 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-0.5 font-semibold text-slate-900">{text}</p>
      <p className="mt-1 flex flex-wrap gap-1.5">
        <Pill tone={ORIGIN_TONE[value.origin]}>{ORIGIN_LABELS[value.origin]}</Pill>
        {value.origin !== "user" ? <Pill tone="neutral">{CONFIDENCE_LABELS[value.confidence]}</Pill> : null}
      </p>
      <p className="mt-1 break-words text-xs text-slate-600">{value.justification}</p>
    </li>
  );
}

export function ClassificationPanel({ sheet, overrides, onOverrides }: { sheet: ClassificationSheet; overrides: ClassificationOverrides; onOverrides: (next: ClassificationOverrides) => void }) {
  const [editing, setEditing] = useState(false);
  const allConfirmed = sheet.source.confirmed && sheet.structure.confirmed && sheet.unit.confirmed;
  const confirmAll = () => onOverrides({ ...overrides, source: sheet.source.value, structure: sheet.structure.value, unit: sheet.unit.value });
  return (
    <Section
      title="Ce qu'ACADIA a reconnu dans vos données"
      description="Détecté automatiquement à partir du fichier et de votre recherche : confirmez, ou corrigez si c'est inexact. Ces caractéristiques déterminent les moteurs d'analyse."
      action={allConfirmed ? <Pill tone="green">Confirmé par vous</Pill> : <Pill tone="yellow">À confirmer</Pill>}
    >
      <ul className="grid gap-2 md:grid-cols-3">
        <Trait label="Type de données" value={sheet.source} text={SOURCE_LABELS[sheet.source.value]} />
        <Trait label="Unité d'analyse" value={sheet.unit} text={UNIT_LABELS[sheet.unit.value]} />
        <Trait label="Structure des observations" value={sheet.structure} text={STRUCTURE_LABELS[sheet.structure.value]} />
      </ul>
      {sheet.uncertainties.filter((u) => u.id === "source" || u.id === "structure" || u.id === "unit").map((u) => (
        <div key={u.id} className="mt-3">
          <Notice tone="warning" title={u.question}>
            <p>{u.impact}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {u.options.map((o) => (
                <button key={o.value} type="button" className={buttonClass.secondary} onClick={() => onOverrides({ ...overrides, [u.id]: o.value })}>
                  {o.label}
                </button>
              ))}
            </div>
          </Notice>
        </div>
      ))}
      <div className="mt-4 flex flex-wrap gap-2">
        {!allConfirmed ? (
          <button type="button" className={buttonClass.primary} onClick={confirmAll}>
            C&apos;est exact
          </button>
        ) : null}
        <button type="button" className={buttonClass.secondary} onClick={() => setEditing((e) => !e)}>
          {editing ? "Fermer la correction" : "Corriger"}
        </button>
      </div>
      {editing ? (
        <div className="mt-3 grid gap-3 rounded-xl bg-slate-50 p-3 md:grid-cols-3">
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Type de données</span>
            <select className={inputClass} value={sheet.source.value} onChange={(e) => onOverrides({ ...overrides, source: e.target.value as SourceType })} aria-label="Type de données">
              {(Object.keys(SOURCE_LABELS) as SourceType[]).map((k) => (
                <option key={k} value={k}>
                  {SOURCE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Unité d&apos;analyse</span>
            <select className={inputClass} value={sheet.unit.value} onChange={(e) => onOverrides({ ...overrides, unit: e.target.value as AnalysisUnit })} aria-label="Unité d'analyse">
              {(Object.keys(UNIT_LABELS) as AnalysisUnit[]).map((k) => (
                <option key={k} value={k}>
                  {UNIT_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Structure des observations</span>
            <select className={inputClass} value={sheet.structure.value} onChange={(e) => onOverrides({ ...overrides, structure: e.target.value as ObservationStructure })} aria-label="Structure des observations">
              {(Object.keys(STRUCTURE_LABELS) as ObservationStructure[]).map((k) => (
                <option key={k} value={k}>
                  {STRUCTURE_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}
      <details className="mt-4 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">Voir la fiche complète (objectifs, nature des variables, provenance, préparation)</summary>
        <div className="mt-3 space-y-3">
          <div>
            <p className="font-semibold text-slate-800">Objectifs de recherche repérés</p>
            {sheet.objectives.length ? (
              <ul className="mt-1 space-y-1">
                {sheet.objectives.map((o) => (
                  <li key={o.value} className="flex flex-wrap items-start gap-2">
                    <Pill tone={ORIGIN_TONE[o.origin]}>{OBJECTIVE_KIND_LABELS[o.value]}</Pill>
                    <span className="min-w-0 flex-1 text-slate-600">{o.justification}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-slate-500">Aucun objectif repéré.</p>
            )}
          </div>
          <div>
            <p className="font-semibold text-slate-800">Nature des variables</p>
            <ul className="mt-1 max-h-72 space-y-1 overflow-y-auto">
              {sheet.variables.map((v) => (
                <li key={v.id} className="flex flex-wrap items-start gap-2 rounded-lg bg-slate-50 p-2">
                  <Pill tone={ORIGIN_TONE[v.nature.origin]}>{NATURE_LABELS[v.nature.value]}</Pill>
                  <span className="min-w-0 flex-1 break-words text-slate-700">
                    {v.header}
                    {v.tags.length ? <span className="text-xs text-slate-500"> — aussi : {v.tags.map((t) => NATURE_LABELS[t].toLowerCase()).join(", ")}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <p>
            <span className="font-semibold text-slate-800">Provenance : </span>
            {sheet.provenance.note}
          </p>
          <p>
            <span className="font-semibold text-slate-800">Préparation : </span>
            {sheet.preparation.detail}
          </p>
        </div>
      </details>
    </Section>
  );
}

/* ================================================================= */
/* Plan des moteurs (orchestrateur)                                    */
/* ================================================================= */

const ROUTE_TONE: Record<RouteStatus, "green" | "yellow" | "red" | "neutral" | "blue"> = { ready: "green", to_confirm: "yellow", unavailable: "neutral", not_needed: "blue", excluded: "red" };

export function OrchestrationPanel({ routing }: { routing: Routing }) {
  const main = routing.steps.filter((s) => s.engineId === "descriptive-statistics" || s.engineId === "inferential-statistics");
  const planned = routing.steps.filter((s) => s.status === "unavailable");
  return (
    <Section title="Ce qu'ACADIA propose pour votre étude" description="Choisi d'après vos objectifs, la nature de vos données et les moteurs réellement disponibles. Rien n'est calculé avant votre validation.">
      {routing.needs.length ? (
        <p className="mb-3 text-sm text-slate-700">
          <span className="font-semibold">Besoins de l&apos;étude : </span>
          {routing.needs.join(" · ")}
        </p>
      ) : null}
      <ul className="space-y-2">
        {main.map((s) => (
          <li key={s.engineId} className="rounded-xl p-3 text-sm ring-1 ring-slate-200">
            <p className="flex flex-wrap items-center gap-2">
              <Pill tone={ROUTE_TONE[s.status]}>{ROUTE_STATUS_LABELS[s.status]}</Pill>
              <span className="font-semibold text-slate-900">{s.engine}</span>
            </p>
            <p className="mt-1 text-slate-700">{s.reason}</p>
            {s.conditions.length ? (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-slate-600">
                {s.conditions.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            ) : null}
            {s.alternatives.length ? <p className="mt-1 text-slate-600">À la place : {s.alternatives.join(" ; ")}</p> : null}
          </li>
        ))}
      </ul>
      {planned.length ? (
        <div className="mt-3">
          <Notice tone="info" title="Capacités nécessaires, pas encore disponibles dans ACADIA">
            <ul className="space-y-1">
              {planned.map((s) => (
                <li key={s.engineId}>
                  <span className="font-semibold">{s.engine} : </span>
                  {s.reason} {s.alternatives.length ? `Disponible à la place : ${s.alternatives.join(" ; ")}` : ""}
                </li>
              ))}
            </ul>
          </Notice>
        </div>
      ) : null}
      {routing.perspective ? (
        <p className="mt-3 rounded-xl bg-indigo-50/70 p-3 text-sm text-indigo-950">
          <span className="font-semibold">Perspective d&apos;interprétation : </span>
          {routing.perspective}
        </p>
      ) : null}
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer font-medium text-slate-700">Détail de tous les moteurs mobilisés</summary>
        <ul className="mt-2 space-y-1">
          {routing.steps.map((s) => (
            <li key={s.engineId} className="flex flex-wrap items-start gap-2">
              <Pill tone={ROUTE_TONE[s.status]}>{ROUTE_STATUS_LABELS[s.status]}</Pill>
              <span className="min-w-0 flex-1 text-slate-700">
                <span className="font-medium">{s.engine}</span> — {s.reason}
              </span>
            </li>
          ))}
        </ul>
      </details>
    </Section>
  );
}
