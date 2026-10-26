-- Parcours guidé : interprétations enregistrées par compte.
-- Migration ADDITIVE : crée une table ; aucune table existante n'est modifiée.

-- CreateTable
CREATE TABLE "JourneySession" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'survey',
    "status" TEXT NOT NULL DEFAULT 'active',
    "stage" TEXT NOT NULL DEFAULT 'domain',
    "schemaVersion" INTEGER NOT NULL DEFAULT 1,
    "payload" TEXT NOT NULL,
    "payloadBytes" INTEGER NOT NULL DEFAULT 0,
    "revision" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "fileName" TEXT,
    "fileSize" INTEGER,
    "fileSha256" TEXT,
    "fileDocumentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "lastOpenedAt" TIMESTAMP(3),

    CONSTRAINT "JourneySession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "JourneySession_fileDocumentId_key" ON "JourneySession"("fileDocumentId");

-- CreateIndex
CREATE INDEX "JourneySession_ownerId_updatedAt_idx" ON "JourneySession"("ownerId", "updatedAt");

-- AddForeignKey
ALTER TABLE "JourneySession" ADD CONSTRAINT "JourneySession_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
