// ============================================================
// ACADIA — ANNUAIRE DES DIRECTEURS DE MÉMOIRE (service serveur)
//
// L'administration tient la liste ; les étudiants n'en lisent que les
// directeurs actifs, sans les notes internes. Un directeur n'est jamais
// supprimé : il est désactivé, pour garder le lien avec les projets.
// Chaque écriture est tracée dans le journal d'audit.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { logAudit } from "@/lib/server/audit/AuditLog";
import {
  isLogicStatus,
  nameKey,
  parseDirectorLines,
  MAX_IMPORT_LINES,
  type DirectorAdmin,
  type DirectorInput,
  type DirectorLogicStatus,
  type DirectorPublic,
  type UnlistedDirectorName,
} from "@/lib/core/directors/directors";

export class DirectorError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function directorErrorResponse(error: unknown): Response {
  if (error instanceof DirectorError) return Response.json({ error: error.message }, { status: error.status });
  throw error;
}

const PUBLIC_SELECT = {
  id: true,
  fullName: true,
  academicTitle: true,
  institution: true,
  faculty: true,
  department: true,
  specialties: true,
  logicStatus: true,
} as const;

function toPublic(row: Omit<DirectorPublic, "logicStatus"> & { logicStatus: string }): DirectorPublic {
  return {
    id: row.id,
    fullName: row.fullName,
    academicTitle: row.academicTitle,
    institution: row.institution,
    faculty: row.faculty,
    department: row.department,
    specialties: row.specialties,
    logicStatus: isLogicStatus(row.logicStatus) ? row.logicStatus : "a_recueillir",
  };
}

/** Pour les étudiants : directeurs actifs uniquement, jamais les notes. */
export async function listActiveDirectors(): Promise<DirectorPublic[]> {
  const rows = await prisma.director.findMany({ where: { isActive: true }, select: PUBLIC_SELECT, orderBy: { fullName: "asc" } });
  return rows.map(toPublic);
}

