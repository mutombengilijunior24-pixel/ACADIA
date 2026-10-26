-- MNJ Stage Connect : candidatures de stage.
-- Migration ADDITIVE : crée une table ; aucune table existante n'est modifiée.

-- CreateTable
CREATE TABLE "StageApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'en_attente',
    "lastName" TEXT NOT NULL,
    "postName" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "university" TEXT NOT NULL,
    "faculty" TEXT NOT NULL,
    "department" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "graduationYear" INTEGER,
    "skills" TEXT NOT NULL,
    "objectives" TEXT NOT NULL,
    "preferredCompany" TEXT,
    "preferredCity" TEXT,
    "startMonth" TEXT,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "packAcceptedAt" TIMESTAMP(3),
    "paymentStatus" TEXT NOT NULL DEFAULT 'non_paye',
    "paymentId" TEXT,
    "paymentMethod" TEXT,
    "paidAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "assignedCompany" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StageApplication_userId_idx" ON "StageApplication"("userId");

-- CreateIndex
CREATE INDEX "StageApplication_status_idx" ON "StageApplication"("status");

-- CreateIndex
CREATE INDEX "StageApplication_faculty_idx" ON "StageApplication"("faculty");

-- CreateIndex
CREATE INDEX "StageApplication_createdAt_idx" ON "StageApplication"("createdAt");

-- AddForeignKey
ALTER TABLE "StageApplication" ADD CONSTRAINT "StageApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

