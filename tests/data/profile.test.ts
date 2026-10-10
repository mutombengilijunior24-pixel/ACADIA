import { beforeAll, describe, expect, it } from "vitest";

import { addOperation, createPreparation, preparedColumn, undoOperation } from "@/lib/core/data/preparation";
import { median, profileDataset, quantile } from "@/lib/core/data/profile";
import type { ImportedDataset } from "@/lib/core/data/types";

import { importOk, utf8 } from "./helpers";

/*
 * Jeu SYNTHÉTIQUE (8 lignes × 7 colonnes). Résultats attendus calculés à la main :
 * - ligne d'index 5 entièrement vide ; ligne 7 identique à la ligne 4 ;
 * - manquantes : id 1, age 2, sexe 1, satisfaction 1, commentaire 2, date 1, vide 8 → 16 / 56 ;
 * - age présent : 23, 31, 45, 27, 38, 27 → min 23, max 45, moyenne 191/6, médiane (27+31)/2 = 29 ;
 * - sexe : F ×4, M ×3 sur 7 ;
 * - satisfaction : 4, 5, 99, 3, 4, 2, 4 → 99 est un code candidat (hors de [2 ; 5]).
 */
const CSV = [
  "id,age,sexe,satisfaction,commentaire,date_enquete,vide",
  "R01,23,F,4,Bon service,05/03/2026,",
  "R02,,M,5,,05/03/2026,",
  "R03,31,F,99,Trop long,06/03/2026,",
  "R04,45,M,3,NA,07/03/2026,",
  "R05,27,F,4,Bon service,13/03/2026,",
  ",,,,,,",
  "R06,38,M,2,Accueil froid,14/03/2026,",
  "R05,27,F,4,Bon service,13/03/2026,",
].join("\n");

let dataset: ImportedDataset;

beforeAll(async () => {
  dataset = await importOk("enquete.csv", utf8(CSV));
});

const col = (profile: ReturnType<typeof profileDataset>, name: string) => profile.columns.find((c) => c.technicalName === name)!;