/** Pour l'administration : tous les directeurs, avec notes et nombre de projets rattachés. */
export async function listAdminDirectors(): Promise<DirectorAdmin[]> {
  const rows = await prisma.director.findMany({
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    include: { _count: { select: { projects: true } } },
  });
  return rows.map((row) => ({
    ...toPublic(row),
    notes: row.notes,
    isActive: row.isActive,
    projects: row._count.projects,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

/** Noms tapés par les étudiants dont le directeur n'est pas dans l'annuaire (les plus fréquents d'abord). */
export async function listUnlistedNames(): Promise<UnlistedDirectorName[]> {
  const groups = await prisma.researchProject.groupBy({
    by: ["directorName"],
    where: { directorId: null, directorName: { not: null } },
    _count: { _all: true },
  });
  const merged = new Map<string, UnlistedDirectorName>();
  for (const g of groups) {
    const name = (g.directorName ?? "").replace(/\s+/g, " ").trim();
    const key = nameKey(name);
    if (!key) continue;
    const current = merged.get(key);
    if (current) current.projects += g._count._all;
    else merged.set(key, { name, projects: g._count._all });
  }
  return [...merged.values()].sort((a, b) => b.projects - a.projects || a.name.localeCompare(b.name, "fr"));
}

async function assertNoHomonym(fullName: string, exceptId?: string) {
  const key = nameKey(fullName);
  const all = await prisma.director.findMany({ select: { id: true, fullName: true } });
  if (all.some((d) => d.id !== exceptId && nameKey(d.fullName) === key)) {
    throw new DirectorError("Un directeur porte déjà ce nom dans l'annuaire.", 409);
  }
}

const orNull = (value: string | undefined) => {
  const v = (value ?? "").replace(/\s+/g, " ").trim();
  return v ? v : null;
};

export async function createDirector(actorId: string, input: DirectorInput & { notes?: string; logicStatus?: DirectorLogicStatus }): Promise<DirectorAdmin> {
  await assertNoHomonym(input.fullName);
  const row = await prisma.director.create({
    data: {
      fullName: input.fullName.replace(/\s+/g, " ").trim(),
      academicTitle: orNull(input.academicTitle),
      institution: orNull(input.institution),
      faculty: orNull(input.faculty),
      department: orNull(input.department),
      specialties: orNull(input.specialties),
      notes: input.notes?.trim() ? input.notes.trim() : null,
      logicStatus: input.logicStatus ?? "a_recueillir",
    },
  });
  await logAudit({ actorId, action: "DIRECTOR_CREATED", entityType: "Director", entityId: row.id });
  return { ...toPublic(row), notes: row.notes, isActive: row.isActive, projects: 0, createdAt: row.createdAt.toISOString(), updatedAt: row.updatedAt.toISOString() };
}

export interface DirectorPatch extends Partial<DirectorInput> {
  notes?: string;
  logicStatus?: DirectorLogicStatus;
  isActive?: boolean;
}

export async function updateDirector(actorId: string, id: string, patch: DirectorPatch): Promise<DirectorAdmin> {
  const existing = await prisma.director.findUnique({ where: { id } });
  if (!existing) throw new DirectorError("Directeur introuvable.", 404);
  if (patch.fullName !== undefined) await assertNoHomonym(patch.fullName, id);

  const data: Record<string, string | boolean | null> = {};
  if (patch.fullName !== undefined) data.fullName = patch.fullName.replace(/\s+/g, " ").trim();
  for (const key of ["academicTitle", "institution", "faculty", "department", "specialties"] as const) {
    if (patch[key] !== undefined) data[key] = orNull(patch[key]);
  }
  if (patch.notes !== undefined) data.notes = patch.notes.trim() ? patch.notes.trim() : null;
  if (patch.logicStatus !== undefined) data.logicStatus = patch.logicStatus;
  if (patch.isActive !== undefined) data.isActive = patch.isActive;

  const row = await prisma.director.update({ where: { id }, data, include: { _count: { select: { projects: true } } } });
  await logAudit({
    actorId,
    action: "DIRECTOR_UPDATED",
    entityType: "Director",
    entityId: id,
    metadata: { fields: Object.keys(data).join(","), isActive: patch.isActive },
  });
  return {
    ...toPublic(row),
    notes: row.notes,
    isActive: row.isActive,
    projects: row._count.projects,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Import d'une liste collée ; les noms déjà présents dans l'annuaire ne sont pas recréés. */
export async function importDirectors(actorId: string, text: string): Promise<{ created: number; existing: number; skipped: number }> {
  const lineCount = text.split(/\r?\n/).filter((l) => l.trim()).length;
  if (lineCount > MAX_IMPORT_LINES) throw new DirectorError(`Liste trop longue : ${MAX_IMPORT_LINES} lignes au maximum par envoi.`, 400);
  const { directors, skipped } = parseDirectorLines(text);
  if (!directors.length) throw new DirectorError("Aucun nom de directeur lisible dans la liste.", 400);

  const known = new Set((await prisma.director.findMany({ select: { fullName: true } })).map((d) => nameKey(d.fullName)));
  const fresh = directors.filter((d) => !known.has(nameKey(d.fullName)));
  if (fresh.length) {
    await prisma.director.createMany({
      data: fresh.map((d) => ({
        fullName: d.fullName,
        academicTitle: orNull(d.academicTitle),
        institution: orNull(d.institution),
        faculty: orNull(d.faculty),
        department: orNull(d.department),
        specialties: orNull(d.specialties),
      })),
    });
  }
  await logAudit({ actorId, action: "DIRECTORS_IMPORTED", entityType: "Director", metadata: { created: fresh.length, existing: directors.length - fresh.length, skipped } });
  return { created: fresh.length, existing: directors.length - fresh.length, skipped };
}

// ------------------------------------------------------------
// LIEN PROJET → DIRECTEUR (écrit à chaque synchronisation d'un projet)
//
// Un id inconnu n'est jamais écrit : la clé étrangère ferait échouer la
// synchronisation de tous les projets de l'étudiant. On garde alors le nom
// affiché seul. Un directeur désactivé APRÈS le choix de l'étudiant reste
// rattaché : le lien n'est jamais rompu en silence.
// ------------------------------------------------------------

export type DirectorLinkColumns = { directorId: string | null; directorName: string | null };

/** Ids d'annuaire réellement présents en base, vérifiés en une seule requête. */
export async function existingDirectorIds(ids: (string | null | undefined)[]): Promise<Set<string>> {
  const wanted = [...new Set(ids.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64))];
  if (!wanted.length) return new Set();
  const rows = await prisma.director.findMany({ where: { id: { in: wanted } }, select: { id: true } });
  return new Set(rows.map((r) => r.id));
}

export function directorLink(research: { directorId?: string | null; directorName?: string | null }, known: Set<string>): DirectorLinkColumns {
  const name = (research.directorName ?? "").replace(/\s+/g, " ").trim().slice(0, 200) || null;
  const id = research.directorId && known.has(research.directorId) ? research.directorId : null;
  return { directorId: id, directorName: name };
}

export async function resolveDirectorLink(directorId: string | null | undefined, directorName: string | null | undefined): Promise<DirectorLinkColumns> {
  return directorLink({ directorId, directorName }, await existingDirectorIds([directorId]));
}
