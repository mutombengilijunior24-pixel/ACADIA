// ============================================================
// ACADIA — BOÎTE DE RÉCEPTION ACADIA (P16, migré vers Prisma en P17)
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { InboxMessage } from "@/lib/core/supervision/SupervisionTypes";

function toDomain(row: {
  id: string;
  senderId: string;
  recipientId: string;
  researchId: string | null;
  submissionId: string | null;
  subject: string;
  body: string;
  type: string;
  createdAt: Date;
  readAt: Date | null;
  priority: string;
}): InboxMessage {
  return {
    id: row.id,
    senderId: row.senderId,
    recipientId: row.recipientId,
    researchId: row.researchId ?? undefined,
    submissionId: row.submissionId ?? undefined,
    subject: row.subject,
    body: row.body,
    type: row.type as InboxMessage["type"],
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString(),
    priority: row.priority as InboxMessage["priority"],
  };
}

export async function listInboxForUser(userId: string): Promise<InboxMessage[]> {
  const rows = await prisma.inboxMessage.findMany({ where: { recipientId: userId }, orderBy: { createdAt: "desc" } });
  return rows.map(toDomain);
}

export async function createMessage(input: Omit<InboxMessage, "id" | "createdAt" | "readAt">): Promise<InboxMessage> {
  const row = await prisma.inboxMessage.create({
    data: {
      senderId: input.senderId,
      recipientId: input.recipientId,
      researchId: input.researchId,
      submissionId: input.submissionId,
      subject: input.subject,
      body: input.body,
      type: input.type,
      priority: input.priority,
    },
  });
  return toDomain(row);
}

export async function markMessageRead(id: string, userId: string): Promise<InboxMessage | null> {
  const found = await prisma.inboxMessage.findFirst({ where: { id, recipientId: userId } });
  if (!found) return null;
  const row = await prisma.inboxMessage.update({ where: { id }, data: { readAt: new Date() } });
  return toDomain(row);
}

export async function countUnread(userId: string): Promise<number> {
  return prisma.inboxMessage.count({ where: { recipientId: userId, readAt: null } });
}
