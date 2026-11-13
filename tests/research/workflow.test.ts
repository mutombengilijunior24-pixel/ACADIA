import { describe, expect, it } from "vitest";

import { canContinue, collectHref, fieldLabel, hasDirectorChoice, interpretHref, journeySeed, missingFor, WIZARD_DOMAINS, WIZARD_STEPS, WIZARD_TOTAL_STEPS } from "@/lib/core/research/workflow";
import { initialResearchData, type ResearchData } from "@/types/Research";

const r = (patch: Partial<ResearchData>): ResearchData => ({ ...initialResearchData, objectives: [], ...patch });

describe("« Nouvelle recherche » en 4 étapes", () => {
  it("4 étapes, le directeur en dernier ; domaines limités à l'économie et à la gestion", () => {
    expect(WIZARD_TOTAL_STEPS).toBe(4);
    expect(WIZARD_STEPS[3].title).toMatch(/Directeur/);
    expect(WIZARD_DOMAINS.map((d) => d.id)).toEqual(["management", "economics"]);
  });

  it("les deux chemins n'apparaissent qu'une fois le directeur choisi (liste ou nom saisi)", () => {
    expect(hasDirectorChoice(r({}))).toBe(false);
    expect(hasDirectorChoice(r({ directorId: "", directorName: " A " }))).toBe(false);
    expect(hasDirectorChoice(r({ directorId: "annuaire-2026-08", directorName: "PO DITEND" }))).toBe(true);
    expect(hasDirectorChoice(r({ directorId: "", directorName: "Prof Mutombo" }))).toBe(true);
  });

  it("on ne passe jamais l'étape du sujet sans sujet", () => {
    expect(canContinue(0, r({ title: "" }))).toBe(false);
    expect(canContinue(0, r({ title: "   Inflation   " }))).toBe(false);
    expect(missingFor(0, r({ title: "" }))).toMatch(/sujet/);
    expect(canContinue(0, r({ title: "Déterminants de l'inflation en RDC" }))).toBe(true);
    expect(missingFor(0, r({ title: "Déterminants de l'inflation en RDC" }))).toBeNull();
  });

  it("spécialité obligatoire, jamais hors économie / gestion ni « prévue »", () => {
    expect(canContinue(1, r({ domain: "Économie" }))).toBe(false);
    expect(canContinue(1, r({ specialty: "monetary_banking" }))).toBe(true);
    expect(canContinue(1, r({ specialty: "interdisciplinary_other" }))).toBe(false);
    expect(canContinue(1, r({ specialty: "customs" }))).toBe(false);
    expect(canContinue(1, r({ specialty: "inventée" }))).toBe(false);
  });

  it("niveau et université obligatoires ; directeur facultatif", () => {
    expect(canContinue(2, r({ level: "Master" }))).toBe(false);
    expect(missingFor(2, r({ level: "Master" }))).toMatch(/université/);
    expect(canContinue(2, r({ level: "Master", university: "UNILU — Université de Lubumbashi" }))).toBe(true);
    expect(canContinue(3, r({}))).toBe(true);
  });

  it("libellé du domaine et de la spécialité", () => {
    expect(fieldLabel(r({ domain: "Économie", specialty: "development" }))).toBe("Économie · Économie du développement");
    expect(fieldLabel(r({ domain: "Économie & Finance" }))).toBe("Économie & Finance");
  });
});

describe("les deux chemins", () => {
  it("récolter : questionnaire avec le sujet et l'université", () => {
    expect(collectHref(r({ title: "Crédit & PME", university: "UNILU" }))).toBe("/dashboard/survey/new?sujet=Cr%C3%A9dit+%26+PME&institution=UNILU");
    expect(collectHref(null)).toBe("/dashboard/survey/new");
  });

  it("interpréter : spécialité transmise ; gestion financière vers son moteur dédié", () => {
    expect(interpretHref(r({ specialty: "monetary_banking" }))).toBe("/dashboard/journey?domaine=economics&specialite=monetary_banking");
    expect(interpretHref(r({ specialty: "finance" }))).toBe("/dashboard/journey?moteur=finance");
    expect(interpretHref(r({}))).toBe("/dashboard/journey");
  });

  it("paramètres d'ouverture du parcours : jamais une valeur hors référentiel", () => {
    expect(journeySeed("economics", "rural")).toEqual({ domain: "economics", specialty: "rural" });
    expect(journeySeed("management", "rural")).toBeNull();
    expect(journeySeed("economics", ["rural"])).toBeNull();
    expect(journeySeed(undefined, undefined)).toBeNull();
  });
});
