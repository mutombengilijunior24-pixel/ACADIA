/**
 * Agrégats et indicateurs macroéconomiques calculés à partir des séries saisies, chacun avec sa formule,
 * son unité et sa lecture économique. Un agrégat n'est calculé que si toutes ses séries sont présentes ;
 * les ratios supposent la même monnaie et la même unité au numérateur et au dénominateur (rappelé à
 * l'écran). Formules usuelles des manuels de macroéconomie, à valider par l'encadreur.
 */
import { isNum, growth, type Values } from "./series";
import type { MacroDataset, MacroRole } from "./types";

export interface AggregateDef {
  id: string;
  label: string;
  /** Formule lisible, avec les noms des séries. */
  formula: string;
  unit: string;
  requires: MacroRole[];
  family: "croissance" | "prix_monnaie" | "exterieur" | "finances_publiques" | "investissement" | "rural";
  /** Lecture économique (ce que signifie une hausse). */
  reading: string;
  compute: (s: Record<MacroRole, Values>, n: number) => Values;
}

export const FAMILY_LABELS: Record<AggregateDef["family"], string> = {
  croissance: "Croissance et activité",
  prix_monnaie: "Prix, monnaie et change",
  exterieur: "Secteur extérieur",
  finances_publiques: "Finances publiques",
  investissement: "Investissement et épargne",
  rural: "Économie rurale",
};

const ratio = (a: Values, b: Values, k = 100): Values => a.map((v, i) => (isNum(v) && isNum(b[i]) && b[i] !== 0 ? (v / (b[i] as number)) * k : null));
const sum = (a: Values, b: Values): Values => a.map((v, i) => (isNum(v) && isNum(b[i]) ? v + (b[i] as number) : null));
const diff = (a: Values, b: Values): Values => a.map((v, i) => (isNum(v) && isNum(b[i]) ? v - (b[i] as number) : null));

