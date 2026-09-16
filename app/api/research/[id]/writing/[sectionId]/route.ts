// ============================================================
// ACADIA — LECTURE ET VALIDATION D'UNE SECTION DE RÉDACTION (Mission 9)
//
// PATCH couvre les 3 transitions humaines possibles sur une section
// déjà générée : "edit" (le chercheur réécrit tout ou partie des
// blocs), "validate", "reject" — jamais un recalcul de contenu ici,
// voir WritingSectionService.editSection/setSectionStatus.
// ============================================================

import { z } from "zod";
import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { listSections, editSection, setSectionStatus, WritingForbiddenError, WritingNotFoundError } from "@/lib/server/research/WritingSectionService";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string; sectionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, sectionId } = await context.params;
  try {
    const sections = await listSections(user.id, id);
    const section = sections.find((s) => s.id === sectionId);
    if (!section) return notFound("Section introuvable.");
    return Response.json({ section }, { status: 200 });
  } catch (error) {
    if (error instanceof WritingNotFoundError) return notFound();
    if (error instanceof WritingForbiddenError) return forbidden(error.message, { actorId: user.id, entityType: "ResearchProject", entityId: id });
    throw error;
  }
}

const blockSchema = z.object({
  id: z.string(),
  type: z.enum(["PARAGRAPH", "HEADING", "LIST", "QUOTE", "NOTE"]),
  text: z.string(),
  items: z.array(z.string()).optional(),
  level: z.union([z.literal(2), z.literal(3)]).optional(),
  claimIds: z.array(z.string()).optional(),
  hasPlaceholder: z.boolean().optional(),
});

const bodySchema = z.union([
  z.object({ action: z.literal("edit"), blocks: z.array(blockSchema).min(1) }),
  z.object({ action: z.literal("validate") }),
  z.object({ action: z.literal("reject") }),
]);

export async function PATCH(request: Request, context: { params: Promise<{ id: string; sectionId: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id, sectionId } = await context.params;
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  try {
    if (parsed.data.action === "edit") {
      const section = await editSection(user.id, id, sectionId, parsed.data.blocks);
      return Response.json({ section }, { status: 200 });
    }
    const section = await setSectionStatus(user.id, id, sectionId, parsed.data.action === "validate" ? "VALIDATED" : "REJECTED");
    return Response.json({ section }, { status: 200 });
  } catch (error) {
    if (error instanceof WritingNotFoundError) return notFound(error.message || undefined);
    if (error instanceof WritingForbiddenError) return forbidden(error.message, { actorId: user.id, entityType: "ResearchProject", entityId: id });
    throw error;
  }
}
