// ============================================================
// ACADIA — JOURNAL D'AUDIT (P17, Partie 31)
//
// Jamais de mot de passe, clé API, ou contenu intégral d'un
// document scientifique dans les métadonnées journalisées — voir
// ACADIA_P17_SECURITY.md §6.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";

export type AuditAction =
  | "USER_CREATED"
  | "ROLE_ASSIGNED"
  | "SUPERVISOR_VERIFIED"
  | "RESEARCH_CREATED"
  | "RESEARCH_UPDATED"
  | "RESEARCH_ARCHIVED"
  | "DATASET_IMPORTED"
  | "DATASET_MAPPING_UPDATED"
  | "SUBMISSION_CREATED"
  | "FEEDBACK_CREATED"
  | "CORRECTION_UPDATED"
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_DELETED"
  | "EXPORT_CREATED"
  | "LOGIN_FAILED"
  | "ACCESS_DENIED"
  | "SURVEY_CREATED"
  | "SURVEY_PUBLISHED"
  | "SURVEY_STATUS_CHANGED"
  | "SURVEY_RESPONSE_RECEIVED";

export async function logAudit(input: {
  actorId?: string;
  action: AuditAction;
  entityType: string;
  entityId?: string;
  metadata?: Record<string, string | number | boolean | undefined>;
}): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: input.actorId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      },
    });
  } catch {
    // L'audit ne doit jamais faire échouer l'action métier elle-même.
  }
}
