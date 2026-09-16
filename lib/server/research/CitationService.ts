// ============================================================
// ACADIA — CITATION SERVICE (mission Bibliography & Reference
// Intelligence §17/§18)
//
// Résolution DÉTERMINISTE (jamais IA) : une citation (Auteur, Année)
// est reliée à une Reference du même projet uniquement si le nom de
// famille ET l'année correspondent exactement. Sinon : UNRESOLVED
// (ou AMBIGUOUS si plusieurs références correspondent) — jamais une
// résolution devinée/approximative.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { ReferenceCitation } from "@prisma/client";
import { ReferenceForbiddenError, ReferenceNotFoundError, InvalidReferenceInputError } from "@/lib/core/research/reference/ReferenceTypes";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";

async function requireOwnedProject(ownerId: string, projectId: string) {
  const project = await prisma.researchProject.findUnique({ where: { id: projectId }, select: { id: true, ownerId: true } });
  if (!project) throw new ReferenceNotFoundError("Projet introuvable.");
  if (project.ownerId !== ownerId) throw new ReferenceForbiddenError("Ce projet ne vous appartient pas.");
  return project;
}

function authorSurname(fullName: string): string {
  const parts = fullName.split(",");
  const surname = parts.length > 1 ? parts[0] : fullName.trim().split(/\s+/).pop() ?? fullName;
  return surname.trim().toLowerCase();
}

