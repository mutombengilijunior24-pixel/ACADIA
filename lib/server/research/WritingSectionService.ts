// ============================================================
// ACADIA — SERVICE DE RÉDACTION SCIENTIFIQUE (Mission 9)
//
// Orchestre génération/édition/validation/régénération d'une section
// de rédaction. Réutilise strictement ResearchStateService (accès
// payload), WritingContextBuilder (contexte minimal par type),
// ResearchWritingAI (4 types génératifs) ou WritingAdapters (3 types
// adaptateurs, zéro appel OpenAI) et WritingGuard (garde-fou). Chaque
// transition (génération/édition/régénération/validation/rejet) est
// tracée par une NOUVELLE entrée dans section.versions — jamais
// écrasée, même discipline que scientificInterpretations/
// scientificConclusions.
// ============================================================

import { randomUUID } from "crypto";
import { getResearchProjectRecord, upsertWritingSectionRecord } from "@/lib/server/research/ResearchStateService";
import {
  buildIntroductionContext,
  buildProblematicContext,
  buildMethodologyContext,
  buildLiteratureReviewContext,
} from "@/lib/server/research/WritingContextBuilder";
import { generateWritingSection as callWritingAI, type WritingSectionKind, type AIWritingBlock } from "@/lib/ai/openai/ResearchWritingAI";
import { buildDiscussionBlocks, buildConclusionBlocks, buildRecommendationsBlocks } from "@/lib/core/writing/WritingAdapters";
import { runWritingGuards } from "@/lib/core/writing/WritingGuard";
import { buildWritingCoherenceReport } from "@/lib/core/writing/WritingCoherenceEngine";
import {
  WRITING_SECTION_LABELS,
  AI_GENERATED_SECTION_TYPES,
  type WritingSection,
  type WritingSectionType,
  type WritingBlock,
  type WritingSectionVersion,
  type WritingCoherenceReport,
} from "@/lib/core/writing/WritingTypes";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import { markClaimsUsedInSection, listClaims, claimTraceabilityStatus } from "@/lib/server/research/ClaimService";
import type { ResearchClaim } from "@prisma/client";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";

export class WritingNotFoundError extends Error {}
export class WritingForbiddenError extends Error {}
export class WritingConflictError extends Error {}

async function requireOwnedRecord(ownerId: string, projectId: string) {
  const record = await getResearchProjectRecord(projectId);
  if (!record) throw new WritingNotFoundError("Projet introuvable.");
  if (record.ownerId !== ownerId) throw new WritingForbiddenError("Ce projet ne vous appartient pas.");
  return record;
}

function toWritingBlocks(aiBlocks: AIWritingBlock[]): WritingBlock[] {
  return aiBlocks.map((b) => ({
    id: randomUUID(),
    type: b.type,
    text: b.text,
    items: b.type === "LIST" ? b.items : undefined,
    level: b.type === "HEADING" && (b.level === 2 || b.level === 3) ? b.level : undefined,
    claimIds: b.claimIds.length > 0 ? b.claimIds : undefined,
    hasPlaceholder: b.type === "NOTE" || undefined,
  }));
}

function collectClaimIds(blocks: WritingBlock[]): string[] {
  return [...new Set(blocks.flatMap((b) => b.claimIds ?? []))];
}

function toAIWritingBlocks(blocks: WritingBlock[]): AIWritingBlock[] {
  return blocks.map((b) => ({ type: b.type, text: b.text, items: b.items ?? [], level: b.level ?? 0, claimIds: b.claimIds ?? [] }));
}

