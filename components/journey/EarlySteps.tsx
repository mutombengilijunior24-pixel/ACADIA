"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";

import ProfilePanel from "@/components/data/ProfilePanel";
import { useResearch } from "@/contexts/ResearchContext";
import { buttonClass, inputClass, Notice, Metric, Pill, Section } from "@/components/data/ui";
import { describeOperation } from "@/lib/core/data/preparation";
import type { DatasetProfile, ImportedDataset, PreparationState } from "@/lib/core/data/types";
import { CONSISTENCY_LABELS, INSTRUMENT_LABELS, SEVERITY_LABELS, type ConsistencyCategory, type ConsistencyIssue, type ConsistencySeverity, type SkipRule, type DataDiagnosis, type DiagnosisAction, type DiagnosisLevel, type InstrumentKind, type InstrumentQuestion } from "@/lib/core/journey";
import type { GeneratedQuestionnaire } from "@/lib/core/questionnaire/QuestionnaireTypes";
import { NATURE_LABELS, RELATION_LABELS, ROLE_LABELS, splitLines, validateResearchInput, type InputError, type ResearchUnderstandingInput, type UnderstandingReport } from "@/lib/core/understanding";

import type { InstrumentState } from "./JourneyWorkspace";

/* ================================================================= */
/* 1. Recherche                                                        */
/* ================================================================= */

export interface ResearchForm {
  title: string;
  problem: string;
  mainQuestion: string;
  specificQuestions: string;
  generalObjective: string;
  specificObjectives: string;
  hypotheses: string;
  population: string;
  field: string;
  period: string;
}

const EMPTY: ResearchForm = { title: "", problem: "", mainQuestion: "", specificQuestions: "", generalObjective: "", specificObjectives: "", hypotheses: "", population: "", field: "", period: "" };

/** Exemple de SAISIE (cas de validation) : ce sont des entrées, jamais des résultats. */
const EXAMPLE: ResearchForm = {
  ...EMPTY,
  title: "La disponibilité d'une garantie est-elle associée au résultat de la dernière demande de crédit des entrepreneures ?",
  mainQuestion: "La disponibilité d'une garantie est-elle associée au résultat de la dernière demande de crédit des entrepreneures ?",
  problem: "Les femmes entrepreneures se voient souvent refuser des crédits, et l'absence de garantie est souvent avancée comme explication.",
  specificQuestions: "Quel est le niveau de disponibilité des garanties chez les entrepreneures ?\nLa disponibilité d'une garantie est-elle associée au résultat de la dernière demande de crédit ?",
  generalObjective: "Examiner la relation entre la disponibilité d'une garantie et le résultat de la dernière demande de crédit.",
  specificObjectives: "Décrire la disponibilité des garanties chez les entrepreneures.\nExaminer la relation entre la disponibilité d'une garantie et le résultat de la dernière demande de crédit.",
  hypotheses: "La disponibilité d'une garantie est associée au résultat de la dernière demande de crédit.",
  population: "Femmes entrepreneures membres de tontines",
  field: "Lubumbashi",
};

type FieldGroup = "essential" | "framework" | "field";

const GROUPS: Array<{ id: FieldGroup; title: string; help: string }> = [
  { id: "essential", title: "L'essentiel", help: "Ce que vous étudiez et la question à laquelle les données doivent répondre." },
  { id: "framework", title: "Votre cadre de recherche", help: "Facultatif, mais chaque objectif sera confronté aux résultats." },
  { id: "field", title: "Votre terrain", help: "Facultatif : la population ciblée sert aussi à vérifier l'échantillon." },
];

