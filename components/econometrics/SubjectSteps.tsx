"use client";

import { Plus, Sparkles } from "lucide-react";

import { buttonClass, inputClass, Notice, Pill, Section } from "@/components/data/ui";
import { ResearchStep, type ResearchForm } from "@/components/journey/EarlySteps";
import {
  availableVariables,
  conceptsIn,
  DEMO_RESEARCH,
  proposeHypothesis,
  readiness,
  refKey,
  specLabel,
  THEORIES,
  TRANSFORM_LABELS,
  type HypothesisMapping,
  type MacroDataset,
  type MacroLink,
  type ModelGroup,
  type ModelSettings,
  type Transform,
  type VariableRef,
} from "@/lib/core/econometrics";
import type { ResearchUnderstandingInput, UnderstandingReport } from "@/lib/core/understanding";

/** Exemple de sujet : celui de la démonstration, adapté à l'économie et à la période des séries réelles (à reformuler). */
function exampleFor(dataset: MacroDataset): Partial<ResearchForm> {
  if (dataset.fictitious || !dataset.economy) return DEMO_RESEARCH;
  const from = dataset.periods[0] ?? "";
  const to = dataset.periods.at(-1) ?? "";
  const swap = (s: string) =>
    s
      .replaceAll("dans la République fictive de Mwinda", `en ${dataset.economy}`)
      .replaceAll("République fictive de Mwinda (économie imaginaire)", dataset.economy)
      .replaceAll("La République fictive de Mwinda", dataset.economy)
      .replaceAll("une économie fictive", dataset.economy)
      .replaceAll("2001", from)
      .replaceAll("2024", to);
  return Object.fromEntries(Object.entries(DEMO_RESEARCH).map(([k, v]) => [k, swap(v)]));
}

