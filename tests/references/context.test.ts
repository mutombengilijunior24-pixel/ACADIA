import { beforeEach, describe, expect, it, vi } from "vitest";

import { checkAttributions, findCitations, paragraphsFromText, validateContextAnswer, type LookupOutcome } from "@/lib/core/references";
import { parseReference } from "@/lib/core/references/parse";

// Routes : session, recherche dans les bases et IA simulées (aucun appel réel).
const session = vi.hoisted(() => ({ user: null as { id: string } | null }));
const lookup = vi.hoisted(() => ({ outcome: null as LookupOutcome | null }));
const ai = vi.hoisted(() => ({ calls: 0, answer: null as unknown, fail: false }));
vi.mock("@/lib/supervision/apiAuth", () => ({ getSessionUser: async () => session.user, unauthorized: () => Response.json({ error: "Non authentifié" }, { status: 401 }) }));
vi.mock("@/lib/server/references/lookup", () => ({ lookupReference: async () => lookup.outcome }));
vi.mock("@/lib/ai/openai/ReferenceContextAI", () => ({
  checkCitationContext: async () => {
    ai.calls += 1;
    if (ai.fail) throw new Error("panne");
    return ai.answer;
  },
}));

const ABSTRACT = "This paper shows that regressions between independent random walks frequently produce high R-squared values and significant t statistics, so that conventional significance tests are misleading for nonstationary series.";
const GRANGER = { source: "crossref" as const, id: "10.1016/0304-4076(74)90034-7", doi: "10.1016/0304-4076(74)90034-7", title: "Spurious regressions in econometrics", authors: [{ family: "Granger", given: "C. W. J.", corporate: false }, { family: "Newbold", given: "P.", corporate: false }], year: 1974, container: "Journal of Econometrics", volume: "2", issue: "2", pages: "111-120", publisher: null, isbn: [], kind: "article" as const, abstract: ABSTRACT, url: null };
// Ce que le navigateur envoie : les métadonnées de la référence (sans les fragments de texte ni la position).
const reference = (() => {
  const r = parseReference({ raw: "Granger, C. W. J., & Newbold, P. (1974). Spurious regressions in econometrics. Journal of Econometrics, 2(2), 111-120.", runs: [], section: null, paragraphIndex: 0 }, 0);
  return { id: r.id, raw: r.raw, authors: r.authors, year: r.year, yearSuffix: r.yearSuffix, noDate: r.noDate, title: r.title, container: r.container, publisher: r.publisher, place: r.place, edition: r.edition, volume: r.volume, issue: r.issue, pages: r.pages, doi: r.doi, url: r.url, isbn: r.isbn, kind: r.kind, uncertain: r.uncertain };
})();
const post = async (path: string, body: unknown) => {
  const { POST } = await import(path === "verify" ? "@/app/api/references/verify/route" : "@/app/api/references/context/route");
  return POST(new Request(`http://localhost/api/references/${path}`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));
};
let userCount = 0;
beforeEach(() => {
  userCount += 1;
  session.user = { id: `etudiant-${userCount}` };
  lookup.outcome = { doi: null, candidates: [GRANGER], containerIndexed: null, consulted: ["crossref"], failed: [] };
  ai.calls = 0;
  ai.fail = false;
  ai.answer = { verdict: "fidele", explanation: "Le résumé le dit.", evidence: "regressions between independent random walks frequently produce high R-squared values" };
});

describe("garde-fou de l'avis de l'IA", () => {
  it("retenu seulement si l'extrait cité figure vraiment dans le résumé", () => {
    expect(validateContextAnswer({ verdict: "fidele", explanation: "ok", evidence: "Regressions between independent random walks frequently produce high R-squared values" }, ABSTRACT).verdict).toBe("fidele");
    const invented = validateContextAnswer({ verdict: "non_fidele", explanation: "Le texte dit l'inverse.", evidence: "the authors prove that money causes inflation" }, ABSTRACT);
    expect([invented.verdict, invented.explanation]).toEqual(["indeterminable", expect.stringContaining("ne s'appuyait pas sur un extrait réel")]);
  });
});

describe("attributions classiques", () => {
  const issuesOf = (text: string) => checkAttributions(findCitations(paragraphsFromText(text))).map((i) => i.code);
  it("anachronisme : un texte antérieur au concept ne peut pas en parler", () => {
    expect(issuesOf("La théorie de l'agence explique les conflits entre actionnaires et dirigeants (Mbuyi, 1965).")).toEqual(["anachronisme"]);
    expect(issuesOf("La théorie de l'agence explique ces conflits (Jensen et Meckling, 1976).")).toEqual([]);
  });
  it("origine présentée avec un autre auteur : simple conseil", () => {
    expect(issuesOf("La pyramide des besoins a été développée par Kotler (2016).")).toEqual(["origine_du_concept"]);
    expect(issuesOf("La pyramide des besoins reste utilisée en gestion (Kotler, 2016).")).toEqual([]);
  });
});

describe("routes", () => {
  it("vérification : 401 sans session, 400 si invalide, statuts sinon", async () => {
    session.user = null;
    expect((await post("verify", { convention: "apa_fr", references: [reference] })).status).toBe(401);
    session.user = { id: "etudiant-x" };
    expect((await post("verify", { convention: "apa_fr", references: [] })).status).toBe(400);
    session.user = { id: "etudiant-y" };
    const res = await post("verify", { convention: "apa_fr", references: [reference] });
    const body = (await res.json()) as { results: Array<{ status: string }> };
    expect([res.status, body.results[0].status]).toEqual([200, "verifiee"]);
  });

  it("contexte : l'IA reçoit le résumé de la base ; pas d'appel IA sans résumé ; 502 si l'IA est en panne", async () => {
    const res = await post("context", { sentence: "Granger et Newbold (1974) montrent que les régressions entre marches aléatoires indépendantes donnent souvent un R² élevé.", reference });
    const body = (await res.json()) as { context: { verdict: string; basedOnAbstract: boolean }; abstract: string };
    expect([res.status, body.context.verdict, body.context.basedOnAbstract, body.abstract, ai.calls]).toEqual([200, "fidele", true, ABSTRACT, 1]);

    session.user = { id: "sans-resume" };
    lookup.outcome = { doi: null, candidates: [{ ...GRANGER, abstract: null }], containerIndexed: null, consulted: ["crossref"], failed: [] };
    const none = (await (await post("context", { sentence: "Granger et Newbold (1974) montrent un résultat important.", reference })).json()) as { context: { verdict: string } };
    expect([none.context.verdict, ai.calls]).toEqual(["indeterminable", 1]);

    session.user = { id: "panne" };
    lookup.outcome = { doi: null, candidates: [GRANGER], containerIndexed: null, consulted: ["crossref"], failed: [] };
    ai.fail = true;
    expect((await post("context", { sentence: "Granger et Newbold (1974) montrent un résultat important.", reference })).status).toBe(502);

    session.user = { id: "introuvable" };
    lookup.outcome = { doi: null, candidates: [], containerIndexed: null, consulted: ["crossref"], failed: [] };
    expect((await post("context", { sentence: "Granger et Newbold (1974) montrent un résultat important.", reference })).status).toBe(409);
  });
});
