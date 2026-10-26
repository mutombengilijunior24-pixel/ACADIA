import { describe, expect, it } from "vitest";

import { leavesOf, POSTE_BY_CODE, POSTES, postesOf } from "@/lib/core/finance";

describe("Référentiel SYSCOHADA révisé", () => {
  it("codes uniques, de deux lettres majuscules", () => {
    const codes = POSTES.map((p) => p.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(code).toMatch(/^[A-Z]{2}$/);
  });

  it("chaque total ne cite que des postes existants de la même section, sans cycle", () => {
    for (const poste of POSTES.filter((p) => p.kind === "total")) {
      expect(poste.sum?.length, poste.code).toBeGreaterThan(0);
      for (const child of poste.sum!) {
        expect(POSTE_BY_CODE[child], `${poste.code} → ${child}`).toBeDefined();
        expect(POSTE_BY_CODE[child].section, `${poste.code} → ${child}`).toBe(poste.section);
      }
      // Sans cycle : la descente aboutit à des postes élémentaires.
      expect(leavesOf(poste.code).every((c) => POSTE_BY_CODE[c].kind === "poste")).toBe(true);
    }
  });

  it("totaux généraux et structure des états", () => {
    expect(leavesOf("BZ")).toEqual(expect.arrayContaining(["AE", "AJ", "BB", "BI", "BS", "BU"]));
    expect(leavesOf("DZ")).toEqual(expect.arrayContaining(["CA", "CJ", "DA", "DJ", "DR", "DV"]));
    expect(leavesOf("XI")).toEqual(expect.arrayContaining(["TA", "RA", "RK", "RM", "TN", "RS"]));
    // La valeur ajoutée part du chiffre d'affaires (TA n'est compté qu'une fois).
    expect(leavesOf("XC").filter((c) => c === "TA")).toHaveLength(1);
    expect(postesOf("actif").at(-1)!.code).toBe("BZ");
    expect(postesOf("passif").at(-1)!.code).toBe("DZ");
    expect(postesOf("cr").at(-1)!.code).toBe("XI");
    expect(postesOf("tft").at(-1)!.code).toBe("ZH");
  });

  it("sens des postes : charges et décaissements en contribution négative", () => {
    for (const code of ["RA", "RK", "RL", "RM", "RS", "FF", "FG", "FN", "FQ", "CB"]) expect(POSTE_BY_CODE[code].sign, code).toBe(-1);
    for (const code of ["TA", "TK", "CA", "DA", "FO", "FI"]) expect(POSTE_BY_CODE[code].sign, code).toBe(1);
    for (const code of ["RB", "TE", "CH", "CJ", "ZA", "FC"]) expect(POSTE_BY_CODE[code].signed, code).toBe(true);
  });
});
