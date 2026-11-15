import { beforeEach, describe, expect, it, vi } from "vitest";

// Rattachement compte directeur <-> fiche de l'annuaire, et canevas appliqué automatiquement.
// Session et base simulées (en mémoire) : aucune donnée réelle.

type Director = {
  id: string;
  fullName: string;
  academicTitle: string | null;
  institution: string | null;
  faculty: string | null;
  department: string | null;
  specialties: string | null;
  notes: string | null;
  logicStatus: string;
  isActive: boolean;
  userId: string | null;
  linkStatus: string | null;
  linkRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};
type Canevas = { id: string; supervisorId: string; academicYear: string; workTypes: string; steps: string; isActive: boolean; updatedAt: Date };

const session = vi.hoisted(() => ({ user: null as { id: string; role: string } | null }));
const audit = vi.hoisted(() => ({ calls: [] as Array<{ action: string }> }));
const db = vi.hoisted(() => ({
  directors: [] as Director[],
  canevas: [] as Canevas[],
  users: {} as Record<string, { email: string; firstName: string; lastName: string | null }>,
}));

vi.mock("@/lib/supervision/apiAuth", () => ({
  getSessionUser: async () => session.user,
  unauthorized: () => Response.json({ error: "Non authentifié" }, { status: 401 }),
  forbidden: (message: string) => Response.json({ error: message }, { status: 403 }),
}));
vi.mock("@/lib/server/audit/AuditLog", () => ({ logAudit: async (x: { action: string }) => void audit.calls.push(x) }));
vi.mock("@/lib/server/db/prisma", () => {
  type Where = { id?: string | { in: string[] }; userId?: string | null; isActive?: boolean; supervisorId?: string | { in: string[] } };
  const matches = (d: Record<string, unknown>, where: Where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (v && typeof v === "object" && "in" in v) return (v as { in: string[] }).in.includes(d[k] as string);
      return d[k] === v;
    });
  const withRelations = (d: Director, args: { select?: Record<string, boolean>; include?: Record<string, unknown> } = {}) => {
    if (args.select) return Object.fromEntries(Object.keys(args.select).map((k) => [k, d[k as keyof Director]]));
    const out: Record<string, unknown> = { ...d };
    if (args.include) {
      out._count = { projects: d.id === "dir-ditend" ? 3 : 0 };
      out.account = d.userId ? db.users[d.userId] ?? null : null;
    }
    return out;
  };
  return {
    prisma: {
      director: {
        findMany: async (args: { where?: Where; select?: Record<string, boolean>; include?: Record<string, unknown> } = {}) =>
          db.directors.filter((d) => matches(d, args.where)).map((d) => withRelations(d, args)),
        findUnique: async (args: { where: Where; select?: Record<string, boolean>; include?: Record<string, unknown> }) => {
          const d = db.directors.find((x) => matches(x, args.where));
          return d ? withRelations(d, args) : null;
        },
        updateMany: async ({ where, data }: { where: Where; data: Partial<Director> }) => {
          const hits = db.directors.filter((d) => matches(d, where));
          if (data.userId && db.directors.some((d) => d.userId === data.userId && !hits.includes(d))) throw Object.assign(new Error("unique"), { code: "P2002" });
          hits.forEach((d) => Object.assign(d, data));
          return { count: hits.length };
        },
        update: async (args: { where: Where; data: Partial<Director>; include?: Record<string, unknown> }) => {
          const d = db.directors.find((x) => matches(x, args.where))!;
          Object.assign(d, args.data);
          return withRelations(d, args);
        },
      },
      supervisionCanevas: {
        findMany: async ({ where }: { where: Where }) => db.canevas.filter((c) => matches(c, where)).map((c) => ({ supervisorId: c.supervisorId })),
        findFirst: async ({ where }: { where: Where }) => db.canevas.filter((c) => matches(c, where)).sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0] ?? null,
        count: async ({ where }: { where: Where }) => db.canevas.filter((c) => matches(c, where)).length,
      },
    },
  };
});

