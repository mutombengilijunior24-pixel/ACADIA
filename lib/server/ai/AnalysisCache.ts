// ============================================================
// ACADIA — CACHE D'ANALYSES GÉNÉRIQUES (mission Security + AI Cost Foundation)
//
// RÈGLE DE SÉCURITÉ ABSOLUE (mission §6) : ne jamais mélanger dans un
// cache partagé des données privées (documents, notes de projet,
// informations personnelles) avec du contenu générique. Ce module
// n'est donc appelé QUE là où l'entrée est strictement un sujet en
// texte libre, sans aucune donnée de projet/utilisateur — voir
// app/api/preview/route.ts, seul appelant actuel.
//
// A1 (SubjectUnderstandingAI), le questionnaire, l'interprétation, la
// conclusion NE PASSENT PAS par ce cache : leur entrée inclut des
// informations spécifiques au chercheur/projet (population, lieu,
// données collectées...) — les mettre en cache global risquerait de
// renvoyer la compréhension ou l'analyse D'UN AUTRE chercheur.
// ============================================================

import { createHash } from "node:crypto";
import { prisma } from "@/lib/server/db/prisma";
import type { AIOperation } from "./AIUsageLedger";

/**
 * Normalisation prudente d'un sujet en texte libre avant hachage :
 * espaces/casse uniquement — ne touche jamais aux accents ni à
 * l'orthographe (une normalisation linguistique agressive risquerait
 * de fusionner deux sujets réellement différents).
 */
export function normalizeSubjectForCache(subject: string): string {
  return subject
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[""''«»]/g, '"')
    .replace(/[.]{2,}/g, ".");
}

export function computeCacheKey(operation: AIOperation, normalizedInput: string): string {
  return createHash("sha256").update(`${operation}:${normalizedInput}`).digest("hex");
}

export interface CachedAnalysis<T> {
  result: T;
  cacheKey: string;
}

export async function getCachedAnalysis<T>(
  operation: AIOperation,
  rawInput: string
): Promise<CachedAnalysis<T> | null> {
  const normalized = normalizeSubjectForCache(rawInput);
  const cacheKey = computeCacheKey(operation, normalized);

  try {
    const hit = await prisma.genericAnalysisCache.findUnique({ where: { cacheKey } });
    if (!hit) return null;

    // Best-effort : ne bloque jamais le retour du résultat mis en
    // cache si la mise à jour du compteur échoue.
    void prisma.genericAnalysisCache
      .update({ where: { cacheKey }, data: { hitCount: { increment: 1 }, lastHitAt: new Date() } })
      .catch((error) => console.error("[ACADIA] Erreur mise à jour hitCount cache :", error));

    return { result: JSON.parse(hit.resultJson) as T, cacheKey };
  } catch (error) {
    console.error("[ACADIA] Erreur lecture GenericAnalysisCache :", error);
    return null;
  }
}

export async function storeCachedAnalysis(
  operation: AIOperation,
  rawInput: string,
  result: unknown
): Promise<void> {
  const normalized = normalizeSubjectForCache(rawInput);
  const cacheKey = computeCacheKey(operation, normalized);

  try {
    await prisma.genericAnalysisCache.upsert({
      where: { cacheKey },
      create: {
        cacheKey,
        operation,
        normalizedInput: normalized,
        resultJson: JSON.stringify(result),
      },
      update: {
        resultJson: JSON.stringify(result),
      },
    });
  } catch (error) {
    console.error("[ACADIA] Erreur écriture GenericAnalysisCache :", error);
  }
}
