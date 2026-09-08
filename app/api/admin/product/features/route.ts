// ============================================================
// ACADIA — DEMANDES DE FONCTIONNALITÉ (admin) — Bloc 2, 08/09/2026
// ============================================================

import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

const STATUSES = ["SUBMITTED", "REVIEWING", "PLANNED", "IN_PROGRESS", "DONE", "DECLINED"] as const;

export async function GET(request: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  const features = await prisma.featureRequest.findMany({
    where: {
      ...(status && STATUSES.includes(status as (typeof STATUSES)[number]) ? { status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { firstName: true, email: true } } },
  });

  return Response.json({ features }, { status: 200 });
}

const patchSchema = z.object({
  id: z.string().min(1),
  status: z.enum(STATUSES),
});

export async function PATCH(request: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const parsed = patchSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const existing = await prisma.featureRequest.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return Response.json({ error: "Demande introuvable." }, { status: 404 });

  const feature = await prisma.featureRequest.update({
    where: { id: parsed.data.id },
    data: { status: parsed.data.status },
  });

  return Response.json({ feature }, { status: 200 });
}