async function generateBlocksForType(
  ownerId: string,
  project: ResearchProject,
  type: WritingSectionType,
  tracking: { userId?: string; projectId?: string; correlationId?: string }
): Promise<{ blocks: WritingBlock[]; source: WritingSectionVersion["source"]; model?: string; guardWarnings?: string[] }> {
  if (AI_GENERATED_SECTION_TYPES.includes(type)) {
    const kind = type as WritingSectionKind;
    const context =
      kind === "INTRODUCTION"
        ? buildIntroductionContext(project)
        : kind === "PROBLEMATIC"
          ? buildProblematicContext(project)
          : kind === "METHODOLOGY"
            ? buildMethodologyContext(project)
            : await buildLiteratureReviewContext(ownerId, project);

    const result = await callWritingAI(kind, context, tracking);
    const validClaimIds = "citableClaims" in context ? context.citableClaims.map((c) => c.id) : [];
    const knownNumbers =
      kind === "METHODOLOGY" && "recommendation" in context
        ? [context.recommendation.sampleSize.value, context.recommendation.readinessPercent].filter((n): n is number => typeof n === "number")
        : undefined;
    const violations = runWritingGuards(result.blocks, validClaimIds, knownNumbers);

    return {
      blocks: toWritingBlocks(result.blocks),
      source: "ai_generated",
      model: result.model,
      guardWarnings: violations.length > 0 ? violations.map((v) => v.reason) : undefined,
    };
  }

  const blocks = type === "DISCUSSION" ? buildDiscussionBlocks(project) : type === "CONCLUSION" ? buildConclusionBlocks(project) : buildRecommendationsBlocks(project);
  return { blocks, source: "adapter" };
}

export interface GenerateOptions {
  userId: string;
  correlationId?: string;
}

async function generateOrRegenerate(
  projectId: string,
  type: WritingSectionType,
  options: GenerateOptions,
  isRegeneration: boolean
): Promise<WritingSection> {
  const record = await requireOwnedRecord(options.userId, projectId);
  const existing = (record.project.writingSections ?? []).find((s) => s.type === type);
  if (isRegeneration && !existing) throw new WritingNotFoundError("Aucune section existante à régénérer — utilisez la génération initiale.");

  const { blocks, source, model, guardWarnings } = await generateBlocksForType(options.userId, record.project, type, {
    userId: options.userId,
    projectId,
    correlationId: options.correlationId,
  });

  const now = new Date().toISOString();
  const version: WritingSectionVersion = {
    id: randomUUID(),
    status: "AI_PROPOSED",
    blocks,
    source: isRegeneration ? "regeneration" : source,
    model,
    guardWarnings,
    createdAt: now,
  };

  const section: WritingSection = {
    id: existing?.id ?? randomUUID(),
    projectId,
    type,
    title: WRITING_SECTION_LABELS[type],
    status: "AI_PROPOSED",
    blocks,
    researchModeTags: record.project.understanding?.researchModeTags,
    sourceClaimIds: collectClaimIds(blocks),
    guardWarnings,
    versions: [...(existing?.versions ?? []), version],
    generatedAt: existing?.generatedAt ?? now,
    updatedAt: now,
  };

  const saved = await upsertWritingSectionRecord(options.userId, projectId, section);
  if (!saved) throw new WritingNotFoundError("Projet introuvable.");
  await markClaimsUsedInSection(projectId, section.sourceClaimIds, section.id);

  const action = isRegeneration ? "WRITING_SECTION_REGENERATED" : "WRITING_SECTION_GENERATED";
  await logAudit({ actorId: options.userId, action, entityType: "ResearchProject", entityId: projectId, metadata: { sectionType: type, sectionId: section.id, source } });
  await trackProductEvent({ userId: options.userId, projectId, eventType: action, metadata: { sectionType: type } });

  return saved;
}

export async function generateSection(projectId: string, type: WritingSectionType, options: GenerateOptions): Promise<WritingSection> {
  return generateOrRegenerate(projectId, type, options, false);
}

export async function regenerateSection(projectId: string, type: WritingSectionType, options: GenerateOptions): Promise<WritingSection> {
  return generateOrRegenerate(projectId, type, options, true);
}

/** Variante adressée par sectionId (routes REST `/writing/[sectionId]/regenerate`) — résout le type depuis la section existante, jamais depuis l'entrée utilisateur. */
export async function regenerateSectionById(projectId: string, sectionId: string, options: GenerateOptions): Promise<WritingSection> {
  const record = await requireOwnedRecord(options.userId, projectId);
  const existing = (record.project.writingSections ?? []).find((s) => s.id === sectionId);
  if (!existing) throw new WritingNotFoundError("Section introuvable.");
  return generateOrRegenerate(projectId, existing.type, options, true);
}

