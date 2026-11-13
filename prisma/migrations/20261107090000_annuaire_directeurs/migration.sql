-- Annuaire des directeurs de mémoire, tenu par l'administration ; lien facultatif projet - directeur.
-- Migration ADDITIVE : crée une table, ajoute des colonnes nullables et insère la liste de départ ; aucune donnée existante n'est modifiée.

-- AlterTable
ALTER TABLE "ResearchProject" ADD COLUMN     "directorId" TEXT,
ADD COLUMN     "directorName" TEXT;

-- CreateTable
CREATE TABLE "Director" (
    "id" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "academicTitle" TEXT,
    "institution" TEXT,
    "faculty" TEXT,
    "department" TEXT,
    "specialties" TEXT,
    "notes" TEXT,
    "logicStatus" TEXT NOT NULL DEFAULT 'a_recueillir',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Director_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Director_institution_idx" ON "Director"("institution");

-- CreateIndex
CREATE INDEX "Director_isActive_idx" ON "Director"("isActive");

-- CreateIndex
CREATE INDEX "ResearchProject_directorId_idx" ON "ResearchProject"("directorId");

-- AddForeignKey
ALTER TABLE "ResearchProject" ADD CONSTRAINT "ResearchProject_directorId_fkey" FOREIGN KEY ("directorId") REFERENCES "Director"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Liste de départ : directeurs de mémoire de l'année académique en cours (UNILU), transmise par l'équipe ACADIA
-- le 2026-11-13. Noms tels que transmis ; titres : DR = Dr, PO = PO (professeur ordinaire), PROF ou PR = Prof.
-- Ids fixes : relancer cette insertion ne crée jamais de doublon. Corrections ensuite depuis /dashboard/admin/directors.
INSERT INTO "Director" ("id", "fullName", "academicTitle", "institution", "updatedAt") VALUES
    ('annuaire-2026-01', 'COALIS', 'Dr', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-02', 'ILUNGA FIFI', 'Dr', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-03', 'KITENGE SARA', 'Dr', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-04', 'KYUNGU DANIEL', 'Dr', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-05', 'LENA', 'Dr', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-06', 'MADI MOMBO', 'Dr', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-07', 'JACQUES MUMBA', 'Dr', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-08', 'DITEND', 'PO', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-09', 'JH KITSALI', 'PO', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-10', 'KAOLA TABU', 'PO', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-11', 'MBAYO', 'PO', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-12', 'MUHEME GASPARD', 'PO', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-13', 'MWANIA JOSE', 'PO', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-14', 'SEM MBIMBI', 'PO', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-15', 'DKI', 'Prof', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-16', 'KALABA BIN SANKWE', 'Prof', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-17', 'KILONDO NGUYA', 'Prof', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-18', 'KWESELE CHOMA CHOMA', 'Prof', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-19', 'NDALA JOHN', 'Prof', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-20', 'MAGUY', 'Prof', 'UNILU', CURRENT_TIMESTAMP),
    ('annuaire-2026-21', 'CHEY', 'PO', 'UNILU', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

