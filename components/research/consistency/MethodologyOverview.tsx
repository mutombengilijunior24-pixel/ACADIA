"use client";

import { useState } from "react";
import { CheckCircle2, AlertTriangle, HelpCircle, GraduationCap } from "lucide-react";
import { buildMethodologyRecommendation } from "@/lib/core/methodology/MethodologyRecommendationEngine";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import ResearchPrimaryButton from "@/components/research/ResearchWizard/brand/ResearchPrimaryButton";

interface MethodologyOverviewProps {
  project: ResearchProject;
  onValidate: () => void;
}

function StatusDot({ status }: { status: "proposed" | "confirmed" | "needs_review" }) {
  if (status === "confirmed") return <span className="text-emerald-600">🟢</span>;
  if (status === "needs_review") return <span className="text-amber-500">⚠</span>;
  return <span className="text-acadia-blue">🟢</span>;
}

export default function MethodologyOverview({ project, onValidate }: MethodologyOverviewProps) {
  const recommendation = buildMethodologyRecommendation(project);
  const [validated, setValidated] = useState(project.methodology.status === "accepted");

  function handleValidate() {
    setValidated(true);
    onValidate();
  }

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-bold tracking-wider text-acadia-blue uppercase">
          ACADIA — Méthodologie de recherche
        </p>
        {project.level && (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-acadia-blue-50 px-3 py-1 text-2xs font-bold text-acadia-blue">
            <GraduationCap className="h-3.5 w-3.5" /> {project.level}
          </span>
        )}
      </div>

      {recommendation.levelGuidance && (
        <p className="mt-3 rounded-2xl bg-slate-50 p-3 text-xs text-slate-600">{recommendation.levelGuidance}</p>
      )}

      <div className="mt-4 divide-y divide-slate-100">
        {/* 1. ORIENTATION */}
        <MethodologyRow index={1} title="Orientation">
          <StatusDot status={recommendation.orientation.status} />{" "}
          <span className="font-semibold text-acadia-navy">
            {recommendation.orientation.value ?? "À définir"}
          </span>
          <p className="mt-1 text-xs text-slate-500">
            {recommendation.orientation.status === "needs_review"
              ? "Non renseignée"
              : "Proposition ACADIA"}
          </p>
          {recommendation.orientation.justification && (
            <p className="mt-1 text-xs text-slate-400 italic">{recommendation.orientation.justification}</p>
          )}
        </MethodologyRow>

        {/* 2. TYPE DE RECHERCHE */}
        <MethodologyRow index={2} title="Type de recherche">
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
        </MethodologyRow>

        {/* 3. TERRAIN / CADRE DE L'ÉTUDE */}
        <MethodologyRow index={3} title="Terrain / cadre de l'étude">
          <span className="font-semibold text-acadia-navy">{project.location || "À préciser"}</span>
        </MethodologyRow>

        {/* 4. POPULATION */}
        <MethodologyRow index={4} title="Population">
          <span className="font-semibold text-acadia-navy">
            {recommendation.population.value ?? "À préciser par le chercheur."}
          </span>
          {!recommendation.population.value && (
            <p className="mt-1 text-xs text-amber-600">
              ⚠ La population cible n&apos;est pas encore renseignée. ACADIA ne peut pas déterminer automatiquement
              une taille d&apos;échantillon fiable.
            </p>
          )}
          {recommendation.population.justification && (
            <WhyToggle text={recommendation.population.justification} />
          )}
        </MethodologyRow>

        {/* 5. UNITÉ D'ANALYSE */}
        <MethodologyRow index={5} title="Unité d'analyse">
          <span className="font-semibold text-acadia-navy">{project.methodology.analysisUnit || "À définir"}</span>
        </MethodologyRow>

        {/* 6. ÉCHANTILLONNAGE */}
        <MethodologyRow index={6} title="Échantillonnage">
          {recommendation.samplingMethod.status === "needs_review" && recommendation.sampleSize.status === "needs_review" ? (
            <p className="text-amber-600">⚠ À définir</p>
          ) : null}
          <p className="text-xs text-slate-500">
            Technique : <span className="font-semibold text-acadia-navy">{recommendation.samplingMethod.value ?? "À confirmer"}</span>
          </p>
          <p className="text-xs text-slate-500">
            Taille : <span className="font-semibold text-acadia-navy">{recommendation.sampleSize.value ?? "À définir"}</span>
          </p>
          {(recommendation.samplingMethod.justification || recommendation.sampleSize.justification) && (
            <WhyToggle text={recommendation.sampleSize.justification ?? recommendation.samplingMethod.justification ?? ""} />
          )}
        </MethodologyRow>

        {/* 7. SOURCES DES DONNÉES */}
        <MethodologyRow index={7} title="Sources des données">
          <StatusDot status={recommendation.dataSourceType.status} />{" "}
          <span className="font-semibold text-acadia-navy">{recommendation.dataSourceType.value ?? "À définir"}</span>
          {recommendation.dataSourceType.justification && (
            <WhyToggle text={recommendation.dataSourceType.justification} />
          )}
        </MethodologyRow>

        {/* 8. MÉTHODE DE COLLECTE */}
        <MethodologyRow index={8} title="Méthode de collecte">
          <StatusDot status={recommendation.collection.status} />{" "}
          <span className="font-semibold text-acadia-navy">
            {recommendation.collection.value?.join(", ") ?? "À définir"}
          </span>
          <p className="mt-1 text-xs text-slate-500">Proposition</p>
        </MethodologyRow>

        {/* 9. INSTRUMENT DE COLLECTE */}
        <MethodologyRow index={9} title="Instrument de collecte">
          <span className="font-semibold text-acadia-navy">
            {(project.methodology.instruments ?? []).length > 0 ? project.methodology.instruments!.join(", ") : "À préciser"}
          </span>
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

        {/* 12. CONSIDÉRATIONS ÉTHIQUES / LIMITES */}
        <MethodologyRow index={12} title="Considérations éthiques / limites">
          {(project.methodology.warnings ?? []).length > 0 ? (
            <ul className="space-y-1">
              {project.methodology.warnings!.map((w) => (
                <li key={w} className="flex items-start gap-1.5 text-xs text-amber-600">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 italic">Aucune limite signalée pour le moment.</p>
          )}
        </MethodologyRow>

        {/* 13. ÉTAT DE PRÉPARATION */}
        <MethodologyRow index={13} title="État de préparation">
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
        {validated ? (
          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700">
            <CheckCircle2 className="h-4 w-4" /> Méthodologie acceptée par le chercheur
          </span>
        ) : (
          <ResearchPrimaryButton size="lg" onClick={handleValidate}>
            Valider la méthodologie
          </ResearchPrimaryButton>
        )}
        <p className="text-2xs text-slate-400 text-center max-w-md">
          Valider signifie que vous acceptez cette proposition d&apos;ACADIA — pas qu&apos;elle est scientifiquement
          garantie. Vous pouvez la modifier à tout moment.
        </p>
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
