import { describe, expect, it } from "vitest";

import { decideExistence, runsText, type LookupOutcome } from "@/lib/core/references";
import { parseReference } from "@/lib/core/references/parse";
import { lookupReference, type LookupCache } from "@/lib/server/references/lookup";
import { abstractFromIndex, fromCrossref, fromHal, fromOpenAlex, splitDisplayName } from "@/lib/server/references/sources";

const ref = (raw: string, section: string | null = null) => parseReference({ raw, runs: [], section, paragraphIndex: 0 }, 0);

// Notice Crossref telle que l'API la renvoie (champs utiles).
const GRANGER_CROSSREF = {
  DOI: "10.1016/0304-4076(74)90034-7",
  title: ["Spurious regressions in econometrics"],
  author: [
    { given: "C.W.J.", family: "Granger" },
    { given: "P.", family: "Newbold" },
  ],
  issued: { "date-parts": [[1974, 7]] },
  "container-title": ["Journal of Econometrics"],
  volume: "2",
  issue: "2",
  page: "111-120",
  publisher: "Elsevier BV",
  type: "journal-article",
  URL: "https://doi.org/10.1016/0304-4076(74)90034-7",
};
const granger = fromCrossref(GRANGER_CROSSREF)!;
const outcome = (o: Partial<LookupOutcome>): LookupOutcome => ({ doi: null, candidates: [], containerIndexed: null, consulted: ["crossref", "openalex"], failed: [], ...o });

describe("notices des bases", () => {
  it("Crossref, OpenAlex (résumé en index inversé) et HAL sont recopiés sans rien ajouter", () => {
    expect(granger).toMatchObject({ source: "crossref", doi: "10.1016/0304-4076(74)90034-7", year: 1974, container: "Journal of Econometrics", volume: "2", issue: "2", pages: "111-120", kind: "article" });
    expect(granger.authors.map((a) => a.family)).toEqual(["Granger", "Newbold"]);
    expect(abstractFromIndex({ regressions: [1], Spurious: [0], are: [2], common: [3] })).toBe("Spurious regressions are common");
    const oa = fromOpenAlex({ id: "https://openalex.org/W1", doi: "https://doi.org/10.1/abc", title: "A title", publication_year: 2010, authorships: [{ author: { display_name: "Jean-Pierre Mbuyi Kalala" } }], primary_location: { source: { display_name: "Revue X" } }, biblio: { volume: "3", issue: "1", first_page: "5", last_page: "9" }, type: "article", abstract_inverted_index: { Résumé: [0], court: [1] } });
    expect(oa).toMatchObject({ doi: "10.1/abc", pages: "5–9", abstract: "Résumé court", container: "Revue X" });
    expect(splitDisplayName("Philip Kotler")).toEqual({ family: "Kotler", given: "Philip", corporate: false });
    const hal = fromHal({ docid: 42, title_s: ["La dollarisation en RDC"], authLastName_s: ["Mutombo"], authFirstName_s: ["Alain"], producedDateY_i: 2018, journalTitle_s: "Revue Y", docType_s: "ART", abstract_s: ["Cet article…"] });
    expect(hal).toMatchObject({ source: "hal", title: "La dollarisation en RDC", year: 2018, kind: "article", abstract: "Cet article…" });
  });
});

