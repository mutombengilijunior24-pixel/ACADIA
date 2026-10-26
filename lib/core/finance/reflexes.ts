/**
 * Les réflexes du financier : ce qu'un analyste expérimenté vérifierait en premier en découvrant ces
 * états. Déclenchés par les chiffres (règles explicites), classés par gravité, rattachés à des familles
 * d'indicateurs pour être ciblés selon le sujet de l'étudiant. Ce sont des pistes à vérifier, jamais
 * des conclusions.
 */
import type { FinanceComputation } from "./compute";
import { formatValue } from "./format";
import type { FamilyId } from "./indicators/types";
import type { FinanceDossier, FinanceProvenanceKind } from "./types";

export type ReflexSeverity = "critique" | "important" | "info";

export const SEVERITY_LABELS: Record<ReflexSeverity, string> = { critique: "Alerte", important: "À vérifier", info: "Bon réflexe" };

export interface Reflex {
  id: string;
  severity: ReflexSeverity;
  families: FamilyId[];
  title: string;
  /** Ce qu'il faut vérifier, avec les chiffres. */
  text: string;
  /** Où chercher l'information. */
  where: string;
}

const ORDER: Record<ReflexSeverity, number> = { critique: 0, important: 1, info: 2 };
/** À gravité égale, les signaux les plus parlants d'abord. */
const PRIORITY = ["cp_negatifs", "cp_demi_capital", "ebe_negatif", "tn_negative", "delai_clients", "levier_negatif", "resultat_hao", "capacite_remb", "ciseaux", "dettes_fiscales", "benefice_sans_tresorerie", "lg_trompeuse", "dr_recurrent", "delai_stocks", "cafg_ecart", "ecarts_acceptes", "fournisseurs_pressent", "dotations_baisse", "inflation", "tft_absent", "un_exercice", "non_audites"];
const priority = (id: string) => (PRIORITY.includes(id) ? PRIORITY.indexOf(id) : PRIORITY.length);

