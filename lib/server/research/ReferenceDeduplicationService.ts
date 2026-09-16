// ============================================================
// ACADIA — DÉDUPLICATION DE RÉFÉRENCES (mission Bibliography &
// Reference Intelligence §15)
//
// Ne supprime JAMAIS automatiquement — signale uniquement des
// POSSIBLE_DUPLICATE que le chercheur examine et décide lui-même.
// Ordre de détection : DOI exact → ISBN exact → auteur+titre+année →
// similarité de titre (jamais l'inverse : un DOI/ISBN identique est
// une preuve forte, une similarité de titre n'est qu'un indice).
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { normalizeDoi, normalizeIsbn, normalizeAuthors, type PossibleDuplicateMatch } from "@/lib/core/research/reference/ReferenceTypes";

function normalizeTitleForComparison(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Similarité de Jaccard sur les tokens du titre — déterministe, jamais une IA (mission §15 ne l'exige pas). */
function titleSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeTitleForComparison(a).split(" ").filter(Boolean));
  const tokensB = new Set(normalizeTitleForComparison(b).split(" ").filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const t of tokensA) if (tokensB.has(t)) intersection++;
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const TITLE_SIMILARITY_THRESHOLD = 0.8;

export interface DuplicateCandidate {
  title: string;
  authors: string[];
  year?: number | null;
  doi?: string | null;
  isbn?: string | null;
}

export async function findPotentialDuplicates(projectId: string, candidate: DuplicateCandidate, excludeReferenceId?: string): Promise<PossibleDuplicateMatch[]> {
  const others = await prisma.reference.findMany({
    where: { projectId, ...(excludeReferenceId ? { id: { not: excludeReferenceId } } : {}) },
    select: { id: true, title: true, authors: true, year: true, doi: true, isbn: true },
  });

  const matches: PossibleDuplicateMatch[] = [];
  const candidateDoi = candidate.doi ? normalizeDoi(candidate.doi) : null;
  const candidateIsbn = candidate.isbn ? normalizeIsbn(candidate.isbn) : null;
  const candidateAuthors = normalizeAuthors(candidate.authors).map((a) => a.toLowerCase()).sort().join("|");
  const candidateTitleNorm = normalizeTitleForComparison(candidate.title);

  for (const other of others) {
    if (candidateDoi && other.doi && normalizeDoi(other.doi) === candidateDoi) {
      matches.push({ referenceId: other.id, reason: "DOI", score: 1 });
      continue;
    }
    if (candidateIsbn && other.isbn && normalizeIsbn(other.isbn) === candidateIsbn) {
      matches.push({ referenceId: other.id, reason: "ISBN", score: 1 });
      continue;
    }
    const otherAuthors = normalizeAuthors(JSON.parse(other.authors) as string[])
      .map((a) => a.toLowerCase())
      .sort()
      .join("|");
    if (candidate.year && other.year === candidate.year && candidateAuthors && otherAuthors === candidateAuthors && normalizeTitleForComparison(other.title) === candidateTitleNorm) {
      matches.push({ referenceId: other.id, reason: "AUTHOR_TITLE_YEAR", score: 1 });
      continue;
    }
    const similarity = titleSimilarity(candidate.title, other.title);
    if (similarity >= TITLE_SIMILARITY_THRESHOLD) {
      matches.push({ referenceId: other.id, reason: "TITLE_SIMILARITY", score: similarity });
    }
  }

  return matches;
}
