import { beforeEach, describe, expect, it, vi } from "vitest";

import { appendTranscript, joinSections, journalError, journalWindowOpen, parseReportDraft, splitSections, unverifiedTerms } from "@/lib/core/stages/journal";
import { stageReportDocument, type StageReportInput } from "@/lib/core/stages/report";
import { attendanceError } from "@/lib/core/stages/workflow";

// Routes : session, service et IA simulés (aucun appel réel, aucune base).
const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
const service = vi.hoisted(() => ({ closed: false, appended: [] as unknown[] }));
const ai = vi.hoisted(() => ({ fail: false, text: "J'ai saisi les factures fournisseurs." }));
vi.mock("@/lib/supervision/apiAuth", () => ({ getSessionUser: async () => session.user, unauthorized: () => Response.json({ error: "Non authentifié" }, { status: 401 }) }));
vi.mock("@/lib/server/stages/StageService", () => {
  class StageError extends Error {
    constructor(
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  }
  const check = () => {
    if (service.closed) throw new StageError("invalid_state", "Cette journée ne peut plus être modifiée.");
  };
  return {
    journalContext: async () => (check(), { company: "Entreprise fictive", tutorName: "M. Test", department: "Comptabilité", faculty: "Économie" }),
    appendJournalTranscript: async (_u: string, _id: string, _day: string, entry: unknown) => (service.appended.push(entry), { id: "dossier" }),
    journalDayInput: async () => (check(), { input: { transcript: "J'ai saisi les factures avec Excel." }, sources: ["J'ai saisi les factures avec Excel.", "Entreprise fictive"] }),
    stageErrorResponse: (e: unknown) => Response.json({ error: (e as Error).message }, { status: e instanceof StageError ? 409 : 500 }),
  };
});
vi.mock("@/lib/ai/openai/StageJournalAI", () => ({
  transcribeAudio: async () => {
    if (ai.fail) throw new Error("panne");
    return ai.text;
  },
  writeDay: async () => {
    if (ai.fail) throw new Error("panne");
    return [
      { title: "Activités réalisées", text: "J'ai saisi 40 factures avec Excel et Sage." },
      { title: "Suite prévue", text: "Demain, je poursuivrai la saisie." },
    ];
  },
}));

const audio = (bytes: number, type = "audio/webm") => new File([new Uint8Array(bytes)], "note.webm", { type });
const transcribe = async (form: Record<string, string | File>) => {
  const { POST } = await import("@/app/api/stages/[id]/journal/transcribe/route");
  const body = new FormData();
  for (const [k, v] of Object.entries(form)) body.append(k, v);
  return POST(new Request("http://localhost/api/stages/d1/journal/transcribe", { method: "POST", body }), { params: Promise.resolve({ id: "d1" }) });
};
const write = async () => {
  const { POST } = await import("@/app/api/stages/[id]/journal/write/route");
  return POST(new Request("http://localhost/api/stages/d1/journal/write", { method: "POST", body: JSON.stringify({ day: "2026-11-03" }), headers: { "Content-Type": "application/json" } }), { params: Promise.resolve({ id: "d1" }) });
};
let n = 0;
beforeEach(() => {
  n += 1;
  session.user = { id: `etudiant-${n}` };
  service.closed = false;
  service.appended = [];
  ai.fail = false;
  ai.text = "J'ai saisi les factures fournisseurs.";
});

describe("règles du journal vocal", () => {
  it("une journée se complète le jour même ou le lendemain, jamais après", () => {
    expect([journalWindowOpen("2026-11-03", "2026-11-03"), journalWindowOpen("2026-11-03", "2026-11-04"), journalWindowOpen("2026-11-03", "2026-11-05"), journalWindowOpen("2026-11-03", "2026-11-02")]).toEqual([true, true, false, false]);
    expect(journalError({ status: "en_stage", record: null, day: "2026-11-03", today: "2026-11-03" })).toMatch(/Signez d'abord votre arrivée/);
    expect(journalError({ status: "termine", record: { day: "2026-11-06" }, day: "2026-11-06", today: "2026-11-07" })).toBeNull();
    expect(journalError({ status: "annule", record: { day: "2026-11-03" }, day: "2026-11-03", today: "2026-11-03" })).toMatch(/annulé/);
  });

  it("sections : un texte rédigé garde ses sous-titres ; un texte libre reste un seul bloc", () => {
    const text = joinSections([
      { title: "Activités réalisées", text: "J'ai saisi des factures." },
      { title: "Outils et méthodes", text: "" },
      { title: "Suite prévue", text: "Poursuivre demain." },
    ]);
    expect(text).toBe("Activités réalisées\nJ'ai saisi des factures.\n\nSuite prévue\nPoursuivre demain.");
    expect(splitSections(text).map((s) => s.title)).toEqual(["Activités réalisées", "Suite prévue"]);
    expect(splitSections("Saisie de 25 factures.")).toEqual([{ title: null, text: "Saisie de 25 factures." }]);
  });

  it("paroles : chaque note et chaque réponse est ajoutée avec son heure (et la question)", () => {
    const t1 = appendTranscript(null, { kind: "note", text: "J'ai saisi des factures.", at: "17:45" });
    const t2 = appendTranscript(t1, { kind: "reponse", question: "Quels outils ?", text: "Excel.", at: "17:50" });
    expect(t2).toBe("[Note 17:45]\nJ'ai saisi des factures.\n\n[Réponse 17:50] Question : Quels outils ?\nExcel.");
  });

  it("garde-fou : chiffres et noms propres absents de ce que l'étudiant a dit sont « à vérifier »", () => {
    const sources = ["J'ai saisi 25 factures avec Excel chez Entreprise fictive.", "M. Test"];
    const written = "Activités réalisées\nCe matin, j'ai saisi 25 factures avec Excel. J'ai ensuite traité 40 pièces dans Sage avec Mme Kabila.\n\nSuite prévue\nDemain, je continuerai chez Entreprise fictive.";
    expect(unverifiedTerms(written, sources)).toEqual(["40", "Sage", "Mme", "Kabila"]);
  });

  it("clôture de la journée : un compte rendu déjà dicté et validé suffit", () => {
    const existing = { day: "2026-11-03", arrivalAt: "2026-11-03T06:00:00Z", departureAt: null, activities: "Activités réalisées\nJ'ai saisi les factures du mois.", tutorConfirmedAt: null };
    expect(attendanceError("en_stage", "2026-11-03", "2026-11-02", "2026-11-06", existing, { action: "depart", activities: "" })).toBeNull();
    expect(attendanceError("en_stage", "2026-11-03", "2026-11-02", "2026-11-06", { ...existing, activities: null }, { action: "depart", activities: "" })).toMatch(/au moins 20 caractères/);
  });

  it("brouillon du rapport : relu seulement s'il est complet et valide", () => {
    expect(parseReportDraft(JSON.stringify({ remerciements: "Merci.", introduction: "Intro.", bilan: "Bilan.", conclusion: "Fin.", generatedAt: "2026-11-06T10:00:00Z", updatedAt: "2026-11-06T10:00:00Z" }))?.introduction).toBe("Intro.");
    expect(parseReportDraft("{pas du json")).toBeNull();
    expect(parseReportDraft(JSON.stringify({ introduction: "seule" }))).toBeNull();
  });
});

describe("rapport Word", () => {
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
    objectives: "Comprendre la tenue de la comptabilité.",
    assignedCompany: "Entreprise fictive",
    companyAddress: null,
    tutorName: "M. Test",
    tutorRole: "Chef comptable",
    startDate: "2026-11-02",
    endDate: "2026-11-06",
    attendance: [{ day: "2026-11-03", arrivalAt: "2026-11-03T06:10:00Z", departureAt: "2026-11-03T15:00:00Z", activities: "Activités réalisées\nJ'ai saisi les factures.\n\nSuite prévue\nPoursuivre la saisie.", tutorConfirmedAt: null }],
  };

  it("journées avec leurs sous-titres ; remerciements, introduction, bilan et conclusion rédigés", () => {
    const draft = JSON.stringify({ remerciements: "Je remercie M. Test.", introduction: "Ce rapport présente mon stage.\n\nIl comprend trois parties.", bilan: "J'ai appris la saisie.", conclusion: "Stage formateur.", generatedAt: null, updatedAt: "2026-11-06T10:00:00Z" });
    const doc = stageReportDocument({ ...input, reportDraft: draft }, "2026-11-09");
    const h = (type: string) => doc.blocks.filter((b) => b.type === type).map((b) => ("text" in b ? b.text : ""));
    expect(h("h1").slice(0, 2)).toEqual(["Remerciements", "Introduction"]);
    expect(h("h3")).toEqual(["Activités réalisées", "Suite prévue"]);
    const text = JSON.stringify(doc.blocks);
    expect(text).toContain("Il comprend trois parties.");
    expect(text).toContain("J'ai appris la saisie.");
    expect(text).not.toContain("[À rédiger : le contexte");
    expect(text).not.toContain("[À rédiger : ce que vous avez appris");
  });

  it("sans parties rédigées : les mentions « [À rédiger] » restent", () => {
    const text = JSON.stringify(stageReportDocument(input, "2026-11-09").blocks);
    expect(text).toContain("[À rédiger : le contexte");
    expect(text).not.toContain("Remerciements");
  });
});

describe("routes du journal vocal", () => {
  it("transcription : 401, 413 (trop long), 415 (format), 409 (journée fermée), 502 (panne), puis texte ajouté", async () => {
    session.user = null;
    expect((await transcribe({ audio: audio(100), day: "2026-11-03" })).status).toBe(401);
    session.user = { id: "e-413" };
    expect((await transcribe({ audio: audio(4 * 1024 * 1024 + 10), day: "2026-11-03" })).status).toBe(413);
    session.user = { id: "e-415" };
    expect((await transcribe({ audio: audio(100, "video/mp4"), day: "2026-11-03" })).status).toBe(415);
    session.user = { id: "e-409" };
    service.closed = true;
    expect((await transcribe({ audio: audio(100), day: "2026-11-01" })).status).toBe(409);
    service.closed = false;
    session.user = { id: "e-502" };
    ai.fail = true;
    expect((await transcribe({ audio: audio(100), day: "2026-11-03" })).status).toBe(502);
    expect(service.appended).toEqual([]);
    ai.fail = false;
    session.user = { id: "e-200" };
    const ok = await transcribe({ audio: audio(100), day: "2026-11-03", kind: "reponse", question: "Quels outils ?", seconds: "42" });
    const body = (await ok.json()) as { text: string };
    expect([ok.status, body.text]).toEqual([200, "J'ai saisi les factures fournisseurs."]);
    expect(service.appended).toEqual([expect.objectContaining({ kind: "reponse", question: "Quels outils ?", text: "J'ai saisi les factures fournisseurs." })]);
  });

  it("rédaction : sections, texte et termes « à vérifier » ; 502 si l'IA est en panne", async () => {
    const res = await write();
    const body = (await res.json()) as { text: string; unverified: string[] };
    expect(res.status).toBe(200);
    expect(body.text).toBe("Activités réalisées\nJ'ai saisi 40 factures avec Excel et Sage.\n\nSuite prévue\nDemain, je poursuivrai la saisie.");
    expect(body.unverified).toEqual(["40", "Sage"]);
    session.user = { id: "e-write-502" };
    ai.fail = true;
    expect((await write()).status).toBe(502);
  });
});