const FIELDS: Array<{ key: keyof ResearchForm; label: string; group: FieldGroup; rows?: number; help?: string; required?: boolean }> = [
  { key: "title", label: "Sujet ou titre provisoire", group: "essential", required: true },
  { key: "mainQuestion", label: "Question principale de recherche", group: "essential", rows: 2 },
  { key: "problem", label: "Problématique", group: "framework", rows: 2, help: "Le constat ou la difficulté de départ." },
  { key: "specificQuestions", label: "Questions spécifiques de recherche (une par ligne)", group: "framework", rows: 3, help: "Chaque question appelle un objectif, puis une hypothèse : ACADIA les relie pour vous." },
  { key: "generalObjective", label: "Objectif général", group: "framework", rows: 2 },
  { key: "specificObjectives", label: "Objectifs spécifiques (un par ligne)", group: "framework", rows: 3, help: "Un objectif par ligne ; ils seront confrontés aux résultats." },
  { key: "hypotheses", label: "Hypothèses (une par ligne)", group: "framework", rows: 2, help: "Laissez vide si votre étude n'en comporte pas." },
  { key: "population", label: "Population ou unité d'analyse", group: "field" },
  { key: "field", label: "Terrain", group: "field" },
  { key: "period", label: "Période", group: "field" },
];

const DRAFT_KEY = "acadia-understanding-draft-v1";

function useUnderstandingDraft(): boolean {
  return useSyncExternalStore(
    () => () => {},
    () => {
      try {
        return localStorage.getItem(DRAFT_KEY) !== null;
      } catch {
        return false;
      }
    },
    () => false,
  );
}

function toForm(input: ResearchUnderstandingInput | null): ResearchForm {
  if (!input) return EMPTY;
  return { title: input.title, problem: input.problem, mainQuestion: input.mainQuestion, specificQuestions: input.specificQuestions.join("\n"), generalObjective: input.generalObjective, specificObjectives: input.specificObjectives.join("\n"), hypotheses: input.hypotheses.join("\n"), population: input.population, field: input.field, period: input.period };
}

