import { strToU8, zipSync } from "fflate";
import { describe, expect, it } from "vitest";

import { analyzeDocument, apaInText, formatApa, readDocx, runsText } from "@/lib/core/references";
import { findCitations } from "@/lib/core/references/citations";
import { paragraphsFromText } from "@/lib/core/references/docx";
import { parseReference, splitBibliography } from "@/lib/core/references/parse";

const ref = (raw: string, section: string | null = null) => parseReference({ raw, runs: [{ text: raw, italic: false }], section, paragraphIndex: 0 }, 0);
const people = (r: ReturnType<typeof ref>) => r.authors.map((a) => `${a.family}|${a.given}${a.corporate ? "|collectif" : ""}`);

describe("lecture des références", () => {
  it("APA : livre avec édition, deux auteurs", () => {
    const r = ref("Kotler, P., & Keller, K. L. (2016). Marketing management (15th ed.). Pearson.");
    expect(people(r)).toEqual(["Kotler|P.", "Keller|K. L."]);
    expect([r.year, r.title, r.edition, r.publisher, r.kind, r.layout, r.uncertain]).toEqual([2016, "Marketing management", "15", "Pearson", "livre", "apa", false]);
  });

  it("APA (français) : article de revue avec volume, numéro, pages et DOI ; nom congolais composé", () => {
    const r = ref("Mbuyi Kalala, J. et Kabamba, P. (2019). Inflation et masse monétaire en RDC. Revue congolaise d'économie, 12(2), 45-67. https://doi.org/10.1234/rce.2019.12");
    expect(people(r)).toEqual(["Mbuyi Kalala|J.", "Kabamba|P."]);
    expect([r.year, r.title, r.container, r.volume, r.issue, r.pages, r.doi, r.kind]).toEqual([2019, "Inflation et masse monétaire en RDC", "Revue congolaise d'économie", "12", "2", "45–67", "10.1234/rce.2019.12", "article"]);
  });

  it("présentation classique : NOM, P. et NOM, P., Titre, éd., Éditeur, Ville, année", () => {
    const r = ref("KOTLER, P. et KELLER, K., Marketing management, 15e éd., Pearson, Paris, 2015.");
    expect(people(r)).toEqual(["KOTLER|P.", "KELLER|K."]);
    expect([r.year, r.title, r.edition, r.publisher, r.place, r.layout, r.kind]).toEqual([2015, "Marketing management", "15", "Pearson", "Paris", "classique", "livre"]);
  });

  it("présentation classique : prénoms complets et titre contenant des virgules", () => {
    const r = ref("KEYNES, John Maynard, Théorie générale de l'emploi, de l'intérêt et de la monnaie, Payot, Paris, 1936.");
    expect(people(r)).toEqual(["KEYNES|John Maynard"]);
    expect([r.title, r.publisher, r.place, r.year]).toEqual(["Théorie générale de l'emploi, de l'intérêt et de la monnaie", "Payot", "Paris", 1936]);
  });

  it("présentation classique : article entre guillemets, « in » revue, vol., n°, pp.", () => {
    const r = ref("MUTOMBO, A., « La dollarisation de l'économie congolaise », in Revue de l'Université de Lubumbashi, vol. 5, n° 2, 2018, pp. 23-41.");
    expect(people(r)).toEqual(["MUTOMBO|A."]);
    expect([r.title, r.container, r.volume, r.issue, r.pages, r.year, r.kind]).toEqual(["La dollarisation de l'économie congolaise", "Revue de l'Université de Lubumbashi", "5", "2", "23–41", 2018, "article"]);
  });

  it("mémoire (rubrique « Mémoires et TFC »), auteur collectif, texte juridique, page web sans date", () => {
    const m = ref("KASONGO, J., Analyse de la rentabilité de la BCDC, Mémoire de licence, UNILU, Lubumbashi, 2020.", "Mémoires et TFC");
    expect([m.kind, m.year, m.title]).toEqual(["memoire", 2020, "Analyse de la rentabilité de la BCDC"]);
    const c = ref("Banque Centrale du Congo. (2021). Rapport annuel 2020. BCC.");
    expect(people(c)).toEqual(["Banque Centrale du Congo||collectif"]);
    expect([c.year, c.title, c.kind]).toEqual([2021, "Rapport annuel 2020", "rapport"]);
    const l = ref("Loi n° 18/027 du 13 décembre 2018 portant loi-cadre de l'enseignement national.");
    expect([l.kind, l.year, l.authors.length]).toEqual(["texte_juridique", 2018, 0]);
    const w = ref("Banque mondiale. (s.d.). Données sur la RDC. https://donnees.banquemondiale.org/pays/congo");
    expect([w.noDate, w.kind, w.url, people(w)[0]]).toEqual([true, "web", "https://donnees.banquemondiale.org/pays/congo", "Banque mondiale||collectif"]);
  });

  it("APA : chapitre d'ouvrage collectif", () => {
    const r = ref("Stiglitz, J. E. (2002). Information and the change in the paradigm in economics. In T. Frängsmyr (Ed.), Les Prix Nobel 2001 (pp. 472–540). Nobel Foundation.");
    expect([people(r)[0], r.kind, r.title, r.container, r.pages, r.publisher]).toEqual(["Stiglitz|J. E.", "chapitre", "Information and the change in the paradigm in economics", "Les Prix Nobel 2001", "472–540", "Nobel Foundation"]);
  });
});

