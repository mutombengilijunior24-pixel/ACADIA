"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, HelpCircle, GraduationCap, ArrowRight, Pencil, X, Save } from "lucide-react";
import { buildMethodologyRecommendation } from "@/lib/core/methodology/MethodologyRecommendationEngine";
import type { ResearchProject, ResearchMethodology, ResearchDesignType, DataSourceType } from "@/lib/core/research/ResearchTypes";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";

interface MethodologyOverviewProps {
  project: ResearchProject;
  onValidate: () => void;
  onContinue?: () => void;
  /**
   * Bloc H — permet au chercheur de corriger/remplacer un ou
   * plusieurs champs de la méthodologie proposée. Optionnel pour
   * ne pas casser un éventuel autre usage du composant qui ne
   * fournirait pas encore ce callback.
   */
  onUpdateFields?: (changes: Partial<ResearchMethodology>) => void;
}

const RESEARCH_DESIGN_OPTIONS: ResearchDesignType[] = [
  "descriptive",
  "explicative",
  "analytique",
  "correlationnelle",
  "causale",
  "comparative",
  "exploratoire",
];

const DATA_SOURCE_OPTIONS: DataSourceType[] = ["primaire", "secondaire", "mixte"];

function StatusDot({ status }: { status: "proposed" | "confirmed" | "needs_review" }) {
  if (status === "confirmed") return <span className="text-emerald-600">🟢</span>;
  if (status === "needs_review") return <span className="text-amber-500">⚠</span>;
  return <span className="text-acadia-blue">🟢</span>;
}

interface EditState {
  approach: string;
  researchDesignType: string;
  population: string;
  populationSize: string;
  analysisUnit: string;
  samplingMethod: string;
  sampleSize: string;
  samplingJustification: string;
  dataSourceType: string;
  techniques: string;
  instruments: string;
}

function buildEditState(project: ResearchProject, recommendation: ReturnType<typeof buildMethodologyRecommendation>): EditState {
  const m = project.methodology;
  return {
    approach: m.approach ?? recommendation.orientation.value ?? "",
    researchDesignType: m.researchDesignType ?? recommendation.researchDesignType.value ?? "",
    population: m.population ?? "",
    populationSize: m.populationSize ? String(m.populationSize) : "",
    analysisUnit: m.analysisUnit ?? "",
    samplingMethod: m.samplingMethod ?? recommendation.samplingMethod.value ?? "",
    sampleSize: m.sampleSize ? String(m.sampleSize) : recommendation.sampleSize.value ? String(recommendation.sampleSize.value) : "",
    samplingJustification: m.samplingJustification ?? "",
    dataSourceType: m.dataSourceType ?? recommendation.dataSourceType.value ?? "",
    techniques: (m.techniques ?? []).join(", "),
    instruments: (m.instruments ?? []).join(", "),
  };
}

