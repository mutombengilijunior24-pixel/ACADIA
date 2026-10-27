/**
 * Jeu de DÉMONSTRATION : économie IMAGINAIRE (« République fictive de Mwinda »), 2001-2024.
 * Toutes les valeurs sont FICTIVES, générées pour illustrer la démarche ; elles ne décrivent aucun pays réel
 * et sont signalées comme telles à l'écran, dans les exports et dans les noms de fichiers.
 */
import type { MacroDataset } from "./types";

export const DEMO_NOTICE = "Données FICTIVES de démonstration (économie imaginaire) : elles illustrent la démarche et ne décrivent aucun pays réel.";

const PERIODS = ["2001", "2002", "2003", "2004", "2005", "2006", "2007", "2008", "2009", "2010", "2011", "2012", "2013", "2014", "2015", "2016", "2017", "2018", "2019", "2020", "2021", "2022", "2023", "2024"];

const SERIES = [
  { id: "pib_reel", name: "PIB réel", unit: "milliards de CDF constants de 2005", role: "pib_reel" as const, values: [1600, 1695.4, 1783.7, 1887.6, 1978.5, 2060.9, 2179.6, 2275.6, 2298.8, 2420.4, 2554.7, 2682.7, 2801.7, 2964.1, 3110, 3214.1, 3376.7, 3575.3, 3730.2, 3793.9, 4005.3, 4193.8, 4380, 4610.9] },
  { id: "pib_nominal", name: "PIB nominal", unit: "milliards de CDF courants", role: "pib_nominal" as const, values: [1152, 1384.3, 1588.9, 1807.3, 2074.4, 2319.9, 2633, 3317.3, 4210.8, 4780.2, 5558.6, 6348.9, 7083.7, 8221.2, 9479.3, 11861.6, 14954, 17101.7, 19861, 23482.7, 26553.9, 30213.8, 34426.7, 39310.4] },
  { id: "ipc", name: "Indice des prix à la consommation", unit: "indice (2005 = 100)", role: "ipc" as const, values: [72, 81.6, 89.1, 95.7, 104.8, 112.6, 120.8, 145.8, 183.2, 197.5, 217.6, 236.7, 252.8, 277.4, 304.8, 369.1, 442.9, 478.3, 532.4, 619, 663, 720.4, 786, 852.6] },
  { id: "m2", name: "Masse monétaire M2", unit: "milliards de CDF", role: "m2" as const, values: [210, 253.1, 286.2, 317, 361, 409.9, 471.1, 587.1, 753.7, 868.7, 997, 1113.7, 1282.6, 1480.9, 1745.1, 2175.1, 2675.3, 2999.7, 3488.9, 4388.1, 4996.5, 5596.9, 6252.8, 7066.6] },
  { id: "taux_change", name: "Taux de change", unit: "CDF pour 1 USD", role: "taux_change" as const, values: [320, 332.1, 350.9, 366.4, 382.3, 389.7, 403.9, 491, 664, 692.3, 715.7, 756.1, 761.8, 781.2, 829.8, 978.9, 1225.4, 1250.2, 1300.4, 1441.9, 1463.8, 1515.5, 1580.9, 1595] },
  { id: "taux_directeur", name: "Taux directeur", unit: "%", role: "taux_directeur" as const, values: [18, 17.1, 16.6, 16.3, 15.8, 15.8, 15.1, 17.9, 20.4, 19.7, 18.7, 17.8, 17.1, 16.4, 16.1, 19, 20.5, 20.3, 19.9, 22.4, 21.3, 20.5, 20, 19.8] },
  { id: "exportations", name: "Exportations", unit: "milliards de CDF courants", role: "exportations" as const, values: [344.5, 436.5, 494.9, 529.8, 655.6, 721.9, 820.4, 1055.7, 1252.3, 1511.3, 1616.3, 1936.3, 2292.8, 2471.5, 2829.2, 3661.3, 4813.6, 5620.7, 6138.2, 7218.2, 8118.9, 9828.8, 10118.6, 12593.8] },
  { id: "importations", name: "Importations", unit: "milliards de CDF courants", role: "importations" as const, values: [417.6, 517.8, 567.5, 631.8, 762.4, 789.1, 900.2, 1145.6, 1446.2, 1735.7, 1980.7, 2380.8, 2570.5, 3011.1, 3624.5, 4301.4, 5442.5, 6514.7, 7071.2, 8612.2, 9556.3, 11209.9, 11280.1, 15262.7] },
  { id: "depenses", name: "Dépenses publiques", unit: "milliards de CDF courants", role: "depenses_publiques" as const, values: [179.3, 244.8, 257.8, 297.8, 333.8, 388.8, 439.2, 531.3, 685.7, 746.7, 961.9, 1115.5, 1248.8, 1382.9, 1545.9, 1893.7, 2333.4, 2915.3, 3241.3, 3722.7, 4469.7, 4877, 5731.5, 6347.2] },
  { id: "recettes", name: "Recettes publiques", unit: "milliards de CDF courants", role: "recettes_publiques" as const, values: [161.2, 190.7, 211.9, 251.3, 288.1, 318.1, 353.1, 434.2, 574.6, 626.2, 747.6, 865, 973.6, 1026.8, 1336.9, 1559.8, 1903.3, 2261.9, 2667, 3105.5, 3427.6, 4060.5, 4497.4, 5174.9] },
  { id: "fbcf", name: "Formation brute de capital fixe", unit: "milliards de CDF courants", role: "fbcf" as const, values: [218, 255.4, 295.2, 340.1, 396.4, 435.7, 526.7, 653.8, 864, 939.1, 1166.6, 1318.1, 1444.7, 1717.6, 1945.1, 2626.5, 3233.7, 3720.3, 4167.2, 5370.6, 5969.5, 6587.6, 7655.9, 9118.2] },
  { id: "va_agricole", name: "Valeur ajoutée agricole", unit: "milliards de CDF courants", role: "va_agricole" as const, values: [283.4, 333.1, 361.7, 423.6, 457.8, 512.4, 598, 743.3, 950.1, 1074.2, 1134.5, 1311.1, 1477.1, 1725.9, 1919.4, 2372.1, 3136.1, 3340.3, 3829.1, 4679.5, 5304.2, 5674.8, 6205.9, 7091.5] },
  { id: "population", name: "Population", unit: "millions d'habitants", role: "population" as const, values: [52.4, 54, 55.7, 57.5, 59.2, 61, 63, 64.8, 66.8, 69, 71, 73.3, 75.6, 77.9, 80.2, 82.6, 85.3, 88.1, 90.7, 93.5, 96.5, 99.5, 102.5, 105.6] },
];

