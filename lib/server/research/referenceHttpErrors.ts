// ============================================================
// ACADIA — TRADUCTION DES ERREURS DOMAINE → HTTP (mission Bibliography
// & Reference Intelligence) — même discipline que
// lib/server/assessment/httpErrors.ts.
// ============================================================

import { ReferenceForbiddenError, ReferenceNotFoundError, ReferenceInUseError, InvalidReferenceInputError } from "@/lib/core/research/reference/ReferenceTypes";

export function toReferenceErrorResponse(error: unknown): Response {
  if (error instanceof ReferenceForbiddenError) {
    return Response.json({ error: error.message }, { status: 403 });
  }
  if (error instanceof ReferenceNotFoundError) {
    return Response.json({ error: error.message }, { status: 404 });
  }
  if (error instanceof ReferenceInUseError) {
    return Response.json({ error: error.message }, { status: 409 });
  }
  if (error instanceof InvalidReferenceInputError) {
    return Response.json({ error: error.message }, { status: 400 });
  }
  console.error("[ACADIA] Erreur Bibliography & Reference Intelligence :", error);
  return Response.json({ error: "Une erreur est survenue." }, { status: 500 });
}
