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
  directorLabel,
  isLinkStatus,
  isLogicStatus,
  nameKey,
  parseDirectorLines,
  MAX_IMPORT_LINES,
  type DirectorAdmin,
  type DirectorCanevasView,
  type DirectorInput,
  type DirectorLinkStatus,
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
  userId: true,
  linkStatus: true,
} as const;

type PublicRow = Omit<DirectorPublic, "logicStatus" | "hasCanevas"> & { logicStatus: string; userId: string | null; linkStatus: string | null };

/** Comptes directeurs (parmi `userIds`) qui ont un canevas ACTIF. */
async function accountsWithActiveCanevas(userIds: (string | null)[]): Promise<Set<string>> {
  const ids = [...new Set(userIds.filter((id): id is string => Boolean(id)))];
  if (!ids.length) return new Set();
  const rows = await prisma.supervisionCanevas.findMany({ where: { supervisorId: { in: ids }, isActive: true }, select: { supervisorId: true } });
  return new Set(rows.map((r) => r.supervisorId));
}

/** Seul un rattachement VALIDÉ par l'administration fait appliquer le canevas du compte. */
const validatedAccount = (row: { userId: string | null; linkStatus: string | null }) => (row.linkStatus === "valide" && row.userId ? row.userId : null);

function toPublic(row: PublicRow, withCanevas: Set<string>): DirectorPublic {
  const account = validatedAccount(row);
  const hasCanevas = Boolean(account && withCanevas.has(account));
  return {
    id: row.id,
    fullName: row.fullName,
    academicTitle: row.academicTitle,
    institution: row.institution,
    faculty: row.faculty,
    department: row.department,
    specialties: row.specialties,
    // Automatique : un canevas actif du directeur vaut « intégré », sans intervention de l'administration.
    logicStatus: hasCanevas ? "integre" : isLogicStatus(row.logicStatus) ? row.logicStatus : "a_recueillir",
    hasCanevas,
  };
}

/** Pour les étudiants : directeurs actifs uniquement, jamais les notes. */
export async function listActiveDirectors(): Promise<DirectorPublic[]> {
  const rows = await prisma.director.findMany({ where: { isActive: true }, select: PUBLIC_SELECT, orderBy: { fullName: "asc" } });
  const withCanevas = await accountsWithActiveCanevas(rows.map(validatedAccount));
  return rows.map((row) => toPublic(row, withCanevas));
}

type AdminRow = PublicRow & {
  notes: string | null;
  isActive: boolean;
  linkRequestedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { projects: number };
  account: { email: string; firstName: string; lastName: string | null } | null;
};

const ADMIN_INCLUDE = { _count: { select: { projects: true } }, account: { select: { email: true, firstName: true, lastName: true } } } as const;

function toAdmin(row: AdminRow, withCanevas: Set<string>): DirectorAdmin {
  return {
    ...toPublic(row, withCanevas),
    notes: row.notes,
    isActive: row.isActive,
    projects: row._count.projects,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    account:
      row.account && isLinkStatus(row.linkStatus)
        ? {
            status: row.linkStatus,
            requestedAt: row.linkRequestedAt ? row.linkRequestedAt.toISOString() : null,
            accountName: [row.account.firstName, row.account.lastName].filter(Boolean).join(" "),
            accountEmail: row.account.email,
          }
        : null,
  };
}