export function financeReflexes(computation: FinanceComputation, dossier: FinanceDossier, context: { provenance: FinanceProvenanceKind | null; acceptedGaps: number }): Reflex[] {
  const { exercises, series, values } = computation;
  if (!exercises.length) return [];
  const last = exercises.length - 1;
  const lastLabel = exercises[last].label;
  const firstLabel = exercises[0].label;
  const at = (id: string, index = last) => series[id]?.values[index]?.value ?? null;
  const firstOf = (id: string) => {
    const i = series[id]?.values.findIndex((v) => v.value !== null) ?? -1;
    return i >= 0 && i < last ? { value: series[id].values[i].value!, label: exercises[i].label } : null;
  };
  const fmt = (id: string, value: number | null) => formatValue(value, series[id].def.unit, dossier.company);
  const money = (value: number | null) => formatValue(value, "montant", dossier.company);
  const poste = (code: string, index = last) => values[index]?.[code]?.value ?? null;
  const out: Reflex[] = [];
  const add = (r: Reflex) => out.push(r);

  // --- Alertes critiques ---
  const cp = poste("CP");
  const capital = poste("CA");
  if (cp !== null && cp <= 0)
    add({ id: "cp_negatifs", severity: "critique", families: ["solvabilite"], title: "Capitaux propres négatifs", text: `Les capitaux propres sont négatifs ou nuls en ${lastLabel} (${money(cp)}) : les dettes dépassent l'actif. Vérifiez si la continuité de l'exploitation est assurée (soutien des associés, recapitalisation).`, where: "Procès-verbaux d'assemblée générale, rapport du commissaire aux comptes, annexe des états financiers." });
  else if (cp !== null && capital && capital > 0 && cp < capital / 2)
    add({ id: "cp_demi_capital", severity: "critique", families: ["solvabilite"], title: "Capitaux propres inférieurs à la moitié du capital", text: `En ${lastLabel}, les capitaux propres (${money(cp)}) sont inférieurs à la moitié du capital (${money(capital)}). Le droit OHADA impose aux associés de se prononcer sur la dissolution anticipée ou la reconstitution des capitaux propres [À VÉRIFIER : articles de l'AUSCGIE].`, where: "Procès-verbaux d'assemblée générale, statuts." });
  const ebe = poste("XD");
  if (ebe !== null && ebe < 0) add({ id: "ebe_negatif", severity: "critique", families: ["rentabilite", "sig"], title: "Excédent brut d'exploitation négatif", text: `En ${lastLabel}, l'exploitation elle-même perd de l'argent avant amortissements et intérêts (EBE ${money(ebe)}). Identifiez les charges qui ont dérapé (achats, personnel, services) et l'évolution des prix de vente.`, where: "Compte de résultat détaillé, grand livre des charges, grille tarifaire." });

  // --- Trésorerie et équilibre ---
  const tn = at("tn");
  if (tn !== null && tn < 0) {
    const tn0 = firstOf("tn");
    add({ id: "tn_negative", severity: tn0 && tn0.value > 0 ? "critique" : "important", families: ["equilibre", "liquidite", "flux"], title: "Trésorerie nette négative", text: `La trésorerie nette est de ${fmt("tn", tn)} en ${lastLabel}${tn0 ? ` (contre ${fmt("tn", tn0.value)} en ${tn0.label})` : ""} : l'entreprise fonctionne grâce à des crédits bancaires à court terme. Vérifiez le montant autorisé, le taux, les garanties et l'échéance de ces crédits.`, where: "Relevés et conventions bancaires (découverts, crédits de trésorerie), poste DR du bilan." });
  }
  const drYears = exercises.filter((_, i) => (poste("DR", i) ?? 0) > 0).length;
  if (drYears >= 2) add({ id: "dr_recurrent", severity: "important", families: ["equilibre", "liquidite", "solvabilite"], title: "Crédits de trésorerie récurrents", text: `Des crédits de trésorerie figurent au bilan sur ${drYears} exercices : le cycle d'exploitation est durablement financé à court terme, ce qui est coûteux et fragile (la banque peut les retirer). Une consolidation à moyen terme serait-elle plus adaptée ?`, where: "Conventions bancaires, tableau des emprunts." });
  const lg = at("lg");
  if (lg !== null && series.lg.values[last].zone === "favorable" && tn !== null && tn < 0)
    add({ id: "lg_trompeuse", severity: "important", families: ["liquidite", "activite"], title: "Une liquidité générale trompeuse", text: `La liquidité générale paraît bonne (${fmt("lg", lg)} en ${lastLabel}) alors que la trésorerie est négative : la liquidité est immobilisée dans les stocks et les créances clients. Vérifiez qu'ils sont réellement réalisables (stocks vendables, clients solvables).`, where: "Inventaire des stocks, balance âgée des clients." });
  const ciseaux = at("ciseaux");
  if (ciseaux !== null && ciseaux > 0.1)
    add({ id: "ciseaux", severity: "important", families: ["equilibre", "activite", "croissance"], title: "Effet ciseaux", text: `En ${lastLabel}, le besoin de financement d'exploitation progresse de ${formatValue(ciseaux, "points")} de plus que le chiffre d'affaires : la croissance consomme la trésorerie. Rapprochez l'évolution des stocks et des créances de celle des ventes.`, where: "Bilans successifs (stocks, clients), conditions de vente." });
  const flux = at("flux_op");
  const rn = poste("XI");
  if (flux !== null && flux < 0 && rn !== null && rn > 0)
    add({ id: "benefice_sans_tresorerie", severity: "important", families: ["flux", "rentabilite", "equilibre"], title: "Un bénéfice qui ne se transforme pas en trésorerie", text: `En ${lastLabel}, l'entreprise est bénéficiaire (${money(rn)}) mais son activité consomme de la trésorerie (flux opérationnels ${fmt("flux_op", flux)}) : le bénéfice est absorbé par le cycle d'exploitation.`, where: "Tableau des flux de trésorerie (lignes FB à FE)." });

  // --- Cycle d'exploitation ---
  const trend = (id: string, threshold: number) => {
    const first = firstOf(id);
    const now = at(id);
    return first && now !== null && now - first.value > threshold ? { first, now } : null;
  };
  const clients = trend("delai_clients", 10);
  if (clients)
    add({ id: "delai_clients", severity: "important", families: ["activite", "liquidite"], title: "Les clients paient de plus en plus tard", text: `Le délai clients passe de ${fmt("delai_clients", clients.first.value)} en ${clients.first.label} à ${fmt("delai_clients", clients.now)} en ${lastLabel}. Demandez la balance âgée : quelle part des créances a plus de 90 jours ? Des créances douteuses ont-elles été dépréciées ? La politique de crédit a-t-elle changé pour soutenir les ventes ?`, where: "Balance âgée des clients, état des créances douteuses, conditions générales de vente." });
  const stocks = trend("delai_stocks", 10);
  if (stocks)
    add({ id: "delai_stocks", severity: "important", families: ["activite"], title: "Des stocks qui s'alourdissent", text: `Le délai de rotation des stocks passe de ${fmt("delai_stocks", stocks.first.value)} à ${fmt("delai_stocks", stocks.now)} : produits lents ou invendables ? Achats anticipés ? Vérifiez l'inventaire et la méthode de valorisation.`, where: "Inventaire détaillé, méthode d'évaluation des stocks (annexe)." });
  const fournisseurs = firstOf("delai_fournisseurs");
  const fNow = at("delai_fournisseurs");
  if (fournisseurs && fNow !== null && fournisseurs.value - fNow > 5 && clients)
    add({ id: "fournisseurs_pressent", severity: "info", families: ["activite", "liquidite"], title: "Les fournisseurs se font payer plus vite", text: `Le délai fournisseurs passe de ${fmt("delai_fournisseurs", fournisseurs.value)} à ${fmt("delai_fournisseurs", fNow)} pendant que les clients paient plus tard : l'entreprise finance l'écart. Les fournisseurs ont-ils réduit leur crédit (perte de confiance) ?`, where: "Échanges avec les fournisseurs, conditions d'achat." });

  // --- Rentabilité ---
  const hao = at("poids_hao");
  if (hao !== null && hao > 0.3)
    add({ id: "resultat_hao", severity: "important", families: ["rentabilite", "sig"], title: "Un résultat porté par des opérations exceptionnelles", text: `Le résultat net de ${lastLabel} repose pour ${fmt("poids_hao", hao)} sur des opérations hors activités ordinaires (cessions d'immobilisations…). La performance courante (résultat des activités ordinaires) est plus faible qu'il n'y paraît, et ce gain ne se reproduira pas.`, where: "Compte de résultat (TN, TO, RO, RP), annexe sur les cessions." });
  const levier = at("levier_ecart");
  if (levier !== null && levier < 0)
    add({ id: "levier_negatif", severity: "important", families: ["rentabilite", "solvabilite"], title: "Effet de levier négatif", text: `En ${lastLabel}, la dette coûte plus que ce que rapporte l'outil économique (écart ${fmt("levier_ecart", levier)}) : chaque franc emprunté réduit la rentabilité des associés. Vérifiez les taux des emprunts et l'usage des fonds empruntés.`, where: "Contrats de prêt, tableau des emprunts (taux, échéances)." });
  const cafg = at("cafg");
  const cafgAdd = at("cafg_additive");
  if (cafg !== null && cafgAdd !== null && Math.abs(cafg - cafgAdd) > Math.max(1, Math.abs(cafg) * 0.01))
    add({ id: "cafg_ecart", severity: "important", families: ["caf"], title: "Les deux calculs de la CAF divergent", text: `CAF à partir de l'EBE : ${money(cafg)} ; méthode additive : ${money(cafgAdd)}. Vérifiez la saisie des dotations, des reprises et des cessions (TJ, RL, TL, RN, TN, RO).`, where: "Compte de résultat, tableau des amortissements et provisions." });
  const rl = poste("RL");
  const rl0 = poste("RL", 0);
  const az = poste("AZ");
  const az0 = poste("AZ", 0);
  if (last > 0 && rl !== null && rl0 !== null && az !== null && az0 !== null && rl < rl0 * 0.9 && az > az0)
    add({ id: "dotations_baisse", severity: "info", families: ["rentabilite", "sig"], title: "Des dotations en baisse", text: `Les dotations aux amortissements et provisions baissent (${money(rl0)} → ${money(rl)}) alors que les immobilisations augmentent : changement de méthode ou résultat flatté ?`, where: "Tableau des amortissements, annexe (méthodes comptables)." });

  // --- Solvabilité ---
  const remb = at("capacite_remb");
  if (remb !== null && remb > 5)
    add({ id: "capacite_remb", severity: "important", families: ["solvabilite", "caf"], title: "Des dettes lourdes au regard de l'autofinancement", text: `Il faudrait ${fmt("capacite_remb", remb)} de capacité d'autofinancement pour rembourser les dettes financières en ${lastLabel}. Vérifiez l'échéancier des emprunts et la capacité à honorer les prochaines échéances.`, where: "Tableau des emprunts, contrats de prêt." });
  const dk = series.croissance_dettes_fiscales;
  const dkFirst = poste("DK", 0);
  const dkLast = poste("DK");
  const caFirst = poste("XB", 0);
  const caLast = poste("XB");
  if (dk && last > 0 && dkFirst && dkLast && caFirst && caLast && dkLast / dkFirst - 1 > 0.3 && dkLast / dkFirst > caLast / caFirst)
    add({ id: "dettes_fiscales", severity: "important", families: ["solvabilite", "activite"], title: "Des dettes fiscales et sociales en forte hausse", text: `Les dettes fiscales et sociales passent de ${money(dkFirst)} en ${firstLabel} à ${money(dkLast)} en ${lastLabel} (+${Math.round((dkLast / dkFirst - 1) * 100)} %), plus vite que l'activité : arriérés d'impôts ou de cotisations ? Pénalités et redressements possibles.`, where: "Avis d'imposition, attestations fiscales et sociales (DGI, CNSS), échéanciers de paiement." });

  // --- Bons réflexes de méthode ---
  if (dossier.company.currency === "CDF" && exercises.length > 1)
    add({ id: "inflation", severity: "info", families: ["croissance", "rentabilite", "activite"], title: "Des montants en francs congolais courants", text: "Les montants sont en CDF nominaux : une partie de la croissance peut refléter l'inflation et la dépréciation du franc congolais. Comparez aussi en USD (au taux de change de clôture) ou en termes réels avant de conclure à une croissance de l'activité.", where: "Taux de change et indices des prix publiés par la Banque centrale du Congo." });
  if (!exercises.some((e) => Object.keys(dossier.values[e.id] ?? {}).some((code) => /^[FZ]/.test(code))))
    add({ id: "tft_absent", severity: "info", families: ["flux", "caf"], title: "Demandez le tableau des flux de trésorerie", text: "Sans tableau des flux de trésorerie, on ne voit pas d'où vient ni où va l'argent (activité, investissements, financement). Demandez-le à l'entreprise : il fait partie des états financiers du Système normal.", where: "Service comptable de l'entreprise." });
  if (exercises.length === 1) add({ id: "un_exercice", severity: "info", families: ["croissance"], title: "Un seul exercice", text: "Avec un seul exercice, aucune évolution ne peut être observée. Demandez au moins deux ou trois exercices successifs pour juger d'une tendance.", where: "Service comptable de l'entreprise, greffe du tribunal de commerce." });
  if (context.provenance === "internes" || context.provenance === "reconstitues")
    add({ id: "non_audites", severity: "info", families: [], title: "Des états non audités", text: "Ces états n'ont pas été audités : présentez vos conclusions avec prudence et indiquez cette limite dans votre méthodologie.", where: "Rapport du commissaire aux comptes, s'il existe." });
  if (context.acceptedGaps > 0)
    add({ id: "ecarts_acceptes", severity: "important", families: [], title: "Des écarts comptables acceptés", text: `${context.acceptedGaps} écart(s) comptable(s) ont été acceptés lors de la vérification des chiffres : les indicateurs concernés en héritent ; mentionnez-le dans les limites de votre étude.`, where: "Document d'origine, service comptable." });

  return out.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || priority(a.id) - priority(b.id));
}
