// ============================================================
// ACADIA — NOTIFICATIONS RÉELLES (P16, migré vers Prisma en P17)
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { Notification, NotificationType } from "@/lib/core/supervision/SupervisionTypes";

function toDomain(row: {
  id: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  relatedResearchId: string | null;
  relatedSubmissionId: string | null;
  createdAt: Date;
  readAt: Date | null;
}): Notification {
  return {
    id: row.id,
    userId: row.userId,
    type: row.type as NotificationType,
    title: row.title,
    body: row.body,
    relatedResearchId: row.relatedResearchId ?? undefined,
    relatedSubmissionId: row.relatedSubmissionId ?? undefined,
    createdAt: row.createdAt.toISOString(),
    readAt: row.readAt?.toISOString(),
  };
}

export async function createNotification(input: {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  relatedResearchId?: string;
  relatedSubmissionId?: string;
}): Promise<Notification> {
  const row = await prisma.notification.create({ data: input });
  return toDomain(row);
}

export async function listNotifications(userId: string): Promise<Notification[]> {
  const rows = await prisma.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" } });
  return rows.map(toDomain);
}

export async function markNotificationRead(id: string, userId: string): Promise<Notification | null> {
  const found = await prisma.notification.findFirst({ where: { id, userId } });
  if (!found) return null;
  const row = await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  return toDomain(row);
}
