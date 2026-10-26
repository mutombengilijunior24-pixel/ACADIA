import { describe, expect, it } from "vitest";

import { blockingGaps, demoDossier, emptyDossier, newExercise, resolveExercise, runChecks, setValue, statementsKey, type FinanceDossier } from "@/lib/core/finance";

// Données FICTIVES (entreprise imaginaire SOKAMA SARL).
const gaps = (d: FinanceDossier) => runChecks(d).filter((c) => c.status === "gap");

describe("Contrôles comptables", () => {
  it("la démonstration est exactement équilibrée : aucun écart, tous les contrôles conformes", () => {
    const checks = runChecks(demoDossier());
    expect(gaps(demoDossier())).toEqual([]);
    const keys = checks.map((c) => c.key.split(":").slice(0, 2).join(":"));
    for (const k of ["equilibre:BZ", "resultat:CJ", "tft:ZH", "tft:ZA", "total:XI", "total:BZ", "total:CP", "total:ZG"]) expect(keys, k).toContain(k);
    // ZA de 2021 : pas de bilan 2020 dans le dossier → non vérifiable (pas de contrôle), pas d'écart.
    expect(checks.some((c) => c.key === "tft:ZA:ex-2021")).toBe(false);
  });

  it("totaux calculés à partir des composantes ; postes vides d'un état fourni comptés à zéro", () => {
    const d = demoDossier();
    const v = resolveExercise(d, "ex-2023");
    expect(v.XI.value).toBe(94176);
    expect(v.XI.computed).toBe(94176);
    expect(v.AE).toMatchObject({ value: 0, origin: "vide" });
    // Un total non saisi est calculé.
    const sansTotal = setValue(d, "ex-2023", "AZ", null);
    expect(resolveExercise(sansTotal, "ex-2023").AZ).toMatchObject({ value: 2375000, origin: "calcule" });
  });

  it("état non fourni : valeurs inconnues (jamais zéro)", () => {
    let d = emptyDossier();
    const id = d.exercises[0].id;
    d = setValue(d, id, "BB", 1000);
    const v = resolveExercise(d, id);
    expect(v.BB.value).toBe(1000);
    expect(v.XI).toMatchObject({ value: null, origin: "absent" });
    expect(v.RA.value).toBeNull();
  });

  it("un chiffre mal recopié est signalé (total, équilibre, résultat), jamais corrigé", () => {
    const d = setValue(demoDossier(), "ex-2022", "BI", 1_150_300); // 1 000 de moins que le document
    const found = blockingGaps(runChecks(d)).map((c) => c.key);
    expect(found).toContain("total:BG:ex-2022");
    expect(d.values["ex-2022"].BI).toBe(1_150_300);
    const bg = runChecks(d).find((c) => c.key === "total:BG:ex-2022")!;
    expect(bg.gap).toBe(1000);
    expect(bg.explanation).toContain("1 214 300");
  });

  it("résultat différent entre bilan et compte de résultat ; trésorerie du TFT différente du bilan", () => {
    let d = setValue(demoDossier(), "ex-2021", "CJ", 219_000);
    d = setValue(d, "ex-2021", "CP", null); // total recalculé
    d = setValue(d, "ex-2021", "DF", null);
    d = setValue(d, "ex-2021", "DZ", null);
    const keys = blockingGaps(runChecks(d)).map((c) => c.key);
    expect(keys).toContain("resultat:CJ:ex-2021");
    expect(keys).toContain("equilibre:BZ:ex-2021");
    // Un flux mal recopié : le sous-total imprimé le signale…
    const tft = setValue(demoDossier(), "ex-2023", "FC", -400_000);
    expect(blockingGaps(runChecks(tft)).map((c) => c.key)).toEqual(["total:ZB:ex-2023"]);
    // … et, sans totaux imprimés, la trésorerie de clôture recalculée ne correspond plus au bilan.
    let sansTotaux = tft;
    for (const code of ["ZB", "ZG", "ZH"]) sansTotaux = setValue(sansTotaux, "ex-2023", code, null);
    expect(blockingGaps(runChecks(sansTotaux)).map((c) => c.key)).toEqual(["tft:ZH:ex-2023"]);
  });

  it("tolérance d'arrondi : un écart d'une unité sur un total de 30 postes est accepté", () => {
    const d = setValue(demoDossier(), "ex-2021", "BZ", 3_876_439);
    expect(blockingGaps(runChecks(d)).map((c) => c.key)).not.toContain("equilibre:BZ:ex-2021");
  });

  it("vraisemblance : signe, unité, exercices non contigus", () => {
    let d = setValue(demoDossier(), "ex-2022", "RK", -375_000);
    expect(runChecks(d).find((c) => c.key === "negatif:RK:ex-2022")?.severity).toBe("warning");
    d = demoDossier();
    d = { ...d, values: { ...d.values, "ex-2023": Object.fromEntries(Object.entries(d.values["ex-2023"]).map(([k, v]) => [k, v * 1000])) } };
    expect(runChecks(d).some((c) => c.key === "echelle:BZ:ex-2023")).toBe(true);
    d = demoDossier();
    d = { ...d, exercises: [d.exercises[0], d.exercises[1], { ...newExercise(2023, "ex-2023"), start: "2023-03-01" }] };
    expect(runChecks(d).some((c) => c.key === "contigus:ex-2023")).toBe(true);
  });

  it("l'empreinte des chiffres change dès qu'un montant change (validation « à revoir »)", () => {
    const d = demoDossier();
    expect(statementsKey(setValue(d, "ex-2021", "TA", 6_000_001))).not.toBe(statementsKey(d));
    expect(statementsKey(demoDossier())).toBe(statementsKey(d));
  });

  it("journal des corrections : seule une modification d'un montant existant est journalisée", () => {
    let d = emptyDossier();
    const id = d.exercises[0].id;
    d = setValue(d, id, "TA", 100);
    expect(d.corrections).toHaveLength(0);
    d = setValue(d, id, "TA", 120);
    expect(d.corrections).toMatchObject([{ code: "TA", before: 100, after: 120 }]);
  });
});
