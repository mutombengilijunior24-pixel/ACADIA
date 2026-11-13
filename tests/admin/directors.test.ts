import { beforeEach, describe, expect, it, vi } from "vitest";

// Session et base simulées (annuaire en mémoire) : aucune donnée réelle.
type Row = {
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
  createdAt: Date;
  updatedAt: Date;
};

const session = vi.hoisted(() => ({ user: null as { id: string; role: string } | null }));
const audit = vi.hoisted(() => ({ calls: [] as Array<{ action: string }> }));
const db = vi.hoisted(() => ({ directors: [] as Row[], seq: 0 }));

vi.mock("@/lib/supervision/apiAuth", () => ({
  getSessionUser: async () => session.user,
  unauthorized: () => Response.json({ error: "Non authentifié" }, { status: 401 }),
  forbidden: (message: string) => Response.json({ error: message }, { status: 403 }),
}));
vi.mock("@/lib/server/audit/AuditLog", () => ({ logAudit: async (x: { action: string }) => void audit.calls.push(x) }));
vi.mock("@/lib/server/db/prisma", () => {
  const blank = (data: Partial<Row>): Row => {
    db.seq += 1;
    const now = new Date("2026-11-13T08:00:00Z");
    return { id: `d${db.seq}`, fullName: "", academicTitle: null, institution: null, faculty: null, department: null, specialties: null, notes: null, logicStatus: "a_recueillir", isActive: true, createdAt: now, updatedAt: now, ...data };
  };
  const pick = (row: Row, select?: Record<string, boolean>) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k as keyof Row]])) : row);
  return {
    prisma: {
      director: {
        findMany: async (args: { where?: { isActive?: boolean; id?: { in: string[] } }; select?: Record<string, boolean>; include?: unknown } = {}) =>
          db.directors
            .filter((d) => (args.where?.isActive === undefined || d.isActive === args.where.isActive) && (!args.where?.id || args.where.id.in.includes(d.id)))
            .map((d) => (args.include ? { ...d, _count: { projects: 0 } } : pick(d, args.select))),
        findUnique: async ({ where }: { where: { id: string } }) => db.directors.find((d) => d.id === where.id) ?? null,
        create: async ({ data }: { data: Partial<Row> }) => {
          const row = blank(data);
          db.directors.push(row);
          return row;
        },
        createMany: async ({ data }: { data: Partial<Row>[] }) => {
          data.forEach((d) => db.directors.push(blank(d)));
          return { count: data.length };
        },
        update: async ({ where, data }: { where: { id: string }; data: Partial<Row> }) => {
          const row = db.directors.find((d) => d.id === where.id)!;
          Object.assign(row, data);
          return { ...row, _count: { projects: 2 } };
        },
      },
      researchProject: {
        groupBy: async () => [
          { directorName: "Prof  Mutombo", _count: { _all: 2 } },
          { directorName: "prof mutombo", _count: { _all: 1 } },
          { directorName: "Dr Ilunga", _count: { _all: 1 } },
        ],
      },
    },
  };
});

import { GET as publicGet } from "@/app/api/directors/route";
import { GET as adminGet, POST as adminPost } from "@/app/api/admin/directors/route";
import { PATCH as adminPatch } from "@/app/api/admin/directors/[id]/route";
import { matchesInstitution, parseDirectorLines, sortForUniversity, directorLabel } from "@/lib/core/directors/directors";
import { directorLink, existingDirectorIds } from "@/lib/server/directors/DirectorsService";

