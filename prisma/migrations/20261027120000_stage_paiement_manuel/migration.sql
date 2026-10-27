-- MNJ Stage Connect : paiement Mobile Money déclaré par l'étudiant et vérifié par l'équipe ; réglages (numéros MNJ).
-- Migration ADDITIVE : colonnes nullables, une table, un index unique sur une colonne neuve ; aucune donnée modifiée.

-- AlterTable
ALTER TABLE "StageApplication" ADD COLUMN     "payAccount" TEXT,
ADD COLUMN     "payDeclaredAt" TIMESTAMP(3),
ADD COLUMN     "paySenderPhone" TEXT,
ADD COLUMN     "payTransactionId" TEXT;

-- CreateTable
CREATE TABLE "StageSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StageSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "StageApplication_payTransactionId_key" ON "StageApplication"("payTransactionId");
