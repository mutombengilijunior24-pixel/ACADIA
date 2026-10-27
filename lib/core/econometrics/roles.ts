/**
 * Rôles macroéconomiques des séries : libellé, unité usuelle et mots qui permettent de reconnaître une
 * colonne importée (« PIB nominal », « M2 », « Taux de change »…). La reconnaissance est proposée, jamais
 * imposée : l'étudiant confirme le rôle de chaque série.
 */
import type { MacroRole } from "./types";

export interface RoleInfo {
  role: MacroRole;
  label: string;
  unitHint: string;
  /** Expressions repérées dans l'en-tête (minuscules, sans accents), la plus longue l'emporte. */
  aliases: string[];
}

export const ROLES: RoleInfo[] = [
  { role: "pib_nominal", label: "PIB nominal (prix courants)", unitHint: "milliards de CDF", aliases: ["pib nominal", "pib courant", "pib a prix courants", "produit interieur brut nominal", "pib en valeur", "pibn", "gdp current"] },
  { role: "pib_reel", label: "PIB réel (prix constants)", unitHint: "milliards de CDF constants", aliases: ["pib reel", "pib constant", "pib a prix constants", "pib en volume", "produit interieur brut reel", "pibr", "gdp constant", "real gdp", "pib"] },
  { role: "ipc", label: "Indice des prix à la consommation (IPC)", unitHint: "indice (base 100)", aliases: ["indice des prix a la consommation", "indice des prix", "ipc", "cpi"] },
  { role: "inflation", label: "Taux d'inflation", unitHint: "%", aliases: ["taux d'inflation", "inflation"] },
  { role: "deflateur", label: "Déflateur du PIB", unitHint: "indice (base 100)", aliases: ["deflateur du pib", "deflateur"] },
  { role: "m2", label: "Masse monétaire M2", unitHint: "milliards de CDF", aliases: ["masse monetaire m2", "masse monetaire", "m2", "monnaie au sens large", "broad money"] },
  { role: "m1", label: "Masse monétaire M1", unitHint: "milliards de CDF", aliases: ["masse monetaire m1", "m1"] },
  { role: "base_monetaire", label: "Base monétaire", unitHint: "milliards de CDF", aliases: ["base monetaire", "monnaie centrale", "m0"] },
  { role: "credit_prive", label: "Crédit à l'économie (secteur privé)", unitHint: "milliards de CDF", aliases: ["credit au secteur prive", "credit a l'economie", "credit prive", "credits a l'economie", "credit bancaire", "credit"] },
  { role: "taux_change", label: "Taux de change (monnaie nationale pour 1 USD)", unitHint: "CDF pour 1 USD", aliases: ["taux de change", "cours de change", "change", "cdf/usd", "usd/cdf", "exchange rate"] },
  { role: "taux_directeur", label: "Taux directeur de la banque centrale", unitHint: "%", aliases: ["taux directeur", "taux de la banque centrale", "taux bcc", "policy rate"] },
  { role: "taux_interet", label: "Taux d'intérêt (débiteur ou créditeur)", unitHint: "%", aliases: ["taux d'interet", "taux debiteur", "taux crediteur", "taux preteur", "lending rate", "interest rate"] },
  { role: "exportations", label: "Exportations", unitHint: "milliards de CDF", aliases: ["exportations", "exports", "export"] },
  { role: "importations", label: "Importations", unitHint: "milliards de CDF", aliases: ["importations", "imports", "import"] },
  { role: "recettes_publiques", label: "Recettes publiques", unitHint: "milliards de CDF", aliases: ["recettes publiques", "recettes de l'etat", "recettes fiscales", "recettes"] },
  { role: "depenses_publiques", label: "Dépenses publiques", unitHint: "milliards de CDF", aliases: ["depenses publiques", "depenses de l'etat", "depenses du gouvernement", "depenses"] },
  { role: "dette_publique", label: "Dette publique", unitHint: "milliards de CDF", aliases: ["dette publique", "encours de la dette", "dette exterieure", "dette"] },
  { role: "reserves_change", label: "Réserves de change", unitHint: "millions d'USD", aliases: ["reserves de change", "reserves internationales", "avoirs exterieurs", "reserves"] },
  { role: "ide", label: "Investissements directs étrangers (IDE)", unitHint: "millions d'USD", aliases: ["investissements directs etrangers", "investissement direct etranger", "ide", "fdi"] },
  { role: "fbcf", label: "Investissement (FBCF)", unitHint: "milliards de CDF", aliases: ["formation brute de capital fixe", "fbcf", "investissement", "investissements"] },
  { role: "epargne", label: "Épargne nationale", unitHint: "milliards de CDF", aliases: ["epargne nationale", "epargne"] },
  { role: "consommation", label: "Consommation finale", unitHint: "milliards de CDF", aliases: ["consommation finale", "consommation des menages", "consommation"] },
  { role: "population", label: "Population", unitHint: "millions d'habitants", aliases: ["population", "habitants"] },
  { role: "va_agricole", label: "Valeur ajoutée agricole", unitHint: "milliards de CDF", aliases: ["valeur ajoutee agricole", "va agricole", "pib agricole", "secteur agricole"] },
  { role: "production_agricole", label: "Production agricole", unitHint: "tonnes", aliases: ["production agricole", "production de mais", "production de manioc", "production vivriere", "production"] },
  { role: "superficie_cultivee", label: "Superficie cultivée", unitHint: "hectares", aliases: ["superficie cultivee", "superficie emblavee", "superficie", "hectares"] },
  { role: "prix_agricole", label: "Prix agricole", unitHint: "CDF par kg", aliases: ["prix au producteur", "prix agricole", "prix du mais", "prix"] },
  { role: "transferts", label: "Transferts des migrants", unitHint: "millions d'USD", aliases: ["transferts des migrants", "transferts de fonds", "remittances", "transferts"] },
  { role: "aide_exterieure", label: "Aide publique au développement", unitHint: "millions d'USD", aliases: ["aide publique au developpement", "aide exterieure", "apd", "aide"] },
  { role: "autre", label: "Autre variable", unitHint: "", aliases: [] },
];

export const ROLE_BY_ID: Record<MacroRole, RoleInfo> = Object.fromEntries(ROLES.map((r) => [r.role, r])) as Record<MacroRole, RoleInfo>;

export const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’`]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

/** Rôle probable d'un en-tête de colonne (expression la plus longue d'abord), ou « autre ». */
export function guessRole(header: string): MacroRole {
  const h = ` ${fold(header).replace(/[^a-z0-9'/ ]+/g, " ").replace(/\s+/g, " ")} `;
  let best: { role: MacroRole; length: number } | null = null;
  for (const info of ROLES) {
    for (const alias of info.aliases) {
      if (h.includes(` ${alias} `) && (!best || alias.length > best.length)) best = { role: info.role, length: alias.length };
    }
  }
  return best?.role ?? "autre";
}