describe("bibliographie d'un mémoire", () => {
  it("repère la section, ses rubriques, et s'arrête aux annexes", () => {
    const paragraphs = paragraphsFromText(
      [
        "Table des matières",
        "Bibliographie 85",
        "Introduction",
        "Selon Kotler (2016), le marketing crée de la valeur.",
        "BIBLIOGRAPHIE",
        "I. Ouvrages",
        "KOTLER, P. et KELLER, K., Marketing management, 15e éd., Pearson, Paris, 2015.",
        "II. Mémoires et TFC",
        "KASONGO, J., Analyse de la rentabilité de la BCDC, Mémoire de licence, UNILU, Lubumbashi, 2020.",
        "Annexes",
        "Questionnaire d'enquête administré en 2021",
      ].join("\n"),
    );
    const { entries, found } = splitBibliography(paragraphs);
    expect(found).toBe(true);
    expect(entries.map((e) => [e.section, e.raw.slice(0, 12)])).toEqual([
      ["Ouvrages", "KOTLER, P. e"],
      ["Mémoires et TFC", "KASONGO, J.,"],
    ]);
  });
});

describe("citations dans le texte", () => {
  const cite = (text: string) => findCitations(paragraphsFromText(text)).map((c) => `${c.authors.join("+")}${c.etAl ? " et al." : ""}|${c.noDate ? "s.d." : c.year}${c.yearSuffix}|${c.narrative ? "N" : "P"}${c.pages ? `|${c.pages}` : ""}`);

  it("entre parenthèses : un ou plusieurs auteurs, et al., plusieurs citations, pages, années multiples", () => {
    expect(cite("Le marketing crée de la valeur (Kotler et Keller, 2016, p. 45 ; BCC, 2021). D'autres l'ont montré (Kotler et al., 2017a ; Porter, 1985, 1990).")).toEqual(["Kotler+Keller|2016|P|p. 45", "BCC|2021|P", "Kotler et al.|2017a|P", "Porter|1985|P", "Porter|1990|P"]);
  });

  it("narratives : « Selon Mbuyi Kalala (2015, p. 12) », « Kotler et Keller (2016) », sans date", () => {
    expect(cite("Selon Mbuyi Kalala (2015, p. 12), l'inflation est monétaire. Kotler et Keller (2016) le confirment, comme la Banque mondiale (s.d.).")).toEqual(["Mbuyi Kalala|2015|N|p. 12", "Kotler+Keller|2016|N", "Banque mondiale|s.d.|N"]);
  });

  it("ne prend pas pour des citations les parenthèses ordinaires", () => {
    expect(cite("La population (N = 120) a été interrogée en 2021 (voir tableau 3). Le taux (en %) a augmenté (2019). La crise a frappé l'Afrique (2009).")).toEqual([]);
  });
});

