// ============================================================
// ACADIA — JOURNAL EMAIL (P16, migré vers Prisma en P17)
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { EmailLogEntry } from "@/lib/core/supervision/SupervisionTypes";

export async function logEmail(input: Omit<EmailLogEntry, "id" | "createdAt">): Promise<EmailLogEntry> {
  const row = await prisma.emailLog.create({ data: input });
  return { id: row.id, to: row.to, subject: row.subject, template: row.template, status: row.status as EmailLogEntry["status"], createdAt: row.createdAt.toISOString(), error: row.error ?? undefined };
}

export async function listEmailLog(): Promise<EmailLogEntry[]> {
  const rows = await prisma.emailLog.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map((row) => ({
    id: row.id,
    to: row.to,
    subject: row.subject,
    template: row.template,
    status: row.status as EmailLogEntry["status"],
    createdAt: row.createdAt.toISOString(),
    error: row.error ?? undefined,
  }));
}
