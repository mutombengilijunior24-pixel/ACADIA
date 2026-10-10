import { describe, expect, it } from "vitest";

import { interpretCell } from "@/lib/core/data/cells";
import { parseCsv } from "@/lib/core/data/csv";
import { DEFAULT_IMPORT_LIMITS } from "@/lib/core/data/limits";

import { buildXlsx, importErrorCodes, importOk, utf8, windows1252 } from "./helpers";

// Données SYNTHÉTIQUES de test.

describe("A1 — importation CSV", () => {
  it("1. lit un CSV simple valide", async () => {
    const dataset = await importOk("enquete.csv", utf8("id,age,sexe\n1,23,F\n2,31,M\n3,27,F\n"));
    expect(dataset.format).toBe("csv");
    expect(dataset.columnCount).toBe(3);
    expect(dataset.rowCount).toBe(3);
    expect(dataset.columns.map((c) => c.originalHeader)).toEqual(["id", "age", "sexe"]);
    expect(dataset.rows[1]).toEqual(["2", "31", "M"]);
    expect(dataset.sourceRows).toEqual([2, 3, 4]);
    expect(dataset.csv).toMatchObject({ delimiter: ",", delimiterSource: "detected", encoding: "utf-8" });
    expect(dataset.status).toBe("ok");
  });

  it("2. préserve les accents français (UTF-8, BOM, et Windows-1252)", async () => {
    const text = "Université;Ville;Réponse\nUniversité de Lubumbashi;Likasi;Très élevé\n";
    const utf = await importOk("a.csv", utf8(`﻿${text}`));
    expect(utf.columns[0].originalHeader).toBe("Université");
    expect(utf.columns[0].technicalName).toBe("universite");
    expect(utf.rows[0]).toEqual(["Université de Lubumbashi", "Likasi", "Très élevé"]);
    expect(utf.csv?.hadBom).toBe(true);

    const ansi = await importOk("b.csv", windows1252(text));
    expect(ansi.rows[0][2]).toBe("Très élevé");
    expect(ansi.csv?.encoding).toBe("windows-1252");
    expect(ansi.issues.map((i) => i.code)).toContain("encoding_fallback");
  });

  it("3. détecte un autre séparateur (point-virgule, tabulation) ou accepte un séparateur imposé", async () => {
    const semicolon = await importOk("a.csv", utf8("note;commentaire\n12,5;bien\n9,0;moyen\n"));
    expect(semicolon.csv?.delimiter).toBe(";");
    expect(semicolon.rows).toEqual([["12,5", "bien"], ["9,0", "moyen"]]);

    const tab = await importOk("a.tsv", utf8("a\tb\n1\t2\n"));
    expect(tab.csv?.delimiter).toBe("\t");

    const forced = await importOk("a.csv", utf8("a|b\n1|2\n"), { delimiter: "|" });
    expect(forced.csv).toMatchObject({ delimiter: "|", delimiterSource: "user" });
    expect(forced.rows).toEqual([["1", "2"]]);
  });

  it("4. conserve un champ entre guillemets contenant le séparateur, des guillemets et un saut de ligne", async () => {
    const dataset = await importOk("a.csv", utf8('nom,avis\n"Kasongo, Jean","Il a dit ""oui""\nsur deux lignes"\nMwamba,ok\n'));
    expect(dataset.rowCount).toBe(2);
    expect(dataset.rows[0]).toEqual(["Kasongo, Jean", 'Il a dit "oui"\nsur deux lignes']);
    expect(dataset.sourceRows).toEqual([2, 4]);
  });

  it("5. distingue cellule vide, chaîne blanche et cellule absente sans rien modifier", async () => {
    const dataset = await importOk("a.csv", utf8("a,b,c\n1,,  \n2,x\n"));
    expect(dataset.rows[0]).toEqual(["1", "", "  "]);
    expect(dataset.rows[1]).toEqual(["2", "x", null]);
    expect(interpretCell(dataset.rows[0][1]).kind).toBe("empty_string");
    expect(interpretCell(dataset.rows[0][2]).kind).toBe("whitespace");
    expect(interpretCell(dataset.rows[1][2]).kind).toBe("missing");
  });

  it("6. accepte un fichier ne contenant que des en-têtes, avec un avertissement", async () => {
    const dataset = await importOk("a.csv", utf8("id,age,sexe\n"));
    expect(dataset.rowCount).toBe(0);
    expect(dataset.columnCount).toBe(3);
    expect(dataset.issues.map((i) => i.code)).toContain("no_observations");
  });

  it("7. refuse un fichier vide ou blanc", async () => {
    expect(await importErrorCodes("a.csv", new Uint8Array())).toEqual(["empty_file"]);
    expect(await importErrorCodes("a.csv", utf8("\n\n  \n"))).toEqual(["empty_file"]);
  });

  it("8. signale les lignes dont la structure ne correspond pas à l'en-tête, sans perdre de valeur", async () => {
    const dataset = await importOk("a.csv", utf8("a,b,c\n1,2,3\n4,5\n6,7,8,9\n"));
    expect(dataset.columnCount).toBe(4);
    expect(dataset.rows).toEqual([
      ["1", "2", "3", null],
      ["4", "5", null, null],
      ["6", "7", "8", "9"],
    ]);
    expect(dataset.columns[3].headerFlags).toContain("extra");
    const codes = dataset.issues.map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["short_rows", "long_rows"]));
    expect(dataset.issues.find((i) => i.code === "short_rows")?.sourceRow).toBe(3);
    expect(dataset.status).toBe("ok_with_warnings");
  });

  it("8b. refuse un guillemet jamais refermé (fichier mal formé)", async () => {
    expect(await importErrorCodes("a.csv", utf8('a,b\n"1,2\n3,4\n'))).toEqual(["csv_unterminated_quote"]);
  });

  it("9. conserve deux colonnes de même en-tête séparément et le signale", async () => {
    const dataset = await importOk("a.csv", utf8("Age,Age,age\n20,21,22\n"));
    expect(dataset.columns.map((c) => c.originalHeader)).toEqual(["Age", "Age", "age"]);
    expect(dataset.columns.map((c) => c.technicalName)).toEqual(["age", "age_2", "age_3"]);
    expect(dataset.rows[0]).toEqual(["20", "21", "22"]);
    expect(dataset.columns[0].headerFlags).toContain("duplicate");
    expect(dataset.columns[2].headerFlags).not.toContain("duplicate");
    expect(dataset.issues.filter((i) => i.code === "duplicate_header")).toHaveLength(1);
  });

  it("10. attribue un nom technique aux colonnes sans en-tête et conserve l'en-tête vide d'origine", async () => {
    const dataset = await importOk("a.csv", utf8("id,,note\n1,x,12\n"));
    expect(dataset.columns[1]).toMatchObject({ originalHeader: "", technicalName: "colonne_2" });
    expect(dataset.columns[1].headerFlags).toContain("empty");
    expect(dataset.issues.map((i) => i.code)).toContain("empty_header");
  });

  it("11. garde les nombres en texte tels quels et les interprète sans les convertir", async () => {
    const dataset = await importOk("a.csv", utf8("code;montant;note\n007;1 200,50;3.5\n"));
    expect(dataset.rows[0]).toEqual(["007", "1 200,50", "3.5"]);
    expect(interpretCell("007")).toMatchObject({ kind: "numeric_text", number: 7, leadingZero: true });
    expect(interpretCell("1 200,50")).toMatchObject({ kind: "numeric_text", number: 1200.5 });
    expect(interpretCell("3,5")).toMatchObject({ kind: "numeric_text", number: 3.5 });
    expect(interpretCell("45 %").kind).toBe("text");
    expect(interpretCell("NA").kind).toBe("text");
  });

  it("12. refuse un fichier dont le format annoncé ne correspond pas au contenu", async () => {
    const xlsx = buildXlsx([{ name: "F", rows: [["a"], [1]] }]);
    expect(await importErrorCodes("donnees.csv", xlsx)).toEqual(["format_mismatch"]);
    expect(await importErrorCodes("donnees.xlsx", utf8("a,b\n1,2\n"))).toEqual(["format_mismatch"]);
    expect(await importErrorCodes("ancien.csv", Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 1, 2]))).toEqual(["format_mismatch"]);
    expect(await importErrorCodes("donnees.sav", utf8("x"))).toEqual(["unsupported_format"]);
    expect(await importErrorCodes("donnees.xls", utf8("x"))).toEqual(["unsupported_format"]);
  });

  it("13. refuse explicitement un fichier dépassant une limite configurée, sans troncature", async () => {
    const lines = ["a,b", ...Array.from({ length: 11 }, (_, i) => `${i},${i}`)].join("\n");
    const limits = { ...DEFAULT_IMPORT_LIMITS, maxRows: 10 };
    expect(await importErrorCodes("a.csv", utf8(lines), {}, limits)).toEqual(["too_many_rows"]);
    expect(await importErrorCodes("a.csv", utf8(lines), {}, { ...DEFAULT_IMPORT_LIMITS, maxFileBytes: 10 })).toEqual(["file_too_large"]);
    expect(await importErrorCodes("a.csv", utf8("a,b,c\n1,2,3\n"), {}, { ...DEFAULT_IMPORT_LIMITS, maxColumns: 2 })).toEqual(["too_many_columns"]);
    const accepted = await importOk("a.csv", utf8(lines), {}, { ...DEFAULT_IMPORT_LIMITS, maxRows: 11 });
    expect(accepted.rowCount).toBe(11);
  });

  it("choisit une autre ligne d'en-tête ou l'absence d'en-tête, et signale un en-tête numérique", async () => {
    const titled = await importOk("a.csv", utf8("Enquête 2026\nid,score\n1,4\n"), { headerRow: 2 });
    expect(titled.columns.map((c) => c.originalHeader)).toEqual(["id", "score"]);
    expect(titled.issues.map((i) => i.code)).toContain("rows_above_header");

    const numeric = await importOk("a.csv", utf8("1,4\n2,5\n"));
    expect(numeric.issues.map((i) => i.code)).toContain("header_looks_like_data");
    const noHeader = await importOk("a.csv", utf8("1,4\n2,5\n"), { noHeader: true });
    expect(noHeader.rowCount).toBe(2);
    expect(noHeader.columns.map((c) => c.technicalName)).toEqual(["colonne_1", "colonne_2"]);
  });

  it("fichier à une seule colonne : aucune valeur coupée (décimales françaises)", async () => {
    const dataset = await importOk("a.csv", utf8("note\n12\n11,5\n14\n"));
    expect(dataset.columnCount).toBe(1);
    expect(dataset.rows).toEqual([["12"], ["11,5"], ["14"]]);
    expect(dataset.csv?.delimiter).toBe("");
    expect(dataset.issues.map((i) => i.code)).toContain("single_column");
  });

  it("parseur : fins de ligne CRLF/CR et dernier enregistrement sans saut de ligne", () => {
    const parsed = parseCsv('a,b\r\n1,2\r3,"4"', ",");
    expect(parsed.ok && parsed.records.map((r) => r.fields)).toEqual([["a", "b"], ["1", "2"], ["3", "4"]]);
  });
});
