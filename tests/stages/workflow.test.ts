import { describe, expect, it } from "vitest";

import { FACULTY_IDS, REQUIRED_DOCUMENTS } from "@/lib/core/stages/catalog";
import { INSTITUTIONS } from "@/lib/core/stages/institutions";
import { registerSheets, stageReportDocument, type StageReportInput } from "@/lib/core/stages/report";
import { attendanceError, computeStatus, dayKey, defaultEndDate, expectedDays, isDay, nextStep, summarizeAttendance, type WorkflowFacts } from "@/lib/core/stages/workflow";

const docs = REQUIRED_DOCUMENTS.academique.map((d) => d.label);
const base: WorkflowFacts = { type: "academique", status: "en_attente", paymentStatus: "non_paye", documentsReceived: [], assignedCompany: null, tutorName: null, startDate: null, endDate: null };

describe("suivi : chaque étape découle d'un fait", () => {
  it("en attente tant que le pack n'est pas réglé ou qu'un document obligatoire manque", () => {
    expect(computeStatus(base, "2026-11-01")).toBe("en_attente");
    expect(computeStatus({ ...base, paymentStatus: "paye" }, "2026-11-01")).toBe("en_attente");
    expect(computeStatus({ ...base, documentsReceived: docs }, "2026-11-01")).toBe("en_attente");
    expect(nextStep({ ...base, documentsReceived: docs.slice(1) }, "2026-11-01").student.join(" ")).toMatch(/Régler votre pack.*Remettre à MNJ : Carte d'étudiant/);
  });

  it("dossier complet → orienté → placé → en stage → terminé, selon les faits et la date", () => {
    const complete = { ...base, paymentStatus: "paye_bureau", documentsReceived: docs };
    expect(computeStatus(complete, "2026-11-01")).toBe("dossier_complet");
    const oriented = { ...complete, assignedCompany: "Entreprise fictive" };
    expect(computeStatus(oriented, "2026-11-01")).toBe("oriente");
    expect(nextStep(oriented, "2026-11-01").team[0]).toMatch(/maître de stage, la date de début, la date de fin/);
    const placed = { ...oriented, tutorName: "M. Test", startDate: "2026-11-03", endDate: "2026-12-02" };
    expect(computeStatus(placed, "2026-11-02")).toBe("place");
    expect(computeStatus(placed, "2026-11-03")).toBe("en_stage");
    expect(computeStatus(placed, "2026-12-02")).toBe("en_stage");
    expect(computeStatus(placed, "2026-12-03")).toBe("termine");
  });

  it("la lettre de motivation (facultative) ne bloque pas un stage professionnel ; l'annulation prime", () => {
    const pro = { ...base, type: "professionnel" as const, paymentStatus: "paye", documentsReceived: REQUIRED_DOCUMENTS.professionnel.filter((d) => !d.optional).map((d) => d.label) };
    expect(computeStatus(pro, "2026-11-01")).toBe("dossier_complet");
    expect(computeStatus({ ...pro, status: "annule" }, "2026-11-01")).toBe("annule");
  });

  it("durée académique par défaut : un mois (fin incluse), y compris en fin de mois", () => {
    expect(defaultEndDate("2026-11-03")).toBe("2026-12-02");
    expect(defaultEndDate("2026-01-31")).toBe("2026-02-27");
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-02-28")).toBe(true);
  });

  it("le jour de référence est celui de Lubumbashi (UTC+2)", () => {
    expect(dayKey(new Date("2026-11-03T22:30:00Z"))).toBe("2026-11-04");
    expect(dayKey(new Date("2026-11-03T21:30:00Z"))).toBe("2026-11-03");
  });
});

describe("présences", () => {
  const rec = (day: string, closed = true, confirmed = false) => ({ day, arrivalAt: `${day}T06:00:00Z`, departureAt: closed ? `${day}T15:00:00Z` : null, activities: closed ? "Saisie des factures fournisseurs avec le comptable." : null, tutorConfirmedAt: confirmed ? `${day}T16:00:00Z` : null });

  it("jours ouvrés attendus : lundi à vendredi", () => {
    expect(expectedDays("2026-11-02", "2026-11-08")).toEqual(["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
  });

  it("taux, absences et « en ordre » ne comptent que les journées passées et clôturées", () => {
    const records = [rec("2026-11-02", true, true), rec("2026-11-03"), rec("2026-11-04", false)];
    const during = summarizeAttendance(records, "2026-11-02", "2026-11-06", "2026-11-05");
    expect(during).toMatchObject({ expected: 3, complete: 2, incomplete: 1, confirmed: 1, absent: [], inOrder: false });
    expect(during.rate).toBeCloseTo(2 / 3);
    const after = summarizeAttendance([...records.slice(0, 2), rec("2026-11-04"), rec("2026-11-05"), rec("2026-11-06")], "2026-11-02", "2026-11-06", "2026-11-09");
    expect(after.inOrder).toBe(true);
    const absentee = summarizeAttendance([rec("2026-11-02")], "2026-11-02", "2026-11-06", "2026-11-09");
    expect(absentee.absent).toEqual(["2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06"]);
    expect(absentee.inOrder).toBe(false);
  });

  it("règles de signature : période du stage, arrivée avant départ, compte rendu obligatoire, une fois par jour", () => {
    const s = "2026-11-02";
    const e = "2026-11-06";
    expect(attendanceError("place", "2026-11-01", s, e, null, { action: "arrivee" })).toMatch(/période du stage/);
    expect(attendanceError("en_stage", "2026-11-03", s, e, null, { action: "arrivee" })).toBeNull();
    expect(attendanceError("en_stage", "2026-11-03", s, e, rec("2026-11-03", false), { action: "arrivee" })).toMatch(/déjà signée/);
    expect(attendanceError("en_stage", "2026-11-03", s, e, null, { action: "depart", activities: "x".repeat(40) })).toMatch(/d'abord votre arrivée/);
    expect(attendanceError("en_stage", "2026-11-03", s, e, rec("2026-11-03", false), { action: "depart", activities: "Trop court" })).toMatch(/au moins/);
    expect(attendanceError("en_stage", "2026-11-03", s, e, rec("2026-11-03", false), { action: "depart", activities: "Préparation de l'inventaire du magasin." })).toBeNull();
    expect(attendanceError("en_stage", "2026-11-03", s, e, rec("2026-11-03"), { action: "depart", activities: "Préparation de l'inventaire du magasin." })).toMatch(/déjà clôturée/);
  });
});

describe("établissements : uniquement des données sourcées", () => {
  it("identifiants uniques, rattachement à une faculté connue, source officielle quand des facultés sont publiées", () => {
    const ids = INSTITUTIONS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const i of INSTITUTIONS) {
      if (i.coverage === "aucune") {
        expect(i.units).toBeUndefined();
        continue;
      }
      expect(i.source?.url).toMatch(/^https:\/\//);
      expect(i.units?.length).toBeGreaterThan(0);
      for (const u of i.units ?? []) expect(FACULTY_IDS).toContain(u.facultyId);
    }
  });

  it("l'ISC Lubumbashi propose ses six filières officielles et leurs options", () => {
    const isc = INSTITUTIONS.find((i) => i.id === "isc-lubumbashi")!;
    expect(isc.units?.map((u) => u.name)).toEqual(["Sciences Commerciales et Financières", "Informatique de Gestion", "Gestion des Ressources Humaines", "Banque, Microfinance et Assurances", "Fiscalité, Douane et Accises", "Secrétariat de Direction"]);
    expect(isc.units?.[0].programs).toContain("Comptabilité et Finance");
  });
});

describe("rapport de stage et registre", () => {
  const input: StageReportInput = {
    type: "academique",
    lastName: "Ilunga",
    postName: "",
    firstName: "Paul",
    university: "ISC — Institut Supérieur de Commerce de Lubumbashi",
    faculty: "economie_gestion",
    facultyName: "Sciences Commerciales et Financières",
    department: "Comptabilité et Finance",
    level: "G3 / L3 (Bac + 3)",
    studentNumber: "ISC-0001",
    skills: ["Comptabilité SYSCOHADA"],
    objectives: "Comprendre la tenue de la comptabilité dans une entreprise commerciale.",
    assignedCompany: "Entreprise fictive",
    companyAddress: null,
    tutorName: "M. Test",
    tutorRole: "Chef comptable",
    startDate: "2026-11-02",
    endDate: "2026-11-06",
    attendance: [
      { day: "2026-11-02", arrivalAt: "2026-11-02T06:00:00Z", departureAt: "2026-11-02T15:30:00Z", activities: "Découverte du service comptable et du plan de comptes.", tutorConfirmedAt: "2026-11-02T16:00:00Z" },
      { day: "2026-11-03", arrivalAt: "2026-11-03T06:10:00Z", departureAt: "2026-11-03T15:00:00Z", activities: "Saisie de 25 factures fournisseurs.", tutorConfirmedAt: null },
    ],
  };

  it("reprend le journal mot pour mot et marque ce qui reste à rédiger", () => {
    const doc = stageReportDocument(input, "2026-11-09");
    const text = JSON.stringify(doc.blocks);
    expect(text).toContain("Saisie de 25 factures fournisseurs.");
    expect(text).toContain("[À rédiger : historique");
    expect(text).toContain("matricule ISC-0001");
    const annex = doc.blocks.find((b) => b.type === "table");
    expect(annex && annex.type === "table" ? annex.rows : []).toHaveLength(2);
    expect(annex && annex.type === "table" ? annex.rows[0] : []).toEqual(["lundi 2 novembre 2026", "08:00", "17:30", "9 h 30", "Oui"]);
  });

  it("registre de la faculté : synthèse et présences jour par jour", () => {
    const sheets = registerSheets([{ name: "Ilunga Paul", studentNumber: "ISC-0001", department: input.department, level: input.level, company: input.assignedCompany, startDate: input.startDate, endDate: input.endDate, attendance: input.attendance }], "Registre", "2026-11-09");
    expect(sheets.map((s) => s.name)).toEqual(["Synthèse", "Registre de présences"]);
    expect(sheets[0].rows[2]).toEqual(["Ilunga Paul", "ISC-0001", "Comptabilité et Finance", "G3 / L3 (Bac + 3)", "Entreprise fictive", "2026-11-02", "2026-11-06", 5, 2, 1, 3, "40 %", "Non"]);
    expect(sheets[1].rows).toHaveLength(4);
  });
});
