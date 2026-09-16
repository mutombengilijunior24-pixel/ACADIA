// ============================================================
// ACADIA — SUPERVISION ACADÉMIQUE : TYPES (P16)
//
// Étend le scaffolding posé en P15 (qui ne définissait que
// `SupervisorFeedback`, jamais câblé — voir ACADIA_P15_AUDIT.md).
// Ce fichier reste un fichier de TYPES uniquement ; la logique
// (stores, moteurs, routes) vit dans lib/supervision/ et
// app/api/supervision/. Aucune donnée scientifique n'est
// recalculée ici — uniquement des structures de transport et de
// suivi humain.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { TheoreticalFrameworkEntry } from "@/lib/core/research/TheoreticalFrameworkTypes";
import type { InstrumentRecord } from "@/contexts/ResearchContext";

// ------------------------------------------------------------
// PROFIL ACADÉMIQUE DU DIRECTEUR
// ------------------------------------------------------------

export interface SupervisorProfile {
  userId: string;
  fullName: string;
  academicTitle?: string;
  institution?: string;
  faculty?: string;
  department?: string;
  domain?: string;
  specialties?: string[];
  activeAcademicYear?: string;
  isActive: boolean;
  professionalEmail?: string;
  signature?: string;
  activeCanevasId?: string;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------
// CANEVAS DE SUPERVISION
// ------------------------------------------------------------

export type CanevasStepStatus =
  | "non_commence"
  | "en_cours"
  | "a_corriger"
  | "corrige"
  | "valide"
  | "bloque";

export interface CanevasStep {
  id: string;
  name: string;
  description?: string;
  order: number;
  required: boolean;
  validationCriteria?: string;
  supervisorComment?: string;
  status: CanevasStepStatus;
}

export type WorkType =
  | "memoire_licence"
  | "memoire_master"
  | "travail_fin_cycle"
  | "dissertation"
  | "autre";

/**
 * Règle explicite du directeur pour le nombre d'hypothèses
 * secondaires attendues — jamais une valeur universelle câblée
 * en dur dans un moteur (Partie 25 du sprint P16). Configurable
 * par niveau, jamais imposée par ACADIA.
 */
export interface HypothesisCountRule {
  level: string;
  minSecondary: number;
  maxSecondary: number;
}

export interface SupervisionCanevas {
  id: string;
  supervisorId: string;
  academicYear: string;
  faculty?: string;
  department?: string;
  workTypes: WorkType[];
  steps: CanevasStep[];
  hypothesisRules?: HypothesisCountRule[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ------------------------------------------------------------
// INVITATION
// ------------------------------------------------------------

export type InvitationStatus = "pending" | "accepted" | "expired" | "revoked";

export interface SupervisorInvitation {
  id: string;
  code: string;
  supervisorId: string;
  studentEmail?: string;
  researchId?: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  usedAt?: string;
  studentId?: string;
}

// ------------------------------------------------------------
// AFFECTATION ÉTUDIANT ↔ DIRECTEUR
// ------------------------------------------------------------

export type AssignmentStatus = "active" | "ended";

export interface SupervisionAssignment {
  id: string;
  studentId: string;
  supervisorId: string;
  researchId?: string;
  status: AssignmentStatus;
  createdAt: string;
  endedAt?: string;
}

// ------------------------------------------------------------
// SOUMISSION
// ------------------------------------------------------------

export type SubmissionStatus =
  | "submitted"
  | "under_review"
  | "feedback_ready"
  | "revision_required"
  | "resubmitted"
  | "accepted";

/**
 * Le serveur n'a jamais accès au localStorage de l'étudiant : au
 * moment de soumettre, le client envoie ce snapshot déjà construit
 * — même logique que les routes d'export P12 (stateless, le
 * serveur ne recalcule jamais la science). C'est aussi la seule
 * forme de "document" que ACADIA stocke réellement aujourd'hui
 * (voir ACADIA_P16_ARCHITECTURE.md §3 — aucun stockage cloud réel).
 */
export interface SubmissionSnapshot {
  project: ResearchProject;
  instrument?: InstrumentRecord;
  theoreticalFramework: TheoreticalFrameworkEntry[];
}

export interface Submission {
  id: string;
  researchId: string;
  studentId: string;
  supervisorId: string;
  version: number;
  snapshot: SubmissionSnapshot;
  submittedAt: string;
  status: SubmissionStatus;
  studentMessage?: string;
  reviewedAt?: string;
  reviewedBy?: string;
  feedbackId?: string;
  previousSubmissionId?: string;
}

// ------------------------------------------------------------
// MESSAGERIE (boîte académique structurée — pas un chat libre)
// ------------------------------------------------------------

export type MessageType = "feedback" | "correction" | "notification" | "validation" | "system";

export interface InboxMessage {
  id: string;
  senderId: string;
  recipientId: string;
  researchId?: string;
  submissionId?: string;
  subject: string;
  body: string;
  type: MessageType;
  createdAt: string;
  readAt?: string;
  priority: "normal" | "high";
}

// ------------------------------------------------------------
// FEEDBACK STRUCTURÉ
// ------------------------------------------------------------

export type FeedbackSectionState = "ok" | "a_corriger" | "bloquant";

export interface FeedbackSectionEntry {
  sectionId: string;
  label: string;
  state: FeedbackSectionState;
  comment?: string;
}

export interface FeedbackEntry {
  id: string;
  submissionId: string;
  supervisorId: string;
  globalEvaluation: string;
  sections: FeedbackSectionEntry[];
  createdAt: string;
  sentAt?: string;
}

// ------------------------------------------------------------
// CORRECTIONS
// ------------------------------------------------------------

export type CorrectionSeverity = "info" | "mineure" | "majeure" | "bloquante";
export type CorrectionStatus = "open" | "partially_resolved" | "resolved" | "rejected" | "needs_discussion";

export interface CorrectionDiscussionEntry {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Correction {
  id: string;
  submissionId: string;
  section: string;
  description: string;
  severity: CorrectionSeverity;
  status: CorrectionStatus;
  createdAt: string;
  resolvedAt?: string;
  resolvedBy?: string;
  discussion: CorrectionDiscussionEntry[];
}

// ------------------------------------------------------------
// BRIEF ACADIA (assistance au directeur — jamais une validation)
// ------------------------------------------------------------

export type GenerationStatus = "generated" | "needs_review" | "accepted" | "edited" | "rejected";

export interface SupervisorBrief {
  id: string;
  submissionId: string;
  generatedAt: string;
  generatedBy: "acadia";
  status: GenerationStatus;
  overallState: "solide" | "a_verifier" | "bloquant";
  strengths: string[];
  inconsistencies: string[];
  incompleteSections: string[];
  importantQuestions: string[];
  progressPercent: number;
  disclaimer: string;
}

// ------------------------------------------------------------
// COMPARAISON DE VERSIONS
// ------------------------------------------------------------

export interface RevisionChangeItem {
  label: string;
  detail?: string;
}

export interface RevisionComparison {
  fromSubmissionId: string;
  toSubmissionId: string;
  added: RevisionChangeItem[];
  removed: RevisionChangeItem[];
  modified: RevisionChangeItem[];
  unchanged: RevisionChangeItem[];
  /** Corrections de la version précédente potentiellement traitées — jamais affirmé avec certitude. */
  potentiallyResolved: RevisionChangeItem[];
  unresolved: RevisionChangeItem[];
}

// ------------------------------------------------------------
// CONFORMITÉ AU CANEVAS
// ------------------------------------------------------------

export interface CanevasComplianceItem {
  ruleLabel: string;
  expected: string;
  actual: string;
  compliant: boolean;
}

// ------------------------------------------------------------
// NOTIFICATIONS
// ------------------------------------------------------------

export type NotificationType =
  | "new_submission"
  | "feedback_received"
  | "correction_requested"
  | "correction_resolved"
  | "supervisor_invitation"
  | "unread_message"
  // Mission 9 — Correction automatique à la soumission : notifie
  // l'enseignant qu'une copie vient d'être corrigée automatiquement
  // (déterministe et/ou IA) et attend sa décision.
  | "grading_ready";

export interface Notification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedResearchId?: string;
  relatedSubmissionId?: string;
  createdAt: string;
  readAt?: string;
}

// ------------------------------------------------------------
// JOURNAL EMAIL (honnêteté — jamais un faux "envoyé")
// ------------------------------------------------------------

export type EmailLogStatus = "sent" | "failed" | "not_configured";

export interface EmailLogEntry {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: EmailLogStatus;
  createdAt: string;
  error?: string;
}