export function ResearchStep({
  report,
  analyzed,
  onAnalyze,
  onContinue,
  title = "2. Mon sujet de recherche",
  example = EXAMPLE,
  continueLabel = "Continuer : mes données",
  assistant,
  insights,
}: {
  report: UnderstandingReport | null;
  analyzed: ResearchUnderstandingInput | null;
  onAnalyze: (input: ResearchUnderstandingInput) => void;
  onContinue: () => void;
  title?: string;
  /** Exemple de saisie proposé par « Remplir avec l'exemple ». */
  example?: Partial<ResearchForm>;
  continueLabel?: string;
  /** Propositions à ajouter au formulaire (moteur dédié) : rendu sous le formulaire. */
  assistant?: (api: { form: ResearchForm; append: (field: "specificQuestions" | "specificObjectives" | "hypotheses", text: string) => void }) => ReactNode;
  /** Lecture complémentaire du sujet (moteur dédié), affichée après l'analyse. */
  insights?: ReactNode;
}) {
  const [form, setForm] = useState<ResearchForm>(() => toForm(analyzed));
  const [errors, setErrors] = useState<InputError[]>([]);
  const hasDraft = useUnderstandingDraft();
  // Projets construits avec l'assistant de recherche (moteur initial : problématique, objectifs, hypothèses).
  const { currentProject, researches } = useResearch();
  const projects = [
    ...(currentProject?.title
      ? [
          {
            id: `project-${currentProject.id}`,
            title: currentProject.title,
            form: {
              ...EMPTY,
              title: currentProject.title,
              problem: currentProject.problem?.statement ?? "",
              mainQuestion: (currentProject.researchQuestions.find((q) => q.type !== "secondary") ?? currentProject.researchQuestions[0])?.text ?? "",
              specificQuestions: currentProject.researchQuestions.filter((q) => q.type === "secondary").map((q) => q.text).join("\n"),
              generalObjective: currentProject.objectives.find((o) => o.role === "general")?.text ?? "",
              specificObjectives: currentProject.objectives.filter((o) => o.role === "specific").map((o) => o.text).join("\n"),
              hypotheses: currentProject.hypotheses.map((h) => h.statement).join("\n"),
              field: currentProject.location ?? "",
            },
          },
        ]
      : []),
    ...researches
      .filter((r) => r.title && r.id !== currentProject?.id)
      .map((r) => ({ id: r.id, title: r.title, form: { ...EMPTY, title: r.title, problem: r.problem, generalObjective: r.objective, specificObjectives: r.objectives.filter(Boolean).join("\n"), population: r.population, field: r.location } })),
  ];
  const set = (key: keyof ResearchForm, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const analyze = (): boolean => {
    const validation = validateResearchInput({ ...form, hypotheses: splitLines(form.hypotheses), specificObjectives: splitLines(form.specificObjectives), specificQuestions: splitLines(form.specificQuestions) });
    if (!validation.ok) {
      setErrors(validation.errors);
      return false;
    }
    setErrors([]);
    onAnalyze(validation.input);
    // Le formulaire reflète le texte nettoyé (balises collées retirées, un objectif par ligne).
    setForm(toForm(validation.input));
    return true;
  };
  const loadDraft = () => {
    try {
      const raw = JSON.parse(localStorage.getItem(DRAFT_KEY) ?? "null") as { form?: Record<string, string> } | null;
      const f = raw?.form;
      if (f && typeof f.title === "string") setForm({ title: f.title, problem: f.problem ?? "", mainQuestion: f.mainQuestion ?? "", specificQuestions: f.specificQuestions ?? "", generalObjective: f.generalObjective ?? "", specificObjectives: f.specificObjectives ?? "", hypotheses: f.hypotheses ?? "", population: f.population ?? "", field: f.field ?? "", period: f.period ?? "" });
    } catch {
      // Brouillon illisible : ignoré.
    }
  };
  const stale = !!analyzed && JSON.stringify(toForm(analyzed)) !== JSON.stringify(form);
  const priority = report?.clarifications.find((q) => q.priority === 1) ?? report?.clarifications[0];

  return (
    <div className="space-y-5">
      <Section
        title={title}
        description="Seul le sujet est obligatoire ; plus vous en dites, plus le plan d'analyse sera précis. ACADIA analyse ces textes avec son moteur de compréhension."
        action={
          <div className="flex flex-wrap gap-2">
            {projects.length ? (
              <select
                className={`${inputClass} w-auto`}
                value=""
                aria-label="Partir d'un projet de recherche"
                onChange={(e) => {
                  const project = projects.find((x) => x.id === e.target.value);
                  if (project) setForm(project.form);
                }}
              >
                <option value="">Partir d&apos;un projet de recherche…</option>
                {projects.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.title}
                  </option>
                ))}
              </select>
            ) : null}
            {hasDraft ? (
              <button type="button" className={buttonClass.ghost} onClick={loadDraft}>
                Reprendre « Comprendre ma recherche »
              </button>
            ) : null}
            <button type="button" className={buttonClass.ghost} onClick={() => setForm({ ...EMPTY, ...example })}>
              Remplir avec l&apos;exemple
            </button>
          </div>
        }
      >
        <div className="space-y-5">
          {GROUPS.map((group) => (
            <fieldset key={group.id} className="rounded-2xl border border-slate-200/80 p-4">
              <legend className="px-1 text-sm font-bold text-slate-900">{group.title}</legend>
              <p className="-mt-1 mb-3 px-1 text-xs text-slate-500">{group.help}</p>
              <div className="grid gap-4 md:grid-cols-2">
          {FIELDS.filter((f) => f.group === group.id).map((field) => {
            const error = errors.find((e) => e.field === field.key)?.message;
            const common = { id: `research-${field.key}`, value: form[field.key], onChange: (e: { target: { value: string } }) => set(field.key, e.target.value), "aria-invalid": !!error };
            return (
              <div key={field.key} className={field.rows ? "md:col-span-2" : field.key === "title" ? "md:col-span-2" : undefined}>
                <label htmlFor={`research-${field.key}`} className="mb-1 flex items-center gap-2 text-sm font-medium text-slate-700">
                  {field.label} {field.required ? <span className="text-xs font-semibold text-red-600">Obligatoire</span> : <span className="text-xs text-slate-400">Facultatif</span>}
                </label>
                {field.rows ? <textarea {...common} rows={field.rows} className={`${inputClass} py-2`} /> : <input {...common} className={inputClass} />}
                {error ? (
                  <p className="mt-1 text-sm text-red-700" role="alert">
                    {error}
                  </p>
                ) : field.help ? (
                  <p className="mt-1 text-xs text-slate-500">{field.help}</p>
                ) : null}
              </div>
            );
          })}
              </div>
            </fieldset>
          ))}
        </div>
        {assistant ? <div className="mt-4">{assistant({ form, append: (field, text) => setForm((f) => ({ ...f, [field]: f[field].trim() ? `${f[field].trim()}
${text}` : text })) })}</div> : null}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className={buttonClass.primary} onClick={() => analyze()}>
            {analyzed ? "Mettre à jour l'analyse" : "Analyser ma recherche"}
          </button>
          {stale ? <span className="self-center text-sm text-amber-800">Modifications non encore analysées.</span> : null}
        </div>
      </Section>

      {report && insights ? insights : null}
      {report ? (
        <Section title="Ce qu'ACADIA a compris" description="Interprétation du moteur de compréhension : des propositions, pas des faits établis.">
          <div className="space-y-3 text-sm">
            <p>
              <span className="font-semibold text-slate-800">Nature de l&apos;étude : </span>
              {NATURE_LABELS[report.nature.nature]}
            </p>
            <ul className="space-y-1">
              {report.variables.filter((v) => v.group !== "secondary").map((v) => (
                <li key={v.key}>
                  <span className="font-medium text-slate-900">{v.name}</span> — <span className="text-slate-600">{ROLE_LABELS[v.role]}</span>
                </li>
              ))}
            </ul>
            {report.relations.map((r) => (
              <p key={r.id} className="text-slate-700">
                {RELATION_LABELS[r.nature]} : « {report.variables.find((v) => v.key === r.from)?.name} » {r.directed ? "→" : "↔"} « {report.variables.find((v) => v.key === r.to)?.name} » <span className="text-slate-500">(supposée, à examiner sur les données)</span>
              </p>
            ))}
            {report.missingEssential.length ? <p className="text-amber-800">Informations encore absentes : {report.missingEssential.map((m) => m.label.toLowerCase()).join(", ")}. Le parcours reste possible, mais les conclusions seront limitées d&apos;autant.</p> : null}
            {priority ? (
              <div className="rounded-xl bg-amber-50 p-3 text-amber-900">
                <p className="font-semibold">Question prioritaire</p>
                <p>{priority.question}</p>
                {report.clarifications.length > 1 ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-xs">Voir les {report.clarifications.length - 1} autre(s) question(s)</summary>
                    <ul className="mt-1 list-disc pl-5 text-xs">
                      {report.clarifications.slice(1).map((q) => (
                        <li key={q.id}>{q.question}</li>
                      ))}
                    </ul>
                  </details>
                ) : null}
              </div>
            ) : null}
          </div>
          <div className="mt-4">
            <button type="button" className={buttonClass.primary} onClick={() => (!stale || analyze()) && onContinue()}>
              {stale ? "Analyser les modifications et continuer" : continueLabel}
            </button>
          </div>
        </Section>
      ) : null}
    </div>
  );
}