describe("APA 7", () => {
  it("livre et article, en français et en anglais, avec l'italique", () => {
    const book = ref("KOTLER, P. et KELLER, K., Marketing management, 15e éd., Pearson, Paris, 2015.");
    expect(runsText(formatApa(book, "apa_fr"))).toBe("Kotler, P. et Keller, K. (2015). Marketing management (15e éd.). Pearson.");
    expect(runsText(formatApa(book, "apa_en"))).toBe("Kotler, P., & Keller, K. (2015). Marketing management (15th ed.). Pearson.");
    expect(formatApa(book, "apa_fr").filter((r) => r.italic).map((r) => r.text)).toEqual(["Marketing management"]);
    const article = ref("MUTOMBO, A., « La dollarisation de l'économie congolaise », in Revue de l'Université de Lubumbashi, vol. 5, n° 2, 2018, pp. 23-41.");
    expect(runsText(formatApa(article, "apa_fr"))).toBe("Mutombo, A. (2018). La dollarisation de l'économie congolaise. Revue de l'Université de Lubumbashi, 5(2), 23–41.");
    expect(formatApa(article, "apa_fr").filter((r) => r.italic).map((r) => r.text)).toEqual(["Revue de l'Université de Lubumbashi", "5"]);
    const keynes = ref("KEYNES, John Maynard, Théorie générale de l'emploi, de l'intérêt et de la monnaie, Payot, Paris, 1936.");
    expect(runsText(formatApa(keynes, "apa_fr"))).toBe("Keynes, J. M. (1936). Théorie générale de l'emploi, de l'intérêt et de la monnaie. Payot.");
  });

  it("citation dans le texte : deux auteurs, « et al. » dès trois, sans date", () => {
    const two = ref("Kotler, P., & Keller, K. L. (2016). Marketing management (15th ed.). Pearson.");
    expect(apaInText(two, "apa_fr", false)).toBe("(Kotler et Keller, 2016)");
    expect(apaInText(two, "apa_en", true)).toBe("Kotler and Keller (2016)");
    const three = ref("Kotler, P., Keller, K. L., & Lane, K. (2018). Marketing. Pearson.");
    expect(apaInText(three, "apa_en", false, "p. 4")).toBe("(Kotler et al., 2018, p. 4)");
    const web = ref("Banque mondiale. (s.d.). Données sur la RDC. https://donnees.banquemondiale.org/pays/congo");
    expect(apaInText(web, "apa_fr", false)).toBe("(Banque mondiale, s.d.)");
  });
});

