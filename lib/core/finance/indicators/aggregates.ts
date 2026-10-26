/**
 * Agrégats nommés utilisés dans les formules (lisibles, partagés, testés). Un nom d'agrégat n'est
 * jamais un code REF du référentiel (« TN » est le poste des produits de cession, « CE » celui des écarts
 * de réévaluation) : un test d'intégrité l'interdit.
 * Montants « tels qu'on les lit » dans les états (convention du référentiel : charges sans signe).
 *
 * [À VÉRIFIER] CAFG : méthode « à partir de l'EBE » et méthode additive, placement des dotations et
 * reprises HAO (comptes 85/86 dans RP/TO), d'après le guide d'application du SYSCOHADA révisé.
 */
export const AGGREGATES: Record<string, { label: string; formula: string }> = {
  FR: { label: "Fonds de roulement net global", formula: "DF - AZ" },
  BF: { label: "Besoin de financement global", formula: "BK + BU - DP - DV" },
  BFE: { label: "Besoin de financement d'exploitation", formula: "BK - BA - (DP - DH)" },
  BFHAO: { label: "Besoin de financement hors activités ordinaires", formula: "BA - DH" },
  TRESO_NETTE: { label: "Trésorerie nette", formula: "BT - DT" },
  DETTES_FIN: { label: "Dettes financières (emprunts et location-acquisition)", formula: "DA + DB" },
  DETTES_NETTES: { label: "Endettement net (dettes financières + trésorerie-passif − trésorerie-actif)", formula: "DA + DB + DT - BT" },
  DETTES_TOTALES: { label: "Total des dettes et provisions (total passif − capitaux propres)", formula: "DZ - CP" },
  CAFG: { label: "Capacité d'autofinancement globale (à partir de l'EBE)", formula: "XD + TK + TM + TO - RM - RP - RQ - RS" },
  CAFG_ADD: { label: "Capacité d'autofinancement globale (méthode additive)", formula: "XI + RL + RN - TJ - TL + RO - TN" },
  CMV: { label: "Coût d'achat des marchandises vendues", formula: "RA + RB" },
  CONSO: { label: "Achats consommés (marchandises et matières)", formula: "RA + RB + RC + RD" },
  ACHATS_BS: { label: "Achats de biens et services", formula: "RA + RC + RE + RG + RH" },
  CHARGES_DEC: { label: "Charges décaissables de l'exercice", formula: "RA + RC + RE + RG + RH + RI + RJ + RK + RM" },
  PRODUCTION: { label: "Production de l'exercice", formula: "TB + TC + TD + TE + TF" },
  CAP_ECO: { label: "Capital économique (actif immobilisé + besoin de financement d'exploitation)", formula: "AZ + BFE" },
  RE_NETTE: { label: "Résultat d'exploitation après impôt théorique", formula: "XE * (1 - taux_is)" },
  INVEST: { label: "Investissements de l'exercice (TFT)", formula: "FF + FG + FH" },
};

/** Paramètres (modifiables et toujours affichés). [À VÉRIFIER] taux en vigueur en RDC. */
export interface FinanceParams {
  /** Taux de TVA pour passer les ventes et achats en TTC (délais clients et fournisseurs). */
  tva: number;
  /** Taux de l'impôt sur les bénéfices (rentabilité économique nette, effet de levier). */
  taux_is: number;
}

export const DEFAULT_PARAMS: FinanceParams = { tva: 0.16, taux_is: 0.3 };

export const PARAM_LABELS: Record<keyof FinanceParams | "jours", string> = {
  tva: "taux de TVA",
  taux_is: "taux de l'impôt sur les bénéfices",
  jours: "nombre de jours de l'exercice (mois × 30)",
};
