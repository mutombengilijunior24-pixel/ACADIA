// ============================================================
// ACADIA — PREVIEW SANS COMPTE (mission Preview WOW)
//
// UN SEUL CERVEAU : ce point d'entrée appelle désormais directement
// A1 (understandResearchWithAI, lib/ai/openai/SubjectUnderstandingAI.ts)
// avec depth="preview" — jamais un second moteur "narratif" séparé
// (l'ancien PreviewNarrativeAI.ts reste dans le dépôt mais n'est plus
// appelé ici ; voir le rapport de mission). Différence Preview / Deep
// Analysis : PAS un contrat différent, seulement une PROFONDEUR
// différente — modèle économique + raisonnement réduit (voir
// ModelRouter + SubjectUnderstandingAI.ts), jamais A2 (variables),
// jamais les orientations théoriques. Aucune session AUTHENTIFIÉE
// requise : userId omis du tracking, aucune donnée personnelle
// enregistrée. Ne persiste le projet nulle part côté serveur — le
// résultat est retourné directement au client, qui décide de le
// conserver (sessionStorage) le temps de l'inscription.
//
// Protection en 4 couches, dans cet ordre (inchangées depuis la
// mission Security + AI Cost Foundation) :
// 1. anonymousSessionId (cookie HttpOnly) : quota NOMINAL par
//    visiteur, pas par IP — une IP de campus ne doit jamais être
//    punie pour l'usage légitime de centaines d'étudiants.
// 2. IP hachée (HMAC, jamais stockée en clair) : signal d'ABUS
//    secondaire, seuil large (pensé "campus", pas "personne").
// 3. Garde de concurrence : un double clic ne doit jamais déclencher
//    deux appels OpenAI simultanés pour la même session.
// 4. Cache générique (sujet seul, jamais de donnée privée) : deux
//    visiteurs qui tapent le même sujet ne paient pas deux fois.
// ============================================================

import { z } from "zod";
import { understandResearchWithAI } from "@/lib/ai/openai/SubjectUnderstandingAI";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";
import { rateLimitStore } from "@/lib/server/security/RateLimitStore";
import { getOrCreateAnonymousSessionId, extractClientIp, hashIp } from "@/lib/server/security/AnonymousSession";
import { tryEnterConcurrency, exitConcurrency } from "@/lib/server/security/ConcurrencyGuard";
import { getCachedAnalysis, storeCachedAnalysis } from "@/lib/server/ai/AnalysisCache";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import type { AIResearchUnderstanding } from "@/lib/ai/openai/SubjectUnderstandingAI";

export const runtime = "nodejs";

const bodySchema = z.object({
  subject: z.string().trim().min(8, "Décrivez votre sujet en quelques mots.").max(600),
});

// Quota nominal par visiteur (anonymousSessionId) — inchangé par
// rapport au réglage précédent (15/heure), désormais rattaché à une
// identité de navigateur plutôt qu'à une IP potentiellement partagée.
const SESSION_LIMIT = 15;
const SESSION_WINDOW_MS = 60 * 60 * 1000;

// Signal d'abus IP — beaucoup plus large que le quota par session :
// pensé pour ne jamais bloquer un campus entier, seulement un script
// qui générerait des centaines de sessions depuis la même IP.
const IP_ABUSE_LIMIT = 300;
const IP_ABUSE_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const { id: anonymousSessionId, isNew } = await getOrCreateAnonymousSessionId();
  const hashedIp = hashIp(extractClientIp(request));

  // Anti-rafale immédiat (sub-seconde, mémoire locale) — inchangé,
  // protège contre un double clic même avant tout accès DB.
  const burstCheck = rateLimiter.check(rateLimitKey("subject-preview", anonymousSessionId), SESSION_LIMIT, SESSION_WINDOW_MS);
  if (!burstCheck.allowed) {
    return Response.json(
      { error: "Trop de tentatives depuis cette connexion. Réessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  // Quota distribué réel (Postgres — voir RateLimitStore.ts) : seule
  // protection valable en environnement serverless multi-instance.
  const sessionQuota = await rateLimitStore.check(
    rateLimitKey("subject-preview-session", anonymousSessionId),
    SESSION_LIMIT,
    SESSION_WINDOW_MS
  );
  if (!sessionQuota.allowed) {
    return Response.json(
      { error: "Trop de tentatives depuis cette connexion. Réessayez dans quelques minutes." },
      { status: 429 }
    );
  }

  const ipAbuseCheck = await rateLimitStore.check(
    rateLimitKey("subject-preview-ip", hashedIp),
    IP_ABUSE_LIMIT,
    IP_ABUSE_WINDOW_MS
  );
  if (!ipAbuseCheck.allowed) {
    return Response.json(
      { error: "Trop de tentatives depuis ce réseau. Réessayez plus tard." },
      { status: 429 }
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Sujet invalide." },
      { status: 400 }
    );
  }

  const concurrencyKey = `subject-preview:${anonymousSessionId}`;
  if (!tryEnterConcurrency(concurrencyKey, 1)) {
    return Response.json(
      { error: "Une analyse est déjà en cours pour votre sujet — patientez quelques secondes." },
      { status: 429 }
    );
  }

  await trackProductEvent({ eventType: "PREVIEW_REQUESTED" });

  // getOrCreateAnonymousSessionId() a déjà posé le cookie (côté
  // next/headers) si nécessaire — isNew ne sert ici qu'à documenter
  // l'intention, aucune action supplémentaire n'est requise sur la
  // réponse JSON standard ci-dessous.
  void isNew;

  try {
    const cached = await getCachedAnalysis<AIResearchUnderstanding>("PREVIEW_ANALYSIS", parsed.data.subject);
    if (cached) {
      await trackProductEvent({ eventType: "PREVIEW_GENERATED", metadata: { confidence: cached.result.confidence, cacheHit: true } });
      return Response.json({ understanding: cached.result }, { status: 200 });
    }

    const understanding = await understandResearchWithAI(
      { title: parsed.data.subject },
      { anonymousSessionId, depth: "preview" }
    );
    void storeCachedAnalysis("PREVIEW_ANALYSIS", parsed.data.subject, understanding);
    await trackProductEvent({ eventType: "PREVIEW_GENERATED", metadata: { confidence: understanding.confidence } });
    return Response.json({ understanding }, { status: 200 });
  } catch (error) {
    console.error("[ACADIA] Erreur preview :", error);
    await trackProductEvent({ eventType: "PREVIEW_FAILED" });
    return Response.json(
      { error: "ACADIA n'a pas pu analyser ce sujet pour le moment. Réessayez dans un instant." },
      { status: 502 }
    );
  } finally {
    exitConcurrency(concurrencyKey);
  }
}
