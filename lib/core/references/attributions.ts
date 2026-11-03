/**
 * Attributions classiques : concepts dont l'origine fait consensus (main invisible → Smith, 1776). Deux
 * contrôles, sans IA :
 * - ANACHRONISME (certain) : la citation est antérieure à l'apparition du concept ;
 * - ORIGINE (conseil) : la phrase présente l'origine du concept (« développé par », « introduit par »…)
 *   mais cite un autre auteur que celui à qui on l'attribue.
 * Liste de départ, à compléter et faire valider par les enseignants.
 */
import { citationLabel } from "./citations";
import { fold, sameFamily } from "./text";
import type { FormIssue, InTextCitation } from "./types";

export interface ClassicAttribution {
  concept: string;
  keywords: string[];
  authors: string[];
  year: number;
  reference: string;
}

export const CLASSIC_ATTRIBUTIONS: ClassicAttribution[] = [
  { concept: "la main invisible", keywords: ["main invisible", "invisible hand"], authors: ["Smith"], year: 1776, reference: "Smith (1776)" },
  { concept: "l'avantage comparatif", keywords: ["avantage comparatif", "avantages comparatifs", "comparative advantage"], authors: ["Ricardo"], year: 1817, reference: "Ricardo (1817)" },
  { concept: "la théorie quantitative de la monnaie", keywords: ["theorie quantitative de la monnaie", "quantity theory of money", "equation des echanges"], authors: ["Fisher", "Friedman", "Bodin", "Hume"], year: 1568, reference: "Fisher (1911) ; Friedman (1956)" },
  { concept: "la parité de pouvoir d'achat", keywords: ["parite de pouvoir d'achat", "parite des pouvoirs d'achat", "purchasing power parity"], authors: ["Cassel"], year: 1916, reference: "Cassel (1918)" },
  { concept: "le multiplicateur keynésien", keywords: ["multiplicateur keynesien", "trappe a liquidite", "theorie generale de l'emploi"], authors: ["Keynes", "Kahn"], year: 1931, reference: "Kahn (1931) ; Keynes (1936)" },
  { concept: "la destruction créatrice", keywords: ["destruction creatrice", "creative destruction"], authors: ["Schumpeter"], year: 1942, reference: "Schumpeter (1942)" },
  { concept: "la pyramide des besoins", keywords: ["pyramide des besoins", "hierarchie des besoins", "pyramide de maslow"], authors: ["Maslow"], year: 1943, reference: "Maslow (1943)" },
  { concept: "la théorie des deux facteurs", keywords: ["theorie des deux facteurs", "facteurs d'hygiene", "theorie bifactorielle"], authors: ["Herzberg"], year: 1959, reference: "Herzberg et al. (1959)" },
  { concept: "les théories X et Y", keywords: ["theorie x et y", "theories x et y"], authors: ["McGregor"], year: 1960, reference: "McGregor (1960)" },
  { concept: "le marketing mix (4P)", keywords: ["4p", "marketing mix", "mix marketing"], authors: ["McCarthy", "Borden"], year: 1960, reference: "McCarthy (1960)" },
  { concept: "les cinq forces concurrentielles", keywords: ["cinq forces", "5 forces", "five forces"], authors: ["Porter"], year: 1979, reference: "Porter (1979)" },
  { concept: "la chaîne de valeur", keywords: ["chaine de valeur", "value chain"], authors: ["Porter"], year: 1985, reference: "Porter (1985)" },
  { concept: "la théorie de l'agence", keywords: ["theorie de l'agence", "agency theory", "couts d'agence"], authors: ["Jensen", "Meckling"], year: 1976, reference: "Jensen et Meckling (1976)" },
  { concept: "la neutralité de la structure financière", keywords: ["modigliani et miller", "neutralite de la structure financiere", "theoreme de modigliani"], authors: ["Modigliani", "Miller"], year: 1958, reference: "Modigliani et Miller (1958)" },
  { concept: "l'efficience des marchés financiers", keywords: ["efficience des marches", "marches efficients", "efficient market"], authors: ["Fama"], year: 1965, reference: "Fama (1970)" },
  { concept: "le MEDAF", keywords: ["medaf", "capm", "modele d'equilibre des actifs financiers"], authors: ["Sharpe", "Lintner", "Mossin", "Treynor"], year: 1964, reference: "Sharpe (1964)" },
  { concept: "la théorie du financement hiérarchique", keywords: ["financement hierarchique", "pecking order"], authors: ["Myers", "Majluf"], year: 1984, reference: "Myers et Majluf (1984)" },
  { concept: "l'asymétrie d'information", keywords: ["marche des citrons", "market for lemons", "asymetrie d'information"], authors: ["Akerlof"], year: 1970, reference: "Akerlof (1970)" },
  { concept: "les coûts de transaction", keywords: ["couts de transaction", "transaction costs"], authors: ["Coase", "Williamson"], year: 1937, reference: "Coase (1937) ; Williamson (1975)" },
  { concept: "la courbe de Phillips", keywords: ["courbe de phillips", "phillips curve"], authors: ["Phillips"], year: 1958, reference: "Phillips (1958)" },
  { concept: "la loi d'Okun", keywords: ["loi d'okun", "okun's law"], authors: ["Okun"], year: 1962, reference: "Okun (1962)" },
  { concept: "le modèle de croissance de Solow", keywords: ["modele de solow", "solow model", "croissance exogene"], authors: ["Solow", "Swan"], year: 1956, reference: "Solow (1956)" },
  { concept: "le modèle de Harrod-Domar", keywords: ["harrod-domar", "harrod domar"], authors: ["Harrod", "Domar"], year: 1939, reference: "Harrod (1939) ; Domar (1946)" },
  { concept: "le cycle de vie du produit", keywords: ["cycle de vie du produit", "product life cycle"], authors: ["Vernon", "Levitt", "Dean"], year: 1950, reference: "Vernon (1966)" },
  { concept: "la cointégration", keywords: ["cointegration"], authors: ["Engle", "Granger"], year: 1981, reference: "Engle et Granger (1987)" },
  { concept: "la régression fallacieuse", keywords: ["regression fallacieuse", "spurious regression"], authors: ["Granger", "Newbold", "Yule"], year: 1926, reference: "Granger et Newbold (1974)" },
];

