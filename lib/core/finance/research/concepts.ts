/**
 * Concepts financiers d'un sujet de recherche : expressions repérées dans le texte (sujet, questions,
 * objectifs, hypothèses, variables) → indicateurs de la base. Base propre au moteur « Gestion financière »
 * (la base de compréhension générale n'est pas modifiée).
 *
 * Repérage par l'expression la plus longue d'abord : « crédit fournisseurs » n'est jamais lu comme
 * « crédit », « rentabilité financière » jamais comme « rentabilité » seule. Le mot « crédit » seul
 * n'est rattaché à rien (crédit bancaire ? crédit clients ? crédit-bail ?) : ACADIA demande de préciser.
 */
import { fold } from "@/lib/core/understanding/text";

import type { FamilyId } from "../indicators/types";

export interface FinanceConcept {
  id: string;
  label: string;
  /** Expressions (repliées : sans accents, en minuscules). Un « s » final est toléré. */
  patterns: string[];
  /** Indicateurs proposés, du plus central au plus complémentaire. */
  indicators: string[];
  families: FamilyId[];
  /** Concept « niveau » (jugé par un repère) plutôt qu'un mécanisme. */
  judged?: boolean;
  /** Remarque affichée à l'étudiant (concept à préciser, non calculable…). */
  note?: string;
}

