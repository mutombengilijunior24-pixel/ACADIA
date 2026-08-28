import type { ResearchData } from "@/types/Research";

import {
  generateMethodology,
  type MethodologyResult,
} from "./MethodologyEngine";

import {
  calculateSampleSize,
  type SamplingResult,
} from "./SamplingEngine";

/* =========================================================
   ACADIA — METHODOLOGY INTELLIGENCE ENGINE
   A3 — Couche intelligente de méthodologie

   IMPORTANT :
   - MethodologyEngine reste le moteur méthodologique historique.
   - SamplingEngine reste le moteur mathématique.
   - A3 orchestre les deux.
   - A3 ne remplace pas A1/A2.
   - A3 ne doit pas réinventer les variables.
========================================================= */

export interface MethodologyIntelligenceResult {

  /* Moteur méthodologique existant */
  methodology: MethodologyResult;

  /* Calcul automatique de l'échantillon */
  sampling: SamplingResult;

  /* Population */
  population: {
    label?: string;
    size?: number;
    known: boolean;
  };

  /* Explications destinées à l'utilisateur */
  recommendations: string[];

  /* Problèmes à vérifier */
  warnings: string[];

  /* État global */
  status:
    | "ready"
    | "needs_review"
    | "incomplete";
}


/* =========================================================
   UTILITAIRE
========================================================= */

function clean(value?: string): string {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}


/* =========================================================
   MOTEUR A3
========================================================= */

export function generateMethodologyIntelligence(
  research: ResearchData
): MethodologyIntelligenceResult {

  /* =======================================================
     1. MÉTHODOLOGIE EXISTANTE
  ======================================================= */

  const methodology =
    generateMethodology(research);


  /* =======================================================
     2. POPULATION
  ======================================================= */

  const populationLabel =
    clean(research.population) ||
    undefined;

  const populationSize =
    Number(research.populationSize) > 0
      ? Number(research.populationSize)
      : undefined;

  const populationKnown =
    populationSize !== undefined;


  /* =======================================================
     3. ÉCHANTILLONNAGE
  ======================================================= */

  const sampling =
    calculateSampleSize(
      populationSize ?? 0
    );


  /* =======================================================
     4. RECOMMANDATIONS A3
  ======================================================= */

  const recommendations: string[] = [
    ...methodology.recommendations,
  ];


  /*
   * Population connue
   */

  if (populationKnown) {

    recommendations.push(
      `La population mère renseignée est de ${populationSize} personnes.`
    );

    if (
      sampling.sampleSize !== null
    ) {

      recommendations.push(
        `ACADIA recommande un échantillon de ${sampling.sampleSize} personnes selon ${sampling.method}.`
      );

    }

  } else {

    recommendations.push(
      "La taille de la population mère doit être renseignée pour calculer automatiquement l'échantillon."
    );

  }


  /*
   * Cohérence
   */

  if (
    methodology.coherenceScore >= 80
  ) {

    recommendations.push(
      "La structure actuelle présente un niveau de cohérence satisfaisant."
    );

  } else if (
    methodology.coherenceScore >= 60
  ) {

    recommendations.push(
      "La structure est exploitable mais certains éléments méthodologiques doivent encore être vérifiés."
    );

  } else {

    recommendations.push(
      "Plusieurs éléments importants doivent encore être clarifiés avant validation."
    );

  }


  /* =======================================================
     5. AVERTISSEMENTS
  ======================================================= */

  const warnings: string[] = [
    ...methodology.warnings,
  ];


  if (
    !clean(research.title)
  ) {

    warnings.push(
      "Le sujet de recherche n'est pas renseigné."
    );

  }


  if (
    !clean(research.problem)
  ) {

    warnings.push(
      "La problématique n'est pas encore renseignée."
    );

  }


  if (
    !clean(research.objective)
  ) {

    warnings.push(
      "L'objectif général n'est pas encore renseigné."
    );

  }


  if (
    !research.objectives ||
    research.objectives.length === 0
  ) {

    warnings.push(
      "Aucun objectif spécifique n'est encore renseigné."
    );

  }


  if (
    !clean(research.population)
  ) {

    warnings.push(
      "La population d'étude n'est pas encore renseignée."
    );

  }


  if (
    !clean(research.researchType)
  ) {

    warnings.push(
      "Le type de recherche doit encore être déterminé."
    );

  }


  /* =======================================================
     6. STATUT GLOBAL
  ======================================================= */

  let status:
    | "ready"
    | "needs_review"
    | "incomplete";


  if (
    !clean(research.title) ||
    !clean(research.problem) ||
    !clean(research.objective)
  ) {

    status = "incomplete";

  } else if (
    warnings.length > 0
  ) {

    status = "needs_review";

  } else {

    status = "ready";

  }


  /* =======================================================
     7. RÉSULTAT
  ======================================================= */

  return {

    methodology,

    sampling,

    population: {

      label:
        populationLabel,

      size:
        populationSize,

      known:
        populationKnown,

    },

    recommendations,

    warnings,

    status,
  };
}