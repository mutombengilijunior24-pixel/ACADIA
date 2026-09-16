// ============================================================
// ACADIA — TRADUCTION DES ERREURS DOMAINE → HTTP (mission Academic
// Assessment Core)
//
// Même discipline que EntitlementRequiredError → 402 (voir routes
// billing) : les services lèvent des erreurs typées, jamais une route
// qui décide elle-même du code HTTP au cas par cas.
// ============================================================

import {
  AssessmentForbiddenError,
  AssessmentNotFoundError,
  AssessmentConflictError,
  InvalidAssignmentStateError,
  InvalidSubmissionStateError,
  InvalidScoreError,
  InvalidQuestionContentError,
  InvalidAnswerError,
} from "@/lib/core/assessment/AssessmentTypes";

export function toAssessmentErrorResponse(error: unknown): Response {
  if (error instanceof AssessmentForbiddenError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof AssessmentNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof AssessmentConflictError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (
    error instanceof InvalidAssignmentStateError ||
    error instanceof InvalidSubmissionStateError ||
    error instanceof InvalidScoreError ||
    error instanceof InvalidQuestionContentError ||
    error instanceof InvalidAnswerError
  ) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  console.error("[ACADIA] Erreur Academic Assessment :", error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}
