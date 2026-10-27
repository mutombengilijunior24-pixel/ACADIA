/**
 * Lecture économique du sujet : concepts macroéconomiques repérés dans les hypothèses, relations
 * (variable explicative → variable expliquée), signe attendu et théorie de référence, puis variables
 * proposées pour les mesurer (séries ou agrégats). Tout est proposé, rien n'est imposé : l'étudiant valide.
 * Références théoriques usuelles, à faire confirmer par l'encadreur.
 */
import type { ResearchChain } from "@/lib/core/chain";

import { fold } from "./roles";
import type { MacroDataset, MacroRole, VariableRef } from "./types";
import { computeAggregates } from "./aggregates";

export interface MacroConcept {
  id: string;
  label: string;
  keywords: string[];
  /** Mesures préférées, dans l'ordre (agrégat calculé ou série d'un rôle donné). */
  measures: Array<{ kind: "aggregate"; id: string } | { kind: "role"; role: MacroRole }>;
}

export const MACRO_CONCEPTS: MacroConcept[] = [
  { id: "inflation", label: "Inflation", keywords: ["taux d'inflation", "inflation", "hausse des prix", "niveau general des prix", "prix a la consommation", "stabilite des prix"], measures: [{ kind: "role", role: "inflation" }, { kind: "aggregate", id: "inflation_ipc" }, { kind: "aggregate", id: "inflation_deflateur" }] },
  { id: "masse_monetaire", label: "Masse monétaire", keywords: ["masse monetaire", "creation monetaire", "offre de monnaie", "offre monetaire", "m2", "monnaie en circulation"], measures: [{ kind: "aggregate", id: "croissance_m2" }, { kind: "role", role: "m2" }] },
  { id: "taux_change", label: "Taux de change", keywords: ["taux de change", "depreciation", "appreciation", "cours du franc", "franc congolais", "change"], measures: [{ kind: "aggregate", id: "depreciation" }, { kind: "role", role: "taux_change" }] },
  { id: "taux_directeur", label: "Taux directeur / taux d'intérêt", keywords: ["taux directeur", "politique monetaire", "taux d'interet", "taux de la banque centrale", "taux debiteur"], measures: [{ kind: "role", role: "taux_directeur" }, { kind: "role", role: "taux_interet" }] },
  { id: "croissance", label: "Croissance économique", keywords: ["croissance economique", "croissance du pib", "produit interieur brut", "production nationale", "activite economique", "croissance", "pib"], measures: [{ kind: "aggregate", id: "croissance_pib_reel" }, { kind: "role", role: "pib_reel" }] },
  { id: "investissement", label: "Investissement", keywords: ["formation brute de capital", "investissement public", "investissements", "investissement", "fbcf"], measures: [{ kind: "aggregate", id: "taux_investissement" }, { kind: "role", role: "fbcf" }] },
  { id: "depenses_publiques", label: "Dépenses publiques", keywords: ["depenses publiques", "depenses de l'etat", "politique budgetaire", "budget de l'etat", "depenses du gouvernement"], measures: [{ kind: "aggregate", id: "depenses_pib" }, { kind: "role", role: "depenses_publiques" }] },
  { id: "deficit", label: "Solde budgétaire", keywords: ["deficit budgetaire", "solde budgetaire", "deficit public", "desequilibre budgetaire"], measures: [{ kind: "aggregate", id: "solde_budgetaire_pib" }] },
  { id: "dette", label: "Dette publique", keywords: ["dette publique", "endettement public", "dette exterieure", "endettement"], measures: [{ kind: "aggregate", id: "dette_pib" }, { kind: "role", role: "dette_publique" }] },
  { id: "exportations", label: "Exportations", keywords: ["exportations", "exportation", "ventes a l'etranger"], measures: [{ kind: "aggregate", id: "croissance_exportations" }, { kind: "role", role: "exportations" }] },
  { id: "ouverture", label: "Ouverture commerciale", keywords: ["ouverture commerciale", "commerce exterieur", "echanges exterieurs", "commerce international", "ouverture"], measures: [{ kind: "aggregate", id: "taux_ouverture" }] },
  { id: "ide", label: "Investissements directs étrangers", keywords: ["investissements directs etrangers", "investissement direct etranger", "capitaux etrangers", "ide"], measures: [{ kind: "role", role: "ide" }] },
  { id: "credit", label: "Crédit à l'économie", keywords: ["credit bancaire", "credit a l'economie", "credit au secteur prive", "financement bancaire", "credits", "credit"], measures: [{ kind: "aggregate", id: "credit_pib" }, { kind: "role", role: "credit_prive" }] },
  { id: "production_agricole", label: "Production agricole", keywords: ["production agricole", "production vivriere", "secteur agricole", "rendement agricole", "agriculture", "production"], measures: [{ kind: "aggregate", id: "croissance_production_agricole" }, { kind: "role", role: "production_agricole" }, { kind: "aggregate", id: "rendement_agricole" }, { kind: "role", role: "va_agricole" }] },
  { id: "recettes", label: "Recettes publiques", keywords: ["recettes publiques", "recettes fiscales", "mobilisation des recettes", "fiscalite", "recettes"], measures: [{ kind: "aggregate", id: "pression_fiscale" }, { kind: "role", role: "recettes_publiques" }] },
  { id: "reserves", label: "Réserves de change", keywords: ["reserves de change", "reserves internationales", "avoirs exterieurs"], measures: [{ kind: "role", role: "reserves_change" }] },
  { id: "transferts", label: "Transferts des migrants", keywords: ["transferts des migrants", "transferts de fonds", "diaspora"], measures: [{ kind: "role", role: "transferts" }] },
  { id: "aide", label: "Aide extérieure", keywords: ["aide publique au developpement", "aide exterieure", "aide au developpement"], measures: [{ kind: "role", role: "aide_exterieure" }] },
  { id: "niveau_de_vie", label: "Niveau de vie", keywords: ["niveau de vie", "pib par habitant", "revenu par habitant", "bien-etre", "pauvrete"], measures: [{ kind: "aggregate", id: "croissance_pib_habitant" }, { kind: "aggregate", id: "pib_par_habitant" }] },
  { id: "epargne", label: "Épargne", keywords: ["epargne nationale", "epargne interieure", "epargne"], measures: [{ kind: "aggregate", id: "taux_epargne" }, { kind: "role", role: "epargne" }] },
];

