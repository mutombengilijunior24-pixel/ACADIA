/**
 * Référentiel SYSCOHADA révisé (Système normal) : postes du bilan, du compte de résultat et du
 * tableau des flux de trésorerie, avec leur code de référence (REF) et la formule de chaque total.
 *
 * Convention de signe (modèle interne) : chaque montant est saisi tel qu'il figure dans l'état, sans
 * signe pour les postes à sens fixe ; `sign` donne sa contribution aux totaux (+1 produit, ressource ou
 * encaissement ; −1 charge, décaissement, capital non appelé). Les postes `signed` (variations de stocks,
 * report à nouveau, résultat, flux de variation du BFR, trésorerie d'ouverture) acceptent un montant négatif.
 *
 * [À VÉRIFIER par un enseignant ou un expert-comptable] : codes REF et libellés, d'après les modèles
 * d'états financiers de l'Acte uniforme relatif au droit comptable (AUDCIF, SYSCOHADA révisé 2017).
 */

export type StatementId = "bilan" | "cr" | "tft";
export type SectionId = "actif" | "passif" | "cr" | "tft";

export interface Poste {
  /** Code de référence SYSCOHADA (deux lettres). */
  code: string;
  label: string;
  section: SectionId;
  kind: "poste" | "total";
  /** Contribution aux totaux d'un montant positif. */
  sign: 1 | -1;
  /** Le montant peut être négatif (variation, report à nouveau, résultat, flux). */
  signed?: boolean;
  /** Totaux : postes additionnés (chacun selon sa contribution). */
  sum?: string[];
  /** 0 = total général, 1 = total, 2 = poste. */
  level: 0 | 1 | 2;
  hint?: string;
}

const p = (code: string, label: string, section: SectionId, sign: 1 | -1 = 1, extra: Partial<Poste> = {}): Poste => ({ code, label, section, kind: "poste", sign, level: 2, ...extra });
const t = (code: string, label: string, section: SectionId, sum: string[], level: 0 | 1 = 1, extra: Partial<Poste> = {}): Poste => ({ code, label, section, kind: "total", sign: 1, signed: true, sum, level, ...extra });

export const SECTION_LABELS: Record<SectionId, string> = {
  actif: "Bilan — actif",
  passif: "Bilan — passif",
  cr: "Compte de résultat",
  tft: "Tableau des flux de trésorerie",
};

export const STATEMENT_LABELS: Record<StatementId, string> = { bilan: "Bilan", cr: "Compte de résultat", tft: "Tableau des flux de trésorerie" };

export const STATEMENT_OF: Record<SectionId, StatementId> = { actif: "bilan", passif: "bilan", cr: "cr", tft: "tft" };

