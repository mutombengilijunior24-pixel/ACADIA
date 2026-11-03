// ============================================================
// ACADIA — COMPTES INSCRITS (admin) : liste, recherche, export CSV
//
// Lecture seule. requireAdmin() sur chaque appel ; l'export est tracé
// dans le journal d'audit (qui, quand, combien de lignes).
// ============================================================

import { z } from "zod";

import { requireAdmin } from "@/lib/server/admin/adminAuth";
import { exportUsers, listUsers, USER_ROLES, usersCsv, usersStats } from "@/lib/server/admin/UsersService";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

const querySchema = z.object({
  q: z.string().trim().max(100).default(""),
  role: z.enum([...USER_ROLES, "all"]).default("all"),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  format: z.enum(["json", "csv"]).default("json"),
});

const PAGE_SIZE = 50;

export async function GET(request: Request) {
  const gate = await requireAdmin();
  if ("response" in gate) return gate.response;
  const parsed = querySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: "Paramètres invalides." }, { status: 400 });
  const { q, role, page, format } = parsed.data;
  // Limite propre à l'export : un export juste après un clic de filtre n'est pas une rafale.
  const limit = format === "csv" ? rateLimiter.check(rateLimitKey("admin-users-export", gate.user.id), 30, 60 * 60 * 1000) : rateLimiter.check(rateLimitKey("admin-users", gate.user.id), 300, 60 * 60 * 1000);
  if (!limit.allowed) return Response.json({ error: "Trop de requêtes : réessayez dans quelques minutes." }, { status: 429 });

  if (format === "csv") {
    const rows = await exportUsers(q, role);
    await logAudit({ actorId: gate.user.id, action: "EXPORT_CREATED", entityType: "AdminUsers", metadata: { rows: rows.length, role, search: q ? "oui" : "non" } });
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(usersCsv(rows), { status: 200, headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="acadia-comptes-inscrits-${stamp}.csv"`, "Cache-Control": "no-store" } });
  }

  const [list, stats] = await Promise.all([listUsers({ q, role, page, pageSize: PAGE_SIZE }), usersStats()]);
  return Response.json({ ...list, page, pageSize: PAGE_SIZE, stats }, { status: 200, headers: { "Cache-Control": "no-store" } });
}
