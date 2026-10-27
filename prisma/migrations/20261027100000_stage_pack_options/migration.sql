-- MNJ Stage Connect : accompagnement à la carte (recommandation 17 $, assurance 10 $).
-- Migration ADDITIVE : une colonne avec valeur par défaut ; aucune donnée existante modifiée ni supprimée.

-- AlterTable
ALTER TABLE "StageApplication" ADD COLUMN     "packOptions" TEXT NOT NULL DEFAULT '[]';

