// ============================================================
// ACADIA — INTERPRÉTATIONS ENREGISTRÉES (parcours guidé)
//
// ownerId toujours fourni par la route depuis la session serveur ;
// chaque fonction revérifie la propriété. La sauvegarde utilise une
// révision (concurrence optimiste) : un autre onglet ne peut pas
// écraser silencieusement une version plus récente.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { JourneyKind } from "@/lib/core/journey/kinds";
import { PERSISTENCE_LIMITS } from "@/lib/core/journey/persistence";

export interface SessionListItem {
  id: string;
  title: string;
  kind: string;
  status: string;
  stage: string;
  summary: string | null;
  fileName: string | null;
  fileStored: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export class JourneySessionError extends Error {
  constructor(
    readonly code: "not_found" | "conflict" | "limit_reached" | "too_large",
    message: string,
  ) {
    super(message);
  }
}

const LIST_SELECT = { id: true, title: true, kind: true, status: true, stage: true, summary: true, fileName: true, fileDocumentId: true, createdAt: true, updatedAt: true } as const;

export async function listSessions(ownerId: string, status: "active" | "archived"): Promise<SessionListItem[]> {
  const rows = await prisma.journeySession.findMany({ where: { ownerId, status }, orderBy: { updatedAt: "desc" }, take: 50, select: LIST_SELECT });
  return rows.map(({ fileDocumentId, ...r }) => ({ ...r, fileStored: !!fileDocumentId }));
}

export async function createSession(ownerId: string, input: { id: string; kind: JourneyKind; title: string; stage: string; payload: string }) {
  if (Buffer.byteLength(input.payload, "utf8") > PERSISTENCE_LIMITS.payloadBytes) throw new JourneySessionError("too_large", "Interprétation trop volumineuse pour être enregistrée.");
  const active = await prisma.journeySession.count({ where: { ownerId, status: "active" } });
  if (active >= PERSISTENCE_LIMITS.activeSessions) throw new JourneySessionError("limit_reached", `Vous avez déjà ${active} interprétations actives : archivez-en avant d'en créer une nouvelle.`);
  return prisma.journeySession.create({
    data: { id: input.id, ownerId, kind: input.kind, title: input.title, stage: input.stage, payload: input.payload, payloadBytes: Buffer.byteLength(input.payload, "utf8") },
    select: { id: true, revision: true, updatedAt: true },
  });
}

export async function getSession(ownerId: string, id: string) {
  const record = await prisma.journeySession.findUnique({ where: { id } });
  if (!record || record.ownerId !== ownerId) return record ? "forbidden" : null;
  await prisma.journeySession.update({ where: { id }, data: { lastOpenedAt: new Date() }, select: { id: true } }).catch(() => undefined);
  return record;
}

export async function ownerOf(id: string): Promise<string | null> {
  return (await ownerAndKindOf(id))?.ownerId ?? null;
}

/** Propriétaire et moteur (le moteur valide l'instantané ; il ne change jamais après la création). */
export async function ownerAndKindOf(id: string): Promise<{ ownerId: string; kind: string } | null> {
  return prisma.journeySession.findUnique({ where: { id }, select: { ownerId: true, kind: true } });
}

/** Sauvegarde automatique : refusée (conflit) si la révision a changé depuis la dernière lecture. */
export async function saveSession(ownerId: string, id: string, input: { revision: number; title: string; stage: string; payload: string; summary: string | null }) {
  const payloadBytes = Buffer.byteLength(input.payload, "utf8");
  if (payloadBytes > PERSISTENCE_LIMITS.payloadBytes) throw new JourneySessionError("too_large", "Interprétation trop volumineuse pour être enregistrée.");
  const result = await prisma.journeySession.updateMany({
    where: { id, ownerId, revision: input.revision },
    data: { title: input.title, stage: input.stage, payload: input.payload, payloadBytes, summary: input.summary, revision: { increment: 1 } },
  });
  if (result.count === 0) {
    const exists = await prisma.journeySession.findFirst({ where: { id, ownerId }, select: { id: true } });
    throw exists ? new JourneySessionError("conflict", "Cette interprétation a été modifiée ailleurs (autre onglet ou appareil).") : new JourneySessionError("not_found", "Interprétation introuvable.");
  }
  return { revision: input.revision + 1 };
}

export async function updateSessionMeta(ownerId: string, id: string, patch: { title?: string; status?: "active" | "archived" }) {
  const result = await prisma.journeySession.updateMany({ where: { id, ownerId }, data: patch });
  if (!result.count) throw new JourneySessionError("not_found", "Interprétation introuvable.");
}

export async function deleteSession(ownerId: string, id: string): Promise<{ fileDocumentId: string | null }> {
  const record = await prisma.journeySession.findFirst({ where: { id, ownerId }, select: { fileDocumentId: true } });
  if (!record) throw new JourneySessionError("not_found", "Interprétation introuvable.");
  await prisma.journeySession.delete({ where: { id } });
  return { fileDocumentId: record.fileDocumentId };
}

export async function setSessionFile(ownerId: string, id: string, file: { documentId: string; name: string; size: number; sha256: string }): Promise<{ previous: string | null }> {
  const record = await prisma.journeySession.findFirst({ where: { id, ownerId }, select: { fileDocumentId: true } });
  if (!record) throw new JourneySessionError("not_found", "Interprétation introuvable.");
  await prisma.journeySession.update({ where: { id }, data: { fileDocumentId: file.documentId, fileName: file.name, fileSize: file.size, fileSha256: file.sha256 } });
  return { previous: record.fileDocumentId };
}

export async function clearSessionFile(ownerId: string, id: string): Promise<{ previous: string | null }> {
  const record = await prisma.journeySession.findFirst({ where: { id, ownerId }, select: { fileDocumentId: true } });
  if (!record) throw new JourneySessionError("not_found", "Interprétation introuvable.");
  await prisma.journeySession.update({ where: { id }, data: { fileDocumentId: null, fileName: null, fileSize: null, fileSha256: null } });
  return { previous: record.fileDocumentId };
}

/** Erreurs de base de données → réponses HTTP explicites (table absente : sauvegarde indisponible, parcours utilisable). */
export function journeyErrorResponse(error: unknown): Response {
  if (error instanceof JourneySessionError) {
    const status = { not_found: 404, conflict: 409, limit_reached: 409, too_large: 413 }[error.code];
    return Response.json({ error: error.message, code: error.code }, { status });
  }
  const code = (error as { code?: string } | null)?.code;
  if (code === "P2021" || code === "P2022") return Response.json({ error: "La sauvegarde des interprétations n'est pas encore activée sur ce serveur.", code: "persistence_unavailable" }, { status: 503 });
  if (code === "P2002") return Response.json({ error: "Cette interprétation existe déjà.", code: "conflict" }, { status: 409 });
  console.error("[journey-sessions]", error instanceof Error ? error.message : "erreur inconnue");
  return Response.json({ error: "Erreur du serveur lors de la sauvegarde.", code: "server_error" }, { status: 500 });
}