export const CONCEPT_BY_ID: Record<string, MacroConcept> = Object.fromEntries(MACRO_CONCEPTS.map((c) => [c.id, c]));

export interface Theory {
  sign: 1 | -1;
  name: string;
  explanation: string;
  references: string;
}

/** Relations théoriques usuelles « cause → effet ». */
export const THEORIES: Record<string, Theory> = {
  "masse_monetaire>inflation": { sign: 1, name: "Théorie quantitative de la monnaie", explanation: "À vitesse de circulation et production données (MV = PY), une création monétaire plus rapide que la production se traduit par une hausse du niveau général des prix.", references: "Fisher (1911) ; Friedman (1956)" },
  "taux_change>inflation": { sign: 1, name: "Transmission du change aux prix (pass-through)", explanation: "La dépréciation de la monnaie nationale renchérit les biens importés et se répercute sur les prix intérieurs, d'autant plus que l'économie est importatrice et dollarisée.", references: "Dornbusch (1987) ; Taylor (2000)" },
  "taux_directeur>inflation": { sign: -1, name: "Canal du taux d'intérêt de la politique monétaire", explanation: "Un relèvement du taux directeur renchérit le crédit, freine la demande et, avec un délai, la hausse des prix.", references: "Mishkin (1995) ; Taylor (1993)" },
  "depenses_publiques>inflation": { sign: 1, name: "Dominance budgétaire", explanation: "Des dépenses publiques financées par la banque centrale accroissent la masse monétaire et alimentent l'inflation.", references: "Sargent et Wallace (1981)" },
  "deficit>inflation": { sign: -1, name: "Financement monétaire du déficit", explanation: "Un solde budgétaire plus élevé (déficit moindre) réduit le besoin de financement monétaire et donc la pression inflationniste.", references: "Sargent et Wallace (1981)" },
  "masse_monetaire>taux_change": { sign: 1, name: "Approche monétaire du taux de change", explanation: "Une offre de monnaie nationale qui croît plus vite que la demande déprécie la monnaie nationale.", references: "Frenkel (1976)" },
  "inflation>taux_change": { sign: 1, name: "Parité de pouvoir d'achat (PPA)", explanation: "Un différentiel d'inflation défavorable se traduit, à terme, par une dépréciation de la monnaie nationale.", references: "Cassel (1918)" },
  "reserves>taux_change": { sign: -1, name: "Défense de la monnaie par les réserves", explanation: "Des réserves de change abondantes permettent à la banque centrale de limiter la dépréciation.", references: "Obstfeld et Rogoff (1996)" },
  "investissement>croissance": { sign: 1, name: "Accumulation du capital", explanation: "L'investissement accroît le stock de capital et la capacité de production.", references: "Harrod (1939) ; Domar (1946) ; Solow (1956)" },
  "exportations>croissance": { sign: 1, name: "Croissance tirée par les exportations", explanation: "Les exportations élargissent les débouchés, apportent des devises et stimulent la production.", references: "Balassa (1978) ; Feder (1983)" },
  "ouverture>croissance": { sign: 1, name: "Gains de l'ouverture", explanation: "L'ouverture favorise la spécialisation et la diffusion technologique ; l'effet reste discuté pour les économies exportatrices de matières premières.", references: "Frankel et Romer (1999)" },
  "depenses_publiques>croissance": { sign: 1, name: "Multiplicateur keynésien", explanation: "La dépense publique soutient la demande globale et la production, surtout en sous-emploi.", references: "Keynes (1936)" },
  "inflation>croissance": { sign: -1, name: "Coûts de l'inflation", explanation: "Au-delà d'un seuil, l'inflation accroît l'incertitude et décourage l'investissement.", references: "Fischer (1993) ; Khan et Senhadji (2001)" },
  "credit>croissance": { sign: 1, name: "Approfondissement financier", explanation: "Le crédit finance l'investissement productif ; la répression financière le freine.", references: "McKinnon (1973) ; Shaw (1973) ; Levine (2005)" },
  "ide>croissance": { sign: 1, name: "Capitaux et transferts de technologie", explanation: "Les IDE apportent du capital et des savoir-faire, sous réserve d'une capacité d'absorption suffisante.", references: "Borensztein, De Gregorio et Lee (1998)" },
  "dette>croissance": { sign: -1, name: "Poids de la dette", explanation: "Un endettement public élevé peut freiner la croissance (éviction, service de la dette) ; les seuils sont débattus.", references: "Reinhart et Rogoff (2010)" },
  "production_agricole>croissance": { sign: 1, name: "Agriculture et développement", explanation: "Le surplus agricole nourrit la croissance des autres secteurs et les revenus ruraux.", references: "Lewis (1954) ; Johnston et Mellor (1961)" },
  "masse_monetaire>croissance": { sign: 1, name: "Effets réels de la monnaie à court terme", explanation: "À court terme la création monétaire peut stimuler l'activité ; à long terme la monnaie est réputée neutre.", references: "Friedman et Schwartz (1963) ; Lucas (1972)" },
  "taux_directeur>credit": { sign: -1, name: "Canal du crédit", explanation: "Un taux plus élevé renchérit le crédit et en réduit la demande.", references: "Bernanke et Gertler (1995)" },
  "credit>production_agricole": { sign: 1, name: "Financement de l'agriculture", explanation: "Le crédit lève la contrainte de trésorerie des exploitants (intrants, équipement).", references: "Feder et al. (1990)" },
  "investissement>production_agricole": { sign: 1, name: "Capital agricole", explanation: "L'investissement (équipement, irrigation) accroît la productivité agricole.", references: "Mellor (1966)" },
  "epargne>investissement": { sign: 1, name: "Épargne et investissement", explanation: "L'épargne intérieure finance l'investissement, d'autant plus que les capitaux sont peu mobiles.", references: "Feldstein et Horioka (1980)" },
  "croissance>recettes": { sign: 1, name: "Élasticité des recettes à l'activité", explanation: "La croissance élargit l'assiette fiscale.", references: "Musgrave (1959)" },
  "recettes>depenses_publiques": { sign: 1, name: "Contrainte budgétaire", explanation: "Les recettes conditionnent la capacité de dépense de l'État.", references: "Musgrave (1959)" },
  "transferts>croissance": { sign: 1, name: "Transferts des migrants", explanation: "Les transferts soutiennent la consommation et l'investissement des ménages ; l'effet sur la croissance reste discuté.", references: "Giuliano et Ruiz-Arranz (2009)" },
};

