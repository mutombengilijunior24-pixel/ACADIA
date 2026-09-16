// ============================================================
// ACADIA — REFERENCE SERVICE (mission Bibliography & Reference
// Intelligence)
//
// Même discipline d'ownership que ResearchStateService.ts : chaque
// fonction reçoit `ownerId` dérivé de la session (jamais du client) et
// revérifie `project.ownerId !== ownerId` avant toute lecture/écriture
// — un Reference n'est jamais accessible en dehors du projet auquel il
// appartient, et un projet n'est jamais accessible en dehors de son
// propriétaire.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { Prisma, type Reference } from "@prisma/client";
import {
  ReferenceForbiddenError,
  ReferenceNotFoundError,
  ReferenceInUseError,
  InvalidReferenceInputError,
  normalizeAuthors,
  normalizeDoi,
  normalizeIsbn,
  normalizeUrl,
  normalizeYear,
  normalizePages,
  DEFAULT_VERIFICATION_STATUS_BY_PROVENANCE,
  type ReferenceInput,
  type ReferenceSourceType,
  type ReferenceVerificationStatus,
} from "@/lib/core/research/reference/ReferenceTypes";
import { findPotentialDuplicates } from "./ReferenceDeduplicationService";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import type { PossibleDuplicateMatch } from "@/lib/core/research/reference/ReferenceTypes";

export async function requireOwnedProject(ownerId: string, projectId: string) {
  const project = await prisma.researchProject.findUnique({ where: { id: projectId }, select: { id: true, ownerId: true } });
  if (!project) throw new ReferenceNotFoundError("Projet introuvable.");
  if (project.ownerId !== ownerId) {
    await logAudit({ actorId: ownerId, action: "ACCESS_DENIED", entityType: "ResearchProject", entityId: projectId, metadata: { reason: "not_owner" } });
    throw new ReferenceForbiddenError("Ce projet ne vous appartient pas.");
  }
  return project;
}

async function requireOwnedReference(ownerId: string, projectId: string, referenceId: string): Promise<Reference> {
  await requireOwnedProject(ownerId, projectId);
  const reference = await prisma.reference.findUnique({ where: { id: referenceId } });
  if (!reference || reference.projectId !== projectId) throw new ReferenceNotFoundError("Référence introuvable.");
  return reference;
}

function validateInput(input: ReferenceInput): void {
  if (!input.title?.trim()) throw new InvalidReferenceInputError("Le titre est obligatoire.");
  if (input.aiConfidence !== undefined && input.aiConfidence !== null && input.provenance !== "AI_PROPOSED") {
    throw new InvalidReferenceInputError("aiConfidence ne peut être défini que pour une référence provenance=AI_PROPOSED.");
  }
  if (input.aiConfidence !== undefined && input.aiConfidence !== null && (input.aiConfidence < 0 || input.aiConfidence > 1)) {
    throw new InvalidReferenceInputError("aiConfidence doit être compris entre 0 et 1.");
  }
}

function toReferenceRecord(input: ReferenceInput, projectId: string) {
  const year = input.year !== undefined ? normalizeYear(input.year) : null;
  return {
    projectId,
    title: input.title.trim(),
    authors: JSON.stringify(normalizeAuthors(input.authors ?? [])),
    year,
    sourceType: input.sourceType,
    journal: input.journal?.trim() || null,
    publisher: input.publisher?.trim() || null,
    volume: input.volume?.trim() || null,
    issue: input.issue?.trim() || null,
    pages: input.pages ? normalizePages(input.pages) : null,
    doi: input.doi ? normalizeDoi(input.doi) : null,
    isbn: input.isbn ? normalizeIsbn(input.isbn) : null,
    url: input.url ? normalizeUrl(input.url) : null,
    language: input.language?.trim() || null,
    verificationStatus: DEFAULT_VERIFICATION_STATUS_BY_PROVENANCE[input.provenance],
    provenance: input.provenance,
    aiConfidence: input.aiConfidence ?? null,
    rawImportData: input.rawImportData ?? null,
  };
}

