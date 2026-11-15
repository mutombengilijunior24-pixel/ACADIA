-- Rattachement d'un compte directeur à sa fiche de l'annuaire (demande par le directeur, validation par l'administration).
-- Migration ADDITIVE : trois colonnes nullables, un index unique et une clé étrangère ; aucune donnée existante n'est modifiée.

-- AlterTable
ALTER TABLE "Director" ADD COLUMN     "linkRequestedAt" TIMESTAMP(3),
ADD COLUMN     "linkStatus" TEXT,
ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Director_userId_key" ON "Director"("userId");

-- AddForeignKey
ALTER TABLE "Director" ADD CONSTRAINT "Director_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