export const FINANCE_CONCEPTS: FinanceConcept[] = [
  { id: "rentabilite_financiere", label: "Rentabilité financière", patterns: ["rentabilite financiere", "rentabilite des capitaux propres", "rentabilite des fonds propres", "rendement des capitaux propres", "rendement des fonds propres", "roe"], indicators: ["roe", "levier_ecart", "effet_levier", "dupont_multiplicateur"], families: ["rentabilite"], judged: true },
  { id: "rentabilite_economique", label: "Rentabilité économique", patterns: ["rentabilite economique", "rentabilite des capitaux investis", "rentabilite des actifs", "performance economique", "roce", "roa"], indicators: ["re_brute", "re_nette", "roce", "roa"], families: ["rentabilite"], judged: true },
  { id: "effet_levier", label: "Effet de levier", patterns: ["effet de levier", "levier financier", "levier d'endettement", "effet de massue"], indicators: ["levier_ecart", "effet_levier", "gearing", "roe", "re_nette", "cout_dette"], families: ["rentabilite", "solvabilite"] },
  { id: "rentabilite", label: "Rentabilité", patterns: ["rentabilite", "profitabilite", "rentable"], indicators: ["roe", "re_brute", "marge_nette", "taux_ebe"], families: ["rentabilite"], judged: true, note: "Rentabilité de quoi ? Financière (capitaux propres), économique (outil), commerciale (marges) : précisez-le dans vos hypothèses." },
  { id: "performance_financiere", label: "Performance financière", patterns: ["performance financiere", "performances financieres", "performance"], indicators: ["roe", "re_brute", "marge_nette", "taux_ebe", "croissance_ca"], families: ["rentabilite", "croissance"], judged: true, note: "« Performance » est un concept large : rentabilité, marges, croissance ? Choisissez les indicateurs qui la mesurent dans votre étude." },
  { id: "marge_nette", label: "Marge nette", patterns: ["marge nette", "marge beneficiaire", "rentabilite commerciale"], indicators: ["marge_nette", "taux_rao", "poids_hao"], families: ["rentabilite"], judged: true },
  { id: "marge_commerciale", label: "Marge commerciale", patterns: ["marge commerciale", "taux de marque", "taux de marge commerciale"], indicators: ["taux_marque", "marge_commerciale", "taux_marge_cmv"], families: ["rentabilite", "sig"], judged: true },
  { id: "ebe", label: "Excédent brut d'exploitation", patterns: ["excedent brut d'exploitation", "ebe", "ebitda", "marge d'exploitation", "rentabilite d'exploitation", "resultat d'exploitation"], indicators: ["taux_ebe", "ebe", "taux_re", "resultat_exploitation"], families: ["rentabilite", "sig"], judged: true },
  { id: "resultat", label: "Résultat net", patterns: ["resultat net", "benefice", "benefices", "perte", "pertes"], indicators: ["resultat_net", "marge_nette", "croissance_rn"], families: ["sig", "rentabilite"] },
  { id: "valeur_ajoutee", label: "Valeur ajoutée", patterns: ["valeur ajoutee", "creation de richesse", "partage de la valeur ajoutee"], indicators: ["valeur_ajoutee", "va_ca", "partage_va_personnel", "partage_va_etat", "partage_va_preteurs"], families: ["sig", "activite"] },
  { id: "creation_valeur", label: "Création de valeur", patterns: ["creation de valeur", "valeur actionnariale", "eva"], indicators: ["roe", "re_nette", "levier_ecart"], families: ["rentabilite"], note: "La création de valeur au sens strict compare la rentabilité au coût des capitaux propres, qui n'est pas dans les états financiers : ACADIA s'en approche par la rentabilité financière et économique." },
  { id: "endettement", label: "Endettement", patterns: ["endettement", "taux d'endettement", "dette", "dettes financieres", "structure financiere", "structure du capital", "politique de financement", "mode de financement", "financement par emprunt", "financement par dette", "emprunt", "gearing"], indicators: ["gearing", "autonomie", "capacite_remb", "endettement_brut", "cout_dette"], families: ["solvabilite"], judged: true },
  { id: "credit_bancaire", label: "Crédit bancaire", patterns: ["credit bancaire", "credits bancaires", "acces au credit", "financement bancaire", "emprunt bancaire", "pret bancaire", "prets bancaires"], indicators: ["gearing", "endettement_brut", "cout_dette", "capacite_remb", "poids_treso_passif"], families: ["solvabilite", "liquidite"] },
  { id: "credit_bail", label: "Crédit-bail (location-acquisition)", patterns: ["credit-bail", "credit bail", "location-acquisition", "location acquisition", "leasing"], indicators: ["endettement_brut", "gearing", "capacite_remb"], families: ["solvabilite"], note: "Les dettes de location-acquisition figurent au poste DB et entrent dans l'endettement." },
  { id: "frais_financiers", label: "Coût de l'endettement", patterns: ["frais financiers", "charges financieres", "cout de la dette", "cout de l'endettement", "taux d'interet", "charge d'interets"], indicators: ["cout_dette", "ff_ca", "couv_ff", "ff_ebe"], families: ["solvabilite"], judged: true },
  { id: "solvabilite", label: "Solvabilité", patterns: ["solvabilite", "autonomie financiere", "independance financiere", "fonds propres", "capitaux propres", "solvable"], indicators: ["autonomie", "independance", "solvabilite_generale", "gearing", "cp_capital"], families: ["solvabilite"], judged: true },
  { id: "liquidite", label: "Liquidité", patterns: ["liquidite", "liquidite generale", "capacite a payer", "dettes a court terme", "ratio de liquidite"], indicators: ["lg", "lr", "li", "poids_treso_passif"], families: ["liquidite"], judged: true },
  { id: "tresorerie", label: "Trésorerie", patterns: ["tresorerie", "gestion de tresorerie", "situation de tresorerie", "tresorerie nette", "cash"], indicators: ["tn", "tn_jours", "flux_op", "fcf", "li"], families: ["equilibre", "flux", "liquidite"], judged: true },
  { id: "decouvert", label: "Crédits de trésorerie", patterns: ["credit de tresorerie", "credits de tresorerie", "decouvert", "decouverts bancaires", "concours bancaires", "facilites de caisse"], indicators: ["poids_treso_passif", "tn", "cout_dette"], families: ["liquidite", "equilibre"] },
  { id: "equilibre_financier", label: "Équilibre financier", patterns: ["equilibre financier", "fonds de roulement", "fonds de roulement net global", "frng", "regle de l'equilibre financier"], indicators: ["fr", "fr_bf", "couv_emplois_stables", "tn", "bf"], families: ["equilibre"], judged: true },
  { id: "bfr", label: "Besoin de financement d'exploitation", patterns: ["besoin en fonds de roulement", "besoin de financement", "bfr", "bfe", "cycle d'exploitation", "effet ciseaux"], indicators: ["bfe", "bfe_jours", "ciseaux", "delai_clients", "delai_stocks", "delai_fournisseurs"], families: ["equilibre", "activite"] },
  { id: "credit_clients", label: "Crédit clients", patterns: ["delai clients", "delai client", "delai de recouvrement", "credit clients", "credit client", "creances clients", "creance client", "recouvrement", "recouvrement des creances", "politique de credit", "credit accorde aux clients", "impayes"], indicators: ["delai_clients", "croissance_clients", "ecart_delais"], families: ["activite"], judged: true },
  { id: "credit_fournisseurs", label: "Crédit fournisseurs", patterns: ["credit fournisseurs", "credit fournisseur", "delai fournisseurs", "delai fournisseur", "dettes fournisseurs", "delai de paiement des fournisseurs"], indicators: ["delai_fournisseurs", "ecart_delais"], families: ["activite"] },
  { id: "stocks", label: "Gestion des stocks", patterns: ["gestion des stocks", "stock", "rotation des stocks", "stockage", "approvisionnement", "approvisionnements"], indicators: ["delai_stocks", "rot_stocks", "croissance_stocks"], families: ["activite"], judged: true },
  { id: "autofinancement", label: "Autofinancement", patterns: ["capacite d'autofinancement", "autofinancement", "caf", "cafg", "ressources internes"], indicators: ["cafg", "caf_ca", "autofinancement", "autofin_invest", "capacite_remb"], families: ["caf"], judged: true },
  { id: "investissement", label: "Investissement", patterns: ["investissement", "politique d'investissement", "immobilisations", "outil de production", "equipement", "equipements"], indicators: ["taux_investissement", "couv_invest", "autofin_invest", "flux_invest", "rot_immo"], families: ["activite", "flux", "caf"] },
  { id: "dividendes", label: "Politique de dividendes", patterns: ["dividende", "politique de dividendes", "distribution des benefices", "remuneration des associes", "remuneration des actionnaires"], indicators: ["taux_distribution", "autofinancement"], families: ["rentabilite", "caf"] },
  { id: "croissance", label: "Croissance de l'activité", patterns: ["chiffre d'affaires", "ventes", "croissance", "activite commerciale", "volume d'activite"], indicators: ["croissance_ca", "chiffre_affaires", "rot_actif"], families: ["croissance", "activite"], judged: true },
  { id: "charges_personnel", label: "Charges de personnel", patterns: ["charges de personnel", "masse salariale", "productivite", "productivite du personnel", "remuneration du personnel"], indicators: ["poids_personnel", "rendement_personnel", "partage_va_personnel", "croissance_personnel"], families: ["activite"] },
  { id: "fiscalite", label: "Fiscalité", patterns: ["pression fiscale", "fiscalite", "impot", "impots et taxes", "charges fiscales", "dettes fiscales"], indicators: ["taux_is_effectif", "poids_impots", "dfs_poids", "partage_va_etat"], families: ["rentabilite", "solvabilite"] },
  { id: "risque_faillite", label: "Risque de défaillance", patterns: ["risque de faillite", "faillite", "defaillance", "difficultes financieres", "detresse financiere", "risque financier"], indicators: ["conan_holder", "altman_z2", "autonomie", "capacite_remb", "lg"], families: ["scores", "solvabilite", "liquidite"] },
  { id: "flux", label: "Flux de trésorerie", patterns: ["flux de tresorerie", "tableau des flux", "tableau de flux", "cash flow", "cash-flow", "flux financiers"], indicators: ["flux_op", "flux_invest", "flux_fin", "fcf", "conversion_resultat"], families: ["flux"] },
  {
    id: "situation_financiere", label: "Situation financière d'ensemble", patterns: ["situation financiere", "sante financiere", "diagnostic financier", "analyse financiere", "analyse des etats financiers", "etats financiers", "equilibre et rentabilite"],
    indicators: ["lg", "autonomie", "gearing", "roe", "marge_nette", "fr", "tn", "delai_clients"], families: ["liquidite", "solvabilite", "rentabilite", "activite", "equilibre"], judged: true,
  },
];