export const theoryOf = (cause: string | null, effect: string | null): Theory | null => (cause && effect ? (THEORIES[`${cause}>${effect}`] ?? null) : null);

/** Nom de chaque concept avec son article, pour rédiger une hypothèse (« la masse monétaire », « l'inflation »). */
const WITH_ARTICLE: Record<string, string> = {
  inflation: "l'inflation",
  masse_monetaire: "la masse monétaire",
  taux_change: "le taux de change",
  taux_directeur: "le taux directeur",
  croissance: "la croissance économique",
  investissement: "l'investissement",
  depenses_publiques: "les dépenses publiques",
  deficit: "le solde budgétaire",
  dette: "la dette publique",
  exportations: "les exportations",
  ouverture: "l'ouverture commerciale",
  ide: "les investissements directs étrangers",
  credit: "le crédit à l'économie",
  production_agricole: "la production agricole",
  recettes: "les recettes publiques",
  reserves: "les réserves de change",
  transferts: "les transferts des migrants",
  aide: "l'aide extérieure",
  niveau_de_vie: "le niveau de vie",
  epargne: "l'épargne",
};
const ofForm = (s: string) => (s.startsWith("le ") ? `du ${s.slice(3)}` : s.startsWith("les ") ? `des ${s.slice(4)}` : `de ${s}`);