/** Extraction déterministe "(Auteur, Année)" — jamais une IA, jamais une invention si le format ne correspond pas. */
export function parseCitationText(rawText: string): { citedAuthor: string | null; citedYear: number | null } {
  const match = rawText.match(/([A-Za-zÀ-ÖØ-öø-ÿ'’\-]+)\D{0,10}(\d{4})/);
  if (!match) return { citedAuthor: null, citedYear: null };
  return { citedAuthor: match[1], citedYear: Number(match[2]) };
}

async function resolveCitationAgainstReferences(projectId: string, citedAuthor: string | null, citedYear: number | null): Promise<{ referenceId: string | null; status: "RESOLVED" | "UNRESOLVED" | "AMBIGUOUS" }> {
  if (!citedAuthor || !citedYear) return { referenceId: null, status: "UNRESOLVED" };

  const candidates = await prisma.reference.findMany({ where: { projectId, year: citedYear }, select: { id: true, authors: true } });
  const surnameNeedle = citedAuthor.trim().toLowerCase();
  const matches = candidates.filter((c) => (JSON.parse(c.authors) as string[]).some((a) => authorSurname(a) === surnameNeedle));

  if (matches.length === 1) return { referenceId: matches[0].id, status: "RESOLVED" };
  if (matches.length > 1) return { referenceId: null, status: "AMBIGUOUS" };
  return { referenceId: null, status: "UNRESOLVED" };
}

export interface CreateCitationInput {
  rawText: string;
  citedAuthor?: string | null;
  citedYear?: number | null;
}

export async function createCitation(ownerId: string, projectId: string, input: CreateCitationInput): Promise<ReferenceCitation> {
  await requireOwnedProject(ownerId, projectId);
  if (!input.rawText?.trim()) throw new InvalidReferenceInputError("Le texte de la citation est obligatoire.");

  const parsed = parseCitationText(input.rawText);
  const citedAuthor = input.citedAuthor ?? parsed.citedAuthor;
  const citedYear = input.citedYear ?? parsed.citedYear;
  const resolution = await resolveCitationAgainstReferences(projectId, citedAuthor, citedYear);

  const citation = await prisma.referenceCitation.create({
    data: {
      projectId,
      rawText: input.rawText.trim(),
      citedAuthor,
      citedYear,
      resolutionStatus: resolution.status,
      referenceId: resolution.referenceId,
    },
  });

  await logAudit({ actorId: ownerId, action: "CITATION_CREATED", entityType: "ReferenceCitation", entityId: citation.id, metadata: { projectId, resolutionStatus: resolution.status } });

  return citation;
}

export interface ListCitationsOptions {
  resolutionStatus?: "RESOLVED" | "UNRESOLVED" | "AMBIGUOUS";
  page?: number;
  pageSize?: number;
}

export async function listCitations(ownerId: string, projectId: string, options: ListCitationsOptions = {}) {
  await requireOwnedProject(ownerId, projectId);
  const page = Math.max(1, Math.trunc(options.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.trunc(options.pageSize ?? 50)));
  const where = { projectId, ...(options.resolutionStatus ? { resolutionStatus: options.resolutionStatus } : {}) };
  const [total, items] = await Promise.all([
    prisma.referenceCitation.count({ where }),
    prisma.referenceCitation.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize }),
  ]);
  return { items, total, page, pageSize };
}

// ------------------------------------------------------------
// COHÉRENCE CITATION ↔ BIBLIOGRAPHIE (mission §18, points A-E)
// Entièrement déterministe — aucune correction automatique, seulement
// un rapport que le chercheur examine et corrige lui-même.
// ------------------------------------------------------------

export interface ConsistencyReport {
  citationsWithoutReference: { citationId: string; rawText: string }[];
  referencesNeverCited: { referenceId: string; title: string }[];
  ambiguousCitations: { citationId: string; rawText: string }[];
  authorYearMismatches: { citationId: string; rawText: string; citedAuthor: string; citedYear: number; matchingReferenceId: string; matchingReferenceYear: number }[];
}

export async function checkBibliographyConsistency(ownerId: string, projectId: string): Promise<ConsistencyReport> {
  await requireOwnedProject(ownerId, projectId);

  const [citations, references] = await Promise.all([
    prisma.referenceCitation.findMany({ where: { projectId } }),
    prisma.reference.findMany({ where: { projectId }, select: { id: true, title: true, authors: true, year: true } }),
  ]);

  const citedReferenceIds = new Set(citations.filter((c) => c.referenceId).map((c) => c.referenceId as string));

  const citationsWithoutReference = citations
    .filter((c) => c.resolutionStatus === "UNRESOLVED")
    .map((c) => ({ citationId: c.id, rawText: c.rawText }));

  const referencesNeverCited = references.filter((r) => !citedReferenceIds.has(r.id)).map((r) => ({ referenceId: r.id, title: r.title }));

  const ambiguousCitations = citations.filter((c) => c.resolutionStatus === "AMBIGUOUS").map((c) => ({ citationId: c.id, rawText: c.rawText }));

  const authorYearMismatches: ConsistencyReport["authorYearMismatches"] = [];
  for (const citation of citations) {
    if (citation.resolutionStatus === "RESOLVED" || !citation.citedAuthor || !citation.citedYear) continue;
    const surnameNeedle = citation.citedAuthor.trim().toLowerCase();
    const authorMatchesDifferentYear = references.filter(
      (r) => r.year !== citation.citedYear && (JSON.parse(r.authors) as string[]).some((a) => authorSurname(a) === surnameNeedle)
    );
    for (const ref of authorMatchesDifferentYear) {
      authorYearMismatches.push({
        citationId: citation.id,
        rawText: citation.rawText,
        citedAuthor: citation.citedAuthor,
        citedYear: citation.citedYear,
        matchingReferenceId: ref.id,
        matchingReferenceYear: ref.year ?? 0,
      });
    }
  }

  await logAudit({ actorId: ownerId, action: "CITATION_CHECKED", entityType: "ResearchProject", entityId: projectId, metadata: { citationCount: citations.length, referenceCount: references.length } });
  await trackProductEvent({ userId: ownerId, projectId, eventType: "CITATION_CHECKED", metadata: { citationCount: citations.length } });

  return { citationsWithoutReference, referencesNeverCited, ambiguousCitations, authorYearMismatches };
}
