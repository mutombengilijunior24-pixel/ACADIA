// ============================================================
// ACADIA — AI USAGE LEDGER (mission Security + AI Cost Foundation)
//
// Journal central de TOUT appel IA (OpenAI ou futur autre fournisseur).
// Ne remplace ni ProductEvents (parcours produit) ni AuditLog
// (sécurité) — ceux-ci continuent d'exister tels quels. Ce module est
// le SEUL endroit qui connaît tokens/coûts/latence d'un appel donné.
//
// Même discipline que logAudit()/trackProductEvent() : n'écrit
// jamais en bloquant le parcours étudiant — une erreur d'écriture du
// ledger est journalée en console puis avalée, jamais propagée.
//
// Ne jamais exposer tokens/coûts aux étudiants par défaut (voir
// mission §2) — ce module n'a aucune route publique ; seule une
// interface d'administration future devrait lire ces données.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";

export const AI_OPERATIONS = [
  "PREVIEW_ANALYSIS",
  "DEEP_ANALYSIS",
  "VARIABLE_ANALYSIS",
  "METHODOLOGY",
  "QUESTIONNAIRE_GENERATION",
  "DOCUMENT_ANALYSIS",
  "INTERPRETATION",
  "CONCLUSION",
  "OTHER",
] as const;

export type AIOperation = (typeof AI_OPERATIONS)[number];

export interface AIUsageInput {
  userId?: string | null;
  projectId?: string | null;
  anonymousSessionId?: string | null;
  operation: AIOperation;
  model: string;
  provider?: string;
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  estimatedCostUsd?: number | null;
  actualCostUsd?: number | null;
  latencyMs?: number | null;
  success: boolean;
  cacheHit?: boolean;
  /** Message court uniquement — jamais une stack trace ni un secret. */
  errorMessage?: string | null;
  requestId?: string | null;
  correlationId?: string | null;
}

// Borne défensive : même un message d'erreur "court" ne doit jamais
// finir par contenir un fragment de clé API ou un payload complet
// collé par erreur par un appelant.
const MAX_ERROR_MESSAGE_LENGTH = 300;

export async function recordAIUsage(input: AIUsageInput): Promise<void> {
  try {
    await prisma.aIUsageLedger.create({
      data: {
        userId: input.userId ?? null,
        projectId: input.projectId ?? null,
        anonymousSessionId: input.anonymousSessionId ?? null,
        operation: input.operation,
        model: input.model,
        provider: input.provider ?? "openai",
        inputTokens: input.inputTokens ?? null,
        cachedInputTokens: input.cachedInputTokens ?? null,
        outputTokens: input.outputTokens ?? null,
        estimatedCostUsd: input.estimatedCostUsd ?? null,
        actualCostUsd: input.actualCostUsd ?? null,
        latencyMs: input.latencyMs ?? null,
        success: input.success,
        cacheHit: input.cacheHit ?? false,
        errorMessage: input.errorMessage
          ? input.errorMessage.slice(0, MAX_ERROR_MESSAGE_LENGTH)
          : null,
        requestId: input.requestId ?? null,
        correlationId: input.correlationId ?? null,
      },
    });
  } catch (error) {
    // Ne jamais bloquer un appel IA parce que le journal n'a pas pu
    // s'écrire (même discipline que logAudit/trackProductEvent).
    console.error("[ACADIA] Erreur d'écriture AIUsageLedger :", error);
  }
}

// ============================================================
// AGRÉGATIONS — fondation pour les métriques business (mission §9)
//
// Ne construit aucun tableau de bord ici — seulement les requêtes
// nécessaires pour qu'un futur écran (ou un script d'analyse) puisse
// calculer coût/utilisateur, coût/projet, coût/étape, etc. sans
// dupliquer de logique d'agrégation.
// ============================================================

export interface AIUsageSummary {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  cacheHits: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalEstimatedCostUsd: number;
}

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  // Prisma renvoie Decimal — toString() puis Number() est la
  // conversion sûre recommandée par Prisma pour un usage applicatif
  // (pas de calcul financier de précision critique effectué ici).
  return Number(value.toString());
}

export async function getUsageSummaryByUser(userId: string): Promise<AIUsageSummary> {
  const rows = await prisma.aIUsageLedger.findMany({ where: { userId } });
  return summarize(rows);
}

export async function getUsageSummaryByProject(projectId: string): Promise<AIUsageSummary> {
  const rows = await prisma.aIUsageLedger.findMany({ where: { projectId } });
  return summarize(rows);
}

export async function getUsageSummaryByOperation(operation: AIOperation): Promise<AIUsageSummary> {
  const rows = await prisma.aIUsageLedger.findMany({ where: { operation } });
  return summarize(rows);
}

function summarize(rows: Array<{
  success: boolean;
  cacheHit: boolean;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: unknown;
}>): AIUsageSummary {
  return rows.reduce<AIUsageSummary>(
    (acc, row) => ({
      totalCalls: acc.totalCalls + 1,
      successCalls: acc.successCalls + (row.success ? 1 : 0),
      failedCalls: acc.failedCalls + (row.success ? 0 : 1),
      cacheHits: acc.cacheHits + (row.cacheHit ? 1 : 0),
      totalInputTokens: acc.totalInputTokens + (row.inputTokens ?? 0),
      totalOutputTokens: acc.totalOutputTokens + (row.outputTokens ?? 0),
      totalEstimatedCostUsd: acc.totalEstimatedCostUsd + toNumber(row.estimatedCostUsd),
    }),
    {
      totalCalls: 0,
      successCalls: 0,
      failedCalls: 0,
      cacheHits: 0,
      totalInputTokens: 0,
      totalOutputTokens: 0,
      totalEstimatedCostUsd: 0,
    }
  );
}