export function demoDataset(): MacroDataset {
  return {
    title: "Masse monétaire, change et inflation (économie fictive)",
    economy: "République fictive de Mwinda (économie imaginaire)",
    frequency: "annuelle",
    periods: [...PERIODS],
    series: SERIES.map((s) => ({ ...s, values: [...s.values] })),
    source: "Données fictives générées par ACADIA pour la démonstration",
    fictitious: true,
  };
}

/** Sujet d'exemple associé à la démonstration (fictif) : des ENTRÉES de l'étudiant, jamais des résultats. */
export const DEMO_RESEARCH = {
  title: "Masse monétaire, taux de change et inflation : cas d'une économie fictive (2001-2024)",
  mainQuestion: "Quels sont les déterminants monétaires de l'inflation dans la République fictive de Mwinda entre 2001 et 2024 ?",
  problem: "La République fictive de Mwinda (économie imaginaire) a connu des épisodes d'inflation élevée, en même temps qu'une création monétaire soutenue et des dépréciations de sa monnaie.",
  specificQuestions: "La croissance de la masse monétaire influence-t-elle l'inflation dans la République fictive de Mwinda ?\nLa dépréciation du taux de change influence-t-elle l'inflation dans la République fictive de Mwinda ?",
  generalObjective: "Analyser les déterminants monétaires de l'inflation dans la République fictive de Mwinda entre 2001 et 2024.",
  specificObjectives: "Analyser l'effet de la croissance de la masse monétaire sur l'inflation.\nAnalyser l'effet de la dépréciation du taux de change sur l'inflation.",
  hypotheses: "La hausse de la masse monétaire entraîne une hausse de l'inflation.\nLa dépréciation du taux de change entraîne une hausse de l'inflation.",
  population: "République fictive de Mwinda (économie imaginaire)",
  field: "Économie monétaire",
  period: "2001-2024",
};