export async function listSections(ownerId: string, projectId: string): Promise<WritingSection[]> {
  const record = await requireOwnedRecord(ownerId, projectId);
  return record.project.writingSections ?? [];
}

export async function editSection(ownerId: string, projectId: string, sectionId: string, blocks: WritingBlock[]): Promise<WritingSection> {
  const record = await requireOwnedRecord(ownerId, projectId);
  const existing = (record.project.writingSections ?? []).find((s) => s.id === sectionId);
  if (!existing) throw new WritingNotFoundError("Section introuvable.");

  // Même discipline que interpretation/[interpretationId]/route.ts (Mission 6,
  // incrément 4) : une édition humaine repasse par le même garde-fou qu'une
  // prose IA — jamais bloquante, seulement signalée (guardWarnings).
  const { items: allClaims } = await listClaims(ownerId, projectId, { pageSize: 200 });
  const validClaimIds = allClaims.filter((c: ResearchClaim) => claimTraceabilityStatus(c) === "SOURCED").map((c: ResearchClaim) => c.id);
  const violations = runWritingGuards(toAIWritingBlocks(blocks), validClaimIds);

  const now = new Date().toISOString();
  const version: WritingSectionVersion = { id: randomUUID(), status: "USER_EDITED", blocks, source: "user_edit", guardWarnings: violations.length > 0 ? violations.map((v) => v.reason) : undefined, createdAt: now };
  const section: WritingSection = {
    ...existing,
    status: "USER_EDITED",
    blocks,
    sourceClaimIds: collectClaimIds(blocks),
    guardWarnings: violations.length > 0 ? violations.map((v) => v.reason) : undefined,
    versions: [...existing.versions, version],
    updatedAt: now,
  };

  const saved = await upsertWritingSectionRecord(ownerId, projectId, section);
  if (!saved) throw new WritingNotFoundError("Projet introuvable.");
  await markClaimsUsedInSection(projectId, section.sourceClaimIds, section.id);

  await logAudit({ actorId: ownerId, action: "WRITING_SECTION_EDITED", entityType: "ResearchProject", entityId: projectId, metadata: { sectionType: existing.type, sectionId } });
  await trackProductEvent({ userId: ownerId, projectId, eventType: "WRITING_SECTION_EDITED", metadata: { sectionType: existing.type } });

  return saved;
}

export async function setSectionStatus(
  ownerId: string,
  projectId: string,
  sectionId: string,
  status: "VALIDATED" | "REJECTED"
): Promise<WritingSection> {
  const record = await requireOwnedRecord(ownerId, projectId);
  const existing = (record.project.writingSections ?? []).find((s) => s.id === sectionId);
  if (!existing) throw new WritingNotFoundError("Section introuvable.");

  const now = new Date().toISOString();
  const version: WritingSectionVersion = { id: randomUUID(), status, blocks: existing.blocks, source: existing.versions[existing.versions.length - 1]?.source ?? "adapter", createdAt: now };
  const section: WritingSection = { ...existing, status, versions: [...existing.versions, version], updatedAt: now };

  const saved = await upsertWritingSectionRecord(ownerId, projectId, section);
  if (!saved) throw new WritingNotFoundError("Projet introuvable.");

  const action = status === "VALIDATED" ? "WRITING_SECTION_VALIDATED" : "WRITING_SECTION_REJECTED";
  await logAudit({ actorId: ownerId, action, entityType: "ResearchProject", entityId: projectId, metadata: { sectionType: existing.type, sectionId } });
  await trackProductEvent({ userId: ownerId, projectId, eventType: action, metadata: { sectionType: existing.type } });

  return saved;
}

export async function checkCoherence(ownerId: string, projectId: string): Promise<WritingCoherenceReport> {
  const record = await requireOwnedRecord(ownerId, projectId);
  const report = buildWritingCoherenceReport(record.project, record.project.writingSections ?? []);

  await logAudit({ actorId: ownerId, action: "WRITING_COHERENCE_CHECKED", entityType: "ResearchProject", entityId: projectId, metadata: { issueCount: report.issues.length } });
  await trackProductEvent({ userId: ownerId, projectId, eventType: "WRITING_COHERENCE_CHECKED", metadata: { issueCount: report.issues.length } });

  return report;
}
