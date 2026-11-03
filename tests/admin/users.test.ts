import { beforeEach, describe, expect, it, vi } from "vitest";

// Session et base simulées : aucune donnée réelle.
const session = vi.hoisted(() => ({ user: null as { id: string; role: string } | null }));
const audit = vi.hoisted(() => ({ calls: [] as unknown[] }));
vi.mock("@/lib/supervision/apiAuth", () => ({
  getSessionUser: async () => session.user,
  unauthorized: () => Response.json({ error: "Non authentifié" }, { status: 401 }),
  forbidden: (message: string) => Response.json({ error: message }, { status: 403 }),
}));
vi.mock("@/lib/server/audit/AuditLog", () => ({ logAudit: async (x: unknown) => void audit.calls.push(x) }));
vi.mock("@/lib/server/db/prisma", () => {
  const user = { id: "u1", firstName: "Awa", lastName: "Mbuyi", email: "awa@exemple.test", role: "student", status: "active", domain: "economics", createdAt: new Date("2026-10-01T08:00:00Z"), lastLoginAt: null, studentProfile: { institution: "UNILU", faculty: "Économie", program: null, studyLevel: "L2", city: "Lubumbashi" }, _count: { researchProjects: 2, journeySessions: 1, stageApplications: 0 } };
  const formula = { ...user, id: "u2", firstName: "=HYPERLINK(\"x\")", email: "b@exemple.test" };
  return {
    prisma: {
      user: {
        count: async () => 2,
        findMany: async () => [user, formula],
        groupBy: async () => [{ role: "student", _count: { _all: 2 } }],
      },
    },
  };
});

import { GET } from "@/app/api/admin/users/route";
import { usersCsv } from "@/lib/server/admin/UsersService";

const get = (query = "") => GET(new Request(`http://localhost/api/admin/users${query}`));
let n = 0;
beforeEach(() => {
  n += 1;
  audit.calls = [];
  session.user = { id: `admin-${n}`, role: "admin" };
});

describe("comptes inscrits (administration)", () => {
  it("401 sans session, 403 pour un étudiant", async () => {
    session.user = null;
    expect((await get()).status).toBe(401);
    session.user = { id: "etudiant", role: "student" };
    expect((await get()).status).toBe(403);
  });

  it("liste paginée avec statistiques, sans mot de passe", async () => {
    const res = await get("?q=awa&role=student");
    const body = (await res.json()) as { total: number; users: Array<Record<string, unknown>>; stats: { byRole: Record<string, number> } };
    expect([res.status, body.total, body.users[0].institution, body.users[0].projects, body.stats.byRole.student]).toEqual([200, 2, "UNILU", 2, 2]);
    expect(JSON.stringify(body)).not.toMatch(/password/i);
  });

  it("export CSV pour Excel : BOM, « ; », formule neutralisée, export tracé dans l'audit", async () => {
    const res = await get("?format=csv");
    const bytes = new Uint8Array(await res.arrayBuffer());
    const csv = new TextDecoder().decode(bytes);
    expect(res.headers.get("Content-Type")).toContain("text/csv");
    // BOM UTF-8 (EF BB BF) : Excel lit les accents correctement.
    expect([...bytes.slice(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
    expect(csv.split("\r\n")[0]).toContain("Prénom;Nom;E-mail;Rôle");
    expect(csv).toContain("Awa;Mbuyi;awa@exemple.test;Étudiant");
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(audit.calls).toEqual([expect.objectContaining({ action: "EXPORT_CREATED", entityType: "AdminUsers" })]);
  });

  it("paramètres invalides refusés", async () => {
    expect((await get("?role=root")).status).toBe(400);
  });

  it("CSV vide : seulement l'en-tête", () => {
    expect(usersCsv([]).split("\r\n")).toHaveLength(1);
  });
});