/** Pour l'administration : tous les directeurs, avec notes, projets rattachés et compte directeur lié. */
export async function listAdminDirectors(): Promise<DirectorAdmin[]> {
  const rows = await prisma.director.findMany({ orderBy: [{ isActive: "desc" }, { fullName: "asc" }], include: ADMIN_INCLUDE });
  const withCanevas = await accountsWithActiveCanevas(rows.map(validatedAccount));
  return rows.map((row) => toAdmin(row, withCanevas));
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
  return toAdmin({ ...row, _count: { projects: 0 }, account: null }, new Set());
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

  const row = await prisma.director.update({ where: { id }, data, include: ADMIN_INCLUDE });
  await logAudit({
    actorId,
    action: "DIRECTOR_UPDATED",
    entityType: "Director",
    entityId: id,
    metadata: { fields: Object.keys(data).join(","), isActive: patch.isActive },
  });
  return toAdmin(row, await accountsWithActiveCanevas([validatedAccount(row)]));
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

// ------------------------------------------------------------
// CANEVAS DU DIRECTEUR, VU PAR L'ÉTUDIANT
//
// Le canevas ACTIF du compte rattaché et VALIDÉ s'applique automatiquement :
// chaque fois que le directeur l'ajuste, l'étudiant voit la nouvelle version.
// Sans rattachement validé ni canevas actif : null (logique générale d'ACADIA).
// ------------------------------------------------------------

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getDirectorCanevas(directorId: string): Promise<DirectorCanevasView | null> {
  const director = await prisma.director.findUnique({
    where: { id: directorId },
    select: { fullName: true, academicTitle: true, userId: true, linkStatus: true },
  });
  const account = director ? validatedAccount(director) : null;
  if (!director || !account) return null;
  const canevas = await prisma.supervisionCanevas.findFirst({ where: { supervisorId: account, isActive: true }, orderBy: { updatedAt: "desc" } });
  if (!canevas) return null;
  const steps = parseJson<{ name?: unknown; description?: unknown; order?: unknown; required?: unknown }[]>(canevas.steps, []);
  return {
    directorLabel: directorLabel(director),
    academicYear: canevas.academicYear,
    workTypes: parseJson<unknown[]>(canevas.workTypes, []).filter((w): w is string => typeof w === "string"),
    steps: steps
      .filter((s) => typeof s?.name === "string" && s.name.trim())
      .sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
      .map((s) => ({ name: String(s.name).trim(), description: typeof s.description === "string" && s.description.trim() ? s.description.trim() : null, required: s.required !== false })),
    updatedAt: canevas.updatedAt.toISOString(),
  };
}

// ------------------------------------------------------------
// RATTACHEMENT D'UN COMPTE DIRECTEUR À SA FICHE
//
// Le directeur (rôle supervisor) choisit son nom dans la liste : demande.
// L'administration valide (ou refuse) depuis « Directeurs de mémoire ».
// Une fiche ne peut être rattachée qu'à un seul compte, et un compte à une seule fiche.
// ------------------------------------------------------------

export interface MyDirectoryLink {
  link: { directorId: string; label: string; status: DirectorLinkStatus; requestedAt: string | null } | null;
  choices: { id: string; label: string; institution: string | null }[];
  /** Projets d'étudiants qui ont choisi ce directeur (seulement une fois le rattachement validé). */
  studentProjects: number;
  hasActiveCanevas: boolean;
}

export async function getMyDirectoryLink(userId: string): Promise<MyDirectoryLink> {
  const mine = await prisma.director.findUnique({ where: { userId }, include: { _count: { select: { projects: true } } } });
  const choices = mine
    ? []
    : (await prisma.director.findMany({ where: { isActive: true, userId: null }, select: { id: true, fullName: true, academicTitle: true, institution: true }, orderBy: { fullName: "asc" } })).map(
        (d) => ({ id: d.id, label: directorLabel(d), institution: d.institution })
      );
  const hasActiveCanevas = (await prisma.supervisionCanevas.count({ where: { supervisorId: userId, isActive: true } })) > 0;
  return {
    link:
      mine && isLinkStatus(mine.linkStatus)
        ? { directorId: mine.id, label: directorLabel(mine), status: mine.linkStatus, requestedAt: mine.linkRequestedAt ? mine.linkRequestedAt.toISOString() : null }
        : null,
    choices,
    studentProjects: mine?.linkStatus === "valide" ? mine._count.projects : 0,
    hasActiveCanevas,
  };
}

const isUniqueViolation = (error: unknown) => typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";

export async function requestDirectoryLink(userId: string, directorId: string): Promise<MyDirectoryLink> {
  const already = await prisma.director.findUnique({ where: { userId }, select: { fullName: true, academicTitle: true } });
  if (already) throw new DirectorError(`Votre compte est déjà rattaché à ${directorLabel(already)}. Annulez d'abord ce rattachement.`, 409);
  const target = await prisma.director.findUnique({ where: { id: directorId }, select: { isActive: true, userId: true } });
  if (!target || !target.isActive) throw new DirectorError("Directeur introuvable dans la liste.", 404);
  if (target.userId) throw new DirectorError("Ce nom est déjà rattaché à un autre compte directeur. Contactez l'équipe ACADIA.", 409);
  try {
    // Condition « userId: null » : deux demandes simultanées ne peuvent pas prendre la même fiche.
    const res = await prisma.director.updateMany({
      where: { id: directorId, userId: null, isActive: true },
      data: { userId, linkStatus: "demande", linkRequestedAt: new Date() },
    });
    if (res.count === 0) throw new DirectorError("Ce nom vient d'être rattaché à un autre compte directeur. Contactez l'équipe ACADIA.", 409);
  } catch (error) {
    if (isUniqueViolation(error)) throw new DirectorError("Votre compte est déjà rattaché à un directeur.", 409);
    throw error;
  }
  await logAudit({ actorId: userId, action: "DIRECTOR_LINK_REQUESTED", entityType: "Director", entityId: directorId });
  return getMyDirectoryLink(userId);
}

export async function cancelMyDirectoryLink(userId: string): Promise<MyDirectoryLink> {
  const mine = await prisma.director.findUnique({ where: { userId }, select: { id: true } });
  if (!mine) throw new DirectorError("Aucun rattachement à annuler.", 404);
  await prisma.director.update({ where: { id: mine.id }, data: { userId: null, linkStatus: null, linkRequestedAt: null } });
  await logAudit({ actorId: userId, action: "DIRECTOR_LINK_CANCELLED", entityType: "Director", entityId: mine.id });
  return getMyDirectoryLink(userId);
}

/** Administration : valider la demande, ou la refuser / retirer un rattachement (la fiche redevient libre). */
export async function decideDirectoryLink(actorId: string, directorId: string, decision: "valider" | "refuser"): Promise<DirectorAdmin> {
  const director = await prisma.director.findUnique({ where: { id: directorId }, select: { userId: true, linkStatus: true } });
  if (!director) throw new DirectorError("Directeur introuvable.", 404);
  if (!director.userId) throw new DirectorError("Aucun compte directeur n'est rattaché à cette fiche.", 409);
  const data = decision === "valider" ? { linkStatus: "valide" } : { userId: null, linkStatus: null, linkRequestedAt: null };
  const row = await prisma.director.update({ where: { id: directorId }, data, include: ADMIN_INCLUDE });
  await logAudit({
    actorId,
    action: decision === "valider" ? "DIRECTOR_LINK_VALIDATED" : "DIRECTOR_LINK_REMOVED",
    entityType: "Director",
    entityId: directorId,
    metadata: { account: director.userId },
  });
  return toAdmin(row, await accountsWithActiveCanevas([validatedAccount(row)]));
}
