import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { importFile } from "@/lib/core/data/importer";
import { DEFAULT_IMPORT_LIMITS } from "@/lib/core/data/limits";
import { inspectZip } from "@/lib/core/data/xlsx";

import { buildXlsx, importErrorCodes, importOk } from "./helpers";

// Classeurs SYNTHÉTIQUES construits pour les tests.

describe("A1 — importation XLSX", () => {
  it("1. lit un classeur valide (texte, nombres, booléens) sans modifier les chaînes", async () => {
    const xlsx = buildXlsx([{ name: "Réponses", rows: [["id", "âge", "commentaire", "accord"], [1, 23, "  très bien ", true], [2, 31.5, "moyen", false]] }]);
    const dataset = await importOk("enquete.xlsx", xlsx);
    expect(dataset.format).toBe("xlsx");
    expect(dataset.xlsx?.sheetName).toBe("Réponses");
    expect(dataset.columns.map((c) => c.originalHeader)).toEqual(["id", "âge", "commentaire", "accord"]);
    expect(dataset.rows).toEqual([
      [1, 23, "  très bien ", true],
      [2, 31.5, "moyen", false],
    ]);
    expect(dataset.sourceRows).toEqual([2, 3]);
  });

  it("2. liste les feuilles et importe la feuille choisie explicitement", async () => {
    const xlsx = buildXlsx([
      { name: "Notes", rows: [["Lisez-moi"]] },
      { name: "Données", rows: [["x", "y"], [1, 2], [3, 4]] },
    ]);
    const first = await importOk("a.xlsx", xlsx);
    expect(first.xlsx?.sheetName).toBe("Notes");
    expect(first.xlsx?.availableSheets).toEqual([
      { name: "Notes", rowCount: 1 },
      { name: "Données", rowCount: 3 },
    ]);
    const chosen = await importOk("a.xlsx", xlsx, { sheet: "Données" });
    expect(chosen.xlsx).toMatchObject({ sheetName: "Données", sheetIndex: 1 });
    expect(chosen.rowCount).toBe(2);
    const missing = await importFile("a.xlsx", xlsx, { sheet: "Inconnue" });
    expect(missing.ok).toBe(false);
    if (!missing.ok) {
      expect(missing.issues[0].code).toBe("sheet_not_found");
      expect(missing.sheets?.map((s) => s.name)).toEqual(["Notes", "Données"]);
    }
  });

  it("3. signale une feuille vide et un classeur entièrement vide", async () => {
    const xlsx = buildXlsx([
      { name: "Vide", rows: [] },
      { name: "Données", rows: [["a"], [1]] },
    ]);
    const auto = await importOk("a.xlsx", xlsx);
    expect(auto.xlsx?.sheetName).toBe("Données");
    expect(await importErrorCodes("a.xlsx", xlsx, { sheet: "Vide" })).toEqual(["empty_file"]);
    expect(await importErrorCodes("a.xlsx", buildXlsx([{ name: "A", rows: [] }]))).toEqual(["empty_workbook"]);
  });

  it("4. conserve les cellules vides comme absentes et les lignes vides du milieu", async () => {
    const dataset = await importOk("a.xlsx", buildXlsx([{ name: "F", rows: [["a", "b", "c"], [1, null, 3], [null, null, null], [4, 5, null]] }]));
    expect(dataset.rowCount).toBe(3);
    expect(dataset.rows).toEqual([
      [1, null, 3],
      [null, null, null],
      [4, 5, null],
    ]);
    expect(dataset.sourceRows).toEqual([2, 3, 4]);
  });

  it("5. lit les dates au format date comme des dates ISO", async () => {
    // 45658 = 2025-01-01 ; 45292 = 2024-01-01 (numéros de série Excel).
    const dataset = await importOk("a.xlsx", buildXlsx([{ name: "F", rows: [["date"], [{ date: 45658 }], [{ date: 45292 }]] }]));
    expect(dataset.rows).toEqual([[{ t: "date", iso: "2025-01-01" }], [{ t: "date", iso: "2024-01-01" }]]);
  });

  it("6. conserve les valeurs numériques (entiers, décimaux, négatifs)", async () => {
    const dataset = await importOk("a.xlsx", buildXlsx([{ name: "F", rows: [["v"], [0], [-12], [3.25], [1e6]] }]));
    expect(dataset.rows.map((r) => r[0])).toEqual([0, -12, 3.25, 1000000]);
  });

  it("7. signale une feuille sans en-têtes exploitables et permet l'import sans en-tête", async () => {
    const xlsx = buildXlsx([{ name: "F", rows: [[1, 2], [3, 4]] }]);
    const dataset = await importOk("a.xlsx", xlsx);
    expect(dataset.issues.map((i) => i.code)).toContain("header_looks_like_data");
    const noHeader = await importOk("a.xlsx", xlsx, { noHeader: true });
    expect(noHeader.rowCount).toBe(2);
    expect(noHeader.headerRow).toBeNull();
    expect(await importErrorCodes("a.xlsx", buildXlsx([{ name: "F", rows: [[null], ["x"]] }]), { headerRow: 1 })).toEqual(["header_not_found"]);
  });

  it("8. refuse un fichier malformé sans exposer de détail technique", async () => {
    const truncated = buildXlsx([{ name: "F", rows: [["a"], [1]] }]).slice(0, 200);
    expect(await importErrorCodes("a.xlsx", truncated)).toEqual(["xlsx_malformed"]);
    const notWorkbook = zipSync({ "hello.txt": strToU8("pas un classeur") });
    const codes = await importErrorCodes("a.xlsx", notWorkbook);
    expect(codes).toEqual(["xlsx_malformed"]);
  });

  it("9. refuse un classeur volumineux ou anormalement compressé (zip bomb), sans le décompresser", async () => {
    const xlsx = buildXlsx([{ name: "F", rows: [["a"], ...Array.from({ length: 50 }, (_, i) => [i])] }]);
    expect(await importErrorCodes("a.xlsx", xlsx, {}, { ...DEFAULT_IMPORT_LIMITS, maxUncompressedBytes: 1000 })).toEqual(["xlsx_too_large"]);
    expect(await importErrorCodes("a.xlsx", xlsx, {}, { ...DEFAULT_IMPORT_LIMITS, maxRows: 10 })).toEqual(["too_many_rows"]);

    const bomb = zipSync({ "xl/workbook.xml": new Uint8Array(4 * 1024 * 1024) }, { level: 9 });
    const issue = inspectZip(bomb, DEFAULT_IMPORT_LIMITS);
    expect(issue?.code).toBe("xlsx_suspicious_compression");
  });
});
