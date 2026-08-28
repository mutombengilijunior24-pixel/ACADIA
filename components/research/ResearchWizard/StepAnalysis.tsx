"use client";

import type { ComponentType } from "react";
import { useResearch } from "@/contexts/ResearchContext";
import { Compass, BarChart3, Users, FileText } from "lucide-react";
import ResearchStepHeader from "./brand/ResearchStepHeader";
import ResearchInsight from "./brand/ResearchInsight";

export default function StepAnalysis() {
  const { currentResearch, methodology, sample } = useResearch();

  const approach =
    methodology?.approach?.trim() ||
    currentResearch.researchType ||
    "À déterminer";

  const method =
    methodology?.method?.trim() ||
    (currentResearch.researchType === "Quantitative"
      ? "Méthode hypothético-déductive"
      : currentResearch.researchType === "Qualitative"
      ? "Méthode compréhensive / inductive"
      : "Méthode mixte séquentielle / concurrente");

  const techniques =
    methodology?.techniques?.length
      ? methodology.techniques
      : currentResearch.collectionMethod
      ? [currentResearch.collectionMethod]
      : ["À déterminer"];

  const population =
    methodology?.population?.trim() ||
    currentResearch.population ||
    "Non renseignée";

  const sampleSize = sample?.sampleSize;

  return (
    <div className="space-y-6">
      <ResearchStepHeader
        step={13}
        category="Recommandations"
        title="Synthèse de l'orientation méthodologique"
        description="ACADIA structure ici les orientations scientifiques dérivées des informations que vous avez renseignées."
      />

      {/* Grille de cartes méthodologiques */}
      <div className="grid gap-4 sm:grid-cols-2">
        <MethodCard
          icon={Compass}
          title="Approche & Posture"
          value={approach}
          subtitle="Orientation épistémologique"
        />

        <MethodCard
          icon={FileText}
          title="Méthode principale"
          value={method}
          subtitle="Cadre de raisonnement"
        />

        <MethodCard
          icon={BarChart3}
          title="Technique de collecte"
          value={techniques.join(", ")}
          subtitle="Instrument empirique"
        />

        <MethodCard
          icon={Users}
          title="Échantillonnage"
          value={
            sampleSize && sampleSize > 0
              ? `${sampleSize} répondants recommandés`
              : "Échantillon standard (~384)"
          }
          subtitle={`Population : ${population}`}
        />
      </div>

      {/* Note d'information */}
      <ResearchInsight title="Étape suivante">
        Vous allez pouvoir vérifier la synthèse complète de votre projet avant
        de valider son enregistrement et d&apos;accéder à votre espace de
        travail.
      </ResearchInsight>
    </div>
  );
}

function MethodCard({
  icon: Icon,
  title,
  value,
  subtitle,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  value: string;
  subtitle: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-2xs space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
        <Icon className="h-4 w-4 text-acadia-blue" />
        <span>{title}</span>
      </div>
      <p className="text-base font-bold text-acadia-navy">
        {value}
      </p>
      <p className="text-xs text-slate-500">
        {subtitle}
      </p>
    </div>
  );
}