/* ================================================================= */
/* 2. Instrument                                                       */
/* ================================================================= */

const INSTRUMENT_HELP: Record<InstrumentKind, string> = {
  questionnaire: "Réponses à des questions fermées ou ouvertes, exportées dans un fichier (Excel, CSV, formulaire en ligne).",
  interview_guide: "Entretiens : les réponses sont des textes. Les tests statistiques ne s'y appliquent pas ; l'analyse thématique n'est pas encore disponible.",
  observation_grid: "Observations codées selon une grille.",
  documentary: "Données tirées de documents, de rapports ou de comptes. Le moteur d'analyse des états financiers n'est pas encore disponible.",
  other: "Autre source : précisez-la dans votre méthodologie.",
};

function readAcadiaQuestionnaires(): Array<{ key: string; questionnaire: GeneratedQuestionnaire }> {
  const list: Array<{ key: string; questionnaire: GeneratedQuestionnaire }> = [];
  try {
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith("acadia-questionnaire-")) continue;
      try {
        const q = JSON.parse(localStorage.getItem(key) ?? "null") as GeneratedQuestionnaire | null;
        if (q && typeof q.title === "string" && Array.isArray(q.sections)) list.push({ key, questionnaire: q });
      } catch {
        // Entrée illisible : ignorée.
      }
    }
  } catch {
    // Stockage indisponible.
  }
  return list;
}