describe("contrôle de forme d'un mémoire (fictif)", () => {
  const memoire = [
    "Introduction",
    "Selon Kotler et Keller (2016), le marketing crée de la valeur. La dollarisation freine la politique monétaire (Mutombo, 2017).",
    "D'autres travaux le confirment (Kotler et al., 2016 ; BCC, 2021). Comme l'écrit Porter, « la stratégie consiste à choisir ce qu'il ne faut pas faire » (Porter, 1996).",
    "Bibliographie",
    "Kotler, P., & Keller, K. L. (2016). Marketing management (15th ed.). Pearson.",
    "MUTOMBO, A., « La dollarisation de l'économie congolaise », in Revue de l'Université de Lubumbashi, vol. 5, n° 2, 2018, pp. 23-41.",
    "Banque Centrale du Congo. (2021). Rapport annuel 2020. BCC.",
    "Porter, M. E. (1996). What is strategy? Harvard Business Review, 74(6), 61-78.",
    "Anderson, J. (2010). Un texte jamais cité. Dunod.",
  ].join("\n");
  const a = analyzeDocument({ paragraphs: paragraphsFromText(memoire), convention: "apa_fr", fromWord: false });
  const codes = a.issues.map((i) => i.code);

  it("citations reliées à leurs références ; acronyme BCC reconnu", () => {
    expect([a.stats.citations, a.stats.references, a.bibliographyFound, a.hasBody]).toEqual([5, 5, true, true]);
    const linked = (author: string) => a.links.find((l) => a.citations.find((c) => c.id === l.citationId)!.authors[0] === author)?.referenceId;
    expect(linked("BCC")).toBe("r3");
    expect(linked("Porter")).toBe("r4");
  });

  it("erreurs repérées : année différente, « et al. » pour deux auteurs, présentation non APA, connecteur", () => {
    expect(codes).toEqual(expect.arrayContaining(["annee_differente", "et_al_injustifie", "presentation_non_apa", "reference_non_citee", "citation_textuelle_sans_page"]));
    const year = a.issues.find((i) => i.code === "annee_differente")!;
    expect(year.message).toContain("2018");
    expect(year.fix).toBe("(Mutombo, 2018)");
    expect(a.issues.find((i) => i.code === "reference_non_citee")!.message).toContain("Anderson");
    // Les erreurs sont présentées en premier.
    expect(a.issues[0].severity).toBe("erreur");
  });

  it("bibliographie corrigée, triée par ordre alphabétique", () => {
    expect(a.corrected.map((c) => runsText(c.runs).slice(0, 12))).toEqual(["Anderson, J.", "Banque Centr", "Kotler, P. e", "Mutombo, A. ", "Porter, M. E"]);
  });

  it("bibliographie collée seule : pas de contrôle des citations", () => {
    const only = analyzeDocument({ paragraphs: paragraphsFromText("Kotler, P., & Keller, K. L. (2016). Marketing management (15th ed.). Pearson.\nPorter, M. E. (1996). What is strategy? Harvard Business Review, 74(6), 61-78."), convention: "apa_fr", fromWord: false, bibliographyOnly: true });
    expect([only.stats.references, only.hasBody, only.issues.some((i) => i.code === "reference_non_citee")]).toEqual([2, false, false]);
  });
});

describe("lecture d'un document Word", () => {
  const p = (inner: string) => `<w:p>${inner}</w:p>`;
  const r = (text: string, italic = false) => `<w:r>${italic ? "<w:rPr><w:i/></w:rPr>" : ""}<w:t xml:space="preserve">${text}</w:t></w:r>`;
  const docx = zipSync({
    "word/document.xml": strToU8(`<?xml version="1.0"?><w:document xmlns:w="w"><w:body>${p(r("Selon Kotler (2016), tout commence par le client."))}${p('<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' + r("Bibliographie"))}${p(r("Kotler, P. (2016). ") + r("Marketing management", true) + r(". Pearson &amp; Co."))}</w:body></w:document>`),
    "word/footnotes.xml": strToU8(`<?xml version="1.0"?><w:footnotes xmlns:w="w"><w:footnote w:type="separator" w:id="-1">${p(r("———"))}</w:footnote><w:footnote w:id="1">${p(r("KOTLER, P., Marketing, Pearson, 2016, p. 4."))}</w:footnote></w:footnotes>`),
  });

  it("paragraphes, italique, style, notes de bas de page (séparateurs exclus)", () => {
    const d = readDocx(docx);
    expect(d.paragraphs.map((x) => x.text)).toEqual(["Selon Kotler (2016), tout commence par le client.", "Bibliographie", "Kotler, P. (2016). Marketing management. Pearson & Co."]);
    expect(d.paragraphs[1].style).toBe("Heading1");
    expect(d.paragraphs[2].runs.filter((x) => x.italic).map((x) => x.text)).toEqual(["Marketing management"]);
    expect(d.footnotes.map((x) => [x.text, x.footnote])).toEqual([["KOTLER, P., Marketing, Pearson, 2016, p. 4.", true]]);
    const a = analyzeDocument({ ...d, convention: "apa_fr", fromWord: true });
    expect(a.issues.some((i) => i.code === "italique_manquant")).toBe(false);
    expect(a.links[0].referenceId).toBe("r1");
  });

  it("un fichier qui n'est pas un Word est refusé avec une explication", () => {
    expect(() => readDocx(zipSync({ "autre.txt": strToU8("x") }))).toThrow(/document Word/);
  });
});