import { GET as linkGet, POST as linkPost, DELETE as linkDelete } from "@/app/api/supervision/directory-link/route";
import { GET as canevasGet } from "@/app/api/directors/[id]/canevas/route";
import { GET as publicList } from "@/app/api/directors/route";
import { PATCH as adminPatch } from "@/app/api/admin/directors/[id]/route";

const director = (id: string, fullName: string, academicTitle: string): Director => ({
  id,
  fullName,
  academicTitle,
  institution: "UNILU",
  faculty: null,
  department: null,
  specialties: null,
  notes: null,
  logicStatus: "a_recueillir",
  isActive: true,
  userId: null,
  linkStatus: null,
  linkRequestedAt: null,
  createdAt: new Date("2026-11-07T09:00:00Z"),
  updatedAt: new Date("2026-11-07T09:00:00Z"),
});

const as = (id: string, role: string) => (session.user = { id, role });
const request = (directorId: string) => linkPost(new Request("http://x/api/supervision/directory-link", { method: "POST", body: JSON.stringify({ directorId }) }));
const decide = (id: string, link: string) =>
  adminPatch(new Request(`http://x/api/admin/directors/${id}`, { method: "PATCH", body: JSON.stringify({ link }) }), { params: Promise.resolve({ id }) });
const canevasOf = async (id: string) => ((await (await canevasGet(new Request("http://x"), { params: Promise.resolve({ id }) })).json()) as { canevas: { steps: { name: string }[]; academicYear: string } | null }).canevas;
const publicDitend = async () => ((await (await publicList()).json()) as { directors: Array<{ id: string; logicStatus: string; hasCanevas: boolean }> }).directors.find((d) => d.id === "dir-ditend")!;
const setCanevas = (supervisorId: string, steps: string[], at: string) => {
  db.canevas.forEach((c) => c.supervisorId === supervisorId && (c.isActive = false));
  db.canevas.push({ id: `c${db.canevas.length}`, supervisorId, academicYear: "2026-2027", workTypes: '["memoire_master"]', steps: JSON.stringify(steps.map((name, order) => ({ name, order: steps.length - order, required: true }))), isActive: true, updatedAt: new Date(at) });
};

beforeEach(() => {
  db.directors = [director("dir-ditend", "DITEND", "PO"), director("dir-lena", "LENA", "Dr")];
  db.canevas = [];
  db.users = { "prof-1": { email: "ditend@unilu.test", firstName: "Jean", lastName: "Ditend" }, "prof-2": { email: "autre@unilu.test", firstName: "Autre", lastName: null } };
  audit.calls = [];
  session.user = null;
});

describe("rattachement d'un compte directeur à sa fiche", () => {
  it("réservé aux comptes directeur", async () => {
    expect((await linkGet()).status).toBe(401);
    as("etudiant", "student");
    expect((await linkGet()).status).toBe(403);
    expect((await request("dir-ditend")).status).toBe(403);
  });

  it("le directeur choisit son nom : demande en attente, puis le nom n'est plus proposé à un autre compte", async () => {
    as("prof-1", "supervisor");
    const before = (await (await linkGet()).json()) as { choices: { id: string; label: string }[]; link: null };
    expect(before.choices.map((c) => c.label)).toEqual(["PO DITEND", "Dr LENA"]);
    const after = (await (await request("dir-ditend")).json()) as { link: { status: string; label: string } };
    expect(after.link).toMatchObject({ status: "demande", label: "PO DITEND" });
    expect(audit.calls.map((c) => c.action)).toEqual(["DIRECTOR_LINK_REQUESTED"]);

    as("prof-2", "supervisor");
    const other = (await (await linkGet()).json()) as { choices: { label: string }[] };
    expect(other.choices.map((c) => c.label)).toEqual(["Dr LENA"]);
    expect((await request("dir-ditend")).status).toBe(409);
  });

  it("un compte ne se rattache qu'à une seule fiche ; il peut annuler sa demande", async () => {
    as("prof-1", "supervisor");
    await request("dir-ditend");
    expect((await request("dir-lena")).status).toBe(409);
    const cancelled = (await (await linkDelete()).json()) as { link: null; choices: unknown[] };
    expect(cancelled.link).toBeNull();
    expect(cancelled.choices).toHaveLength(2);
  });
});