const post = (body: unknown) => adminPost(new Request("http://localhost/api/admin/directors", { method: "POST", body: JSON.stringify(body) }));
const patch = (id: string, body: unknown) =>
  adminPatch(new Request(`http://localhost/api/admin/directors/${id}`, { method: "PATCH", body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

beforeEach(() => {
  db.directors = [];
  db.seq = 0;
  audit.calls = [];
  session.user = { id: "admin-1", role: "admin" };
});

describe("liste collée de directeurs", () => {
  it("une ligne par directeur, « ; » ou tabulation, nom seul obligatoire, doublons et lignes vides ignorés", () => {
    const { directors, skipped } = parseDirectorLines(
      ["KABAMBA Jean ; Prof ; UNILU ; Sciences Économiques ; Économie ; Économétrie, Finance", "", "  ", "Kabamba  jean", "MUTOMBO Paul\tDr\tUNIKIN", "ab ; Dr", "Éloi Kasongo"].join("\n")
    );
    expect(directors).toEqual([
      { fullName: "KABAMBA Jean", academicTitle: "Prof", institution: "UNILU", faculty: "Sciences Économiques", department: "Économie", specialties: "Économétrie, Finance" },
      { fullName: "MUTOMBO Paul", academicTitle: "Dr", institution: "UNIKIN" },
      { fullName: "Éloi Kasongo" },
    ]);
    // « Kabamba  jean » (doublon) et « ab » (nom trop court) ; les lignes vides ne comptent pas.
    expect(skipped).toBe(2);
  });

  it("libellé : titre puis nom, ou le nom seul", () => {
    expect(directorLabel({ fullName: "DITEND", academicTitle: "PO" })).toBe("PO DITEND");
    expect(directorLabel({ fullName: "LENA", academicTitle: null })).toBe("LENA");
  });
});

describe("rapprochement université ↔ directeur", () => {
  it("acronyme, nom complet connu, et jamais une autre université", () => {
    expect(matchesInstitution("UNILU", "Université de Lubumbashi (UNILU)")).toBe(true);
    expect(matchesInstitution("UNILU", "université de lubumbashi")).toBe(true);
    expect(matchesInstitution("unilu", "UNILU")).toBe(true);
    expect(matchesInstitution("UNILU", "Université de Kinshasa (UNIKIN)")).toBe(false);
    expect(matchesInstitution("UPC", "Université Protestante au Congo")).toBe(true);
    expect(matchesInstitution(null, "UNILU")).toBe(false);
    expect(matchesInstitution("UNILU", "")).toBe(false);
  });

  it("les directeurs de l'université saisie d'abord, puis les autres, par ordre alphabétique", () => {
    const list = [
      { fullName: "ZOLA", institution: "UNILU" },
      { fullName: "AMANI", institution: "UNIKIN" },
      { fullName: "BAKA", institution: "UNILU" },
      { fullName: "CIZA", institution: null },
    ];
    const { matching, others } = sortForUniversity(list, "Université de Lubumbashi (UNILU)");
    expect(matching.map((d) => d.fullName)).toEqual(["BAKA", "ZOLA"]);
    expect(others.map((d) => d.fullName)).toEqual(["AMANI", "CIZA"]);
  });
});

describe("annuaire : accès et écritures", () => {
  it("lecture étudiante : 401 sans session ; seulement les actifs, jamais les notes", async () => {
    db.directors.push(
      { id: "a", fullName: "ACTIF", academicTitle: "Prof", institution: "UNILU", faculty: null, department: null, specialties: null, notes: "exige 3 hypothèses", logicStatus: "en_cours", isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: "b", fullName: "INACTIF", academicTitle: null, institution: null, faculty: null, department: null, specialties: null, notes: null, logicStatus: "a_recueillir", isActive: false, createdAt: new Date(), updatedAt: new Date() }
    );
    session.user = null;
    expect((await publicGet()).status).toBe(401);
    session.user = { id: "etudiant", role: "student" };
    const res = await publicGet();
    const body = (await res.json()) as { directors: Array<Record<string, unknown>> };
    expect(body.directors.map((d) => d.fullName)).toEqual(["ACTIF"]);
    expect(JSON.stringify(body)).not.toContain("hypothèses");
    expect(body.directors[0]).not.toHaveProperty("notes");
  });

  it("administration : 401 sans session, 403 pour un étudiant", async () => {
    session.user = null;
    expect((await adminGet()).status).toBe(401);
    session.user = { id: "etudiant", role: "student" };
    expect((await adminGet()).status).toBe(403);
    expect((await post({ fullName: "KABAMBA" })).status).toBe(403);
  });

  it("ajout : nom obligatoire, homonyme refusé, écriture tracée", async () => {
    expect((await post({ fullName: "ab" })).status).toBe(400);
    const res = await post({ fullName: "  KABAMBA   Jean ", academicTitle: "Prof", institution: "UNILU", specialties: "" });
    const body = (await res.json()) as { director: Record<string, unknown> };
    expect(res.status).toBe(201);
    expect([body.director.fullName, body.director.specialties, body.director.logicStatus]).toEqual(["KABAMBA Jean", null, "a_recueillir"]);
    expect((await post({ fullName: "kabamba jean" })).status).toBe(409);
    expect(audit.calls.map((c) => c.action)).toEqual(["DIRECTOR_CREATED"]);
  });

  it("import d'une liste : les noms déjà présents ne sont pas recréés", async () => {
    await post({ fullName: "DITEND", academicTitle: "PO" });
    const res = await post({ bulk: "DITEND ; PO\nLENA ; Dr\nMAGUY ; Prof\n\nLena" });
    const body = (await res.json()) as { imported: { created: number; existing: number; skipped: number } };
    expect(body.imported).toEqual({ created: 2, existing: 1, skipped: 1 });
    expect(db.directors.map((d) => d.fullName)).toEqual(["DITEND", "LENA", "MAGUY"]);
    expect((await post({ bulk: "\n \n" })).status).toBe(400);
  });

  it("modification : désactivation, état du canevas, notes ; fiche inconnue → 404", async () => {
    await post({ fullName: "MBAYO", academicTitle: "PO" });
    const res = await patch("d1", { isActive: false, logicStatus: "integre", notes: "Plan en 4 chapitres" });
    const body = (await res.json()) as { director: Record<string, unknown> };
    expect([res.status, body.director.isActive, body.director.logicStatus, body.director.notes]).toEqual([200, false, "integre", "Plan en 4 chapitres"]);
    expect((await patch("d1", { logicStatus: "valide" })).status).toBe(400);
    expect((await patch("d1", {})).status).toBe(400);
    expect((await patch("inconnu", { notes: "x" })).status).toBe(404);
  });

  it("noms saisis hors liste regroupés sans tenir compte des espaces ni de la casse", async () => {
    const body = (await (await adminGet()).json()) as { unlisted: Array<{ name: string; projects: number }> };
    expect(body.unlisted).toEqual([
      { name: "Prof Mutombo", projects: 3 },
      { name: "Dr Ilunga", projects: 1 },
    ]);
  });
});

describe("lien projet → directeur (synchronisation)", () => {
  it("un id inconnu n'est jamais écrit : on garde le nom affiché", async () => {
    await post({ fullName: "KALABA BIN SANKWE", academicTitle: "Prof" });
    const known = await existingDirectorIds(["d1", "fantome", undefined, ""]);
    expect([...known]).toEqual(["d1"]);
    expect(directorLink({ directorId: "d1", directorName: "Prof KALABA BIN SANKWE" }, known)).toEqual({ directorId: "d1", directorName: "Prof KALABA BIN SANKWE" });
    expect(directorLink({ directorId: "fantome", directorName: " Prof  X " }, known)).toEqual({ directorId: null, directorName: "Prof X" });
    expect(directorLink({ directorId: "", directorName: "" }, known)).toEqual({ directorId: null, directorName: null });
  });
});
