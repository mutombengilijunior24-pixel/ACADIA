// ============================================================
// ACADIA — IMPORT BIBTEX / RIS (mission Bibliography & Reference
// Intelligence §11/§12)
//
// Parsing déterministe (BibliographyImport.ts) puis persistance via
// ReferenceService.createReference (même chemin qu'une saisie
// manuelle — jamais un second système d'écriture). Une entrée mal
// formée est reportée dans `errors`, jamais silencieusement perdue.
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";
import { parseBibTeX, parseRIS } from "@/lib/server/research/BibliographyImport";
import { createReference, requireOwnedProject } from "@/lib/server/research/ReferenceService";
import { toReferenceErrorResponse } from "@/lib/server/research/referenceHttpErrors";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { trackProductEvent } from "@/lib/server/analytics/ProductEvents";
import type { Reference } from "@prisma/client";
import type { PossibleDuplicateMatch } from "@/lib/core/research/reference/ReferenceTypes";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  format: z.enum(["bibtex", "ris"]),
  text: z.string().min(1).max(2_000_000),
});

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Requête invalide (format et text sont requis)." }, { status: 400 });
  }

  const parseResult = parsed.data.format === "bibtex" ? parseBibTeX(parsed.data.text) : parseRIS(parsed.data.text);

  const created: Reference[] = [];
  const duplicatesByReference: Record<string, PossibleDuplicateMatch[]> = {};
  const creationErrors: string[] = [];

  try {
    // Ownership vérifiée EN AMONT, même si 0 référence n'a pu être
    // parsée — sinon un id de projet invalide/étranger passerait
    // silencieusement (aucune itération dans la boucle ci-dessous).
    await requireOwnedProject(user.id, id);
    for (const input of parseResult.references) {
      try {
        const result = await createReference(user.id, id, input);
        created.push(result.reference);
        if (result.possibleDuplicates.length > 0) duplicatesByReference[result.reference.id] = result.possibleDuplicates;
      } catch (error) {
        creationErrors.push(error instanceof Error ? error.message : "Erreur inconnue lors de la création d'une référence importée.");
      }
    }
  } catch (error) {
    return toReferenceErrorResponse(error);
  }

  await logAudit({ actorId: user.id, action: "REFERENCE_IMPORTED", entityType: "ResearchProject", entityId: id, metadata: { format: parsed.data.format, created: created.length, errors: parseResult.errors.length + creationErrors.length } });
  await trackProductEvent({ userId: user.id, projectId: id, eventType: "REFERENCE_IMPORTED", metadata: { format: parsed.data.format, created: created.length } });

  return Response.json(
    { created, errors: [...parseResult.errors, ...creationErrors], duplicatesByReference },
    { status: 200 }
  );
}
