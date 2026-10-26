import { describe, expect, it } from "vitest";

import { demoDossier, FINANCE_SNAPSHOT_VERSION, financeSnapshotSchema, financeSteps, parseFinanceSnapshot, type FinanceFlags, type FinanceSnapshot } from "@/lib/core/finance";
import { parseSnapshot } from "@/lib/core/journey/persistence";

// Données FICTIVES (entreprise imaginaire).
const snapshot = (): FinanceSnapshot => ({
  engine: "finance",
  version: FINANCE_SNAPSHOT_VERSION,
  field: { domain: "management", specialty: "finance", secondary: [] },
  fieldConfirmed: true,
  source: "demo",
  dossier: demoDossier(),
  provenance: { kind: "fictifs", description: "" },
  attested: true,
  acceptedGaps: {},
  validatedKey: "abc",
  research: null,
  view: "review",
});

describe("Interprétation financière enregistrée", () => {
  it("l'instantané est validé, aller-retour JSON sans perte", () => {
    const s = snapshot();
    const back = parseFinanceSnapshot(JSON.parse(JSON.stringify(s)));
    expect(back).toEqual(s);
  });

  it("moteur, version ou contenu invalides : refusé", () => {
    const s = snapshot();
    expect(parseFinanceSnapshot({ ...s, engine: "survey" })).toBeNull();
    expect(parseFinanceSnapshot({ ...s, version: 2 })).toBeNull();
    expect(parseFinanceSnapshot({ ...s, dossier: { ...s.dossier, values: { "ex-2021": { ab: 1 } } } })).toBeNull();
    expect(parseFinanceSnapshot({ ...s, dossier: { ...s.dossier, values: { "ex-2021": { TA: Number.POSITIVE_INFINITY } } } })).toBeNull();
    expect(parseFinanceSnapshot({ ...s, dossier: { ...s.dossier, exercises: [] } })).toBeNull();
    // Un instantané financier n'est pas un instantané du parcours général, et inversement.
    expect(parseSnapshot(s)).toBeNull();
    expect(financeSnapshotSchema.safeParse({ version: 1, field: s.field }).success).toBe(false);
  });

  it("taille : 5 exercices complets restent très en dessous de la limite d'enregistrement", () => {
    const s = snapshot();
    const values = { ...s.dossier.values, "ex-2024": s.dossier.values["ex-2023"], "ex-2025": s.dossier.values["ex-2023"] };
    const bytes = JSON.stringify({ ...s, dossier: { ...s.dossier, values } }).length;
    expect(bytes).toBeLessThan(200_000);
  });
});

describe("Étapes du moteur « Gestion financière »", () => {
  const none: FinanceFlags = { domain: false, source: false, review: "none", diagnosis: "none", research: false, framing: "none", indicators: "none", criteria: "none", reasoning: "none", report: "none" };

  it("ordre : domaine → source → vérification → état de l'entreprise…", () => {
    expect(financeSteps(none).current).toBe("domain");
    expect(financeSteps({ ...none, domain: true }).current).toBe("source");
    expect(financeSteps({ ...none, domain: true, source: true }).current).toBe("review");
    const s = financeSteps({ ...none, domain: true, source: true, review: "validated" });
    expect(s.current).toBe("diagnosis");
    expect(s.stages.map((x) => x.state)).toEqual(["done", "done", "current", "todo", "todo", "todo"]);
  });

  it("chiffres modifiés après validation : étape « à revoir », rien n'est effacé", () => {
    const s = financeSteps({ ...none, domain: true, source: true, review: "stale" });
    expect(s.current).toBe("review");
    expect(s.stages[1].state).toBe("stale");
    expect(s.nextAction).toContain("ont changé");
  });
});