describe("statut d'existence", () => {
  it("vérifiée par DOI : la notice concorde", () => {
    const r = ref("Granger, C. W. J., & Newbold, P. (1974). Spurious regressions in econometrics. Journal of Econometrics, 2(2), 111-120. https://doi.org/10.1016/0304-4076(74)90034-7");
    const v = decideExistence(r, outcome({ doi: { found: true, record: granger } }), "apa_fr");
    expect([v.status, v.differences]).toEqual(["verifiee", []]);
  });

  it("à corriger : bonne référence, mauvaise année et mauvaises pages ; la correction vient de la notice", () => {
    const r = ref("Granger, C. W. J. et Newbold, P. (1976). Spurious regressions in econometrics. Journal of Econometrics, 2(2), 111-125.");
    const v = decideExistence(r, outcome({ candidates: [granger] }), "apa_fr");
    expect(v.status).toBe("a_corriger");
    expect(v.differences.map((d) => [d.field, d.student, d.found])).toEqual([
      ["annee", "1976", "1974"],
      ["pages", "111–125", "111-120"],
    ]);
    expect(runsText(v.corrected!)).toBe("Granger, C. W. J. et Newbold, P. (1974). Spurious regressions in econometrics. Journal of Econometrics, 2(2), 111–120. https://doi.org/10.1016/0304-4076(74)90034-7");
  });

  it("suspecte : DOI qui renvoie à un autre texte, ou DOI inexistant sans aucun texte de ce titre", () => {
    const r = ref("Mbuyi, K. (2019). La politique monétaire de la BCC face à la dollarisation. Journal of Econometrics, 12(3), 45-67. https://doi.org/10.1016/0304-4076(74)90034-7");
    const other = decideExistence(r, outcome({ doi: { found: true, record: granger } }), "apa_fr");
    expect(other.status).toBe("suspecte");
    expect(other.reasons[0]).toContain("Spurious regressions in econometrics");
    const none = decideExistence(r, outcome({ doi: { found: false, record: null } }), "apa_fr");
    expect([none.status, none.reasons[0]]).toEqual(["suspecte", expect.stringContaining("n'existe dans aucune base")]);
  });

  it("suspecte : article récent introuvable dans une revue pourtant indexée", () => {
    const r = ref("Kabeya, P. (2021). Effets de la masse monétaire sur l'inflation au Katanga. Journal of Econometrics, 225(1), 10-30.");
    const v = decideExistence(r, outcome({ containerIndexed: true }), "apa_fr");
    expect(v.status).toBe("suspecte");
    expect(v.reasons.join(" ")).toContain("est indexée");
  });

  it("introuvable (pas suspecte) pour un livre ; non vérifiable pour un mémoire ou si les bases sont en panne", () => {
    const book = decideExistence(ref("MALU, J., Économie du Katanga, Éditions Universitaires, Lubumbashi, 1998."), outcome({ consulted: ["openlibrary", "googlebooks", "crossref"] }), "apa_fr");
    expect(book.status).toBe("introuvable");
    expect(book.reasons.join(" ")).toContain("pas une preuve d'invention");
    const memoire = decideExistence(ref("KASONGO, J., Analyse de la rentabilité de la BCDC, Mémoire de licence, UNILU, Lubumbashi, 2020."), outcome({ consulted: ["hal"] }), "apa_fr");
    expect(memoire.status).toBe("non_verifiable");
    const down = decideExistence(ref("Porter, M. E. (1996). What is strategy? Harvard Business Review, 74(6), 61-78."), outcome({ consulted: ["crossref", "openalex"], failed: ["crossref", "openalex"] }), "apa_fr");
    expect(down.status).toBe("non_verifiable");
  });
});