describe("canevas appliqué automatiquement aux étudiants", () => {
  it("rien tant que l'administration n'a pas validé ; validé : le canevas actif s'applique, et chaque ajustement aussi", async () => {
    setCanevas("prof-1", ["Introduction", "Revue", "Méthodologie"], "2026-11-10T10:00:00Z");
    as("prof-1", "supervisor");
    await request("dir-ditend");

    as("etudiant", "student");
    expect(await canevasOf("dir-ditend")).toBeNull();
    expect(await publicDitend()).toMatchObject({ hasCanevas: false, logicStatus: "a_recueillir" });

    // Seul un administrateur valide.
    expect((await decide("dir-ditend", "valider")).status).toBe(403);
    as("admin", "admin");
    const validated = (await (await decide("dir-ditend", "valider")).json()) as { director: { account: { status: string; accountEmail: string }; hasCanevas: boolean } };
    expect(validated.director.account).toMatchObject({ status: "valide", accountEmail: "ditend@unilu.test" });
    expect(validated.director.hasCanevas).toBe(true);

    as("etudiant", "student");
    const canevas = await canevasOf("dir-ditend");
    // Étapes remises dans l'ordre défini par le directeur (champ « order »).
    expect(canevas?.steps.map((s) => s.name)).toEqual(["Méthodologie", "Revue", "Introduction"]);
    expect(await publicDitend()).toMatchObject({ hasCanevas: true, logicStatus: "integre" });

    // Le directeur ajuste son canevas : l'étudiant voit la nouvelle version, sans aucune intervention.
    setCanevas("prof-1", ["Données", "Interprétation"], "2026-11-15T10:00:00Z");
    expect((await canevasOf("dir-ditend"))?.steps.map((s) => s.name)).toEqual(["Interprétation", "Données"]);
  });

  it("rattachement validé mais aucun canevas actif : logique générale d'ACADIA", async () => {
    as("prof-1", "supervisor");
    await request("dir-ditend");
    as("admin", "admin");
    await decide("dir-ditend", "valider");
    as("etudiant", "student");
    expect(await canevasOf("dir-ditend")).toBeNull();
    expect(await publicDitend()).toMatchObject({ hasCanevas: false });
  });

  it("rattachement retiré : retour à la logique générale, et la fiche redevient libre", async () => {
    setCanevas("prof-1", ["Introduction"], "2026-11-10T10:00:00Z");
    as("prof-1", "supervisor");
    await request("dir-ditend");
    as("admin", "admin");
    await decide("dir-ditend", "valider");
    const removed = (await (await decide("dir-ditend", "refuser")).json()) as { director: { account: null; hasCanevas: boolean } };
    expect(removed.director).toMatchObject({ account: null, hasCanevas: false });
    expect(audit.calls.map((c) => c.action)).toEqual(["DIRECTOR_LINK_REQUESTED", "DIRECTOR_LINK_VALIDATED", "DIRECTOR_LINK_REMOVED"]);
    as("etudiant", "student");
    expect(await canevasOf("dir-ditend")).toBeNull();
    as("prof-2", "supervisor");
    expect((await request("dir-ditend")).status).toBe(200);
  });

  it("décision sur une fiche sans compte rattaché : refusée", async () => {
    as("admin", "admin");
    expect((await decide("dir-lena", "valider")).status).toBe(409);
    expect((await decide("dir-lena", "n-importe")).status).toBe(400);
  });
});
