import { describe, expect, it } from "vitest";

import { checkCausality } from "@/lib/core/analysis/InterpretationGuards";
import { computeFinance, demoDossier, diagnose, financeReflexes, POSTES, setValue, type FinanceDossier } from "@/lib/core/finance";

// Données FICTIVES (entreprise imaginaire SOKAMA SARL, milliers de CDF).
const demo = demoDossier();
const c = computeFinance(demo);
const value = (id: string, index: number) => c.series[id].values[index].value!;
const D = demo.values;
const close = (actual: number, expected: number) => expect(actual).toBeCloseTo(expected, 6);

/** Un exercice de la démonstration seul, sans aucun total saisi (les totaux sont recalculés). */
function onlyLeaves(exerciseId: string, patch: Record<string, number> = {}): FinanceDossier {
  const totals = new Set(POSTES.filter((p) => p.kind === "total").map((p) => p.code));
  const values = Object.fromEntries(Object.entries({ ...D[exerciseId], ...patch }).filter(([code]) => !totals.has(code)));
  return { ...demo, exercises: demo.exercises.filter((e) => e.id === exerciseId), values: { [exerciseId]: values }, origins: {} };
}

describe("Indicateurs calculés sur la démonstration (vérifiés à la main)", () => {
  it("équilibre : FR, BFE, trésorerie nette, identité FR − BF = TN", () => {
    const y = D["ex-2023"];
    close(value("fr", 2), y.DF - y.AZ);
    close(value("bfe", 2), y.BK - y.DP);
    close(value("tn", 2), y.BT - y.DT);
    expect(value("tn", 2)).toBe(-413_176);
    close(value("fr", 2) - value("bf", 2), value("tn", 2));
  });

  it("liquidité, solvabilité, rentabilité", () => {
    const y = D["ex-2023"];
    close(value("lg", 2), (y.BK + y.BT) / (y.DP + y.DT));
    close(value("lr", 2), (y.BK - y.BB + y.BT) / (y.DP + y.DT));
    close(value("autonomie", 2), y.CP / y.DZ);
    close(value("gearing", 2), (y.DA + y.DT - y.BT) / y.CP);
    close(value("roe", 2), y.XI / y.CP);
    close(value("marge_nette", 2), y.XI / y.XB);
    close(value("taux_ebe", 2), y.XD / y.XB);
    close(value("re_brute", 2), y.XE / (y.AZ + y.BK - y.DP));
    close(value("couv_ff", 2), y.XD / y.RM);
    close(value("cp_capital", 2), y.CP / y.CA);
  });

  it("CAF : les deux méthodes concordent et égalent la CAFG du tableau des flux ; capacité de remboursement", () => {
    for (let i = 0; i < 3; i += 1) {
      close(value("cafg", i), value("cafg_additive", i));
      close(value("cafg", i), D[demo.exercises[i].id].FA);
    }
    close(value("capacite_remb", 2), D["ex-2023"].DA / D["ex-2023"].FA);
  });

  it("délais (TVA 16 %, 360 jours) et croissance", () => {
    const y = D["ex-2023"];
    close(value("delai_clients", 2), (y.BI / (y.XB * 1.16)) * 360);
    close(value("delai_stocks", 2), (y.BB / (y.RA + y.RB)) * 360);
    close(value("delai_fournisseurs", 2), (y.DJ / ((y.RA + y.RE + y.RG + y.RH) * 1.16)) * 360);
    expect(Math.round(value("delai_clients", 0))).toBe(38);
    expect(Math.round(value("delai_clients", 2))).toBe(62);
    close(value("croissance_ca", 1), D["ex-2022"].XB / D["ex-2021"].XB - 1);
    expect(c.series.croissance_ca.values[0].status).toBe("no_previous");
  });

  it("effet de levier : positif en 2021, négatif en 2023 (Re nette < coût de la dette après impôt)", () => {
    expect(value("levier_ecart", 0)).toBeGreaterThan(0);
    expect(value("levier_ecart", 2)).toBeLessThan(0);
    const y = D["ex-2023"];
    close(value("levier_ecart", 2), (y.XE * 0.7) / (y.AZ + y.BK - y.DP) - (y.RM * 0.7) / (y.DA + y.DT));
  });

  it("indicateur sans objet ou état absent : non calculable avec sa raison, jamais inventé", () => {
    const negatif = computeFinance(onlyLeaves("ex-2023", { CG: -3_000_000 }));
    expect(negatif.series.roe.values[0]).toMatchObject({ value: null, status: "not_significant" });
    expect(negatif.series.roe.values[0].reason).toContain("capitaux propres");
    const bilanSeul = computeFinance({ ...onlyLeaves("ex-2023"), values: { "ex-2023": Object.fromEntries(Object.entries(onlyLeaves("ex-2023").values["ex-2023"]).filter(([k]) => /^[A-D]/.test(k))) } });
    expect(bilanSeul.series.roe.values[0]).toMatchObject({ value: null, status: "statement_missing" });
    expect(bilanSeul.series.lg.values[0].value).not.toBeNull();
  });
});

