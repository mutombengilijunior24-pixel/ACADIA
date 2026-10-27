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
  | "RESEARCH_ANALYSIS_VALIDATED"
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
  | "METHODOLOGY_EDITED"
  | "QUESTIONNAIRE_GENERATION_STARTED"
  | "QUESTIONNAIRE_EDITED"
  | "PUBLIC_SURVEY_OPENED"
  | "PUBLIC_SURVEY_STARTED"
  | "PUBLIC_SURVEY_COMPLETED"
  | "FIRST_SURVEY_RESPONSE_RECEIVED"
  | "ERROR_OCCURRED"
  | "FEEDBACK_SUBMITTED"
  | "BUG_REPORTED"
  | "FEATURE_REQUESTED"

  // ------------------------------------------------------------
  // ENTONNOIR "PREVIEW SANS COMPTE" (MVP simplification, 10/09/2026)
  //
  // Sujet saisi sur la landing → preview A1 sans session → compte créé
  // seulement après avoir vu la valeur. Voir app/api/preview/route.ts
  // et app/apercu/page.tsx.
  // ------------------------------------------------------------

  | "SUBJECT_SUBMITTED"
  | "PREVIEW_REQUESTED"
  | "PREVIEW_GENERATED"
  | "PREVIEW_FAILED"
  | "PREVIEW_ACCEPTED"
  | "PREVIEW_EDITED"
  | "ACCOUNT_CREATED_AFTER_PREVIEW"
  | "PHENOMENON_EVIDENCE_FETCHED"

  // ------------------------------------------------------------
  // CONVERSION + PAY-AS-YOU-PROGRESS (mission dédiée)
  // ------------------------------------------------------------

  | "PAYWALL_VIEWED"
  | "UNLOCK_CLICKED"
  | "CHECKOUT_STARTED"
  | "PAYMENT_SUCCEEDED"
  | "PAYMENT_FAILED"
  | "ENTITLEMENT_GRANTED"
  | "STAGE_STARTED"
  | "STAGE_COMPLETED"
  | "STAGE_ABANDONED"

  // ------------------------------------------------------------
  // PAYMENT ENGINE (mission dédiée) — étend le vocabulaire ci-dessus,
  // ne le duplique pas. WEBHOOK_REJECTED est un événement de SÉCURITÉ
  // (signature invalide/provider inconnu), pas un événement produit —
  // c'est pourquoi il vit ici et pas dans PUBLIC_PRODUCT_EVENT_TYPES.
  // ------------------------------------------------------------

  | "PAYMENT_PROCESSING"
  | "PAYMENT_CANCELLED"
  | "PAYMENT_EXPIRED"
  | "ENTITLEMENT_REVOKED"
  | "WEBHOOK_REJECTED"

  // ------------------------------------------------------------
  // ACADEMIC ASSESSMENT CORE (mission dédiée) — voir
  // lib/server/assessment/*Service.ts, seuls émetteurs de ces actions.
  // ------------------------------------------------------------

  | "ASSIGNMENT_CREATED"
  | "ASSIGNMENT_UPDATED"
  | "ASSIGNMENT_PUBLISHED"
  | "ASSIGNMENT_CLOSED"
  | "QUESTION_CREATED"
  | "QUESTION_UPDATED"
  | "RUBRIC_CREATED"
  | "ASSIGNMENT_SUBMITTED"
  | "ASSIGNMENT_GRADED"
  | "SUBMISSION_CREATED"
  | "SUBMISSION_SUBMITTED"
  | "SUBMISSION_RETURNED"
  | "EVALUATION_CREATED"
  | "EVALUATION_ACCEPTED"
  | "EVALUATION_MODIFIED"
  | "EVALUATION_REJECTED"
  | "GRADE_FINALIZED"
  | "AI_GRADING_PROPOSED"
  | "AI_GRADING_ACCEPTED"
  | "AI_GRADING_MODIFIED"
  | "AI_GRADING_REJECTED"

  // ------------------------------------------------------------
  // AI GRADING ENGINE (mission dédiée) — étend le vocabulaire
  // Academic Assessment Core ci-dessus, ne le duplique pas.
  // AI_GRADING_REQUESTED marque le déclenchement d'une correction par
  // l'enseignant (avant toute réponse de l'IA) ; AI_GRADING_FAILED
  // marque un échec du moteur/de la validation de sortie — distinct
  // d'AI_GRADING_REJECTED, qui est une DÉCISION humaine, jamais un
  // échec technique.
  // ------------------------------------------------------------

  | "AI_GRADING_REQUESTED"
  | "AI_GRADING_FAILED"

  // ------------------------------------------------------------
  // TEACHER WORKSPACE + GRADEBOOK (mission dédiée) — étend le
  // vocabulaire Academic Assessment / AI Grading ci-dessus, ne le
  // duplique pas : accepter/modifier une proposition restent
  // AI_GRADING_ACCEPTED/AI_GRADING_MODIFIED (Mission 3), retourner une
  // copie reste SUBMISSION_RETURNED (Mission 5) — seuls les événements
  // de consultation/lecture, absents jusqu'ici, sont ajoutés.
  // ------------------------------------------------------------

  | "TEACHER_DASHBOARD_VIEWED"
  | "ASSIGNMENT_OPENED"
  | "SUBMISSION_OPENED"
  | "AI_PROPOSAL_VIEWED"
  | "GRADEBOOK_VIEWED"
  | "GRADE_EXPORT_REQUESTED"

  // ------------------------------------------------------------
  // BIBLIOGRAPHY & REFERENCE INTELLIGENCE (mission dédiée) — voir
  // lib/server/research/Reference*.ts, seuls émetteurs.
  // ------------------------------------------------------------

  | "REFERENCE_CREATED"
  | "REFERENCE_UPDATED"
  | "REFERENCE_IMPORTED"
  | "REFERENCE_DELETED"
  | "REFERENCE_VERIFICATION_CHANGED"
  | "BIBLIOGRAPHY_VIEWED"
  | "BIBLIOGRAPHY_EXPORTED"
  | "CITATION_CHECKED"
  | "DUPLICATE_DETECTED"
  // Non listés explicitement par la mission mais nécessaires : une
  // citation ou un claim créé ne doit jamais apparaître dans le
  // journal sous l'action "REFERENCE_CREATED" (entityType différent,
  // confusion à la lecture) — mêmes principes, actions dédiées.
  | "CITATION_CREATED"
  | "CLAIM_CREATED"

  // ------------------------------------------------------------
  // STUDENT ENROLLMENT (retour utilisateur post-Mission Teacher
  // Workspace) — voir lib/server/assessment/EnrollmentService.ts.
  // ------------------------------------------------------------

  | "COHORT_JOINED"

  // ------------------------------------------------------------
  // MISSION 9 — CORRECTION AUTOMATIQUE À LA SOUMISSION — distingue un
  // déclenchement automatique (ce nouvel événement) d'un déclenchement
  // manuel par l'enseignant (AI_GRADING_REQUESTED, Mission 6, inchangé).
  // ------------------------------------------------------------

  | "AI_GRADING_AUTO_TRIGGERED"

  // ------------------------------------------------------------
  // MISSION 9 — RESEARCH WRITING ENGINE — voir
  // lib/server/research/WritingSectionService.ts. Distingue une
  // proposition IA d'une décision humaine (édition/validation/rejet),
  // même discipline que Mission 6/7 (interprétation/conclusion).
  // ------------------------------------------------------------

  | "WRITING_SECTION_GENERATED"
  | "WRITING_SECTION_EDITED"
  | "WRITING_SECTION_VALIDATED"
  | "WRITING_SECTION_REJECTED"
  | "WRITING_SECTION_REGENERATED"
  | "WRITING_COHERENCE_CHECKED"
  | "JOURNEY_SESSION_CREATED"
  | "JOURNEY_SESSION_ARCHIVED"
  | "JOURNEY_SESSION_RESTORED"
  | "JOURNEY_SESSION_DELETED"
  | "JOURNEY_FILE_STORED"
  | "JOURNEY_FILE_DELETED"
  | "STAGE_APPLICATION_CREATED"
  | "STAGE_APPLICATION_CANCELLED"
  | "STAGE_APPLICATION_UPDATED"
  | "STAGE_PAYMENT_INITIATED"
  | "STAGE_PAYMENT_CONFIRMED"
  | "STAGE_EXPORTED"
  | "STAGE_STATUS_CHANGED"
  | "STAGE_ATTENDANCE_SIGNED"
  | "STAGE_TUTOR_CONFIRMED"
  | "STAGE_ACCESS_CREATED"
  | "STAGE_ACCESS_REVOKED"
  | "STAGE_ACCESS_VIEWED"
  | "STAGE_PAYMENT_DECLARED"
  | "STAGE_PAYMENT_REJECTED"
  | "STAGE_SETTINGS_UPDATED";

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