/** Postes dans l'ordre des modèles officiels (l'ordre d'affichage). */
export const POSTES: Poste[] = [
  // ---------------- BILAN — ACTIF (montants nets) ----------------
  t("AD", "Immobilisations incorporelles", "actif", ["AE", "AF", "AG", "AH"]),
  p("AE", "Frais de développement et de prospection", "actif"),
  p("AF", "Brevets, licences, logiciels et droits similaires", "actif"),
  p("AG", "Fonds commercial et droit au bail", "actif"),
  p("AH", "Autres immobilisations incorporelles", "actif"),
  t("AI", "Immobilisations corporelles", "actif", ["AJ", "AK", "AL", "AM", "AN"]),
  p("AJ", "Terrains", "actif"),
  p("AK", "Bâtiments", "actif"),
  p("AL", "Aménagements, agencements et installations", "actif"),
  p("AM", "Matériel, mobilier et actifs biologiques", "actif"),
  p("AN", "Matériel de transport", "actif"),
  p("AP", "Avances et acomptes versés sur immobilisations", "actif"),
  t("AQ", "Immobilisations financières", "actif", ["AR", "AS"]),
  p("AR", "Titres de participation", "actif"),
  p("AS", "Autres immobilisations financières", "actif"),
  t("AZ", "Total actif immobilisé", "actif", ["AD", "AI", "AP", "AQ"]),
  p("BA", "Actif circulant HAO", "actif"),
  p("BB", "Stocks et encours", "actif"),
  t("BG", "Créances et emplois assimilés", "actif", ["BH", "BI", "BJ"]),
  p("BH", "Fournisseurs, avances versées", "actif"),
  p("BI", "Clients", "actif"),
  p("BJ", "Autres créances", "actif"),
  t("BK", "Total actif circulant", "actif", ["BA", "BB", "BG"]),
  p("BQ", "Titres de placement", "actif"),
  p("BR", "Valeurs à encaisser", "actif"),
  p("BS", "Banques, chèques postaux, caisse et assimilés", "actif"),
  t("BT", "Total trésorerie-actif", "actif", ["BQ", "BR", "BS"]),
  p("BU", "Écart de conversion-actif", "actif"),
  t("BZ", "Total général actif", "actif", ["AZ", "BK", "BT", "BU"], 0),

  // ---------------- BILAN — PASSIF ----------------
  p("CA", "Capital", "passif"),
  p("CB", "Apporteurs, capital non appelé (−)", "passif", -1),
  p("CD", "Primes liées au capital social", "passif"),
  p("CE", "Écarts de réévaluation", "passif"),
  p("CF", "Réserves indisponibles", "passif"),
  p("CG", "Réserves libres", "passif"),
  p("CH", "Report à nouveau (+ ou −)", "passif", 1, { signed: true }),
  p("CJ", "Résultat net de l'exercice (bénéfice + ou perte −)", "passif", 1, { signed: true }),
  p("CL", "Subventions d'investissement", "passif"),
  p("CM", "Provisions réglementées", "passif"),
  t("CP", "Total capitaux propres et ressources assimilées", "passif", ["CA", "CB", "CD", "CE", "CF", "CG", "CH", "CJ", "CL", "CM"]),
  p("DA", "Emprunts et dettes financières diverses", "passif"),
  p("DB", "Dettes de location-acquisition", "passif"),
  p("DC", "Provisions pour risques et charges", "passif"),
  t("DD", "Total dettes financières et ressources assimilées", "passif", ["DA", "DB", "DC"]),
  t("DF", "Total ressources stables", "passif", ["CP", "DD"]),
  p("DH", "Dettes circulantes HAO", "passif"),
  p("DI", "Clients, avances reçues", "passif"),
  p("DJ", "Fournisseurs d'exploitation", "passif"),
  p("DK", "Dettes fiscales et sociales", "passif"),
  p("DM", "Autres dettes", "passif"),
  p("DN", "Provisions pour risques à court terme", "passif"),
  t("DP", "Total passif circulant", "passif", ["DH", "DI", "DJ", "DK", "DM", "DN"]),
  p("DQ", "Banques, crédits d'escompte", "passif"),
  p("DR", "Banques, établissements financiers et crédits de trésorerie", "passif"),
  t("DT", "Total trésorerie-passif", "passif", ["DQ", "DR"]),
  p("DV", "Écart de conversion-passif", "passif"),
  t("DZ", "Total général passif", "passif", ["DF", "DP", "DT", "DV"], 0),

  // ---------------- COMPTE DE RÉSULTAT ----------------
  p("TA", "Ventes de marchandises", "cr"),
  p("RA", "Achats de marchandises", "cr", -1),
  p("RB", "Variation de stocks de marchandises", "cr", -1, { signed: true, hint: "Stock initial − stock final (négatif si le stock augmente)." }),
  t("XA", "Marge commerciale", "cr", ["TA", "RA", "RB"]),
  p("TB", "Ventes de produits fabriqués", "cr"),
  p("TC", "Travaux, services vendus", "cr"),
  p("TD", "Produits accessoires", "cr"),
  t("XB", "Chiffre d'affaires", "cr", ["TA", "TB", "TC", "TD"]),
  p("TE", "Production stockée (ou déstockage)", "cr", 1, { signed: true }),
  p("TF", "Production immobilisée", "cr"),
  p("TG", "Subventions d'exploitation", "cr"),
  p("TH", "Autres produits", "cr"),
  p("TI", "Transferts de charges d'exploitation", "cr"),
  p("RC", "Achats de matières premières et fournitures liées", "cr", -1),
  p("RD", "Variation de stocks de matières premières et fournitures liées", "cr", -1, { signed: true }),
  p("RE", "Autres achats", "cr", -1),
  p("RF", "Variation de stocks d'autres approvisionnements", "cr", -1, { signed: true }),
  p("RG", "Transports", "cr", -1),
  p("RH", "Services extérieurs", "cr", -1),
  p("RI", "Impôts et taxes", "cr", -1),
  p("RJ", "Autres charges", "cr", -1),
  t("XC", "Valeur ajoutée", "cr", ["XB", "RA", "RB", "TE", "TF", "TG", "TH", "TI", "RC", "RD", "RE", "RF", "RG", "RH", "RI", "RJ"]),
  p("RK", "Charges de personnel", "cr", -1),
  t("XD", "Excédent brut d'exploitation (EBE)", "cr", ["XC", "RK"]),
  p("TJ", "Reprises d'amortissements, provisions et dépréciations", "cr"),
  p("RL", "Dotations aux amortissements, aux provisions et dépréciations", "cr", -1),
  t("XE", "Résultat d'exploitation", "cr", ["XD", "TJ", "RL"]),
  p("TK", "Revenus financiers et assimilés", "cr"),
  p("TL", "Reprises de provisions et dépréciations financières", "cr"),
  p("TM", "Transferts de charges financières", "cr"),
  p("RM", "Frais financiers et charges assimilées", "cr", -1),
  p("RN", "Dotations aux provisions et aux dépréciations financières", "cr", -1),
  t("XF", "Résultat financier", "cr", ["TK", "TL", "TM", "RM", "RN"]),
  t("XG", "Résultat des activités ordinaires (RAO)", "cr", ["XE", "XF"]),
  p("TN", "Produits des cessions d'immobilisations", "cr"),
  p("TO", "Autres produits HAO", "cr"),
  p("RO", "Valeurs comptables des cessions d'immobilisations", "cr", -1),
  p("RP", "Autres charges HAO", "cr", -1),
  t("XH", "Résultat hors activités ordinaires (HAO)", "cr", ["TN", "TO", "RO", "RP"]),
  p("RQ", "Participation des travailleurs", "cr", -1),
  p("RS", "Impôts sur le résultat", "cr", -1),
  t("XI", "Résultat net", "cr", ["XG", "XH", "RQ", "RS"], 0),

  // ---------------- TABLEAU DES FLUX DE TRÉSORERIE ----------------
  p("ZA", "Trésorerie nette au 1er janvier (trésorerie-actif N−1 − trésorerie-passif N−1)", "tft", 1, { signed: true }),
  p("FA", "Capacité d'autofinancement globale (CAFG)", "tft", 1, { signed: true }),
  p("FB", "− Variation de l'actif circulant HAO", "tft", 1, { signed: true, hint: "Effet sur la trésorerie (négatif si l'actif augmente)." }),
  p("FC", "− Variation des stocks", "tft", 1, { signed: true, hint: "Effet sur la trésorerie (négatif si les stocks augmentent)." }),
  p("FD", "− Variation des créances", "tft", 1, { signed: true, hint: "Effet sur la trésorerie (négatif si les créances augmentent)." }),
  p("FE", "+ Variation du passif circulant", "tft", 1, { signed: true, hint: "Effet sur la trésorerie (positif si les dettes augmentent)." }),
  t("ZB", "Flux de trésorerie provenant des activités opérationnelles", "tft", ["FA", "FB", "FC", "FD", "FE"]),
  p("FF", "Décaissements liés aux acquisitions d'immobilisations incorporelles", "tft", -1),
  p("FG", "Décaissements liés aux acquisitions d'immobilisations corporelles", "tft", -1),
  p("FH", "Décaissements liés aux acquisitions d'immobilisations financières", "tft", -1),
  p("FI", "Encaissements liés aux cessions d'immobilisations incorporelles et corporelles", "tft"),
  p("FJ", "Encaissements liés aux cessions d'immobilisations financières", "tft"),
  t("ZC", "Flux de trésorerie provenant des activités d'investissement", "tft", ["FF", "FG", "FH", "FI", "FJ"]),
  p("FK", "Augmentations de capital par apports nouveaux", "tft"),
  p("FL", "Subventions d'investissement reçues", "tft"),
  p("FM", "Prélèvements sur le capital", "tft", -1),
  p("FN", "Dividendes versés", "tft", -1),
  t("ZD", "Flux de trésorerie provenant des capitaux propres", "tft", ["FK", "FL", "FM", "FN"]),
  p("FO", "Emprunts", "tft"),
  p("FP", "Autres dettes financières", "tft"),
  p("FQ", "Remboursements des emprunts et autres dettes financières", "tft", -1),
  t("ZE", "Flux de trésorerie provenant des capitaux étrangers", "tft", ["FO", "FP", "FQ"]),
  t("ZF", "Flux de trésorerie provenant des activités de financement", "tft", ["ZD", "ZE"]),
  t("ZG", "Variation de la trésorerie nette de la période", "tft", ["ZB", "ZC", "ZF"]),
  t("ZH", "Trésorerie nette au 31 décembre", "tft", ["ZA", "ZG"], 0),
];

export const POSTE_BY_CODE: Record<string, Poste> = Object.fromEntries(POSTES.map((poste) => [poste.code, poste]));

export const postesOf = (section: SectionId): Poste[] => POSTES.filter((poste) => poste.section === section);

export const statementOf = (code: string): StatementId | null => {
  const poste = POSTE_BY_CODE[code];
  return poste ? STATEMENT_OF[poste.section] : null;
};

/** Postes élémentaires (non totaux) sous un total, récursivement. */
export function leavesOf(code: string): string[] {
  const poste = POSTE_BY_CODE[code];
  if (!poste) return [];
  if (poste.kind === "poste") return [code];
  return (poste.sum ?? []).flatMap(leavesOf);
}
