// ============================================================
// ACADIA — CONTEXTE DE RÉDACTION PAR TYPE DE SECTION (Mission 9)
//
// Un contexte par type de section génère UNIQUEMENT les champs
// pertinents (mission §31 — contrôle des coûts) : jamais le dataset
// brut, jamais l'intégralité du projet. Chaque fonction est pure et
// synchrone à l'exception de celle qui a besoin des claims (accès
// Prisma via ClaimService, déjà existant, jamais dupliqué).
// ============================================================

import type { ResearchProject, ResearchModeTag } from "@/lib/core/research/ResearchTypes";
import { buildMethodologyRecommendation, type MethodologyRecommendation } from "@/lib/core/methodology/MethodologyRecommendationEngine";
import { listClaims, claimTraceabilityStatus } from "@/lib/server/research/ClaimService";

function activeModeTags(project: ResearchProject): ResearchModeTag[] {
  return project.understanding?.researchModeTags ?? [];
}

export interface IntroductionContext {
  title: string;
  domain?: string;
  university?: string;
  level?: string;
  location?: string;
  phenomenon?: string;
  problemStatement?: string;
  researchQuestions: { id: string; text: string; type?: string }[];
  researchObjectives: { id: string; text: string; role: string }[];
  researchModeTags: ResearchModeTag[];
}

export function buildIntroductionContext(project: ResearchProject): IntroductionContext {
  return {
    title: project.title,
    domain: project.domain,
    university: project.university,
    level: project.level,
    location: project.location || project.understanding?.location,
    phenomenon: project.understanding?.phenomenon,
    problemStatement: project.problem?.statement,
    researchQuestions: project.researchQuestions.map((q) => ({ id: q.id, text: q.text, type: q.type })),
    researchObjectives: project.objectives.map((o) => ({ id: o.id, text: o.text || o.title || "", role: o.role })),
    researchModeTags: activeModeTags(project),
  };
}

export interface ProblematicContext {
  title: string;
  phenomenon?: string;
  problemStatement?: string;
  mainConcepts: string[];
  proposedRelationship?: { from: string; to: string; relation: string; description?: string };
  sourcedContext: { text: string; sourceTitle: string; sourceUrl: string }[];
  researchQuestions: { id: string; text: string; type?: string }[];
  researchModeTags: ResearchModeTag[];
}

export function buildProblematicContext(project: ResearchProject): ProblematicContext {
  return {
    title: project.title,
    phenomenon: project.understanding?.phenomenon,
    problemStatement: project.problem?.statement,
    mainConcepts: project.understanding?.mainConcepts ?? [],
    proposedRelationship: project.understanding?.proposedRelationship
      ? { ...project.understanding.proposedRelationship, relation: String(project.understanding.proposedRelationship.relation) }
      : undefined,
    sourcedContext: (project.sourcedContext ?? []).map((s) => ({ text: s.text, sourceTitle: s.sourceTitle, sourceUrl: s.sourceUrl })),
    researchQuestions: project.researchQuestions.map((q) => ({ id: q.id, text: q.text, type: q.type })),
    researchModeTags: activeModeTags(project),
  };
}

export interface MethodologyContext {
  title: string;
  level?: string;
  recommendation: MethodologyRecommendation;
  hypothesesCount: number;
  variablesCount: number;
  researchModeTags: ResearchModeTag[];
}

export function buildMethodologyContext(project: ResearchProject): MethodologyContext {
  return {
    title: project.title,
    level: project.level,
    recommendation: buildMethodologyRecommendation(project),
    hypothesesCount: project.hypotheses.length,
    variablesCount: project.variables.length,
    researchModeTags: activeModeTags(project),
  };
}

export interface LiteratureReviewContext {
  title: string;
  phenomenon?: string;
  theoreticalOrientations: { id: string; theory: string; reason: string }[];
  /** Claims déjà créés par le chercheur et reliés à une référence — jamais un claim SOURCE_NEEDED (mission §21/§37). */
  citableClaims: { id: string; text: string; referenceId: string }[];
  researchModeTags: ResearchModeTag[];
}

export async function buildLiteratureReviewContext(ownerId: string, project: ResearchProject): Promise<LiteratureReviewContext> {
  const { items } = await listClaims(ownerId, project.id, { pageSize: 200 });
  const citableClaims = items
    .filter((c) => claimTraceabilityStatus(c) === "SOURCED")
    .map((c) => ({ id: c.id, text: c.text, referenceId: c.referenceId as string }));

  return {
    title: project.title,
    phenomenon: project.understanding?.phenomenon,
    theoreticalOrientations: (project.theoreticalOrientations ?? []).map((t) => ({ id: t.id, theory: t.theory, reason: t.reason })),
    citableClaims,
    researchModeTags: activeModeTags(project),
  };
}
