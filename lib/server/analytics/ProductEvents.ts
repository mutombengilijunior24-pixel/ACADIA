// ============================================================
// ACADIA — SERVICE CENTRAL D'ÉVÉNEMENTS PRODUIT (Bloc 2, 08/09/2026)
//
// Réutilise AuditLog tel quel (lib/server/audit/AuditLog.ts) — aucun
// deuxième système de journalisation. trackProductEvent() est une
// enveloppe fine et nommée pour le vocabulaire "parcours produit",
// distincte des actions de sécurité déjà journalisées (LOGIN_FAILED,
// ACCESS_DENIED...) : entityType="Product" les regroupe clairement
// lors d'une lecture du journal. logAudit() avale déjà toute erreur
// en interne (jamais d'exception propagée) — cette garantie est donc
// héritée sans code supplémentaire : le tracking ne peut jamais
// interrompre le parcours d'un étudiant.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { logAudit, type AuditAction } from "@/lib/server/audit/AuditLog";

export const PRODUCT_EVENT_TYPES = [
  "AUTH_LOGIN",
  "AUTH_LOGOUT",
  "PROJECT_OPENED",
  "A1_STARTED",
  "A1_COMPLETED",
  "A2_STARTED",
  "A2_COMPLETED",
  "VARIABLES_GENERATED",
  "METHODOLOGY_STARTED",
  "METHODOLOGY_COMPLETED",
  "METHODOLOGY_EDITED",
  "QUESTIONNAIRE_GENERATION_STARTED",
  "QUESTIONNAIRE_EDITED",
  "PUBLIC_SURVEY_OPENED",
  "PUBLIC_SURVEY_STARTED",
  "PUBLIC_SURVEY_COMPLETED",
  "FIRST_SURVEY_RESPONSE_RECEIVED",
  "ERROR_OCCURRED",
  "FEEDBACK_SUBMITTED",
  "BUG_REPORTED",
  "FEATURE_REQUESTED",
  "SUBJECT_SUBMITTED",
  "PREVIEW_REQUESTED",
  "PREVIEW_GENERATED",
  "PREVIEW_FAILED",
  "PREVIEW_ACCEPTED",
  "PREVIEW_EDITED",
  "ACCOUNT_CREATED_AFTER_PREVIEW",
  "PHENOMENON_EVIDENCE_FETCHED",

  // Conversion + Pay-as-you-progress (mission dédiée) — voir
  // lib/server/billing/EntitlementService.ts, seul émetteur de ces
  // événements.
  "PAYWALL_VIEWED",
  "UNLOCK_CLICKED",
  "CHECKOUT_STARTED",
  "PAYMENT_SUCCEEDED",
  "PAYMENT_FAILED",
  "ENTITLEMENT_GRANTED",
  "STAGE_STARTED",
  "STAGE_COMPLETED",
  "STAGE_ABANDONED",
] as const;

export type ProductEventType = (typeof PRODUCT_EVENT_TYPES)[number];

// Vérifie à la compilation que chaque valeur ci-dessus existe bien
// dans AuditAction — si ce type ne compile plus, une valeur a été
// mal orthographiée par rapport à AuditLog.ts.
type _AssertSubsetOfAuditAction = ProductEventType extends AuditAction ? true : never;
const _check: _AssertSubsetOfAuditAction = true;
void _check;

/**
 * Sous-ensemble de PRODUCT_EVENT_TYPES qu'un CLIENT NON authentifié
 * (répondant public à une enquête) peut légitimement déclencher via
 * POST /api/product/events — voir cette route. Tout le reste exige
 * une session ACADIA (userId dérivé du serveur, jamais du client).
 */
export const PUBLIC_PRODUCT_EVENT_TYPES: readonly ProductEventType[] = [
  "PUBLIC_SURVEY_OPENED",
  "PUBLIC_SURVEY_STARTED",
  "PUBLIC_SURVEY_COMPLETED",
  // Entonnoir preview sans compte (MVP simplification, 10/09/2026) —
  // déclenchés avant toute session par app/apercu/page.tsx.
  "SUBJECT_SUBMITTED",
  "PREVIEW_ACCEPTED",
  "PREVIEW_EDITED",
];

export interface TrackProductEventInput {
  userId?: string;
  projectId?: string;
  eventType: ProductEventType;
  metadata?: Record<string, string | number | boolean | undefined>;
}

/**
 * Point d'entrée unique pour enregistrer un événement de parcours
 * produit. Ne bloque et ne fait jamais échouer l'action principale de
 * l'utilisateur (voir logAudit). `metadata` ne doit jamais contenir de
 * secret, de réponse de questionnaire brute, ni de contenu scientifique
 * intégral — uniquement des identifiants et de courtes valeurs
 * descriptives (voir chaque site d'appel pour le détail retenu).
 */
