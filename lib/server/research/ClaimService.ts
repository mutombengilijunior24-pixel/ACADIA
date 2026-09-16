// ============================================================
// ACADIA — CLAIM SERVICE (mission Bibliography & Reference
// Intelligence §21/§48)
//
// Préparatoire (traçabilité CLAIM → SOURCE → REFERENCE, utile pour un
// futur RAG — mission §48) : CRUD minimal volontaire. Le texte d'un
// claim est TOUJOURS saisi par le chercheur — jamais généré ou proposé
// par l'IA dans cette mission (mission §21 : "NE JAMAIS fabriquer une
// citation pour rendre une phrase plus académique").
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { ResearchClaim } from "@prisma/client";
import { ReferenceForbiddenError, ReferenceNotFoundError, InvalidReferenceInputError } from "@/lib/core/research/reference/ReferenceTypes";
import { logAudit } from "@/lib/server/audit/AuditLog";

async function requireOwnedProject(ownerId: string, projectId: string) {
  const project = await prisma.researchProject.findUnique({ where: { id: projectId }, select: { id: true, ownerId: true } });
  if (!project) throw new ReferenceNotFoundError("Projet introuvable.");
  if (project.ownerId !== ownerId) throw new ReferenceForbiddenError("Ce projet ne vous appartient pas.");
  return project;
}

export async function createClaim(ownerId: string, projectId: string, text: string, referenceId?: string | null): Promise<ResearchClaim> {
  await requireOwnedProject(ownerId, projectId);
  if (!text?.trim()) throw new InvalidReferenceInputError("Le texte du claim est obligatoire.");

  if (referenceId) {
    const reference = await prisma.reference.findUnique({ where: { id: referenceId } });
    if (!reference || reference.projectId !== projectId) throw new ReferenceNotFoundError("Référence introuvable pour ce projet.");
  }

  const claim = await prisma.researchClaim.create({ data: { projectId, text: text.trim(), referenceId: referenceId ?? null } });
  await logAudit({ actorId: ownerId, action: "CLAIM_CREATED", entityType: "ResearchClaim", entityId: claim.id, metadata: { projectId, hasReference: !!referenceId } });
  return claim;
}

export async function linkClaimToReference(ownerId: string, projectId: string, claimId: string, referenceId: string | null): Promise<ResearchClaim> {
  await requireOwnedProject(ownerId, projectId);
  const claim = await prisma.researchClaim.findUnique({ where: { id: claimId } });
  if (!claim || claim.projectId !== projectId) throw new ReferenceNotFoundError("Claim introuvable.");

  if (referenceId) {
    const reference = await prisma.reference.findUnique({ where: { id: referenceId } });
    if (!reference || reference.projectId !== projectId) throw new ReferenceNotFoundError("Référence introuvable pour ce projet.");
  }

  return prisma.researchClaim.update({ where: { id: claimId }, data: { referenceId } });
}

export interface ListClaimsOptions {
  page?: number;
  pageSize?: number;
}

export async function listClaims(ownerId: string, projectId: string, options: ListClaimsOptions = {}) {
  await requireOwnedProject(ownerId, projectId);
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.trunc(options.pageSize ?? 50)));
  const [total, items] = await Promise.all([
    prisma.researchClaim.count({ where: { projectId } }),
    prisma.researchClaim.findMany({ where: { projectId }, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { items, total, page, pageSize };
}

/** "Source à ajouter ou vérifier" (mission §21) — jamais une fausse source pour combler l'absence. */
export function claimTraceabilityStatus(claim: ResearchClaim): "SOURCED" | "SOURCE_NEEDED" {
  return claim.referenceId ? "SOURCED" : "SOURCE_NEEDED";
}

/**
 * Mission 9 (Research Writing Engine) — enregistre qu'un claim déjà
 * existant a été RÉUTILISÉ par une section de rédaction. N'écrit
 * jamais le texte d'un claim (toujours saisi par le chercheur, voir
 * createClaim ci-dessus) — seulement une trace de réutilisation, pour
 * qu'une future vue "où ce claim est-il cité" (module Bibliographie)
 * reste possible sans reparcourir tous les WritingSection en JSON.
 * Ignore silencieusement un claimId qui n'appartient pas à ce projet
 * (ne bloque jamais la persistance d'une section pour cette raison —
 * le garde-fou anti-hallucination, lui, bloque déjà les claimIds
 * inconnus avant d'arriver ici).
 */
export async function markClaimsUsedInSection(projectId: string, claimIds: string[], sectionId: string): Promise<void> {
  if (claimIds.length === 0) return;
  await prisma.researchClaim.updateMany({
    where: { id: { in: claimIds }, projectId },
    data: { sectionId, claimType: "citation" },
  });
}
