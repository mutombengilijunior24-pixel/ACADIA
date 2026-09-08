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
  | "ANALYSIS_PLAN_GENERATED"
  | "ANALYSIS_PLAN_ITEM_UPDATED"
  | "STATISTICAL_RUN_EXECUTED"
  | "SCIENTIFIC_INTERPRETATION_GENERATED"
  | "SCIENTIFIC_INTERPRETATION_FORMULATED"
  | "SCIENTIFIC_INTERPRETATION_VALIDATED"
  | "SCIENTIFIC_CONCLUSION_GENERATED"
  | "SCIENTIFIC_CONCLUSION_FORMULATED"
  | "SCIENTIFIC_CONCLUSION_VALIDATED"
  | "SCIENTIFIC_CONCLUSION_EDITED"
  | "SCIENTIFIC_CONCLUSION_REJECTED"
  | "SCIENTIFIC_CONCLUSION_REGENERATED"
  | "SCIENTIFIC_CONCLUSION_OUTDATED"
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
  | "SURVEY_RESPONSE_RECEIVED"

  // ------------------------------------------------------------
  // ÉVÉNEMENTS PRODUIT (Bloc 2 — bêta "100 étudiants", 08/09/2026)
  //
  // Réutilise AuditLog tel quel comme magasin d'événements produit —
  // voir lib/server/analytics/ProductEvents.ts. Une partie du
  // vocabulaire demandé par la mission existe déjà ci-dessus et n'est
  // pas dupliquée : AUTH_REGISTERED→USER_CREATED,
  // PROJECT_CREATED/SUBJECT_SUBMITTED→RESEARCH_CREATED (même moment
  // réel dans l'assistant actuel), QUESTIONNAIRE_GENERATED→SURVEY_CREATED,
  // QUESTIONNAIRE_PUBLISHED→SURVEY_PUBLISHED (le "questionnaire" de la
  // mission est le module "Survey" du code — mêmes actions déjà
  // journalisées, jamais dupliquées), DATASET_MAPPED→DATASET_MAPPING_UPDATED,
  // ANALYSIS_PLAN_CREATED→ANALYSIS_PLAN_GENERATED,
  // ANALYSIS_EXECUTED→STATISTICAL_RUN_EXECUTED,
  // INTERPRETATION_GENERATED/VALIDATED et CONCLUSION_GENERATED/VALIDATED
  // →SCIENTIFIC_INTERPRETATION_*/SCIENTIFIC_CONCLUSION_* (déjà
  // journalisés par les Missions 6/7). VARIABLES_VALIDATED n'est pas
  // ajouté : aucune interface de validation des variables A2 n'existe
  // réellement (voir audit Bloc 0) — l'événement ne représenterait
  // aucune action réelle.
  // ------------------------------------------------------------

  | "AUTH_LOGIN"
  | "AUTH_LOGOUT"
  | "PROJECT_OPENED"
  | "A1_STARTED"
  | "A1_COMPLETED"
  | "A2_STARTED"
  | "A2_COMPLETED"
  | "VARIABLES_GENERATED"
  | "METHODOLOGY_STARTED"
  | "METHODOLOGY_COMPLETED"
  | "QUESTIONNAIRE_GENERATION_STARTED"
  | "QUESTIONNAIRE_EDITED"
  | "PUBLIC_SURVEY_OPENED"
  | "PUBLIC_SURVEY_STARTED"
  | "PUBLIC_SURVEY_COMPLETED"
  | "FIRST_SURVEY_RESPONSE_RECEIVED"
  | "ERROR_OCCURRED"
  | "FEEDBACK_SUBMITTED"
  | "BUG_REPORTED"
  | "FEATURE_REQUESTED";

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
