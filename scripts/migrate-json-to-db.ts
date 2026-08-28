// ============================================================
// ACADIA — MIGRATION data/*.json → BASE DE DONNÉES (P17)
//
// Exécution unique, manuelle. Dry-run par défaut (aucune écriture)
// — passer --apply pour écrire réellement. Idempotent : une
// exécution répétée ignore les enregistrements déjà présents
// (jamais de doublon). Ne supprime jamais les fichiers JSON source
// (ils restent la sauvegarde de secours — voir
// ACADIA_P17_MIGRATION_GUIDE.md).
//
// Usage :
//   npx tsx scripts/migrate-json-to-db.ts             (aperçu)
//   npx tsx scripts/migrate-json-to-db.ts --apply      (écriture réelle)
// ============================================================

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const APPLY = process.argv.includes("--apply");
const DATA_DIR = path.join(process.cwd(), "data");
const prisma = new PrismaClient();

function readJson<T>(fileName: string): T[] {
  const file = path.join(DATA_DIR, fileName);
  if (!existsSync(file)) return [];
  try {
    const parsed = JSON.parse(readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

interface Summary {
  file: string;
  found: number;
  created: number;
  skipped: number;
  errors: number;
}

async function migrateUsers(): Promise<Summary> {
  const rows = readJson<{
    id: string;
    email: string;
    passwordHash: string;
    firstName: string;
    lastName?: string;
    domain?: string;
    role?: string;
    createdAt: string;
  }>("users.json");

  const summary: Summary = { file: "users.json", found: rows.length, created: 0, skipped: 0, errors: 0 };

  for (const row of rows) {
    try {
      const existing = await prisma.user.findUnique({ where: { email: row.email.toLowerCase() } });
      if (existing) {
        summary.skipped += 1;
        continue;
      }
      if (APPLY) {
        await prisma.user.create({
          data: {
            id: row.id,
            email: row.email.toLowerCase(),
            passwordHash: row.passwordHash,
            firstName: row.firstName,
            lastName: row.lastName,
            domain: row.domain,
            role: row.role ?? "student",
            createdAt: new Date(row.createdAt),
          },
        });
      }
      summary.created += 1;
    } catch (e) {
      console.error(`  ! Erreur utilisateur ${row.email}:`, e instanceof Error ? e.message : e);
      summary.errors += 1;
    }
  }
  return summary;
}

/**
 * Migration générique pour les stores de supervision (P16) dont la
 * forme JSON correspond directement à un modèle Prisma (id déjà
 * présent, mêmes noms de champs pour les scalaires). Les champs
 * qui étaient des objets/tableaux imbriqués en JSON restent
 * sérialisés en chaîne (colonnes JSON — voir schema.prisma).
 */
async function migrateSimple<T extends { id: string }>(
  fileName: string,
  modelName: "supervisorInvitation" | "supervisionAssignment" | "submission" | "inboxMessage" | "feedbackEntry" | "correction" | "notification" | "emailLog",
  transform: (row: T) => Record<string, unknown>
): Promise<Summary> {
  const rows = readJson<T>(fileName);
  const summary: Summary = { file: fileName, found: rows.length, created: 0, skipped: 0, errors: 0 };

  for (const row of rows) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const existing = await (prisma[modelName] as any).findUnique({ where: { id: row.id } });
      if (existing) {
        summary.skipped += 1;
        continue;
      }
      if (APPLY) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma[modelName] as any).create({ data: transform(row) });
      }
      summary.created += 1;
    } catch (e) {
      console.error(`  ! Erreur ${fileName} ${row.id}:`, e instanceof Error ? e.message : e);
      summary.errors += 1;
    }
  }
  return summary;
}

