-- MNJ Stage Connect : journal vocal du stagiaire (transcription, version rédigée) et parties rédigées du rapport.
-- Migration ADDITIVE : colonnes nullables uniquement ; aucune donnée modifiée.

-- AlterTable
ALTER TABLE "StageApplication" ADD COLUMN     "reportDraft" TEXT;

-- AlterTable
ALTER TABLE "StageAttendance" ADD COLUMN     "journalSource" TEXT,
ADD COLUMN     "transcript" TEXT,
ADD COLUMN     "writtenAt" TIMESTAMP(3);
