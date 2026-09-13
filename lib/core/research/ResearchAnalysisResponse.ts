// ============================================================
// ACADIA — CONTRAT SERVEUR CENTRAL : ResearchAnalysisResponse
// (mission Server Contracts & Research Persistence)
//
// Enveloppe STABLE, suffisamment riche pour alimenter Preview,
// Dashboard, Méthodologie, Questionnaire, Collecte, Analyse,
// Rédaction et Soutenance — sans qu'aucune de ces interfaces n'ait à
// connaître la forme interne de ResearchProject.payload.
//
// Ne remplace ni ResearchIntelligenceResult (résultat d'ORCHESTRATION
// ÉPHÉMÈRE d'un seul appel A1+A2, lib/core/research/ResearchIntelligenceEngine.ts)
// ni ResearchProject (structure de PERSISTANCE complète) — c'est la
// vue RECOMPOSÉE, versionnée, destinée aux appelants externes
// (routes API, futures interfaces). methodologyRecommendation et
// consistency sont TOUJOURS recalculés ici, jamais persistés en
// double (voir ResearchTypes.ts, ResearchAnalysisVersion).
//
// Rétrocompatibilité : un ResearchProject créé avant cette mission
// n'a pas de `analysisHistory` — buildResearchAnalysisResponse
// synthétise alors une version 1 "fantôme" à partir du seul
// `understanding` déjà présent, pour que le contrat reste toujours
// bien formé, y compris pour les anciens projets.
// ============================================================

import type {
  ResearchProject,
  ResearchAnalysisVersion,
  AnalysisValidationState,
  ProvenanceTag,
} from "./ResearchTypes";

import {
  buildMethodologyRecommendation,
  type MethodologyRecommendation,
} from "@/lib/core/methodology/MethodologyRecommendationEngine";

import {
  checkResearchConsistency,
  type ResearchConsistencyResult,
} from "./ResearchConsistencyEngine";

// ------------------------------------------------------------
// RÉSUMÉ LÉGER D'UNE VERSION (jamais le contenu complet) — évite de
// retourner des données inutiles dans une liste d'historique (mission
// §2 : "ne pas retourner de données inutiles"). Le contenu complet
// d'une version n'est disponible que pour `currentVersion`.
// ------------------------------------------------------------

export interface ResearchAnalysisVersionSummary {
  id: string;
  version: number;
  parentVersion?: number;
  engineVersion?: string;
  model?: string;
  provenance: ProvenanceTag;
  validation: AnalysisValidationState;
  createdAt: string;
  variableCount: number;
  hypothesesAddedCount: number;
}

export interface ResearchAnalysisResponse {
  subject: string;
  researchType?: string;
  currentVersion: ResearchAnalysisVersion;
  history: ResearchAnalysisVersionSummary[];
  methodologyRecommendation: MethodologyRecommendation;
  consistency: ResearchConsistencyResult;
}

function summarize(version: ResearchAnalysisVersion): ResearchAnalysisVersionSummary {
  return {
    id: version.id,
    version: version.version,
    parentVersion: version.parentVersion,
    engineVersion: version.engineVersion,
    model: version.model,
    provenance: version.provenance,
    validation: version.validation,
    createdAt: version.createdAt,
    variableCount: version.variables.length,
    hypothesesAddedCount: version.hypothesesAdded.length,
  };
}

/**
 * Synthétise une version 1 "fantôme" pour un projet antérieur à cette
 * mission (aucun `analysisHistory`) — JAMAIS écrite en base par cette
 * fonction (lecture seule) : la première vraie écriture dans
 * `analysisHistory` se fera à la prochaine analyse en profondeur
 * (voir deep-analysis/route.ts), sans perte de ce qui existait déjà.
 */
function synthesizeLegacyVersion(project: ResearchProject): ResearchAnalysisVersion | null {
  if (!project.understanding) return null;

  return {
    id: `legacy-${project.id}`,
    version: 1,
    engineVersion: project.understanding.engineVersion,
    provenance: "AI_INFERENCE",
    // "generated" par défaut : on ne peut pas savoir rétroactivement
    // si un ancien projet a été explicitement validé — jamais présumer
    // une validation qui n'a pas eu lieu.
    validation: "generated",
    createdAt: project.metadata?.updatedAt ?? project.metadata?.createdAt ?? new Date().toISOString(),
    understanding: project.understanding,
    variables: project.variables ?? [],
    relations: project.relations ?? [],
    hypothesesAdded: project.hypotheses ?? [],
  };
}

export function buildResearchAnalysisResponse(project: ResearchProject): ResearchAnalysisResponse {
  const history = project.analysisHistory ?? [];
  const current = history[history.length - 1] ?? synthesizeLegacyVersion(project);

  if (!current) {
    throw new Error(
      "Impossible de construire ResearchAnalysisResponse : ce projet n'a encore aucune analyse (ni analysisHistory, ni understanding)."
    );
  }

  // `history` inclut toujours la version courante (réelle ou
  // synthétisée) — un appelant qui parcourt `history` n'a jamais
  // besoin de savoir si `currentVersion` en fait déjà partie.
  const fullHistory = history.length > 0 ? history : [current];

  return {
    subject: project.title,
    researchType: project.researchType,
    currentVersion: current,
    history: fullHistory.map(summarize),
    methodologyRecommendation: buildMethodologyRecommendation(project),
    consistency: checkResearchConsistency(project),
  };
}

/**
 * true si le projet a au moins une analyse exploitable (historique
 * réel OU understanding hérité d'avant cette mission) — utilisé par
 * les routes pour décider d'appeler buildResearchAnalysisResponse
 * sans risquer l'exception ci-dessus.
 */
export function hasAnalyzableUnderstanding(project: ResearchProject): boolean {
  return (project.analysisHistory?.length ?? 0) > 0 || Boolean(project.understanding);
}