describe("A2 — profilage (valeurs calculées à la main)", () => {
  it("compte lignes, colonnes, cellules et taux de valeurs manquantes", () => {
    const profile = profileDataset(dataset);
    expect(profile.rowCount).toBe(8);
    expect(profile.columnCount).toBe(7);
    expect(profile.totalCells).toBe(56);
    expect(profile.missingCells).toBe(16);
    expect(profile.missingCellRate).toBeCloseTo(16 / 56, 12);
    expect(profile.rowsWithMissing).toBe(8);
    expect(profile.columns.map((c) => c.missing)).toEqual([1, 2, 1, 1, 2, 1, 8]);
    expect(col(profile, "age").missingRate).toBeCloseTo(2 / 8, 12);
  });

  it("détecte la ligne entièrement vide et le doublon exact sans rien supprimer", () => {
    const profile = profileDataset(dataset);
    expect(profile.emptyRows).toBe(1);
    expect(profile.emptyRowIndexes).toEqual([5]);
    expect(profile.exactDuplicateRows).toBe(1);
    expect(profile.duplicateGroups).toEqual([{ firstRow: 4, duplicateRows: [7] }]);
    expect(dataset.rowCount).toBe(8);
  });

  it("calcule les statistiques numériques exactes", () => {
    const age = col(profileDataset(dataset), "age");
    expect(age.storageType).toBe("integer");
    expect(age.numeric).toEqual({ count: 6, min: 23, max: 45, mean: 191 / 6, median: 29 });
    expect(age.distinct).toBe(5);
  });

  it("calcule les effectifs et fréquences d'une variable catégorielle", () => {
    const sexe = col(profileDataset(dataset), "sexe");
    expect(sexe.storageType).toBe("string");
    expect(sexe.categories?.top).toEqual([
      { value: "F", count: 4, frequency: 4 / 7 },
      { value: "M", count: 3, frequency: 3 / 7 },
    ]);
  });

  it("propose 99 et NA comme codes de non-réponse sans les appliquer", () => {
    const profile = profileDataset(dataset);
    expect(col(profile, "satisfaction").missingCodeCandidates).toEqual([{ value: "99", count: 1 }]);
    expect(col(profile, "satisfaction").missing).toBe(1);
    expect(col(profile, "commentaire").missingCodeCandidates).toEqual([{ value: "NA", count: 1 }]);
    expect(profile.readiness).toBe("ready_with_warnings");
  });

  it("applique un code de non-réponse confirmé, de façon réversible", () => {
    const column = dataset.columns.find((c) => c.technicalName === "satisfaction")!.index;
    const state = addOperation(createPreparation(dataset), { type: "declare_missing_codes", column, values: ["99"] });
    const satisfaction = col(profileDataset(dataset, state), "satisfaction");
    expect(satisfaction.missing).toBe(2);
    expect(satisfaction.numeric).toEqual({ count: 6, min: 2, max: 5, mean: 22 / 6, median: 4 });
    expect(satisfaction.appliedMissingCodes).toEqual(["99"]);
    expect(preparedColumn(dataset, state, column).missing.filter(Boolean)).toHaveLength(2);
    // La donnée d'origine est intacte et l'annulation restaure le profil initial.
    expect(dataset.rows[2][column]).toBe("99");
    const undone = undoOperation(state, state.operations[0].id);
    expect(col(profileDataset(dataset, undone), "satisfaction").missing).toBe(1);
  });

  it("exclut une ligne sur décision explicite et permet de revenir en arrière", () => {
    const state = addOperation(createPreparation(dataset), { type: "exclude_rows", rows: [7], reason: "doublon confirmé" });
    const profile = profileDataset(dataset, state);
    expect(profile.rowCount).toBe(7);
    expect(profile.excludedRows).toBe(1);
    expect(profile.exactDuplicateRows).toBe(0);
    expect(dataset.rows).toHaveLength(8);
    expect(profileDataset(dataset, undoOperation(state, state.operations[0].id)).exactDuplicateRows).toBe(1);
  });

  it("traite une colonne vide et des dates jour d'abord prouvées par une valeur > 12", () => {
    const profile = profileDataset(dataset);
    const vide = col(profile, "vide");
    expect(vide).toMatchObject({ storageType: "unknown", present: 0, missingRate: 1 });
    expect(vide.warnings).toContain("Colonne entièrement vide.");
    const date = col(profile, "date_enquete");
    expect(date.storageType).toBe("date");
    expect(date.dates).toMatchObject({ recognized: 7, recognizedRate: 1, ambiguousFormat: false, min: "2026-03-05", max: "2026-03-14" });
  });

  it("signale les colonnes ambiguës sans les convertir", async () => {
    const ds = await importOk("a.csv", utf8("score,jour,jour_us\n12,05/03/2026,02/13/2026\n15,06/03/2026,05/03/2026\nabc,,\n20,,\n18,,\n"));
    const profile = profileDataset(ds);
    expect(col(profile, "score").storageType).toBe("ambiguous");
    expect(col(profile, "score").numeric).toBeUndefined();
    expect(profile.ambiguousColumns).toBe(1);
    // Aucune valeur > 12 en première position : format JJ/MM non prouvé.
    expect(col(profile, "jour").dates).toMatchObject({ ambiguousFormat: true });
    expect(col(profile, "jour").dates?.min).toBeUndefined();
    // 02/13/2026 prouve « mois d'abord » : la lecture jour d'abord des autres dates est douteuse.
    expect(col(profile, "jour_us").dates?.ambiguousFormat).toBe(true);
    expect(ds.rows[2][0]).toBe("abc");
  });

  it("signale les valeurs atypiques (Tukey) sans les retirer", async () => {
    const ds = await importOk("a.csv", utf8(["v", "10", "11", "12", "12", "13", "13", "14", "100"].join("\n")));
    const v = col(profileDataset(ds), "v");
    // Q1 = 11,75 ; Q3 = 13,25 ; IQR = 1,5 ; bornes 9,5 et 15,5.
    expect(v.outliers).toEqual({ method: "IQR_1_5", lowerFence: 9.5, upperFence: 15.5, count: 1, examples: [100] });
    expect(v.numeric?.count).toBe(8);
  });

  it("médiane et quantiles : formules de référence", () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(quantile([1, 2, 3, 4, 5], 0.25)).toBe(2);
    expect(quantile([10, 11, 12, 12, 13, 13, 14, 100], 0.75)).toBe(13.25);
  });

  it("un fichier sans observation n'est pas prêt pour l'analyse", async () => {
    const profile = profileDataset(await importOk("a.csv", utf8("a,b\n")));
    expect(profile).toMatchObject({ rowCount: 0, totalCells: 0, missingCellRate: 0, readiness: "not_ready" });
  });
});
