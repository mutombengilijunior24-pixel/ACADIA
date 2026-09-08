// ============================================================
// ACADIA — SIGNALEMENTS DE BUG (admin) — Bloc 2, 08/09/2026
// ============================================================

import { z } from "zod";
import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

const STATUSES = ["OPEN", "IN_REVIEW", "RESOLVED", "CLOSED"] as const;
const SEVERITIES = ["LOW", "MEDIUM", "HIGH", "BLOCKER"] as const;

export async function GET(request: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const severity = url.searchParams.get("severity");

  const bugs = await prisma.bugReport.findMany({
    where: {
      ...(status && STATUSES.includes(status as (typeof STATUSES)[number]) ? { status } : {}),
      ...(severity && SEVERITIES.includes(severity as (typeof SEVERITIES)[number]) ? { severity } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { firstName: true, email: true } } },
  });

  return Response.json({ bugs }, { status: 200 });
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

  const existing = await prisma.bugReport.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return Response.json({ error: "Signalement introuvable." }, { status: 404 });

  const isClosing = parsed.data.status === "RESOLVED" || parsed.data.status === "CLOSED";

  const bug = await prisma.bugReport.update({
    where: { id: parsed.data.id },
    data: {
      status: parsed.data.status,
      resolvedAt: isClosing ? new Date() : null,
      resolvedBy: isClosing ? gate.user.id : null,
    },
  });

  return Response.json({ bug }, { status: 200 });
}