describe("recherche dans les bases (réponses simulées, aucun appel réel)", () => {
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  const memoryCache = () => {
    const store = new Map<string, LookupOutcome>();
    const cache: LookupCache = { get: async (k) => store.get(k) ?? null, set: async (k, _i, o) => void store.set(k, o) };
    return { store, cache };
  };

  it("DOI : Crossref, puis OpenAlex pour le résumé ; résultat gardé en cache", async () => {
    const calls: string[] = [];
    const fetcher = async (url: string) => {
      calls.push(url);
      if (url.startsWith("https://api.crossref.org/works/")) return json({ message: GRANGER_CROSSREF });
      if (url.startsWith("https://api.openalex.org/works/doi:")) return json({ title: "Spurious regressions in econometrics", publication_year: 1974, abstract_inverted_index: { It: [0], is: [1], spurious: [2] } });
      return json({}, 500);
    };
    const { store, cache } = memoryCache();
    const r = ref("Granger, C. W. J., & Newbold, P. (1974). Spurious regressions in econometrics. Journal of Econometrics, 2(2), 111-120. https://doi.org/10.1016/0304-4076(74)90034-7");
    const o = await lookupReference(r, { fetcher, cache });
    expect(o.doi?.record?.abstract).toBe("It is spurious");
    expect(calls).toHaveLength(2);
    expect(store.size).toBe(1);
    await lookupReference(r, { fetcher, cache });
    expect(calls).toHaveLength(2); // deuxième fois : le cache répond.
  });

  it("livre : Open Library et Google Books ; une base en panne n'est jamais mise en cache", async () => {
    const fetcher = async (url: string) => {
      if (url.startsWith("https://openlibrary.org/search.json")) return json({ docs: [{ key: "/works/OL1W", title: "Marketing management", author_name: ["Philip Kotler", "Kevin Lane Keller"], publisher: ["Pearson"] }] });
      if (url.startsWith("https://www.googleapis.com/books")) return json({}, 503);
      return json({ message: { items: [] } });
    };
    const { store, cache } = memoryCache();
    const r = ref("KOTLER, P. et KELLER, K., Marketing management, 15e éd., Pearson, Paris, 2015.");
    const o = await lookupReference(r, { fetcher, cache });
    expect(o.failed).toEqual(["googlebooks"]);
    expect(store.size).toBe(0);
    const v = decideExistence(r, o, "apa_fr");
    expect(v.status).toBe("verifiee");
    // Livre : les auteurs de l'étudiant sont gardés (la notice d'une autre édition peut en omettre).
    expect(runsText(v.corrected!)).toBe("Kotler, P. et Keller, K. (2015). Marketing management (15e éd.). Pearson.");
  });
});

describe("pages et bases secondaires", () => {
  it("« 251 » (première page seule) ne contredit pas « 251-276 » ; la correction garde les pages complètes", () => {
    const r = ref("Engle, R. F., & Granger, C. W. J. (1987). Co-integration and error correction: Representation, estimation, and testing. Econometrica, 55(2), 251-276.");
    const rec = { ...granger, title: "Co-integration and error correction: Representation, estimation, and testing", authors: [{ family: "Engle", given: "Robert F.", corporate: false }, { family: "Granger", given: "C. W. J.", corporate: false }], year: 1987, container: "Econometrica", volume: "55", issue: "2", pages: "251", doi: "10.2307/1913236" };
    const v = decideExistence(r, outcome({ candidates: [rec] }), "apa_en");
    expect([v.status, v.differences]).toEqual(["verifiee", []]);
    expect(runsText(v.corrected!)).toContain("55(2), 251–276.");
  });

  it("Google Books en panne n'empêche pas de conclure pour un livre, Open Library ayant répondu", () => {
    const v = decideExistence(ref("Keynes, J. M. (1950). The theory of money and inflation in Central Africa. Macmillan."), outcome({ consulted: ["openlibrary", "googlebooks", "crossref"], failed: ["googlebooks"] }), "apa_fr");
    expect(v.status).toBe("introuvable");
    expect(v.reasons[0]).toContain("Google Books n'a pas répondu");
    const down = decideExistence(ref("Keynes, J. M. (1950). The theory of money and inflation in Central Africa. Macmillan."), outcome({ consulted: ["openlibrary", "googlebooks"], failed: ["openlibrary"] }), "apa_fr");
    expect(down.status).toBe("non_verifiable");
  });

  it("titre APA contenant des guillemets (« The market for \"lemons\" »)", () => {
    expect(ref('Akerlof, G. A. (1970). The market for "lemons": Quality uncertainty and the market mechanism. The Quarterly Journal of Economics, 84(3), 488-500.').title).toBe('The market for "lemons": Quality uncertainty and the market mechanism');
  });
});
