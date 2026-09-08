// ============================================================
// ACADIA — FEEDBACK PRODUIT (admin) — Bloc 2, 08/09/2026
//
// Uniquement ProductFeedback (question/satisfaction) — les
// problèmes et suggestions vivent dans BugReport/FeatureRequest
// (voir /api/admin/product/bugs et /features), jamais dupliqués ici.
// ============================================================

import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { prisma } from "@/lib/server/db/prisma";

export const runtime = "nodejs";

const TYPES = ["question", "satisfaction"] as const;

export async function GET(request: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");

  const feedback = await prisma.productFeedback.findMany({
    where: {
      ...(type && TYPES.includes(type as (typeof TYPES)[number]) ? { type } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { user: { select: { firstName: true, email: true } } },
  });

  return Response.json({ feedback }, { status: 200 });
}
