// ============================================================
// ACADIA — BRIEFS ACADIA PERSISTÉS (P16, migré vers Prisma en P17)
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import type { SupervisorBrief } from "@/lib/core/supervision/SupervisionTypes";

function toDomain(row: {
  id: string;
  submissionId: string;
  generatedAt: Date;
  generatedBy: string;
  status: string;
  overallState: string;
  strengths: string;
  inconsistencies: string;
  incompleteSections: string;
  importantQuestions: string;
  progressPercent: number;
  disclaimer: string;
}): SupervisorBrief {
  return {
    id: row.id,
    submissionId: row.submissionId,
    generatedAt: row.generatedAt.toISOString(),
    generatedBy: row.generatedBy as "acadia",
    status: row.status as SupervisorBrief["status"],
    overallState: row.overallState as SupervisorBrief["overallState"],
    strengths: JSON.parse(row.strengths),
    inconsistencies: JSON.parse(row.inconsistencies),
    incompleteSections: JSON.parse(row.incompleteSections),
    importantQuestions: JSON.parse(row.importantQuestions),
    progressPercent: row.progressPercent,
    disclaimer: row.disclaimer,
  };
}

export async function getBriefForSubmission(submissionId: string): Promise<SupervisorBrief | undefined> {
  const row = await prisma.supervisorBrief.findFirst({ where: { submissionId }, orderBy: { generatedAt: "desc" } });
  return row ? toDomain(row) : undefined;
}

export async function saveBrief(brief: Omit<SupervisorBrief, "id">): Promise<SupervisorBrief> {
  const row = await prisma.supervisorBrief.create({
    data: {
      submissionId: brief.submissionId,
      generatedBy: brief.generatedBy,
      status: brief.status,
      overallState: brief.overallState,
      strengths: JSON.stringify(brief.strengths),
      inconsistencies: JSON.stringify(brief.inconsistencies),
      incompleteSections: JSON.stringify(brief.incompleteSections),
      importantQuestions: JSON.stringify(brief.importantQuestions),
      progressPercent: brief.progressPercent,
      disclaimer: brief.disclaimer,
    },
  });
  return toDomain(row);
}