const ORIGIN_WORDS = /\b(?:d[ée]velopp[ée]e?s?|introduite?s?|fond[ée]e?s?|formul[ée]e?s?|[ée]labor[ée]e?s?|propos[ée]e?s?|invent[ée]e?s?|con[çc]ue?s?|cr[ée]{1,2}e?s?|p[èe]re\s+de|initiateur|fondateur|on\s+doit\s+(?:a|à))\b/i;

const norm = (s: string) => ` ${fold(s).replace(/[’`´]/g, "'").replace(/[^a-z0-9']+/g, " ").trim()} `;

export function checkAttributions(citations: InTextCitation[]): FormIssue[] {
  const issues: FormIssue[] = [];
  const seen = new Set<string>();
  for (const c of citations) {
    const sentence = norm(c.sentence);
    for (const a of CLASSIC_ATTRIBUTIONS) {
      if (!a.keywords.some((k) => sentence.includes(` ${fold(k)} `))) continue;
      const key = `${c.id}|${a.concept}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const byOrigin = c.authors.some((name) => a.authors.some((x) => sameFamily(name, x)));
      if (c.year && c.year < a.year && !byOrigin) {
        issues.push({ code: "anachronisme", severity: "erreur", citationId: c.id, message: `« ${citationLabel(c)} » est cité à propos de ${a.concept}, qui n'apparaît qu'en ${a.year} (${a.reference}). Un texte de ${c.year} ne peut pas en parler : vérifiez l'année ou l'auteur.` });
      } else if (!byOrigin && ORIGIN_WORDS.test(c.sentence)) {
        issues.push({ code: "origine_du_concept", severity: "conseil", citationId: c.id, message: `Vous présentez l'origine de ${a.concept} en citant ${citationLabel(c)} ; ce concept est habituellement attribué à ${a.reference}. Si vous parlez de son origine, citez aussi cette source.` });
      }
    }
  }
  return issues;
}