async function main() {
  console.log(`ACADIA — migration data/*.json → base de données (${APPLY ? "APPLICATION RÉELLE" : "APERÇU (dry-run)"})\n`);

  const summaries: Summary[] = [];
  summaries.push(await migrateUsers());

  // Les stores de supervision P16 stockaient déjà des identifiants
  // et des champs directement compatibles avec les modèles Prisma
  // correspondants (voir lib/supervision/*Store.ts avant migration).
  summaries.push(
    await migrateSimple("invitations.json", "supervisorInvitation", (r: Record<string, unknown>) => ({
      id: r.id,
      code: r.code,
      supervisorId: r.supervisorId,
      studentEmail: r.studentEmail,
      researchId: r.researchId,
      status: r.status,
      createdAt: new Date(r.createdAt as string),
      expiresAt: new Date(r.expiresAt as string),
      usedAt: r.usedAt ? new Date(r.usedAt as string) : null,
      studentId: r.studentId,
    }))
  );

  summaries.push(
    await migrateSimple("assignments.json", "supervisionAssignment", (r: Record<string, unknown>) => ({
      id: r.id,
      studentId: r.studentId,
      supervisorId: r.supervisorId,
      researchId: r.researchId,
      status: r.status,
      createdAt: new Date(r.createdAt as string),
      endedAt: r.endedAt ? new Date(r.endedAt as string) : null,
    }))
  );

  summaries.push(
    await migrateSimple("submissions.json", "submission", (r: Record<string, unknown>) => ({
      id: r.id,
      researchId: r.researchId,
      studentId: r.studentId,
      supervisorId: r.supervisorId,
      version: r.version,
      snapshot: JSON.stringify(r.snapshot),
      submittedAt: new Date(r.submittedAt as string),
      status: r.status,
      studentMessage: r.studentMessage,
      reviewedAt: r.reviewedAt ? new Date(r.reviewedAt as string) : null,
      reviewedBy: r.reviewedBy,
      feedbackId: r.feedbackId,
      previousSubmissionId: r.previousSubmissionId,
    }))
  );

  summaries.push(
    await migrateSimple("messages.json", "inboxMessage", (r: Record<string, unknown>) => ({
      id: r.id,
      senderId: r.senderId,
      recipientId: r.recipientId,
      researchId: r.researchId,
      submissionId: r.submissionId,
      subject: r.subject,
      body: r.body,
      type: r.type,
      createdAt: new Date(r.createdAt as string),
      readAt: r.readAt ? new Date(r.readAt as string) : null,
      priority: r.priority,
    }))
  );

  summaries.push(
    await migrateSimple("feedback.json", "feedbackEntry", (r: Record<string, unknown>) => ({
      id: r.id,
      submissionId: r.submissionId,
      supervisorId: r.supervisorId,
      globalEvaluation: r.globalEvaluation,
      sections: JSON.stringify(r.sections),
      createdAt: new Date(r.createdAt as string),
      sentAt: r.sentAt ? new Date(r.sentAt as string) : null,
    }))
  );

  summaries.push(
    await migrateSimple("corrections.json", "correction", (r: Record<string, unknown>) => ({
      id: r.id,
      submissionId: r.submissionId,
      section: r.section,
      description: r.description,
      severity: r.severity,
      status: r.status,
      createdAt: new Date(r.createdAt as string),
      resolvedAt: r.resolvedAt ? new Date(r.resolvedAt as string) : null,
      resolvedBy: r.resolvedBy,
      discussion: JSON.stringify(r.discussion ?? []),
    }))
  );

  summaries.push(
    await migrateSimple("notifications.json", "notification", (r: Record<string, unknown>) => ({
      id: r.id,
      userId: r.userId,
      type: r.type,
      title: r.title,
      body: r.body,
      relatedResearchId: r.relatedResearchId,
      relatedSubmissionId: r.relatedSubmissionId,
      createdAt: new Date(r.createdAt as string),
      readAt: r.readAt ? new Date(r.readAt as string) : null,
    }))
  );

  console.log("Résumé :");
  console.table(summaries.map((s) => ({ fichier: s.file, trouvés: s.found, créés: s.created, ignorés: s.skipped, erreurs: s.errors })));

  if (!APPLY) {
    console.log("\nAucune écriture effectuée (dry-run). Relancer avec --apply pour appliquer réellement.");
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