export interface CreateReferenceResult {
  reference: Reference;
  possibleDuplicates: PossibleDuplicateMatch[];
}

export async function createReference(ownerId: string, projectId: string, input: ReferenceInput): Promise<CreateReferenceResult> {
  await requireOwnedProject(ownerId, projectId);
  validateInput(input);

  const possibleDuplicates = await findPotentialDuplicates(projectId, {
    title: input.title,
    authors: input.authors ?? [],
    year: input.year,
    doi: input.doi,
    isbn: input.isbn,
  });

  const reference = await prisma.reference.create({ data: toReferenceRecord(input, projectId) });

  await logAudit({ actorId: ownerId, action: "REFERENCE_CREATED", entityType: "Reference", entityId: reference.id, metadata: { projectId, provenance: input.provenance, sourceType: input.sourceType } });
  await trackProductEvent({ userId: ownerId, projectId, eventType: "REFERENCE_CREATED", metadata: { referenceId: reference.id } });
  if (possibleDuplicates.length > 0) {
    await logAudit({ actorId: ownerId, action: "DUPLICATE_DETECTED", entityType: "Reference", entityId: reference.id, metadata: { count: possibleDuplicates.length } });
    await trackProductEvent({ userId: ownerId, projectId, eventType: "DUPLICATE_DETECTED", metadata: { referenceId: reference.id, count: possibleDuplicates.length } });
  }

  return { reference, possibleDuplicates };
}

export interface UpdateReferenceInput extends Partial<ReferenceInput> {
  /** Décision humaine explicite de vérification — jamais déduite automatiquement d'une autre action. */
  verificationStatus?: ReferenceVerificationStatus;
}

export async function updateReference(ownerId: string, projectId: string, referenceId: string, patch: UpdateReferenceInput): Promise<Reference> {
  const existing = await requireOwnedReference(ownerId, projectId, referenceId);

  if (patch.aiConfidence !== undefined && patch.aiConfidence !== null) {
    const provenance = patch.provenance ?? existing.provenance;
    if (provenance !== "AI_PROPOSED") throw new InvalidReferenceInputError("aiConfidence ne peut être défini que pour une référence provenance=AI_PROPOSED.");
    if (patch.aiConfidence < 0 || patch.aiConfidence > 1) throw new InvalidReferenceInputError("aiConfidence doit être compris entre 0 et 1.");
  }

  const data: Prisma.ReferenceUpdateInput = {};
  if (patch.title !== undefined) {
    if (!patch.title.trim()) throw new InvalidReferenceInputError("Le titre est obligatoire.");
    data.title = patch.title.trim();
  }
  if (patch.authors !== undefined) data.authors = JSON.stringify(normalizeAuthors(patch.authors));
  if (patch.year !== undefined) data.year = normalizeYear(patch.year);
  if (patch.sourceType !== undefined) data.sourceType = patch.sourceType;
  if (patch.journal !== undefined) data.journal = patch.journal?.trim() || null;
  if (patch.publisher !== undefined) data.publisher = patch.publisher?.trim() || null;
  if (patch.volume !== undefined) data.volume = patch.volume?.trim() || null;
  if (patch.issue !== undefined) data.issue = patch.issue?.trim() || null;
  if (patch.pages !== undefined) data.pages = patch.pages ? normalizePages(patch.pages) : null;
  if (patch.doi !== undefined) data.doi = patch.doi ? normalizeDoi(patch.doi) : null;
  if (patch.isbn !== undefined) data.isbn = patch.isbn ? normalizeIsbn(patch.isbn) : null;
  if (patch.url !== undefined) data.url = patch.url ? normalizeUrl(patch.url) : null;
  if (patch.language !== undefined) data.language = patch.language?.trim() || null;
  if (patch.aiConfidence !== undefined) data.aiConfidence = patch.aiConfidence;

  const verificationChanged = patch.verificationStatus !== undefined && patch.verificationStatus !== existing.verificationStatus;
  if (patch.verificationStatus !== undefined) data.verificationStatus = patch.verificationStatus;

  const updated = await prisma.reference.update({ where: { id: referenceId }, data });

  await logAudit({ actorId: ownerId, action: "REFERENCE_UPDATED", entityType: "Reference", entityId: referenceId, metadata: { projectId } });
  if (verificationChanged) {
    await logAudit({ actorId: ownerId, action: "REFERENCE_VERIFICATION_CHANGED", entityType: "Reference", entityId: referenceId, metadata: { from: existing.verificationStatus, to: patch.verificationStatus } });
  }

  return updated;
}

