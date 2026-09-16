-- CreateTable
CREATE TABLE "Reference" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "authors" TEXT NOT NULL,
    "year" INTEGER,
    "sourceType" TEXT NOT NULL,
    "journal" TEXT,
    "publisher" TEXT,
    "volume" TEXT,
    "issue" TEXT,
    "pages" TEXT,
    "doi" TEXT,
    "isbn" TEXT,
    "url" TEXT,
    "language" TEXT,
    "verificationStatus" TEXT NOT NULL DEFAULT 'TO_VERIFY',
    "provenance" TEXT NOT NULL,
    "aiConfidence" DECIMAL(4,3),
    "rawImportData" TEXT,
    "duplicateOfId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Reference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReferenceCitation" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "referenceId" TEXT,
    "rawText" TEXT NOT NULL,
    "citedAuthor" TEXT,
    "citedYear" INTEGER,
    "resolutionStatus" TEXT NOT NULL DEFAULT 'UNRESOLVED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReferenceCitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ResearchClaim" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResearchClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Reference_projectId_idx" ON "Reference"("projectId");
CREATE INDEX "Reference_doi_idx" ON "Reference"("doi");
CREATE INDEX "Reference_verificationStatus_idx" ON "Reference"("verificationStatus");
CREATE INDEX "ReferenceCitation_projectId_idx" ON "ReferenceCitation"("projectId");
CREATE INDEX "ReferenceCitation_referenceId_idx" ON "ReferenceCitation"("referenceId");
CREATE INDEX "ResearchClaim_projectId_idx" ON "ResearchClaim"("projectId");
CREATE INDEX "ResearchClaim_referenceId_idx" ON "ResearchClaim"("referenceId");

-- AddForeignKey
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Reference" ADD CONSTRAINT "Reference_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReferenceCitation" ADD CONSTRAINT "ReferenceCitation_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReferenceCitation" ADD CONSTRAINT "ReferenceCitation_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ResearchClaim" ADD CONSTRAINT "ResearchClaim_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "ResearchProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResearchClaim" ADD CONSTRAINT "ResearchClaim_referenceId_fkey" FOREIGN KEY ("referenceId") REFERENCES "Reference"("id") ON DELETE SET NULL ON UPDATE CASCADE;