export async function trackProductEvent(input: TrackProductEventInput): Promise<void> {
  await logAudit({
    actorId: input.userId,
    action: input.eventType,
    entityType: "Product",
    entityId: input.projectId,
    metadata: input.metadata,
  });
}

// ============================================================
// LECTURE — VUE D'ENSEMBLE / FUNNEL / ERREURS (dashboard admin)
//
// Requêtes de comptage pur sur des données déjà écrites — aucun
// chiffre inventé, aucune interprétation causale produite ici (voir
// mission §23 "test anti-fausse analyse") : chaque fonction retourne
// des comptages factuels, la mise en forme ("abandon observé" plutôt
// que "cause de l'abandon") est de la responsabilité de l'UI.
// ============================================================

export interface FunnelStepResult {
  key: string;
  label: string;
  userCount: number;
}

/**
 * Une étape de funnel = un ou plusieurs AuditAction représentant la
 * MÊME étape réelle du parcours (voir mapping documenté dans
 * AuditLog.ts). Le funnel compte des UTILISATEURS DISTINCTS ayant
 * atteint l'étape au moins une fois — jamais un nombre d'événements
 * bruts, qui surcompterait les régénérations/réessais.
 */
const FUNNEL_STEPS: { key: string; label: string; actions: AuditAction[] }[] = [
  { key: "registered", label: "Inscription", actions: ["USER_CREATED"] },
  { key: "project_created", label: "Projet créé", actions: ["RESEARCH_CREATED"] },
  { key: "a1_completed", label: "A1 terminé", actions: ["A1_COMPLETED"] },
  { key: "a2_completed", label: "A2 terminé", actions: ["A2_COMPLETED"] },
  { key: "methodology_completed", label: "Méthodologie terminée", actions: ["METHODOLOGY_COMPLETED"] },
  { key: "questionnaire_created", label: "Questionnaire créé", actions: ["SURVEY_CREATED"] },
  { key: "questionnaire_published", label: "Questionnaire publié", actions: ["SURVEY_PUBLISHED"] },
  { key: "first_response", label: "Première réponse reçue", actions: ["FIRST_SURVEY_RESPONSE_RECEIVED"] },
];

export async function computeFunnel(): Promise<FunnelStepResult[]> {
  const results: FunnelStepResult[] = [];
  for (const step of FUNNEL_STEPS) {
    const rows = await prisma.auditLog.findMany({
      where: { action: { in: step.actions }, actorId: { not: null } },
      select: { actorId: true },
      distinct: ["actorId"],
    });
    results.push({ key: step.key, label: step.label, userCount: rows.length });
  }
  return results;
}

export interface ProductOverview {
  usersRegistered: number;
  usersActive7d: number;
  usersNew7d: number;
  projectsCreated: number;
  questionnairesPublished: number;
  responsesCollected: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export async function computeProductOverview(): Promise<ProductOverview> {
  const since7d = new Date(Date.now() - 7 * DAY_MS);

  const [usersRegistered, usersNew7d, activeActorRows, projectsCreated, questionnairesPublished, responsesCollected] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: since7d } } }),
    prisma.auditLog.findMany({
      where: { timestamp: { gte: since7d }, actorId: { not: null } },
      select: { actorId: true },
      distinct: ["actorId"],
    }),
    prisma.auditLog.count({ where: { action: "RESEARCH_CREATED" } }),
    prisma.auditLog.count({ where: { action: "SURVEY_PUBLISHED" } }),
    prisma.auditLog.count({ where: { action: "SURVEY_RESPONSE_RECEIVED" } }),
  ]);

  return {
    usersRegistered,
    usersActive7d: activeActorRows.length,
    usersNew7d,
    projectsCreated,
    questionnairesPublished,
    responsesCollected,
  };
}

export interface ErrorStatRow {
  metadata: string | null;
  count: number;
}

/**
 * Erreurs applicatives auto-signalées (ERROR_OCCURRED, émises côté
 * client — voir POST /api/product/events) — distinctes des erreurs
 * techniques serveur, déjà capturées par Sentry lorsqu'il est
 * configuré (voir instrumentation.ts, non dupliqué ici : mission §14).
 */
export async function computeErrorStats(limit = 50): Promise<{ id: string; entityId: string | null; metadata: string | null; timestamp: Date }[]> {
  return prisma.auditLog.findMany({
    where: { action: "ERROR_OCCURRED" },
    orderBy: { timestamp: "desc" },
    take: limit,
    select: { id: true, entityId: true, metadata: true, timestamp: true },
  });
}