export async function getReference(ownerId: string, projectId: string, referenceId: string): Promise<Reference> {
  return requireOwnedReference(ownerId, projectId, referenceId);
}

export interface ListReferencesOptions {
  search?: string;
  sourceType?: ReferenceSourceType;
  verificationStatus?: ReferenceVerificationStatus;
  page?: number;
  pageSize?: number;
}

export interface ListReferencesResult {
  items: Reference[];
  total: number;
  page: number;
  pageSize: number;
}

/** Pagination serveur (mission §35) — jamais toute la bibliothèque chargée d'un coup. */
export async function listReferences(ownerId: string, projectId: string, options: ListReferencesOptions = {}): Promise<ListReferencesResult> {
  await requireOwnedProject(ownerId, projectId);

  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.trunc(options.pageSize ?? 25)));

  const where: Prisma.ReferenceWhereInput = {
    projectId,
    ...(options.sourceType ? { sourceType: options.sourceType } : {}),
    ...(options.verificationStatus ? { verificationStatus: options.verificationStatus } : {}),
    ...(options.search?.trim()
      ? {
          OR: [
            { title: { contains: options.search.trim(), mode: "insensitive" } },
            { authors: { contains: options.search.trim(), mode: "insensitive" } },
            { doi: { contains: options.search.trim(), mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, items] = await Promise.all([
    prisma.reference.count({ where }),
    prisma.reference.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);

  return { items, total, page, pageSize };
}

/**
 * Suppression bloquée explicitement si la référence est encore utilisée
 * (mission §30) — jamais un soft-delete silencieux, jamais une
 * suppression en cascade des citations/claims qui en dépendent.
 */
export async function deleteReference(ownerId: string, projectId: string, referenceId: string): Promise<void> {
  await requireOwnedReference(ownerId, projectId, referenceId);

  const [citationCount, claimCount, duplicateLinkCount] = await Promise.all([
    prisma.referenceCitation.count({ where: { referenceId } }),
    prisma.researchClaim.count({ where: { referenceId } }),
    prisma.reference.count({ where: { duplicateOfId: referenceId } }),
  ]);

  if (citationCount > 0 || claimCount > 0 || duplicateLinkCount > 0) {
    throw new ReferenceInUseError(
      `Impossible de supprimer cette référence : utilisée par ${citationCount} citation(s), ${claimCount} claim(s), ${duplicateLinkCount} référence(s) marquée(s) doublon.`
    );
  }

  await prisma.reference.delete({ where: { id: referenceId } });
  await logAudit({ actorId: ownerId, action: "REFERENCE_DELETED", entityType: "Reference", entityId: referenceId, metadata: { projectId } });
}

/**
 * Toutes les références d'un projet, SANS pagination — réservé à la
 * génération de bibliographie/export (mission §24/§34), une opération
 * volontairement exhaustive et ponctuelle, distincte du parcours/
 * recherche paginé de `listReferences` (mission §35). Fonction UNIQUE
 * réutilisée par la génération formatée et les deux exports (BibTeX/CSV)
 * — jamais une requête réécrite par format (mission §34).
 */
export async function listAllReferences(ownerId: string, projectId: string): Promise<Reference[]> {
  await requireOwnedProject(ownerId, projectId);
  return prisma.reference.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
}

export { findPotentialDuplicates };