/** Hypothèse rédigée à partir d'une relation théorique : une proposition, que l'étudiant valide ou reformule. */
export function proposeHypothesis(cause: string, effect: string, sign: 1 | -1): string {
  const name = (id: string) => WITH_ARTICLE[id] ?? (CONCEPT_BY_ID[id]?.label.toLowerCase() ?? id);
  // Pour le change, la hausse du cours (francs par dollar) est une dépréciation : on l'écrit sans ambiguïté.
  const subject = cause === "taux_change" ? "La dépréciation du taux de change" : `La hausse ${ofForm(name(cause))}`;
  return `${subject} entraîne une ${sign === 1 ? "hausse" : "baisse"} ${ofForm(name(effect))}.`;
}

interface Hit {
  concept: MacroConcept;
  at: number;
  /** Longueur de l'expression repérée. */
  len: number;
}

/** Texte normalisé pour le repérage : minuscules, sans accents ni apostrophes (« l'inflation » → « l inflation »). */
const norm = (s: string) => fold(s).replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();

/** Concepts présents dans un texte, dans l'ordre d'apparition (expression la plus longue d'abord). */
export function conceptsIn(text: string): Hit[] {
  const t = ` ${norm(text)} `;
  const taken: Array<[number, number]> = [];
  const hits: Hit[] = [];
  const all = MACRO_CONCEPTS.flatMap((concept) => concept.keywords.map((k) => ({ concept, k: norm(k) }))).sort((a, b) => b.k.length - a.k.length);
  for (const { concept, k } of all) {
    let from = 0;
    for (;;) {
      const i = t.indexOf(` ${k} `, from);
      if (i < 0) break;
      const span: [number, number] = [i, i + k.length + 1];
      if (!taken.some(([a, b]) => span[0] < b && a < span[1])) {
        taken.push(span);
        if (!hits.some((h) => h.concept.id === concept.id)) hits.push({ concept, at: i, len: k.length });
      }
      from = i + 1;
    }
  }
  return hits.sort((a, b) => a.at - b.at);
}

const POSITIVE = ["hausse", "augmentation", "augmente", "accroissement", "accroit", "stimule", "favorise", "ameliore", "positivement", "positif", "eleve", "renforce", "depreciation", "acceleration", "accelere"];
const NEGATIVE = ["baisse", "diminution", "diminue", "reduction", "reduit", "freine", "ralentit", "negativement", "negatif", "degrade", "appreciation", "recul", "contraction", "affaiblit"];