/** Étape « Sujet » : formulaire commun + lecture économique et hypothèses fondées sur la théorie. */
export function EconResearchStep({ report, analyzed, onAnalyze, onContinue, dataset }: { report: UnderstandingReport | null; analyzed: ResearchUnderstandingInput | null; onAnalyze: (input: ResearchUnderstandingInput) => void; onContinue: () => void; dataset: MacroDataset }) {
  return (
    <ResearchStep
      title="4. Mon sujet de recherche"
      example={exampleFor(dataset)}
      continueLabel="Continuer : la cohérence de ma recherche"
      report={report}
      analyzed={analyzed}
      onAnalyze={onAnalyze}
      onContinue={onContinue}
      assistant={({ form, append }) => {
        const subject = `${form.title} ${form.mainQuestion} ${form.problem} ${form.generalObjective} ${form.specificQuestions} ${form.hypotheses}`;
        if (!subject.trim()) return null;
        const concepts = conceptsIn(subject).map((h) => h.concept);
        const ids = new Set(concepts.map((c) => c.id));
        const proposals = Object.entries(THEORIES)
          .map(([k, t]) => ({ cause: k.split(">")[0], effect: k.split(">")[1], t }))
          .filter((p) => ids.has(p.cause) && ids.has(p.effect));
        return (
          <div className="space-y-3 rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4">
            <p className="flex items-center gap-2 font-semibold text-indigo-950">
              <Sparkles size={18} aria-hidden /> Lecture économique de votre sujet
            </p>
            {concepts.length ? (
              <p className="text-sm text-slate-700">
                Concepts repérés : {concepts.map((c) => c.label).join(" · ")}.
              </p>
            ) : (
              <p className="text-sm text-slate-700">Aucun concept macroéconomique reconnu pour l&apos;instant (inflation, masse monétaire, taux de change, croissance, investissement, dépenses publiques…).</p>
            )}
            {proposals.length ? (
              <ul className="space-y-2">
                {proposals.map((p) => {
                  const text = proposeHypothesis(p.cause, p.effect, p.t.sign);
                  const already = form.hypotheses.toLowerCase().includes(text.toLowerCase());
                  return (
                    <li key={`${p.cause}>${p.effect}`} className="rounded-xl bg-white p-3 text-sm ring-1 ring-indigo-100">
                      <p className="font-semibold text-slate-900">{text}</p>
                      <p className="mt-1 text-xs text-slate-600">
                        {p.t.name} — {p.t.explanation} ({p.t.references})
                      </p>
                      <button type="button" className={`${buttonClass.ghost} mt-1`} disabled={already} onClick={() => append("hypotheses", text)}>
                        <Plus size={14} aria-hidden /> {already ? "Déjà dans vos hypothèses" : "Ajouter à mes hypothèses"}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <p className="text-xs text-slate-500">Propositions fondées sur des théories usuelles, à valider avec votre encadreur : vous restez l&apos;auteur de vos hypothèses.</p>
          </div>
        );
      }}
    />
  );
}

/** Note sous la chaîne de cohérence : relations économiques repérées dans chaque hypothèse. */
export function EconVariablesNote({ links }: { links: MacroLink[] }) {
  const withRel = links.filter((l) => l.hypothesis);
  if (!withRel.length) return null;
  return (
    <div className="space-y-2 rounded-2xl border border-indigo-200 bg-indigo-50/50 p-4 text-sm">
      <p className="font-semibold text-indigo-950">Relations économiques repérées</p>
      <ul className="space-y-1.5">
        {withRel.map((l) => (
          <li key={l.rowId}>
            {l.cause && l.effect ? (
              <>
                <span className="font-semibold">{l.cause.label}</span> → <span className="font-semibold">{l.effect.label}</span>, signe attendu {l.expectedSign === 1 ? "positif" : l.expectedSign === -1 ? "négatif" : "à préciser"}
                {l.theory ? <span className="text-slate-600"> — {l.theory.name}</span> : null}
              </>
            ) : (
              <span className="text-slate-600">« {l.statement} » : relation à préciser à l&apos;étape du modèle.</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

const refValue = (r: VariableRef | null) => (r ? refKey(r) : "");
const parseRef = (v: string): VariableRef | null => {
  const [kind, ...id] = v.split(":");
  return kind === "series" || kind === "aggregate" ? { kind, id: id.join(":") } : null;
};

/** Étape « Mon modèle » : variables de chaque hypothèse, signe attendu, forme du modèle et contrôles. */
export function ModelStep({
  dataset,
  links,
  mappings,
  models,
  settings,
  confirmed,
  stale,
  onMapping,
  onSettings,
  onConfirm,
}: {
  dataset: MacroDataset;
  links: MacroLink[];
  mappings: Record<string, HypothesisMapping>;
  models: ModelGroup[];
  settings: Record<string, ModelSettings>;
  confirmed: boolean;
  stale: boolean;
  onMapping: (rowId: string, patch: Partial<HypothesisMapping>) => void;
  onSettings: (key: string, patch: Partial<ModelSettings>) => void;
  onConfirm: () => void;
}) {
  const variables = availableVariables(dataset);
  const hypotheses = links.filter((l) => l.hypothesis);
  const options = (
    <>
      <option value="">— Choisir une variable —</option>
      <optgroup label="Séries saisies">
        {variables
          .filter((v) => v.ref.kind === "series")
          .map((v) => (
            <option key={refKey(v.ref)} value={refKey(v.ref)}>
              {v.label} ({v.unit || "unité ?"})
            </option>
          ))}
      </optgroup>
      <optgroup label="Agrégats calculés">
        {variables
          .filter((v) => v.ref.kind === "aggregate")
          .map((v) => (
            <option key={refKey(v.ref)} value={refKey(v.ref)}>
              {v.label} ({v.unit})
            </option>
          ))}
      </optgroup>
    </>
  );
  const complete = hypotheses.every((l) => mappings[l.rowId]?.dependent && mappings[l.rowId]?.independent);
  return (
    <Section title="4. Mon modèle économétrique" description="Pour chaque hypothèse : la variable expliquée (Y), la variable explicative (X) et le signe attendu du coefficient. Les hypothèses qui partagent la même variable expliquée forment une même équation.">
      {!hypotheses.length ? <Notice tone="warning">Aucune hypothèse dans votre sujet : ajoutez-en à l&apos;étape « Sujet de recherche ».</Notice> : null}
      <ol className="space-y-3">
        {hypotheses.map((l, i) => {
          const m = mappings[l.rowId] ?? { dependent: null, independent: null, sign: null };
          return (
            <li key={l.rowId} className="rounded-2xl border border-slate-200 p-4" aria-label={`Hypothèse ${i + 1}`}>
              <p className="font-semibold text-slate-900">
                H{i + 1}. {l.hypothesis}
              </p>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <label className="text-sm font-semibold text-slate-800">
                  Variable explicative (X)
                  <select className={`${inputClass} mt-1`} value={refValue(m.independent)} onChange={(e) => onMapping(l.rowId, { independent: parseRef(e.target.value) })} aria-label={`Variable explicative de l'hypothèse ${i + 1}`}>
                    {options}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Variable expliquée (Y)
                  <select className={`${inputClass} mt-1`} value={refValue(m.dependent)} onChange={(e) => onMapping(l.rowId, { dependent: parseRef(e.target.value) })} aria-label={`Variable expliquée de l'hypothèse ${i + 1}`}>
                    {options}
                  </select>
                </label>
                <label className="text-sm font-semibold text-slate-800">
                  Signe attendu du coefficient
                  <select className={`${inputClass} mt-1`} value={m.sign === 1 ? "+" : m.sign === -1 ? "-" : ""} onChange={(e) => onMapping(l.rowId, { sign: e.target.value === "+" ? 1 : e.target.value === "-" ? -1 : null })} aria-label={`Signe attendu de l'hypothèse ${i + 1}`}>
                    <option value="">À préciser</option>
                    <option value="+">Positif (+)</option>
                    <option value="-">Négatif (−)</option>
                  </select>
                </label>
              </div>
              {l.theory ? (
                <p className="mt-2 text-xs text-slate-600">
                  <span className="font-semibold">{l.theory.name}</span> ({l.theory.references}) : {l.theory.explanation}
                </p>
              ) : null}
              {l.signSource ? <p className="mt-1 text-xs text-slate-500">Signe proposé d&apos;après {l.signSource === "hypothese" ? "la formulation de votre hypothèse" : "la théorie économique"} ; vous pouvez le modifier.</p> : null}
            </li>
          );
        })}
      </ol>

      {models.length ? (
        <div className="mt-5 space-y-3">
          <h3 className="text-base font-extrabold text-slate-900">Équation(s) à estimer</h3>
          {models.map((g) => {
            const s = settings[g.key] ?? { transform: "niveau" as Transform, controls: [] };
            const names = g.spec.regressors.map((r) => variables.find((v) => refKey(v.ref) === refKey(r))?.label ?? "?");
            const obs = dataset.periods.length - (g.spec.transform === "niveau" || g.spec.transform === "log" ? 0 : 1);
            const ready = readiness(obs, g.spec.regressors.length + 1);
            return (
              <article key={g.key} className="rounded-2xl border border-indigo-200 bg-indigo-50/40 p-4" aria-label={g.label}>
                <p className="font-bold text-slate-900">{g.label}</p>
                <p className="mt-1 text-sm text-slate-700">Variables explicatives : {names.join(" ; ")}</p>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <label className="text-sm font-semibold text-slate-800">
                    Forme du modèle
                    <select className={`${inputClass} mt-1`} value={s.transform} onChange={(e) => onSettings(g.key, { transform: e.target.value as Transform })} aria-label={`Forme du ${g.label}`}>
                      {(Object.keys(TRANSFORM_LABELS) as Transform[]).map((t) => (
                        <option key={t} value={t}>
                          {TRANSFORM_LABELS[t]} — {specLabel(t)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-sm font-semibold text-slate-800">
                    Ajouter une variable de contrôle
                    <select className={`${inputClass} mt-1`} value="" onChange={(e) => {
                      const r = parseRef(e.target.value);
                      if (r) onSettings(g.key, { controls: [...s.controls, r] });
                    }} aria-label={`Variable de contrôle du ${g.label}`}>
                      {options}
                    </select>
                  </label>
                </div>
                {s.controls.length ? (
                  <p className="mt-2 flex flex-wrap gap-2 text-xs">
                    {s.controls.map((c) => (
                      <button key={refKey(c)} type="button" className="rounded-full bg-white px-3 py-1 font-semibold text-slate-700 ring-1 ring-slate-200 hover:ring-rose-300" onClick={() => onSettings(g.key, { controls: s.controls.filter((x) => refKey(x) !== refKey(c)) })}>
                        Contrôle : {variables.find((v) => refKey(v.ref) === refKey(c))?.label ?? "?"} ✕
                      </button>
                    ))}
                  </p>
                ) : null}
                <p className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                  <Pill tone={ready.level === "complet" ? "green" : ready.level === "bloque" ? "red" : "yellow"}>
                    {ready.observations} observation(s) · {ready.level === "complet" ? "analyse complète" : ready.level === "partiel" ? "analyse partielle" : ready.level === "indicatif" ? "analyse indicative" : "analyse impossible"}
                  </Pill>
                  <span className="text-slate-600">Niveau : relation directe ; log : élasticités ; différences ou croissance : variations d&apos;une période à l&apos;autre (souvent nécessaires pour des séries non stationnaires).</span>
                </p>
              </article>
            );
          })}
        </div>
      ) : null}

      {stale ? (
        <div className="mt-4">
          <Notice tone="stale">Vos séries ou votre sujet ont changé depuis la validation du modèle : vérifiez-le puis validez à nouveau.</Notice>
        </div>
      ) : null}
      <button type="button" className={`${buttonClass.primary} mt-5`} disabled={!models.length || !complete} onClick={onConfirm}>
        {confirmed && !stale ? "Modèle validé — voir le raisonnement" : "Valider mon modèle et lancer le raisonnement"}
      </button>
      {!complete && hypotheses.length ? <p className="mt-2 text-xs text-slate-500">Associez une variable expliquée et une variable explicative à chaque hypothèse.</p> : null}
    </Section>
  );
}