export const FINANCE_CONCEPT_BY_ID: Record<string, FinanceConcept> = Object.fromEntries(FINANCE_CONCEPTS.map((c) => [c.id, c]));

export interface ConceptMatch {
  concept: FinanceConcept;
  phrase: string;
  start: number;
  end: number;
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const PATTERNS = FINANCE_CONCEPTS.flatMap((concept) => concept.patterns.map((pattern) => ({ concept, pattern, re: new RegExp(`(?<![a-z0-9])${escape(pattern)}s?(?![a-z0-9])`, "g") }))).sort((a, b) => b.pattern.length - a.pattern.length);

/** Concepts repérés dans un texte, sans double comptage (l'expression la plus longue l'emporte). */
export function matchConcepts(text: string): ConceptMatch[] {
  const folded = fold(text);
  const taken: Array<[number, number]> = [];
  const matches: ConceptMatch[] = [];
  for (const { concept, pattern, re } of PATTERNS) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(folded))) {
      const start = m.index;
      const end = start + m[0].length;
      if (taken.some(([a, b]) => start < b && end > a)) continue;
      taken.push([start, end]);
      matches.push({ concept, phrase: pattern, start, end });
    }
  }
  return matches.sort((a, b) => a.start - b.start);
}

/** Concepts distincts, dans l'ordre d'apparition. */
export function conceptsOf(text: string): FinanceConcept[] {
  const seen = new Set<string>();
  return matchConcepts(text)
    .map((m) => m.concept)
    .filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)));
}

/** « crédit » employé seul : à préciser. */
export const ambiguousCredit = (text: string) => {
  const folded = fold(text);
  const all = [...folded.matchAll(/(?<![a-z0-9])credits?(?![a-z0-9])/g)].length;
  const qualified = matchConcepts(text).filter((m) => m.phrase.includes("credit")).length;
  return all > qualified;
};
