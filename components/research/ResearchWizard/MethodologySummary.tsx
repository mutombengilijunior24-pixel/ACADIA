"use client";

import { useRouter } from "next/navigation";
import { useResearch } from "@/contexts/ResearchContext";
import { CheckCircle2, Sparkles, ArrowRight, Target } from "lucide-react";
import { useState } from "react";
import ResearchStepHeader from "./brand/ResearchStepHeader";
import ResearchSummaryCard from "./brand/ResearchSummaryCard";
import ResearchPrimaryButton from "./brand/ResearchPrimaryButton";

export default function MethodologySummary() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    currentResearch,
    methodology: rawMethodology,
    sample,
    createCurrentResearch,
  } = useResearch();

  const methodology = rawMethodology ?? {
    approach: currentResearch.researchType || "Quantitative",
    method: "Méthode scientifique",
    techniques: currentResearch.collectionMethod ? [currentResearch.collectionMethod] : [],
    analyses: [],
  };

  const handleCreateProject = () => {
    try {
      setIsSubmitting(true);
      const project = createCurrentResearch();
      router.push(`/dashboard/research/${project.id}`);
    } catch (err) {
      console.error("Erreur lors de la création du projet :", err);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      {/* Bannière de confirmation */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-5 flex items-start gap-3.5">
        <CheckCircle2 className="h-6 w-6 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <h2 className="text-base font-bold text-emerald-950">
            Votre recherche est maintenant structurée
          </h2>
          <p className="text-xs sm:text-sm text-emerald-800 leading-relaxed">
            Toutes les informations essentielles ont été renseignées. Vous pourrez accéder à votre espace de travail dédié pour lancer l'intelligence scientifique, concevoir vos questionnaires et piloter votre étude.
          </p>
        </div>
      </div>

      <ResearchStepHeader
        step={14}
        category="Finalisation"
        title="Récapitulatif de votre projet"
        description="Vérifiez les données clés saisies au cours du parcours."
      />

      {/* Grille des informations */}
      <div className="grid gap-3.5 sm:grid-cols-2">
        <ResearchSummaryCard label="Sujet / Titre" value={currentResearch.title} colSpan={2} />
        <ResearchSummaryCard label="Domaine" value={currentResearch.domain} />
        <ResearchSummaryCard label="Niveau académique" value={currentResearch.level} />
        <ResearchSummaryCard label="Université / Institution" value={currentResearch.university} />
        <ResearchSummaryCard label="Type de recherche" value={currentResearch.researchType} />
        <ResearchSummaryCard label="Problématique" value={currentResearch.problem} colSpan={2} />
        <ResearchSummaryCard label="Objectif général" value={currentResearch.objective} colSpan={2} />
        <ResearchSummaryCard label="Population cible" value={currentResearch.population} />
        <ResearchSummaryCard
          label="Taille de population"
          value={
            currentResearch.populationSize > 0
              ? `${currentResearch.populationSize} personnes`
              : "Non définie"
          }
        />
        <ResearchSummaryCard label="Cadre géographique" value={currentResearch.location} />
        <ResearchSummaryCard label="Méthode de collecte" value={currentResearch.collectionMethod} />
      </div>

      {/* Objectifs spécifiques */}
      <div className="rounded-2xl border border-slate-200/90 bg-white p-5 space-y-3 shadow-2xs">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-500">
          <Target className="h-4 w-4 text-acadia-blue" />
          <span>Objectifs spécifiques</span>
        </div>

        {currentResearch.objectives && currentResearch.objectives.length > 0 ? (
          <ol className="space-y-2 pl-2">
            {currentResearch.objectives.map((obj, idx) => (
              <li key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-700">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-acadia-blue-100 text-2xs font-bold text-acadia-navy mt-0.5">
                  {idx + 1}
                </span>
                <span>{obj}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-xs text-slate-400 italic">Aucun objectif spécifique renseigné.</p>
        )}
      </div>

      {/* Échantillonnage recommandé */}
      <div className="rounded-2xl border border-acadia-navy/10 bg-acadia-navy p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-acadia-blue-light">
            Dimensionnement de l'échantillon
          </span>
          <h3 className="text-base sm:text-lg font-bold text-white mt-1">
            Taille d'échantillon recommandée (n)
          </h3>
          <p className="text-xs text-white/60 mt-0.5">
            Calculé avec un intervalle de confiance de 95% et une marge d'erreur de 5%.
          </p>
        </div>

        <div className="flex items-baseline gap-2 bg-white/10 rounded-xl px-4 py-3 border border-white/10 shrink-0">
          <span className="text-3xl font-extrabold text-white">
            {sample.sampleSize && sample.sampleSize > 0 ? sample.sampleSize : 384}
          </span>
          <span className="text-xs font-semibold text-white/70">répondants</span>
        </div>
      </div>

      {/* Bouton de validation & création */}
      <ResearchPrimaryButton
        size="lg"
        onClick={handleCreateProject}
        disabled={isSubmitting}
        className="w-full"
      >
        <Sparkles className="h-5 w-5" />
        <span>{isSubmitting ? "Création en cours..." : "Continuer avec ACADIA"}</span>
        <ArrowRight className="h-5 w-5" />
      </ResearchPrimaryButton>
    </div>
  );
}