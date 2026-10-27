import { strFromU8, unzipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { buildWorkbook } from "@/lib/core/export/xlsx";
import { DEFAULT_STAGE_OPTIONS, FACULTIES, FACULTY_BY_ID, isPaid, LEVELS, normalizeOptions, optionsTotal, paidOptions, STAGE_OPTIONS, stageApplicationSchema } from "@/lib/core/stages/catalog";
import { stageWorkbookSheets, STAGE_EXPORT_HEADER, type StageExportRow } from "@/lib/core/stages/export";

const valid = {
  type: "professionnel" as const,
  lastName: "Kabila",
  postName: "Mwamba",
  firstName: "Grâce",
  phone: "+243 81 234 5678",
  email: "grace@example.com",
  university: "Université de Lubumbashi",
  institutionId: "",
  faculty: "economie_gestion",
  facultyName: "",
  department: "Gestion financière",
  level: "Master 2" as const,
  studentNumber: "",
  graduationYear: null,
  skills: ["Analyse financière"],
  objectives: "Mettre en pratique l'analyse des états financiers dans une entreprise.",
  preferredCompany: "",
  preferredCity: "Lubumbashi",
  startMonth: "2026-11",
  consent: true as const,
};

describe("catalogue Stage Connect", () => {
  it("couvre toutes les facultés, pas seulement l'économie, chacune avec filières et compétences", () => {
    const ids = FACULTIES.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toEqual(expect.arrayContaining(["economie_gestion", "polytechnique", "droit", "medecine_sante", "informatique"]));
    for (const f of FACULTIES) {
      expect(FACULTY_BY_ID[f.id]).toBe(f);
      // « Autre faculté » : filière en saisie libre.
      if (f.id !== "autre") expect(f.departments.length).toBeGreaterThan(0);
      expect(f.skills.length).toBeGreaterThan(0);
    }
  });

  it("propose deux options (17 $ et 10 $, 27 $ les deux) et ne considère comme réglés que les paiements confirmés", () => {
    // Recommandation 17 $ (cochée d'office), assurance 10 $, les deux 27 $.
    expect(STAGE_OPTIONS.map((o) => [o.id, o.priceUsd])).toEqual([["recommandation", 17], ["assurance", 10]]);
    expect(DEFAULT_STAGE_OPTIONS).toEqual(["recommandation"]);
    expect(optionsTotal(["recommandation"])).toBe(17);
    expect(optionsTotal(["assurance"])).toBe(10);
    expect(optionsTotal(["assurance", "recommandation", "assurance", "inconnue"])).toBe(27);
    expect(normalizeOptions(["assurance", "x", "recommandation"])).toEqual(["recommandation", "assurance"]);
    expect(STAGE_OPTIONS[1].items.some((i) => /Global Sûreté/.test(i.detail))).toBe(true);
    expect(paidOptions({ paymentStatus: "paye_bureau", packOptions: ["assurance"] })).toEqual(["assurance"]);
    expect(paidOptions({ paymentStatus: "paye", packOptions: [] })).toEqual(["recommandation", "assurance"]);
    expect(paidOptions({ paymentStatus: "non_paye", packOptions: ["assurance"] })).toEqual([]);
    expect(isPaid("paye")).toBe(true);
    expect(isPaid("paye_bureau")).toBe(true);
    for (const s of ["non_paye", "en_attente", "echoue"]) expect(isPaid(s)).toBe(false);
  });
});

describe("formulaire d'inscription", () => {
  it("accepte un dossier complet (post-nom et entreprise facultatifs)", () => {
    expect(stageApplicationSchema.safeParse(valid).success).toBe(true);
    expect(stageApplicationSchema.safeParse({ ...valid, postName: "" }).success).toBe(true);
  });

  it("refuse une faculté inconnue, un téléphone invalide ou des objectifs trop courts", () => {
    expect(stageApplicationSchema.safeParse({ ...valid, faculty: "astrologie" }).success).toBe(false);
    expect(stageApplicationSchema.safeParse({ ...valid, institutionId: "inconnue" }).success).toBe(false);
    expect(stageApplicationSchema.safeParse({ ...valid, institutionId: "isc-lubumbashi" }).success).toBe(true);
    expect(stageApplicationSchema.safeParse({ ...valid, phone: "abc" }).success).toBe(false);
    expect(stageApplicationSchema.safeParse({ ...valid, objectives: "Apprendre." }).success).toBe(false);
    expect(stageApplicationSchema.safeParse({ ...valid, skills: [] }).success).toBe(false);
  });

  it("exige l'accord explicite et l'année de fin pour un diplômé", () => {
    expect(stageApplicationSchema.safeParse({ ...valid, consent: false }).success).toBe(false);
    const graduate = stageApplicationSchema.safeParse({ ...valid, level: "Diplômé(e)", graduationYear: null });
    expect(graduate.success).toBe(false);
    expect(graduate.error?.issues[0]?.path).toEqual(["graduationYear"]);
    expect(stageApplicationSchema.safeParse({ ...valid, level: LEVELS[5], graduationYear: 2025 }).success).toBe(true);
  });
});

describe("export Excel du CRM", () => {
  const row = (over: Partial<StageExportRow>): StageExportRow => ({
    type: "academique",
    status: "en_attente",
    lastName: "Ilunga",
    postName: "",
    firstName: "Paul",
    phone: "+243 99 000 0000",
    email: "paul@example.com",
    university: "UNILU",
    faculty: "economie_gestion",
    department: "Gestion financière",
    level: "G3 / L3 (Bac + 3)",
    graduationYear: null,
    skills: ["Comptabilité", "Excel"],
    objectives: "Découvrir le métier de contrôleur de gestion.",
    preferredCompany: null,
    preferredCity: null,
    startMonth: null,
    paymentStatus: "non_paye",
    assignedCompany: null,
    adminNotes: null,
    createdAt: "2026-10-26T09:30:00.000Z",
    ...over,
  });
  const rows = [
    row({}),
    row({ firstName: "Anne", level: "Master 2", paymentStatus: "paye" }),
    row({ firstName: "Marc", faculty: "polytechnique", department: "Génie électrique", level: "Master 2" }),
  ];

  it("sépare les candidats par faculté, filière et niveau", () => {
    const sheets = stageWorkbookSheets(rows, "Test");
    // Une feuille par faculté, dans l'ordre alphabétique des libellés.
    expect(sheets.map((s) => s.name)).toEqual(["Candidats", "Par faculté et filière", FACULTY_BY_ID.polytechnique.label, FACULTY_BY_ID.economie_gestion.label]);
    expect(sheets[0].rows[1]).toEqual(STAGE_EXPORT_HEADER);
    expect(sheets[0].rows).toHaveLength(2 + rows.length);
    const segments = sheets[1].rows.slice(2);
    expect(segments).toHaveLength(3);
    expect(segments.reduce((n, r) => n + Number(r[3]), 0)).toBe(rows.length);
    expect(sheets[2].rows).toHaveLength(2 + 1);
    expect(sheets[3].rows).toHaveLength(2 + 2);
  });

  it("produit un classeur .xlsx valide avec des noms de feuille Excel corrects", () => {
    const files = unzipSync(buildWorkbook(stageWorkbookSheets(rows, "Candidats du 26/10/2026")));
    const workbook = strFromU8(files["xl/workbook.xml"]);
    const names = [...workbook.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
    expect(names).toHaveLength(4);
    for (const n of names) expect(n.length).toBeLessThanOrEqual(31);
    expect(strFromU8(files["xl/worksheets/sheet1.xml"])).toContain("Ilunga");
  });
});