describe("Verdict « L'état de l'entreprise »", () => {
  const dg = diagnose(c, demo)!;

  it("démonstration : saine en 2021, fragile en 2023, en dégradation, avec raisons chiffrées", () => {
    expect(dg.byExercise.map((e) => e.level)).toEqual(["saine", "plutot_saine", "fragile"]);
    expect(dg.trajectory).toBe("degradation");
    expect(dg.headline).toBe("Fragile en 2023 (saine en 2021), en dégradation");
    expect(dg.reasons.join(" ")).toMatch(/Capacité de remboursement : 12,4 ans en 2023/);
    expect(dg.reasons.join(" ")).toMatch(/effet de levier négatif/);
    const solvabilite = dg.latest.dimensions.find((d) => d.id === "solvabilite")!;
    expect(solvabilite.level).toBe("fragile");
  });

  it("entreprise en difficulté : seuils rédhibitoires (capitaux propres négatifs, EBE négatif)", () => {
    const d = onlyLeaves("ex-2023", { CG: -3_000_000, RK: 1_500_000 });
    const r = diagnose(computeFinance(d), d)!;
    const dims = Object.fromEntries(r.latest.dimensions.map((x) => [x.id, x]));
    expect(dims.solvabilite.level).toBe("difficulte");
    expect(dims.solvabilite.caps).toContain("capitaux propres négatifs ou nuls");
    expect(dims.rentabilite.level).toBe("difficulte");
    expect(["fragile", "difficulte"]).toContain(r.latest.level);
  });

  it("entreprise saine (exercice 2021 seul)", () => {
    const d = onlyLeaves("ex-2021");
    expect(diagnose(computeFinance(d), d)!.latest.level).toBe("saine");
  });

  it("données insuffisantes : dimensions « non établies », jamais devinées", () => {
    const leaves = onlyLeaves("ex-2023").values["ex-2023"];
    const d: FinanceDossier = { ...onlyLeaves("ex-2023"), values: { "ex-2023": Object.fromEntries(Object.entries(leaves).filter(([k]) => /^[A-D]/.test(k))) } };
    const r = diagnose(computeFinance(d), d)!;
    const dims = Object.fromEntries(r.latest.dimensions.map((x) => [x.id, x.level]));
    expect(dims.rentabilite).toBe("non_etabli");
    expect(dims.activite).toBe("non_etabli");
  });

  it("le secteur ajuste les repères (délai clients de 62 jours : défavorable en commerce, à surveiller dans l'industrie)", () => {
    expect(c.series.delai_clients.values[2].zone).toBe("defavorable");
    const industrie = { ...demo, company: { ...demo.company, sector: "industrie" as const } };
    expect(computeFinance(industrie).series.delai_clients.values[2].zone).toBe("vigilance");
  });
});

describe("Réflexes du financier", () => {
  const reflexes = financeReflexes(c, demo, { provenance: "fictifs", acceptedGaps: 0 });
  const ids = reflexes.map((r) => r.id);

  it("démonstration : les signaux du scénario sont repérés, avec les chiffres", () => {
    for (const id of ["tn_negative", "dr_recurrent", "ciseaux", "delai_clients", "delai_stocks", "resultat_hao", "levier_negatif", "capacite_remb", "dettes_fiscales", "inflation", "lg_trompeuse", "benefice_sans_tresorerie"]) expect(ids, id).toContain(id);
    expect(ids).not.toContain("cp_negatifs");
    expect(ids).not.toContain("tft_absent");
    expect(reflexes[0].severity).toBe("critique");
    expect(reflexes.find((r) => r.id === "delai_clients")!.text).toContain("38 j");
    expect(reflexes.find((r) => r.id === "dettes_fiscales")!.text).toContain("+70 %");
  });

  it("un seul exercice sans tableau des flux : réflexes de méthode", () => {
    const d = onlyLeaves("ex-2021");
    const noTft = { ...d, values: { "ex-2021": Object.fromEntries(Object.entries(d.values["ex-2021"]).filter(([k]) => !/^[FZ]/.test(k))) } };
    const r = financeReflexes(computeFinance(noTft), noTft, { provenance: "internes", acceptedGaps: 1 }).map((x) => x.id);
    expect(r).toEqual(expect.arrayContaining(["un_exercice", "tft_absent", "non_audites", "ecarts_acceptes"]));
  });

  it("aucun texte produit n'emploie un vocabulaire causal sans précaution", () => {
    const dg = diagnose(c, demo)!;
    const texts = [...reflexes.map((r) => r.text), ...dg.reasons, ...dg.latest.dimensions.flatMap((d) => d.reasons)];
    expect(checkCausality(texts.map((text, i) => ({ field: String(i), text })))).toEqual([]);
  });

  it("une modification des chiffres change le verdict calculé (rien n'est figé)", () => {
    const better = setValue(demo, "ex-2023", "RM", 50_000);
    expect(computeFinance(better).series.couv_ff.values[2].value).toBeGreaterThan(value("couv_ff", 2));
  });
});
