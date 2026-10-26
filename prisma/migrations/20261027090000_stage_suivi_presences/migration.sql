-- MNJ Stage Connect : suivi piloté par les faits (placement, documents reçus), présences journalières
-- et accès sécurisés (maître de stage, faculté). Migration ADDITIVE uniquement : colonnes nullables ou
-- avec valeur par défaut, nouvelles tables ; aucune donnée existante modifiée ni supprimée.

-- AlterTable
ALTER TABLE "StageApplication" ADD COLUMN     "companyAddress" TEXT,
ADD COLUMN     "documentsReceived" TEXT NOT NULL DEFAULT '[]',
ADD COLUMN     "endDate" TEXT,
ADD COLUMN     "facultyName" TEXT,
ADD COLUMN     "institutionId" TEXT,
ADD COLUMN     "startDate" TEXT,
ADD COLUMN     "studentNumber" TEXT,
ADD COLUMN     "tutorEmail" TEXT,
ADD COLUMN     "tutorName" TEXT,
ADD COLUMN     "tutorPhone" TEXT,
ADD COLUMN     "tutorRole" TEXT;

-- CreateTable
CREATE TABLE "StageAttendance" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "arrivalAt" TIMESTAMP(3) NOT NULL,
    "departureAt" TIMESTAMP(3),
    "activities" TEXT,
    "tutorConfirmedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageAccess" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "applicationId" TEXT,
    "university" TEXT,
    "facultyName" TEXT,
    "createdById" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageAccess_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageAttendance_applicationId_idx" ON "StageAttendance"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "StageAttendance_applicationId_day_key" ON "StageAttendance"("applicationId", "day");

-- CreateIndex
CREATE UNIQUE INDEX "StageAccess_tokenHash_key" ON "StageAccess"("tokenHash");

-- CreateIndex
CREATE INDEX "StageAccess_kind_idx" ON "StageAccess"("kind");

-- CreateIndex
CREATE INDEX "StageAccess_applicationId_idx" ON "StageAccess"("applicationId");

-- CreateIndex
CREATE INDEX "StageApplication_university_idx" ON "StageApplication"("university");

-- AddForeignKey
ALTER TABLE "StageAttendance" ADD CONSTRAINT "StageAttendance_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StageApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageAccess" ADD CONSTRAINT "StageAccess_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "StageApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