export const AGGREGATES: AggregateDef[] = [
  { id: "croissance_pib_reel", label: "Taux de croissance du PIB réel", formula: "(PIB réel t ÷ PIB réel t−1 − 1) × 100", unit: "%", requires: ["pib_reel"], family: "croissance", reading: "Rythme d'expansion de la production en volume : une hausse traduit une accélération de l'activité économique.", compute: (s) => growth(s.pib_reel) },
  { id: "croissance_pib_nominal", label: "Taux de croissance du PIB nominal", formula: "(PIB nominal t ÷ PIB nominal t−1 − 1) × 100", unit: "%", requires: ["pib_nominal"], family: "croissance", reading: "Croissance en valeur : mélange l'effet du volume et l'effet des prix.", compute: (s) => growth(s.pib_nominal) },
  { id: "pib_par_habitant", label: "PIB réel par habitant", formula: "PIB réel ÷ Population", unit: "par habitant", requires: ["pib_reel", "population"], family: "croissance", reading: "Niveau de vie moyen : il progresse seulement si la production croît plus vite que la population.", compute: (s) => ratio(s.pib_reel, s.population, 1) },
  { id: "croissance_pib_habitant", label: "Croissance du PIB réel par habitant", formula: "(PIB/hab t ÷ PIB/hab t−1 − 1) × 100", unit: "%", requires: ["pib_reel", "population"], family: "croissance", reading: "Variation du niveau de vie moyen, une fois la croissance démographique déduite.", compute: (s) => growth(ratio(s.pib_reel, s.population, 1)) },
  { id: "inflation_ipc", label: "Taux d'inflation (IPC)", formula: "(IPC t ÷ IPC t−1 − 1) × 100", unit: "%", requires: ["ipc"], family: "prix_monnaie", reading: "Hausse générale des prix à la consommation : une inflation élevée érode le pouvoir d'achat.", compute: (s) => growth(s.ipc) },
  { id: "deflateur_pib", label: "Déflateur du PIB", formula: "PIB nominal ÷ PIB réel × 100", unit: "indice", requires: ["pib_nominal", "pib_reel"], family: "prix_monnaie", reading: "Niveau général des prix de tous les biens produits dans l'économie.", compute: (s) => ratio(s.pib_nominal, s.pib_reel) },
  { id: "inflation_deflateur", label: "Inflation mesurée par le déflateur", formula: "(Déflateur t ÷ Déflateur t−1 − 1) × 100", unit: "%", requires: ["pib_nominal", "pib_reel"], family: "prix_monnaie", reading: "Hausse des prix de l'ensemble de la production nationale (et pas seulement de la consommation).", compute: (s) => growth(ratio(s.pib_nominal, s.pib_reel)) },
  { id: "croissance_m2", label: "Croissance de la masse monétaire M2", formula: "(M2 t ÷ M2 t−1 − 1) × 100", unit: "%", requires: ["m2"], family: "prix_monnaie", reading: "Rythme de création monétaire : selon la théorie quantitative, une création plus rapide que la production nourrit l'inflation.", compute: (s) => growth(s.m2) },
  { id: "vitesse_monnaie", label: "Vitesse de circulation de la monnaie", formula: "PIB nominal ÷ M2", unit: "fois par an", requires: ["pib_nominal", "m2"], family: "prix_monnaie", reading: "Nombre de fois qu'une unité de monnaie finance la production (V de MV = PY) : une baisse signifie que les agents détiennent davantage de monnaie.", compute: (s) => ratio(s.pib_nominal, s.m2, 1) },
  { id: "liquidite_economie", label: "Taux de liquidité de l'économie (M2/PIB)", formula: "M2 ÷ PIB nominal × 100", unit: "%", requires: ["m2", "pib_nominal"], family: "prix_monnaie", reading: "Profondeur monétaire et financière : un ratio élevé traduit une économie plus monétisée.", compute: (s) => ratio(s.m2, s.pib_nominal) },
  { id: "multiplicateur_monetaire", label: "Multiplicateur monétaire", formula: "M2 ÷ Base monétaire", unit: "fois", requires: ["m2", "base_monetaire"], family: "prix_monnaie", reading: "Capacité du système bancaire à créer de la monnaie à partir de la monnaie centrale.", compute: (s) => ratio(s.m2, s.base_monetaire, 1) },
  { id: "credit_pib", label: "Crédit au secteur privé (% du PIB)", formula: "Crédit à l'économie ÷ PIB nominal × 100", unit: "%", requires: ["credit_prive", "pib_nominal"], family: "prix_monnaie", reading: "Approfondissement financier : part de l'activité financée par le crédit bancaire.", compute: (s) => ratio(s.credit_prive, s.pib_nominal) },
  { id: "depreciation", label: "Taux de dépréciation de la monnaie nationale", formula: "(Taux de change t ÷ Taux de change t−1 − 1) × 100", unit: "%", requires: ["taux_change"], family: "prix_monnaie", reading: "Taux de change coté « monnaie nationale pour 1 USD » : une hausse signifie que la monnaie nationale perd de la valeur.", compute: (s) => growth(s.taux_change) },
  { id: "taux_interet_reel", label: "Taux d'intérêt réel (approximation de Fisher)", formula: "Taux d'intérêt nominal − Inflation (IPC)", unit: "points de %", requires: ["taux_interet", "ipc"], family: "prix_monnaie", reading: "Coût réel du crédit : négatif quand l'inflation dépasse le taux nominal, ce qui pénalise l'épargne.", compute: (s) => diff(s.taux_interet, growth(s.ipc)) },
  { id: "taux_ouverture", label: "Taux d'ouverture commerciale", formula: "(Exportations + Importations) ÷ PIB nominal × 100", unit: "%", requires: ["exportations", "importations", "pib_nominal"], family: "exterieur", reading: "Degré d'insertion de l'économie dans les échanges internationaux.", compute: (s) => ratio(sum(s.exportations, s.importations), s.pib_nominal) },
  { id: "balance_commerciale_pib", label: "Solde commercial (% du PIB)", formula: "(Exportations − Importations) ÷ PIB nominal × 100", unit: "%", requires: ["exportations", "importations", "pib_nominal"], family: "exterieur", reading: "Excédent (positif) ou déficit (négatif) des échanges de biens et services.", compute: (s) => ratio(diff(s.exportations, s.importations), s.pib_nominal) },
  { id: "couverture_importations", label: "Taux de couverture des importations", formula: "Exportations ÷ Importations × 100", unit: "%", requires: ["exportations", "importations"], family: "exterieur", reading: "Part des importations financée par les exportations (100 % = équilibre).", compute: (s) => ratio(s.exportations, s.importations) },
  { id: "croissance_exportations", label: "Croissance des exportations", formula: "(Exportations t ÷ Exportations t−1 − 1) × 100", unit: "%", requires: ["exportations"], family: "exterieur", reading: "Dynamisme des ventes à l'étranger.", compute: (s) => growth(s.exportations) },
  { id: "solde_budgetaire_pib", label: "Solde budgétaire (% du PIB)", formula: "(Recettes publiques − Dépenses publiques) ÷ PIB nominal × 100", unit: "%", requires: ["recettes_publiques", "depenses_publiques", "pib_nominal"], family: "finances_publiques", reading: "Négatif : déficit public à financer (emprunt ou, en dernier recours, création monétaire).", compute: (s) => ratio(diff(s.recettes_publiques, s.depenses_publiques), s.pib_nominal) },
  { id: "depenses_pib", label: "Dépenses publiques (% du PIB)", formula: "Dépenses publiques ÷ PIB nominal × 100", unit: "%", requires: ["depenses_publiques", "pib_nominal"], family: "finances_publiques", reading: "Poids de l'État dans l'économie.", compute: (s) => ratio(s.depenses_publiques, s.pib_nominal) },
  { id: "pression_fiscale", label: "Taux de prélèvement (recettes / PIB)", formula: "Recettes publiques ÷ PIB nominal × 100", unit: "%", requires: ["recettes_publiques", "pib_nominal"], family: "finances_publiques", reading: "Capacité de l'État à mobiliser des ressources internes.", compute: (s) => ratio(s.recettes_publiques, s.pib_nominal) },
  { id: "dette_pib", label: "Dette publique (% du PIB)", formula: "Dette publique ÷ PIB nominal × 100", unit: "%", requires: ["dette_publique", "pib_nominal"], family: "finances_publiques", reading: "Poids de l'endettement public rapporté à la richesse produite.", compute: (s) => ratio(s.dette_publique, s.pib_nominal) },
  { id: "taux_investissement", label: "Taux d'investissement (FBCF / PIB)", formula: "FBCF ÷ PIB nominal × 100", unit: "%", requires: ["fbcf", "pib_nominal"], family: "investissement", reading: "Effort d'accumulation du capital, moteur de la croissance future (Harrod-Domar, Solow).", compute: (s) => ratio(s.fbcf, s.pib_nominal) },
  { id: "taux_epargne", label: "Taux d'épargne (épargne / PIB)", formula: "Épargne nationale ÷ PIB nominal × 100", unit: "%", requires: ["epargne", "pib_nominal"], family: "investissement", reading: "Ressources internes disponibles pour financer l'investissement.", compute: (s) => ratio(s.epargne, s.pib_nominal) },
  { id: "ide_reserves", label: "IDE rapportés aux réserves de change", formula: "IDE ÷ Réserves de change × 100", unit: "%", requires: ["ide", "reserves_change"], family: "investissement", reading: "Poids des capitaux étrangers entrants par rapport aux réserves (mêmes unités requises).", compute: (s) => ratio(s.ide, s.reserves_change) },
  { id: "part_agriculture", label: "Part de l'agriculture dans le PIB", formula: "Valeur ajoutée agricole ÷ PIB nominal × 100", unit: "%", requires: ["va_agricole", "pib_nominal"], family: "rural", reading: "Poids du secteur agricole : sa baisse progressive accompagne habituellement la transformation structurelle (Lewis).", compute: (s) => ratio(s.va_agricole, s.pib_nominal) },
  { id: "croissance_production_agricole", label: "Croissance de la production agricole", formula: "(Production t ÷ Production t−1 − 1) × 100", unit: "%", requires: ["production_agricole"], family: "rural", reading: "Dynamique de l'offre agricole.", compute: (s) => growth(s.production_agricole) },
  { id: "rendement_agricole", label: "Rendement agricole", formula: "Production agricole ÷ Superficie cultivée", unit: "par hectare", requires: ["production_agricole", "superficie_cultivee"], family: "rural", reading: "Productivité de la terre : une hausse traduit une intensification (intrants, techniques).", compute: (s) => ratio(s.production_agricole, s.superficie_cultivee, 1) },
];