export default function MethodologyOverview({ project, onValidate, onContinue, onUpdateFields }: MethodologyOverviewProps) {
  const recommendation = buildMethodologyRecommendation(project);
  const [validated, setValidated] = useState(project.methodology.status === "accepted");
  const [editing, setEditing] = useState(false);
  const [edit, setEdit] = useState<EditState>(() => buildEditState(project, recommendation));

  function handleValidate() {
    setValidated(true);
    onValidate();
  }

  function startEditing() {
    setEdit(buildEditState(project, recommendation));
    setEditing(true);
  }

  function cancelEditing() {
    setEditing(false);
  }

  function saveEditing() {
    const changes: Partial<ResearchMethodology> = {
      approach: edit.approach.trim() || undefined,
      researchDesignType: (edit.researchDesignType.trim() || undefined) as ResearchDesignType | undefined,
      population: edit.population.trim() || undefined,
      populationSize: edit.populationSize.trim() ? Number(edit.populationSize.trim()) : undefined,
      analysisUnit: edit.analysisUnit.trim() || undefined,
      samplingMethod: edit.samplingMethod.trim() || undefined,
      sampleSize: edit.sampleSize.trim() ? Number(edit.sampleSize.trim()) : undefined,
      samplingJustification: edit.samplingJustification.trim() || undefined,
      dataSourceType: (edit.dataSourceType.trim() || undefined) as DataSourceType | undefined,
      techniques: edit.techniques
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      instruments: edit.instruments
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
    };

    onUpdateFields?.(changes);
    setEditing(false);
    if (validated) {
      // Une méthodologie modifiée redevient une proposition à
      // revalider — cohérent avec updateMethodologyFields côté
      // contexte, qui repasse le statut à "draft".
      setValidated(false);
    }
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">
          ACADIA — Méthodologie de recherche
        </p>
        <div className="flex items-center gap-2">
          {project.level && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-acadia-blue-50 px-3 py-1 text-2xs font-bold text-acadia-blue">
              <GraduationCap className="h-3.5 w-3.5" /> {project.level}
            </span>
          )}
          {onUpdateFields && !editing && (
            <button
              type="button"
              onClick={startEditing}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1 text-2xs font-bold text-acadia-navy hover:bg-slate-50"
            >
              <Pencil className="h-3 w-3" /> Modifier
            </button>
          )}
        </div>
      </div>

      {editing && (
        <p className="mt-3 rounded-2xl bg-acadia-blue-50 p-3 text-xs text-acadia-navy">
          Vous n&apos;êtes pas d&apos;accord avec une proposition d&apos;ACADIA ? Corrigez-la directement ci-dessous
          — vos valeurs remplacent la proposition, elles ne sont jamais écrasées automatiquement.
        </p>
      )}

      {recommendation.levelGuidance && !editing && (
        <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">{recommendation.levelGuidance}</p>
      )}

      {project.variables.length === 0 && (
        <p className="mt-3 flex items-start gap-2 rounded-2xl bg-amber-50 p-3 text-xs text-amber-800">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            ACADIA ne peut pas encore proposer de devis de recherche ni de méthodes d&apos;analyse : vos variables
            n&apos;ont pas encore été identifiées (étape A2). Revenez d&apos;abord à cette étape — les propositions
            ci-dessous se compléteront automatiquement une fois vos variables renseignées.
          </span>
        </p>
      )}

      <div className="mt-4 divide-y divide-slate-100">
        {/* 1. ORIENTATION */}
        <MethodologyRow index={1} title="Orientation">
          {editing ? (
            <SelectField
              value={edit.approach}
              onChange={(v) => setEdit((s) => ({ ...s, approach: v }))}
              options={[
                { value: "quantitative", label: "Quantitative" },
                { value: "qualitative", label: "Qualitative" },
                { value: "mixed", label: "Mixte" },
              ]}
            />
          ) : (
            <>
              <StatusDot status={recommendation.orientation.status} />{" "}
              <span className="font-semibold text-acadia-navy">
                {recommendation.orientation.value ?? "À définir"}
              </span>
              <p className="mt-1 text-xs text-slate-500">
                {recommendation.orientation.status === "needs_review" ? "Non renseignée" : "Proposition ACADIA"}
              </p>
              {recommendation.orientation.justification && (
                <p className="mt-1 text-xs text-slate-400 italic">{recommendation.orientation.justification}</p>
              )}
            </>
          )}
        </MethodologyRow>

        {/* 2. TYPE DE RECHERCHE */}
        <MethodologyRow index={2} title="Type de recherche">
          {editing ? (
            <SelectField
              value={edit.researchDesignType}
              onChange={(v) => setEdit((s) => ({ ...s, researchDesignType: v }))}
              options={RESEARCH_DESIGN_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          ) : (
            <>
              <StatusDot status={recommendation.researchDesignType.status} />{" "}
              <span className="font-semibold text-acadia-navy">
                {recommendation.researchDesignType.value ?? "À définir"}
              </span>
              <p className="mt-1 text-xs text-slate-500">
                {recommendation.researchDesignType.status === "needs_review" ? "À confirmer" : "Proposition ACADIA"}
              </p>
              {recommendation.researchDesignType.justification && (
                <p className="mt-1 text-xs text-slate-400 italic">{recommendation.researchDesignType.justification}</p>
              )}
            </>
          )}
        </MethodologyRow>

        {/* 3. TERRAIN / CADRE DE L'ÉTUDE */}
        <MethodologyRow index={3} title="Terrain / cadre de l'étude">
          <span className="font-semibold text-acadia-navy">{project.location || "À préciser"}</span>
        </MethodologyRow>

        {/* 4. POPULATION */}
        <MethodologyRow index={4} title="Population">
          {editing ? (
            <div className="space-y-2">
              <TextField
                value={edit.population}
                onChange={(v) => setEdit((s) => ({ ...s, population: v }))}
                placeholder="Ex. Les étudiants finalistes de l'UNILU en 2026"
              />
              <div>
                <label className="text-2xs font-semibold text-slate-500">
                  Taille de la population (si connue — permet à ACADIA de calculer un échantillon)
                </label>
                <TextField
                  value={edit.populationSize}
                  onChange={(v) => setEdit((s) => ({ ...s, populationSize: v.replace(/[^0-9]/g, "") }))}
                  placeholder="Ex. 3400"
                />
              </div>
            </div>
          ) : (
            <>
              <span className="font-semibold text-acadia-navy">
                {recommendation.population.value ?? "À préciser par le chercheur."}
              </span>
              {!recommendation.population.value && (
                <p className="mt-1 text-xs text-amber-600">
                  ⚠ La population cible n&apos;est pas encore renseignée. ACADIA ne peut pas déterminer
                  automatiquement une taille d&apos;échantillon fiable.
                </p>
              )}
              {recommendation.population.justification && (
                <WhyToggle text={recommendation.population.justification} />
              )}
            </>
          )}
        </MethodologyRow>

        {/* 5. UNITÉ D'ANALYSE */}
        <MethodologyRow index={5} title="Unité d'analyse">
          {editing ? (
            <TextField
              value={edit.analysisUnit}
              onChange={(v) => setEdit((s) => ({ ...s, analysisUnit: v }))}
              placeholder="Ex. Entreprise, agent, ménage..."
            />
          ) : (
            <span className="font-semibold text-acadia-navy">{project.methodology.analysisUnit || "À définir"}</span>
          )}
        </MethodologyRow>

        {/* 6. ÉCHANTILLONNAGE */}
        <MethodologyRow index={6} title="Échantillonnage">
          {editing ? (
            <div className="space-y-2">
              <div>
                <label className="text-2xs font-semibold text-slate-500">Technique</label>
                <TextField
                  value={edit.samplingMethod}
                  onChange={(v) => setEdit((s) => ({ ...s, samplingMethod: v }))}
                  placeholder="Ex. Échantillonnage raisonné"
                />
              </div>
              <div>
                <label className="text-2xs font-semibold text-slate-500">Taille</label>
                <TextField
                  value={edit.sampleSize}
                  onChange={(v) => setEdit((s) => ({ ...s, sampleSize: v.replace(/[^0-9]/g, "") }))}
                  placeholder="Ex. 46"
                />
              </div>
              <div>
                <label className="text-2xs font-semibold text-slate-500">Justification</label>
                <TextAreaField
                  value={edit.samplingJustification}
                  onChange={(v) => setEdit((s) => ({ ...s, samplingJustification: v }))}
                  placeholder="Pourquoi cette technique et cette taille ?"
                />
              </div>
            </div>
          ) : (
            <>
              {recommendation.samplingMethod.status === "needs_review" &&
              recommendation.sampleSize.status === "needs_review" ? (
                <p className="text-amber-600">⚠ À définir</p>
              ) : null}
              <p className="text-xs text-slate-500">
                Technique :{" "}
                <span className="font-semibold text-acadia-navy">
                  {recommendation.samplingMethod.value ?? "À confirmer"}
                </span>
              </p>
              <p className="text-xs text-slate-500">
                Taille :{" "}
                <span className="font-semibold text-acadia-navy">
                  {recommendation.sampleSize.value ?? "À définir"}
                </span>
              </p>
              {(recommendation.samplingMethod.justification || recommendation.sampleSize.justification) && (
                <WhyToggle
                  text={recommendation.sampleSize.justification ?? recommendation.samplingMethod.justification ?? ""}
                />
              )}
            </>
          )}
        </MethodologyRow>

        {/* 7. SOURCES DES DONNÉES */}
        <MethodologyRow index={7} title="Sources des données">
          {editing ? (
            <SelectField
              value={edit.dataSourceType}
              onChange={(v) => setEdit((s) => ({ ...s, dataSourceType: v }))}
              options={DATA_SOURCE_OPTIONS.map((o) => ({ value: o, label: o }))}
            />
          ) : (
            <>
              <StatusDot status={recommendation.dataSourceType.status} />{" "}
              <span className="font-semibold text-acadia-navy">{recommendation.dataSourceType.value ?? "À définir"}</span>
              {recommendation.dataSourceType.justification && (
                <WhyToggle text={recommendation.dataSourceType.justification} />
              )}
            </>
          )}
        </MethodologyRow>

        {/* 8. MÉTHODE DE COLLECTE */}
        <MethodologyRow index={8} title="Méthode de collecte">
          {editing ? (
            <TextField
              value={edit.techniques}
              onChange={(v) => setEdit((s) => ({ ...s, techniques: v }))}
              placeholder="Ex. Questionnaire, entretien (séparés par des virgules)"
            />
          ) : (
            <>
              <StatusDot status={recommendation.collection.status} />{" "}
              <span className="font-semibold text-acadia-navy">
                {recommendation.collection.value?.join(", ") ?? "À définir"}
              </span>
              <p className="mt-1 text-xs text-slate-500">Proposition</p>
            </>
          )}
        </MethodologyRow>

        {/* 9. INSTRUMENT DE COLLECTE */}
        <MethodologyRow index={9} title="Instrument de collecte">
          {editing ? (
            <TextField
              value={edit.instruments}
              onChange={(v) => setEdit((s) => ({ ...s, instruments: v }))}
              placeholder="Ex. Questionnaire structuré (séparés par des virgules)"
            />
          ) : (
            <span className="font-semibold text-acadia-navy">
              {(project.methodology.instruments ?? []).length > 0 ? project.methodology.instruments!.join(", ") : "À préciser"}
            </span>
          )}
        </MethodologyRow>

        {/* 10. OPÉRATIONNALISATION DES VARIABLES */}
        <MethodologyRow index={10} title="Opérationnalisation des variables">
          {project.variables.length === 0 ? (
            <p className="text-sm text-slate-400 italic">Aucune variable identifiée</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {project.variables.map((v) => (
                <li key={v.id} className="font-semibold text-acadia-navy">
                  {v.role === "independent" ? "X" : v.role === "dependent" ? "Y" : v.role} : {v.name}
                  <span className="ml-1 font-normal text-slate-400">
                    ({(v.dimensions ?? []).length} dimension(s))
                  </span>
                </li>
              ))}
            </ul>
          )}
        </MethodologyRow>

        {/* 11. MÉTHODES D'ANALYSE */}
        <MethodologyRow index={11} title="Méthodes d'analyse">
          <p className="text-sm font-semibold text-acadia-navy">
            {recommendation.analysisPlan.join(" + ")}
          </p>
        </MethodologyRow>

        {/* 12. LIMITES MÉTHODOLOGIQUES */}
        <MethodologyRow index={12} title="Limites méthodologiques">
          {(recommendation.limitations.length > 0 || (project.methodology.warnings ?? []).length > 0) ? (
            <ul className="space-y-1.5">
              {recommendation.limitations.map((limit) => (
                <li key={limit} className="flex items-start gap-1.5 text-xs text-slate-600">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" /> {limit}
                </li>
              ))}
              {(project.methodology.warnings ?? []).map((w) => (
                <li key={w} className="flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 italic">Aucune limite identifiée pour le moment.</p>
          )}
        </MethodologyRow>

        {/* 13. CONSIDÉRATIONS ÉTHIQUES */}
        <MethodologyRow index={13} title="Considérations éthiques">
          <ul className="space-y-1.5">
            {recommendation.ethicalConsiderations.map((item) => (
              <li key={item} className="text-xs text-slate-600">
                {item}
              </li>
            ))}
          </ul>
        </MethodologyRow>

        {/* 14. ÉTAT DE PRÉPARATION */}
        <MethodologyRow index={14} title="État de préparation">
          <p className="text-sm font-semibold text-acadia-navy">
            Méthodologie : {recommendation.readinessPercent}%
          </p>
          {recommendation.toValidate.length > 0 && (
            <ul className="mt-2 space-y-1">
              {recommendation.toValidate.map((item) => (
                <li key={item} className="flex items-center gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="h-3 w-3 shrink-0" /> {item}
                </li>
              ))}
            </ul>
          )}
        </MethodologyRow>
      </div>

      <div className="mt-6 flex flex-col items-center gap-2 border-t border-slate-100 pt-6">
        {editing ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={cancelEditing}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              <X className="h-4 w-4" /> Annuler
            </button>
            <ResearchPrimaryButton size="lg" onClick={saveEditing}>
              <Save className="mr-1.5 h-4 w-4" /> Enregistrer mes corrections
            </ResearchPrimaryButton>
          </div>
        ) : validated ? (
          <>
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
              <CheckCircle2 className="h-4 w-4" /> Méthodologie acceptée par le chercheur
            </span>
            {onContinue && (
              <button
                type="button"
                onClick={onContinue}
                className="mt-2 inline-flex items-center gap-1.5 rounded-xl bg-acadia-blue px-5 py-2.5 text-sm font-semibold text-white hover:brightness-110"
              >
                Étape suivante : construire mon questionnaire <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </>
        ) : (
          <ResearchPrimaryButton size="lg" onClick={handleValidate}>
            Valider la méthodologie
          </ResearchPrimaryButton>
        )}
        {!editing && (
          <p className="text-2xs text-slate-400 text-center max-w-md">
            Valider signifie que vous acceptez cette proposition d&apos;ACADIA — pas qu&apos;elle est scientifiquement
            garantie. Vous pouvez la modifier à tout moment via le bouton « Modifier » ci-dessus.
          </p>
        )}
      </div>
    </section>
  );
}

function WhyToggle({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-1.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-2xs font-semibold text-acadia-blue hover:underline"
      >
        <HelpCircle className="h-3 w-3" /> {open ? "Masquer" : "Pourquoi ?"}
      </button>
      {open && <p className="mt-1 text-xs text-slate-500">{text}</p>}
    </div>
  );
}

function TextField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-acadia-navy focus:border-acadia-blue focus:outline-none focus:ring-1 focus:ring-acadia-blue"
    />
  );
}

function TextAreaField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-acadia-navy focus:border-acadia-blue focus:outline-none focus:ring-1 focus:ring-acadia-blue"
    />
  );
}

function SelectField({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-acadia-navy focus:border-acadia-blue focus:outline-none focus:ring-1 focus:ring-acadia-blue"
    >
      <option value="">À définir</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function MethodologyRow({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-4 first:pt-0 last:pb-0">
      <p className="text-2xs font-bold tracking-wider text-slate-400 uppercase">
        {index}. {title}
      </p>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
