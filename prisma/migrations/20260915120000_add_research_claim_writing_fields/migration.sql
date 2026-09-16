-- Mission 9 — Research Writing Engine
-- Additifs nullables sur ResearchClaim : aucune ligne existante n'est modifiée en valeur.
ALTER TABLE "ResearchClaim" ADD COLUMN "claimType" TEXT;
ALTER TABLE "ResearchClaim" ADD COLUMN "sectionId" TEXT;

CREATE INDEX "ResearchClaim_sectionId_idx" ON "ResearchClaim"("sectionId");