export const AGGREGATE_BY_ID: Record<string, AggregateDef> = Object.fromEntries(AGGREGATES.map((a) => [a.id, a]));

/** Séries par rôle (la première série de chaque rôle). */
export function seriesByRole(dataset: MacroDataset): Record<MacroRole, Values> {
  const out = {} as Record<MacroRole, Values>;
  for (const s of dataset.series) if (s.role !== "autre" && !out[s.role]) out[s.role] = s.values;
  return out;
}

export interface ComputedAggregate {
  def: AggregateDef;
  values: Values;
}

/** Agrégats calculables avec les séries disponibles (ceux qui manquent d'une série ne sont pas proposés). */
export function computeAggregates(dataset: MacroDataset): ComputedAggregate[] {
  const byRole = seriesByRole(dataset);
  const n = dataset.periods.length;
  return AGGREGATES.filter((a) => a.requires.every((r) => byRole[r]))
    .filter((a) => !(a.id === "inflation_ipc" && byRole.inflation)) // l'inflation saisie telle quelle fait foi
    .map((def) => ({ def, values: def.compute(byRole, n).slice(0, n) }));
}

/** Agrégats qui deviendraient calculables si l'étudiant ajoutait une série (pour l'orienter). */
export function missingForAggregates(dataset: MacroDataset): Array<{ def: AggregateDef; missing: MacroRole[] }> {
  const byRole = seriesByRole(dataset);
  return AGGREGATES.map((def) => ({ def, missing: def.requires.filter((r) => !byRole[r]) })).filter((x) => x.missing.length > 0 && x.missing.length < x.def.requires.length);
}
