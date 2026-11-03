/**
 * Recherche d'une référence dans les bases ouvertes, avec un cache PARTAGÉ (une référence publiée,
 * vérifiée une fois, sert à tous) : seules des métadonnées publiques y sont stockées (titre, auteurs,
 * année, revue, DOI), jamais le mémoire ni l'identité de l'étudiant.
 */
import { createHash } from "node:crypto";

import { norm, scoreMatch, titleSimilarity, type LookupOutcome, type ParsedReference, type SourceId, type WorkRecord } from "@/lib/core/references";
import { prisma } from "@/lib/server/db/prisma";

import { crossrefByDoi, crossrefContainers, crossrefSearch, googleBooksSearch, halSearch, openAlexByDoi, openAlexSearch, openLibrarySearch, type Fetcher } from "./sources";

const OPERATION = "REFERENCE_LOOKUP";
const CACHE_VERSION = "v1";
const CACHE_DAYS = 30;
const ABSTRACT_MAX = 4000;

export interface LookupCache {
  get(key: string): Promise<LookupOutcome | null>;
  set(key: string, normalizedInput: string, outcome: LookupOutcome): Promise<void>;
}

/** Cache dans la table GenericAnalysisCache (opération dédiée, métadonnées publiques uniquement). */
export const databaseCache: LookupCache = {
  async get(key) {
    try {
      const hit = await prisma.genericAnalysisCache.findUnique({ where: { cacheKey: key } });
      if (!hit || Date.now() - hit.createdAt.getTime() > CACHE_DAYS * 86_400_000) return null;
      void prisma.genericAnalysisCache.update({ where: { cacheKey: key }, data: { hitCount: { increment: 1 }, lastHitAt: new Date() } }).catch(() => undefined);
      return JSON.parse(hit.resultJson) as LookupOutcome;
    } catch {
      return null;
    }
  },
  async set(key, normalizedInput, outcome) {
    try {
      const resultJson = JSON.stringify(outcome);
      await prisma.genericAnalysisCache.upsert({ where: { cacheKey: key }, create: { cacheKey: key, operation: OPERATION, normalizedInput: normalizedInput.slice(0, 500), resultJson }, update: { resultJson, createdAt: new Date(), lastHitAt: new Date() } });
    } catch {
      // Le cache est une optimisation : une écriture manquée n'empêche jamais la réponse.
    }
  },
};

/** Clé de cache : ce qui identifie la référence publiée (DOI, titre, premier auteur, année, type). */
export function lookupInput(ref: ParsedReference): string {
  return [CACHE_VERSION, ref.doi?.toLowerCase() ?? "", norm(ref.title ?? ""), norm(ref.authors[0]?.family ?? ""), ref.year ?? "", ref.kind, ref.isbn ?? "", norm(ref.container ?? "")].join("|");
}
export const lookupKey = (input: string) => createHash("sha256").update(`${OPERATION}:${input}`).digest("hex");

const trimRecord = (w: WorkRecord): WorkRecord => ({ ...w, abstract: w.abstract ? w.abstract.slice(0, ABSTRACT_MAX) : null });

export async function lookupReference(ref: ParsedReference, deps: { fetcher?: Fetcher; cache?: LookupCache | null } = {}): Promise<LookupOutcome> {
  const fetcher = deps.fetcher ?? fetch;
  const cache = deps.cache === undefined ? databaseCache : deps.cache;
  const input = lookupInput(ref);
  const key = lookupKey(input);
  const cached = cache ? await cache.get(key) : null;
  if (cached) return cached;

  const consulted = new Set<SourceId>();
  const failed = new Set<SourceId>();
  const candidates: WorkRecord[] = [];
  const attempt = async <T>(source: SourceId, run: () => Promise<T>): Promise<T | null> => {
    consulted.add(source);
    try {
      return await run();
    } catch {
      // Base en panne ou délai dépassé : notée, sans jamais conclure à l'absence de la référence.
      failed.add(source);
      return null;
    }
  };
  const isStrong = () => candidates.some((w) => {
    const s = scoreMatch(ref, w);
    return s.title >= 0.88 && s.author;
  });
  const author = ref.authors[0] && !ref.authors[0].corporate ? ref.authors[0].family : null;
  const query = [ref.title, author ?? ref.authors[0]?.family, ref.year].filter(Boolean).join(" ");

  // 1. DOI (identifiant le plus sûr) ; OpenAlex complète le résumé quand Crossref ne le donne pas.
  let doi: LookupOutcome["doi"] = null;
  if (ref.doi) {
    const rec = await attempt("crossref", () => crossrefByDoi(ref.doi!, fetcher));
    if (!failed.has("crossref")) doi = { found: !!rec, record: rec };
    if (rec && !rec.abstract) {
      const alt = await attempt("openalex", () => openAlexByDoi(ref.doi!, fetcher));
      if (alt?.abstract) doi = { found: true, record: { ...rec, abstract: alt.abstract } };
    }
  }
  const doiMatches = doi?.record && ref.title ? titleSimilarity(ref.title, doi.record.title) >= 0.75 : false;

  // 2. Recherche par titre (inutile si le DOI correspond déjà).
  if (ref.title && !doiMatches && ref.kind !== "web") {
    if (ref.kind === "livre") {
      const [ol, gb] = await Promise.all([attempt("openlibrary", () => openLibrarySearch(ref.title!, author, fetcher)), attempt("googlebooks", () => googleBooksSearch(ref.title!, author, fetcher))]);
      candidates.push(...(ol ?? []), ...(gb ?? []));
      if (!isStrong()) candidates.push(...((await attempt("crossref", () => crossrefSearch(query, fetcher))) ?? []));
    } else if (ref.kind === "memoire" || ref.kind === "cours" || ref.kind === "texte_juridique") {
      candidates.push(...((await attempt("hal", () => halSearch(ref.title!, fetcher))) ?? []));
    } else {
      candidates.push(...((await attempt("crossref", () => crossrefSearch(query, fetcher))) ?? []));
      if (!isStrong()) candidates.push(...((await attempt("openalex", () => openAlexSearch(query, fetcher))) ?? []));
      if (!isStrong()) candidates.push(...((await attempt("hal", () => halSearch(ref.title!, fetcher))) ?? []));
    }
  }

  // 3. Article introuvable : la revue est-elle indexée ? (signal d'une référence inventée)
  let containerIndexed: boolean | null = null;
  if (ref.kind === "article" && ref.container && !doiMatches && !isStrong()) {
    const titles = await attempt("crossref", () => crossrefContainers(ref.container!, fetcher));
    containerIndexed = titles ? titles.some((t) => titleSimilarity(t, ref.container!) >= 0.9) : null;
  }

  const outcome: LookupOutcome = {
    doi: doi ? { found: doi.found, record: doi.record ? trimRecord(doi.record) : null } : null,
    candidates: candidates.map(trimRecord),
    containerIndexed,
    consulted: [...consulted],
    failed: [...failed],
  };
  // Une réponse incomplète (base en panne) n'est pas gardée : elle sera redemandée.
  if (cache && !outcome.failed.length) await cache.set(key, input, outcome);
  return outcome;
}
