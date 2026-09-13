// ============================================================
// ACADIA — RATE LIMIT STORE (mission Security + AI Cost Foundation)
//
// lib/server/security/RateLimiter.ts (P17, existant, INCHANGÉ) reste
// le garde-fou anti-rafale en mémoire process (sub-seconde, par
// instance serverless) — sa propre documentation reconnaît déjà
// explicitement ne pas être une protection globale. Ce fichier
// ajoute la couche qui MANQUAIT : un quota réellement partagé entre
// toutes les instances, porté par Postgres (déjà provisionné pour ce
// projet — aucune nouvelle dépendance Redis/KV installée, cf. mission
// §10 : "si aucun stockage distribué n'est disponible... préparer
// Redis/KV/DB selon l'environnement" — la DB EST disponible ici).
//
// Interface RateLimitStore : permet de substituer plus tard une
// implémentation Redis/KV sans changer les appelants.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { rateLimiter, type RateLimitResult } from "./RateLimiter";

export interface RateLimitStore {
  /**
   * Incrémente le compteur pour `key` et indique si la limite est
   * respectée pour la fenêtre glissante [now - windowMs, now].
   */
  check(key: string, limit: number, windowMs: number): Promise<RateLimitResult>;
}

// ------------------------------------------------------------
// IMPLÉMENTATION EN MÉMOIRE (fallback / tests) — enveloppe le
// InMemoryRateLimiter existant dans l'interface async RateLimitStore,
// sans dupliquer sa logique.
// ------------------------------------------------------------

export class InMemoryRateLimitStore implements RateLimitStore {
  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    return rateLimiter.check(key, limit, windowMs);
  }
}

// ------------------------------------------------------------
// IMPLÉMENTATION POSTGRES — vraie protection distribuée, active dès
// aujourd'hui (aucune infrastructure supplémentaire à provisionner).
//
// Fenêtre glissante approximée par fenêtre fixe rechargée (reset dès
// que `now - windowStart >= windowMs`) — même sémantique que
// InMemoryRateLimiter, pour un comportement prévisible identique
// entre les deux implémentations. Une transaction Prisma sérialise
// la lecture-incrémentation pour éviter une racecondition entre deux
// instances serverless simultanées.
// ------------------------------------------------------------

export class PostgresRateLimitStore implements RateLimitStore {
  async check(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
    const now = new Date();

    try {
      return await prisma.$transaction(async (tx) => {
        const existing = await tx.rateLimitCounter.findUnique({ where: { key } });

        if (!existing || now.getTime() - existing.windowStart.getTime() >= windowMs) {
          await tx.rateLimitCounter.upsert({
            where: { key },
            create: { key, count: 1, windowStart: now },
            update: { count: 1, windowStart: now },
          });
          return { allowed: true, remaining: limit - 1, resetAt: now.getTime() + windowMs };
        }

        const nextCount = existing.count + 1;
        await tx.rateLimitCounter.update({
          where: { key },
          data: { count: nextCount },
        });

        return {
          allowed: nextCount <= limit,
          remaining: Math.max(0, limit - nextCount),
          resetAt: existing.windowStart.getTime() + windowMs,
        };
      });
    } catch (error) {
      // Panne DB (voir mémoire connue : le pooler Supabase peut
      // devenir injoignable) — ne jamais bloquer tout le parcours
      // anonyme derrière une dépendance DB en plus de l'appel IA
      // lui-même. Repli explicite sur la couche mémoire locale
      // (protection dégradée mais non nulle), jamais un blocage total.
      console.error("[ACADIA] PostgresRateLimitStore indisponible, repli mémoire :", error);
      return rateLimiter.check(key, limit, windowMs);
    }
  }
}

export const rateLimitStore: RateLimitStore = new PostgresRateLimitStore();
