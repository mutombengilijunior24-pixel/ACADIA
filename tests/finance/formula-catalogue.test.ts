import { describe, expect, it } from "vitest";

import { AGGREGATES, evaluate, FAMILY_LABELS, identifiersOf, INDICATORS, parseFormula, POSTE_BY_CODE, type Evaluation, type FamilyId } from "@/lib/core/finance";

const PARAMS = new Set(["tva", "taux_is", "jours"]);
const known = (name: string) => !!POSTE_BY_CODE[name] || name in AGGREGATES || PARAMS.has(name);
const run = (src: string, values: Record<string, number[]>, index = 0): Evaluation =>
  evaluate(parseFormula(src), index, (name, i) => (values[name]?.[i] !== undefined ? { ok: true, value: values[name][i] } : i < 0 ? { ok: false, reason: "no_previous" } : { ok: false, reason: "missing", codes: [name] }));

describe("Langage des formules", () => {
  it("priorités, parenthèses, moins unaire, fonctions", () => {
    expect(run("2 + 3 * 4", {})).toEqual({ ok: true, value: 14 });
    expect(run("(2 + 3) * 4", {})).toEqual({ ok: true, value: 20 });
    expect(run("-XI / -CP", { XI: [10], CP: [-40] })).toEqual({ ok: true, value: -0.25 });
    expect(run("abs(XI) + min(1, 2) + max(1, 2)", { XI: [-5] })).toEqual({ ok: true, value: 8 });
    expect(run("XB / prev(XB) - 1", { XB: [100, 125] }, 1)).toEqual({ ok: true, value: 0.25 });
    expect(run("avg(BB)", { BB: [100, 300] }, 1)).toEqual({ ok: true, value: 200 });
    expect(run("prev(XB)", { XB: [100] }, 0)).toEqual({ ok: false, reason: "no_previous" });
  });

  it("poste manquant : non calculable avec la liste des postes, division par zéro signalée", () => {
    expect(run("(BK + BT) / (DP + DT)", { BK: [10], DP: [5] })).toEqual({ ok: false, reason: "missing", codes: ["BT", "DT"] });
    expect(run("XI / CP", { XI: [10], CP: [0] })).toEqual({ ok: false, reason: "zero_division" });
  });

  it("aucun eval : fonction inconnue ou caractère inattendu refusés à l'analyse", () => {
    expect(() => parseFormula("constructor(1)")).toThrow(/fonction inconnue/);
    expect(() => parseFormula("XI; alert(1)")).toThrow();
    expect(() => parseFormula("XI / ")).toThrow();
    expect(() => parseFormula("(XI")).toThrow();
  });
});

describe("Base des indicateurs : intégrité", () => {
  it("plus de 100 indicateurs, identifiants uniques, toutes les familles représentées", () => {
    expect(INDICATORS.length).toBeGreaterThanOrEqual(100);
    expect(new Set(INDICATORS.map((i) => i.id)).size).toBe(INDICATORS.length);
    for (const family of Object.keys(FAMILY_LABELS) as FamilyId[]) expect(INDICATORS.some((i) => i.family === family), family).toBe(true);
  });

  it("un nom d'agrégat n'est jamais un code REF ; chaque formule d'agrégat est valide et ne cite que des noms connus", () => {
    for (const [name, aggregate] of Object.entries(AGGREGATES)) {
      expect(POSTE_BY_CODE[name], `${name} est aussi un code REF`).toBeUndefined();
      for (const id of identifiersOf(parseFormula(aggregate.formula))) expect(known(id), `${name} → ${id}`).toBe(true);
    }
  });

  it("chaque formule (et garde) est valide et ne cite que des postes, agrégats ou paramètres connus", () => {
    for (const def of INDICATORS) {
      for (const formula of [def.formula, ...(def.guard ? [def.guard.formula] : [])]) {
        const node = parseFormula(formula);
        for (const id of identifiersOf(node)) expect(known(id), `${def.id} → ${id}`).toBe(true);
      }
    }
  });

  it("fiches complètes : définition, intérêt ; indicateur jugé = repères + lectures ; indicateur du verdict = jugé", () => {
    for (const def of INDICATORS) {
      expect(def.definition.length, def.id).toBeGreaterThan(10);
      expect(def.why.length, def.id).toBeGreaterThan(10);
      if (def.norms && def.direction !== "neutral") {
        expect(def.reading.favorable, def.id).not.toBe("");
        expect(def.reading.defavorable, def.id).not.toBe("");
        expect(def.norms.note.length, def.id).toBeGreaterThan(10);
      }
      if (def.dimension) {
        expect(def.norms, def.id).toBeDefined();
        expect(def.direction, def.id).not.toBe("neutral");
        expect(def.weight, def.id).toBeGreaterThan(0);
      }
      if (def.norms && def.direction === "higher") expect(def.norms.default.good, def.id).toBeGreaterThanOrEqual(def.norms.default.bad);
      if (def.norms && def.direction === "lower") expect(def.norms.default.good, def.id).toBeLessThanOrEqual(def.norms.default.bad);
    }
  });

  it("les scores calibrés ailleurs portent une mise en garde et ne participent pas au verdict", () => {
    for (const def of INDICATORS.filter((i) => i.family === "scores")) {
      expect(def.caveat, def.id).toMatch(/non validé pour la RDC/);
      expect(def.dimension, def.id).toBeUndefined();
    }
  });
});