/** Polarité du mot de variation le plus proche avant la position `end`, après la position `start`. */
function polarityBetween(t: string, start: number, end: number): 1 | -1 | null {
  const segment = t.slice(start, end);
  let best: { pos: number; sign: 1 | -1 } | null = null;
  for (const [words, sign] of [[POSITIVE, 1], [NEGATIVE, -1]] as const) {
    for (const w of words) {
      const i = segment.lastIndexOf(` ${w}`);
      if (i >= 0 && (!best || i > best.pos)) best = { pos: i, sign };
    }
  }
  return best?.sign ?? null;
}

export interface MacroLink {
  rowId: string;
  index: number;
  statement: string;
  hypothesis: string | null;
  cause: MacroConcept | null;
  effect: MacroConcept | null;
  /** Signe attendu : celui écrit dans l'hypothèse, sinon celui de la théorie, sinon à préciser. */
  expectedSign: 1 | -1 | null;
  signSource: "hypothese" | "theorie" | null;
  theory: Theory | null;
}

/** Relations du sujet, ligne par ligne de la chaîne de cohérence. */
export function macroLinks(chain: ResearchChain): MacroLink[] {
  const text = (id: string | null) => (id ? (chain.statements.find((s) => s.id === id)?.text ?? null) : null);
  return chain.rows.map((row, index) => {
    const hypothesis = text(row.hypothesisId);
    const statement = hypothesis ?? text(row.objectiveId) ?? text(row.questionId) ?? "";
    const hits = conceptsIn(statement);
    let cause: Hit | null = null;
    let effect: Hit | null = null;
    if (hits.length >= 2) {
      const [a, b] = hits;
      // Sens : celui de la théorie s'il est connu ; sinon l'ordre de la phrase, inversé pour « Y dépend de X ».
      const theoryDir = THEORIES[`${a.concept.id}>${b.concept.id}`] ? "ab" : THEORIES[`${b.concept.id}>${a.concept.id}`] ? "ba" : null;
      const depends = /depend|fonction de|explique par|determine par/.test(fold(statement));
      [cause, effect] = theoryDir === "ab" ? [a, b] : theoryDir === "ba" ? [b, a] : depends ? [b, a] : [a, b];
    }
    const theory = theoryOf(cause?.concept.id ?? null, effect?.concept.id ?? null);
    let expectedSign: 1 | -1 | null = null;
    let signSource: MacroLink["signSource"] = null;
    if (cause && effect && hypothesis) {
      const t = ` ${norm(statement)} `;
      const first = Math.min(cause.at, effect.at);
      const second = Math.max(cause.at, effect.at);
      // Qualificatif de la cause (« hausse de », « baisse de », ou le mot lui-même : « dépréciation », « appréciation »).
      const causeQualifier = polarityBetween(t, Math.max(0, cause.at - 40), cause.at + cause.len + 2) ?? 1;
      const effectQualifier = polarityBetween(t, first + (first === cause.at ? cause.len + 1 : 1), second + 1);
      if (effectQualifier !== null) {
        expectedSign = (causeQualifier * effectQualifier) as 1 | -1;
        signSource = "hypothese";
      }
    }
    if (expectedSign === null && theory) {
      expectedSign = theory.sign;
      signSource = "theorie";
    }
    return { rowId: row.id, index, statement, hypothesis, cause: cause?.concept ?? null, effect: effect?.concept ?? null, expectedSign, signSource, theory };
  });
}

/** Première mesure disponible d'un concept dans les données (agrégat calculable ou série du bon rôle). */
export function measureOf(concept: MacroConcept | null, dataset: MacroDataset): VariableRef | null {
  if (!concept) return null;
  const aggregates = new Set(computeAggregates(dataset).map((a) => a.def.id));
  for (const m of concept.measures) {
    if (m.kind === "aggregate" && aggregates.has(m.id)) return { kind: "aggregate", id: m.id };
    if (m.kind === "role") {
      const s = dataset.series.find((x) => x.role === m.role);
      if (s) return { kind: "series", id: s.id };
    }
  }
  return null;
}