export function InstrumentStep({ instrument, questions, onChange, confirmed, onConfirm }: { instrument: InstrumentState; questions: InstrumentQuestion[]; onChange: (next: InstrumentState) => void; confirmed: boolean; onConfirm: () => void }) {
  const [stored, setStored] = useState<Array<{ key: string; questionnaire: GeneratedQuestionnaire }> | null>(null);
  const [attempted, setAttempted] = useState(false);
  const ready = !!instrument.kind && (instrument.kind !== "questionnaire" || instrument.mode === "headers" || questions.length > 0);
  return (
    <Section title="3. Mes données : comment ont-elles été collectées ?" description="Questionnaire, entretiens, documents… ACADIA détectera aussi le type de données dans votre fichier. Il n'invente aucune question : il utilise seulement ce que vous fournissez.">
      <fieldset className="space-y-2">
        <legend className="sr-only">Type d&apos;instrument</legend>
        {(Object.keys(INSTRUMENT_LABELS) as InstrumentKind[]).map((kind) => (
          <label key={kind} className={`flex cursor-pointer gap-3 rounded-xl p-3 text-sm ring-1 ${instrument.kind === kind ? "bg-blue-50 ring-blue-200" : "ring-slate-200"}`}>
            <input type="radio" name="instrument" className="mt-1 h-4 w-4 shrink-0" checked={instrument.kind === kind} onChange={() => onChange({ ...instrument, kind })} />
            <span>
              <span className="font-medium text-slate-900">{INSTRUMENT_LABELS[kind]}</span>
              <span className="block text-slate-600">{INSTRUMENT_HELP[kind]}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {instrument.kind === "questionnaire" ? (
        <div className="mt-5 space-y-3 text-sm">
          <p className="font-semibold text-slate-800">Comment ACADIA peut-il connaître les questions posées ?</p>
          {(
            [
              ["headers", "Les en-têtes de mon fichier reprennent le texte des questions (export de formulaire en ligne, par exemple)."],
              ["text", "Je colle le texte de mon questionnaire."],
              ["acadia", "J'ai créé mon questionnaire dans ACADIA."],
            ] as const
          ).map(([mode, label]) => (
            <label key={mode} className="flex items-start gap-2">
              <input type="radio" name="instrument-mode" className="mt-1 h-4 w-4 shrink-0" checked={instrument.mode === mode} onChange={() => onChange({ ...instrument, mode })} />
              <span>{label}</span>
            </label>
          ))}
          {instrument.mode === "text" ? (
            <label className="block">
              <span className="mb-1 block font-medium text-slate-700">Texte du questionnaire</span>
              <textarea className={`${inputClass} min-h-40 py-2`} value={instrument.text} onChange={(e) => onChange({ ...instrument, text: e.target.value })} placeholder={"1. Disposez-vous d'une garantie pour obtenir un crédit ?\n- Oui\n- Non\n2. Quel a été le résultat de votre dernière demande de crédit ?"} />
              <span className="mt-1 block text-xs text-slate-500">Questions numérotées ou terminées par « ? » ; modalités en puces (-, □, a), …).</span>
            </label>
          ) : null}
          {instrument.mode === "acadia" ? (
            <div className="space-y-2">
              {stored === null ? (
                <button type="button" className={buttonClass.secondary} onClick={() => setStored(readAcadiaQuestionnaires())}>
                  Afficher mes questionnaires ACADIA
                </button>
              ) : stored.length ? (
                <select className={inputClass} value={instrument.acadia?.key ?? ""} onChange={(e) => onChange({ ...instrument, acadia: stored.find((s) => s.key === e.target.value) ?? null })}>
                  <option value="">Choisir un questionnaire…</option>
                  {stored.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.questionnaire.title}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="text-amber-800">Aucun questionnaire ACADIA n&apos;est enregistré dans ce navigateur.</p>
              )}
            </div>
          ) : null}
          {instrument.mode !== "headers" && questions.length ? (
            <details className="rounded-xl bg-slate-50 p-3" open>
              <summary className="cursor-pointer font-medium text-slate-700">{questions.length} question(s) lue(s)</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-700">
                {questions.slice(0, 12).map((q) => (
                  <li key={q.id}>
                    {q.text}
                    {q.options.length ? <span className="text-slate-500"> — {q.options.join(" / ")}</span> : null}
                  </li>
                ))}
              </ol>
              {questions.length > 12 ? <p className="mt-1 text-xs text-slate-500">… et {questions.length - 12} autre(s).</p> : null}
            </details>
          ) : null}
        </div>
      ) : null}
      {instrument.kind === "interview_guide" ? <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Avec un guide d&apos;entretien, ACADIA ne proposera aucun test statistique. Si votre fichier contient aussi des questions fermées, elles pourront être décrites.</p> : null}

      <div className="mt-5 space-y-3">
        {attempted && !ready ? (
          <Notice tone="error" title="Il manque une information">
            {!instrument.kind ? "Choisissez le type d'instrument utilisé." : instrument.mode === "text" ? "Collez le texte de votre questionnaire (au moins une question lisible), ou indiquez que les en-têtes du fichier reprennent les questions." : "Choisissez votre questionnaire ACADIA, ou indiquez que les en-têtes du fichier reprennent les questions."}
          </Notice>
        ) : null}
        <button
          type="button"
          className={buttonClass.primary}
          onClick={() => {
            if (!ready) {
              setAttempted(true);
              return;
            }
            onConfirm();
          }}
        >
          {confirmed ? "Continuer : mon fichier" : "Confirmer l'instrument et continuer"}
        </button>
      </div>
    </Section>
  );
}

/* ================================================================= */
/* 4. Qualité des données                                              */
/* ================================================================= */

const LEVELS: Record<DiagnosisLevel, { label: string; tone: "red" | "yellow" | "blue" | "neutral" }> = {
  confirmed: { label: "Problème confirmé", tone: "red" },
  decision: { label: "Décision à prendre", tone: "blue" },
  potential: { label: "Anomalie potentielle", tone: "yellow" },
  suggestion: { label: "Suggestion de nettoyage", tone: "neutral" },
};

const SEVERITY_TONE: Record<ConsistencySeverity, "red" | "yellow" | "neutral"> = { high: "red", medium: "yellow", low: "neutral" };

export function QualityStep({
  diagnosis,
  dataset,
  profile,
  preparation,
  confirmed,
  onAction,
  onUndo,
  onConfirm,
  consistency,
  skipRules,
  onSkipDecision,
  onSkipValues,
  provenanceDeclared,
}: {
  consistency: ConsistencyIssue[];
  skipRules: SkipRule[];
  onSkipDecision: (id: string, value: "confirmed" | "rejected") => void;
  onSkipValues: (id: string, values: string[]) => void;
  provenanceDeclared: boolean;
  diagnosis: DataDiagnosis;
  dataset: ImportedDataset;
  profile: DatasetProfile;
  preparation: PreparationState;
  confirmed: boolean;
  onAction: (action: DiagnosisAction) => void;
  onUndo: (operationId: string) => void;
  onConfirm: () => void;
}) {
  const [attempted, setAttempted] = useState(false);
  const applied = preparation.operations.filter((op) => op.type === "exclude_rows" || op.type === "declare_missing_codes");
  return (
    <div className="space-y-5">
      <Section title="4. Vérification des données" description="Rien n'est supprimé ni modifié sans votre décision ; chaque décision est réversible.">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Lignes importées" value={diagnosis.rows} />
          <Metric label="Observations utilisables" value={diagnosis.rowsUsed} hint={diagnosis.rowsExcluded ? `${diagnosis.rowsExcluded} exclue(s)` : "aucune exclusion"} />
          <Metric label="Questions" value={diagnosis.questionUnits} hint={`${diagnosis.columns} colonnes, dont ${diagnosis.technicalColumns + diagnosis.optionColumns} mises de côté`} />
          <Metric label="Cellules vides" value={`${Math.round(diagnosis.missingCellRate * 100)} %`} />
          <Metric label="Codes de non-réponse" value={diagnosis.declaredCodes} />
          <Metric label="Doublons potentiels" value={diagnosis.duplicates} tone={diagnosis.duplicates ? "warn" : undefined} />
          <Metric label="Types incertains" value={diagnosis.uncertainTypes} tone={diagnosis.uncertainTypes ? "warn" : undefined} />
          <Metric label="Alertes de cohérence" value={diagnosis.coherenceAlerts} tone={diagnosis.coherenceAlerts ? "warn" : undefined} />
        </div>
        <div className="mt-4 space-y-1 text-sm text-slate-700">
          {diagnosis.summary.map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
      </Section>

      <Section title="Points relevés" description="Classés par nature : problème confirmé, décision à prendre, anomalie potentielle, suggestion.">
        {diagnosis.items.length ? (
          <ul className="space-y-2">
            {diagnosis.items.map((item) => (
              <li key={item.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <Pill tone={LEVELS[item.level].tone}>{LEVELS[item.level].label}</Pill>
                  <span className="font-semibold text-slate-900">{item.title}</span>
                </div>
                <p className="mt-1 break-words text-slate-600">{item.detail}</p>
                <p className="mt-1 text-slate-700">
                  <span className="font-medium">Pourquoi c&apos;est important : </span>
                  {item.why}
                </p>
                <p className="mt-1 text-slate-700">
                  <span className="font-medium">Proposition : </span>
                  {item.proposal}
                </p>
                <p className="mt-1 text-slate-700">
                  <span className="font-medium">Conséquence sur les analyses : </span>
                  {item.consequence}
                </p>
                {item.action ? (
                  <button type="button" className={`${buttonClass.secondary} mt-2`} onClick={() => onAction(item.action!)}>
                    {item.action.label}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Aucun problème relevé.</p>
        )}
        {applied.length ? (
          <div className="mt-4 rounded-xl bg-slate-50 p-3 text-sm">
            <p className="font-semibold text-slate-800">Vos décisions</p>
            <ul className="mt-1 space-y-1">
              {applied.map((op) => (
                <li key={op.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-slate-700">{describeOperation(op, dataset)}</span>
                  <button type="button" className={buttonClass.ghost} onClick={() => onUndo(op.id)}>
                    Annuler
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        <details className="mt-4 text-sm">
          <summary className="cursor-pointer font-medium text-slate-700">Profil détaillé des colonnes</summary>
          <div className="mt-3">
            <ProfilePanel dataset={dataset} profile={profile} onExcludeDuplicates={(rows) => onAction({ type: "exclude_rows", rows, label: "" })} />
          </div>
        </details>
      </Section>

      <Section title="Conditions de passage" description="Quelles questions ne s'appliquent qu'à une partie des répondants ? Les règles tirées de votre questionnaire sont appliquées ; celles déduites d'un intitulé restent à confirmer — ACADIA n'en invente pas.">
        {skipRules.length ? (
          <ul className="space-y-2">
            {skipRules.map((rule) => (
              <li key={rule.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Pill tone={rule.status === "confirmed" ? "green" : "yellow"}>{rule.status === "confirmed" ? (rule.source === "instrument" ? "Consigne de l'instrument" : "Confirmée par vous") : "Proposée — à confirmer"}</Pill>
                  <span className="font-semibold text-slate-900">« {rule.targetHeader} »</span>
                </p>
                <p className="mt-1 text-slate-700">
                  S&apos;applique seulement si « {rule.when.header} » = {rule.when.values.map((v) => `« ${v} »`).join(" ou ")}.
                </p>
                <p className="mt-1 text-xs text-slate-500">{rule.rationale}</p>
                {rule.source !== "instrument" && rule.options.length > 1 && rule.options.length <= 12 ? (
                  <fieldset className="mt-2">
                    <legend className="text-xs font-medium text-slate-600">Réponses à « {rule.when.header} » pour lesquelles la question s&apos;applique :</legend>
                    <div className="mt-1 flex flex-wrap gap-3">
                      {rule.options.map((option) => (
                        <label key={option} className="flex min-h-9 items-center gap-1.5 text-sm">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={rule.when.values.includes(option)}
                            onChange={(e) => onSkipValues(rule.id, e.target.checked ? [...rule.when.values, option] : rule.when.values.filter((v) => v !== option))}
                          />
                          {option}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                ) : null}
                {rule.source !== "instrument" ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {rule.status !== "confirmed" ? (
                      <button type="button" className={buttonClass.secondary} onClick={() => onSkipDecision(rule.id, "confirmed")}>
                        Confirmer cette règle
                      </button>
                    ) : null}
                    <button type="button" className={buttonClass.ghost} onClick={() => onSkipDecision(rule.id, "rejected")}>
                      Écarter
                    </button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Aucune condition de passage connue. Si votre questionnaire comporte des consignes de saut, collez-le à l&apos;étape « Instrument de collecte ».</p>
        )}
      </Section>

      <Section title="Cohérence des réponses" description="Contrôles explicites, règle par règle. ACADIA signale ; il ne modifie jamais les réponses et ne qualifie pas d'impossible ce qui peut s'expliquer.">
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {(Object.keys(CONSISTENCY_LABELS) as ConsistencyCategory[]).map((category) => (
            <Pill key={category} tone={consistency.some((c) => c.category === category) ? "yellow" : "neutral"}>
              {CONSISTENCY_LABELS[category]} : {consistency.filter((c) => c.category === category).length}
            </Pill>
          ))}
        </div>
        {consistency.length ? (
          <ul className="space-y-2">
            {consistency.map((issue) => (
              <li key={issue.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                <p className="flex flex-wrap items-center gap-2">
                  <Pill tone={SEVERITY_TONE[issue.severity]}>Gravité {SEVERITY_LABELS[issue.severity]}</Pill>
                  <span className="font-semibold text-slate-900">{CONSISTENCY_LABELS[issue.category]}</span>
                  <span className="text-xs text-slate-500">Règle : {issue.ruleLabel}</span>
                </p>
                <p className="mt-1 break-words text-slate-700">{issue.problem}</p>
                <p className="mt-1 text-xs text-slate-500">Questions : {issue.elements.map((e) => `« ${e.header} »`).join(", ")}</p>
                <p className="mt-1 text-slate-700">
                  <span className="font-medium">Justification : </span>
                  {issue.justification}
                </p>
                <p className="mt-1 text-slate-700">
                  <span className="font-medium">Action recommandée : </span>
                  {issue.action}
                </p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">Aucun signal : les contrôles disponibles n&apos;ont détecté ni contradiction ni tension.</p>
        )}
      </Section>

      {attempted && !provenanceDeclared ? (
        <Notice tone="error" title="Provenance des données à indiquer">
          Indiquez d&apos;où viennent ces données (encadré « D&apos;où viennent ces données ? » en haut de l&apos;étape) : elle figure dans tous les rapports.
        </Notice>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonClass.primary}
          onClick={() => {
            if (!provenanceDeclared) {
              setAttempted(true);
              document.getElementById("provenance")?.scrollIntoView({ behavior: "smooth", block: "center" });
              return;
            }
            onConfirm();
          }}
        >
          {confirmed ? "Continuer : variables" : "Confirmer l'état des données et continuer"}
        </button>
        {!provenanceDeclared ? <span className="self-center text-sm text-slate-600">La provenance de ce fichier doit d&apos;abord être indiquée.</span> : null}
      </div>
    </div>
  );
}
