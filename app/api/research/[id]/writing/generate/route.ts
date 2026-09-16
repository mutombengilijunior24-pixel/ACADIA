// ============================================================
// ACADIA — GÉNÉRATION D'UNE SECTION DE RÉDACTION (Mission 9)
//
// Un appel unique couvre les 4 types génératifs (IA réelle,
// ResearchWritingAI.ts) et les 3 types adaptateurs (déterministes,
// WritingAdapters.ts) — le choix est interne à WritingSectionService,
// jamais exposé au client (mission §37 : le chercheur ne doit pas
// avoir à savoir "quel moteur" produit quoi).
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { generateSection, WritingForbiddenError, WritingNotFoundError } from "@/lib/server/research/WritingSectionService";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  type: z.enum(["INTRODUCTION", "PROBLEMATIC", "LITERATURE_REVIEW", "METHODOLOGY", "DISCUSSION", "CONCLUSION", "RECOMMENDATIONS"]),
});

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Corps de requête invalide — 'type' est requis." }, { status: 400 });
  }

  try {
    const section = await generateSection(id, parsed.data.type, { userId: user.id });
    return Response.json({ section }, { status: 201 });
  } catch (error) {
    if (error instanceof WritingNotFoundError) return notFound();
    if (error instanceof WritingForbiddenError) return forbidden(error.message, { actorId: user.id, entityType: "ResearchProject", entityId: id });
    const message = error instanceof Error ? error.message : "Échec de la génération.";
    return Response.json({ error: message }, { status: 502 });
  }
}
