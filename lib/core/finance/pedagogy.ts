/**
 * Comprendre et défendre son travail à l'oral, même sans formation comptable :
 *  - un lexique en mots simples (avec le code SYSCOHADA du poste concerné) ;
 *  - « l'essentiel à dire » en quelques phrases, à la première personne, avec les chiffres ;
 *  - les questions probables du jury et des réponses chiffrées, tirées des calculs d'ACADIA.
 * Tout est déduit des résultats : aucune phrase ne cite un chiffre qui n'a pas été calculé.
 */
import type { CheckResult } from "./checks";
import type { FinanceComputation } from "./compute";
import type { Diagnosis } from "./diagnosis";
import { explainIndicator } from "./explain";
import { currencySuffix, formatValue } from "./format";
import type { FinanceReasoning } from "./research/interpret";
import type { HypothesisResult } from "./research/evaluate";
import type { LinkStructure } from "./research/structure";
import { FINANCE_PROVENANCE_LABELS, type FinanceDossier, type FinanceProvenanceKind } from "./types";

export interface GlossaryEntry {
  term: string;
  plain: string;
}

/** Lexique en mots simples. */
export const GLOSSARY: GlossaryEntry[] = [
  { term: "Exercice", plain: "Une année comptable (en général du 1er janvier au 31 décembre). Les états financiers sont établis à la fin de chaque exercice." },
  { term: "SYSCOHADA révisé", plain: "Le plan comptable commun aux pays de l'OHADA, dont la RDC : il fixe la forme du bilan, du compte de résultat et du tableau des flux, et les codes des postes (AD, BB, CP, XI…)." },
  { term: "Bilan", plain: "La photographie de l'entreprise à la date de clôture : à gauche ce qu'elle possède (actif), à droite comment c'est financé (passif). Le total de l'actif est toujours égal au total du passif." },
  { term: "Actif immobilisé (AZ)", plain: "Les biens durables : terrains, bâtiments, matériel, camions. Ils servent plusieurs années." },
  { term: "Actif circulant (BK)", plain: "Ce qui tourne avec l'activité : les stocks (BB) et les créances, surtout ce que les clients doivent encore (BI)." },
  { term: "Trésorerie-actif (BT)", plain: "L'argent disponible : caisse et comptes en banque." },
  { term: "Capitaux propres (CP)", plain: "L'argent des propriétaires : le capital apporté plus les bénéfices laissés dans l'entreprise (réserves, résultat)." },
  { term: "Dettes financières (DA, DB)", plain: "Les emprunts à plus d'un an (banques, location-acquisition)." },
  { term: "Passif circulant (DP)", plain: "Les dettes de l'activité courante : fournisseurs (DJ), impôts et cotisations (DK), autres dettes." },
  { term: "Trésorerie-passif (DT)", plain: "Les crédits bancaires à court terme : découverts, crédits de trésorerie (DR). Ils coûtent cher et la banque peut les retirer." },
  { term: "Compte de résultat", plain: "Le film de l'année : ce que l'entreprise a vendu et produit (produits) moins ce qu'elle a dépensé (charges) donne son bénéfice ou sa perte." },
  { term: "Chiffre d'affaires (XB)", plain: "Le total des ventes de l'année." },
  { term: "Marge commerciale (XA)", plain: "Ventes de marchandises moins le coût d'achat des marchandises vendues : ce que gagne le commerçant sur ce qu'il revend." },
  { term: "Valeur ajoutée (XC)", plain: "La richesse créée par l'entreprise : ce qu'elle vend moins ce qu'elle achète à d'autres (marchandises, services)." },
  { term: "Excédent brut d'exploitation, EBE (XD)", plain: "Ce que rapporte l'activité elle-même, après les salaires mais avant l'usure du matériel (amortissements), les intérêts et l'impôt." },
  { term: "Résultat d'exploitation (XE)", plain: "L'EBE après l'usure du matériel (amortissements) : le résultat de l'activité normale." },
  { term: "Résultat financier (XF)", plain: "Les produits financiers moins les intérêts payés sur les dettes." },
  { term: "Hors activités ordinaires, HAO (XH)", plain: "Les opérations exceptionnelles, comme la vente d'un camion : elles ne se reproduisent pas chaque année." },
  { term: "Résultat net (XI)", plain: "Le bénéfice (ou la perte) final de l'année, après impôt." },
  { term: "Capacité d'autofinancement, CAF", plain: "L'argent que l'activité de l'année laisse à l'entreprise pour investir, rembourser ses emprunts ou payer des dividendes." },
  { term: "Tableau des flux de trésorerie", plain: "Il explique d'où vient l'argent et où il va : activité, investissements, financement (emprunts, associés)." },
  { term: "Fonds de roulement, FR", plain: "Ressources durables (capitaux propres + emprunts) moins immobilisations : le coussin d'argent durable qui reste pour financer l'activité courante." },
  { term: "Besoin de financement, BFR (BF, BFE)", plain: "L'argent bloqué dans l'activité : stocks + créances clients − dettes fournisseurs. Plus les clients paient tard et plus les stocks dorment, plus il est grand." },
  { term: "Trésorerie nette, TN", plain: "Trésorerie-actif moins trésorerie-passif. C'est aussi le fonds de roulement moins le besoin de financement : TN = FR − BF." },
  { term: "Ratio", plain: "Le rapport entre deux montants (une division) : il permet de comparer des années ou des entreprises de tailles différentes." },
  { term: "Repère usuel", plain: "Un seuil couramment utilisé en analyse financière pour juger un ratio. Ce n'est pas une loi : il dépend du secteur et se discute avec l'encadreur." },
  { term: "Liquidité générale", plain: "Les actifs à court terme divisés par les dettes à court terme : au-dessus de 1, l'entreprise peut en principe payer ce qu'elle doit à court terme." },
  { term: "Autonomie financière", plain: "La part du financement apportée par les propriétaires (capitaux propres ÷ total du bilan)." },
  { term: "Endettement net / capitaux propres (gearing)", plain: "Les dettes financières et bancaires, moins l'argent disponible, divisées par les capitaux propres. Au-delà de 1, l'entreprise doit plus aux banques qu'elle n'a de fonds propres." },
  { term: "Capacité de remboursement", plain: "Les dettes financières divisées par la CAF : le nombre d'années d'autofinancement qu'il faudrait pour tout rembourser." },
  { term: "Rentabilité économique", plain: "Ce que rapporte l'outil de l'entreprise (immobilisations + besoin de financement), quel que soit son financement." },
  { term: "Rentabilité financière (ROE)", plain: "Ce que rapporte l'argent des propriétaires : résultat net ÷ capitaux propres." },
  { term: "Effet de levier", plain: "Emprunter augmente la rentabilité des propriétaires seulement si l'outil rapporte plus que ce que coûte la dette. Sinon, l'endettement la fait baisser (effet de levier négatif)." },
  { term: "Délai clients", plain: "Le nombre moyen de jours que mettent les clients à payer." },
  { term: "Délai fournisseurs", plain: "Le nombre moyen de jours que l'entreprise met à payer ses fournisseurs." },
  { term: "Délai de rotation des stocks", plain: "Le nombre moyen de jours que les marchandises restent en stock avant d'être vendues." },
  { term: "Effet ciseaux", plain: "Quand le besoin de financement grandit plus vite que les ventes : l'entreprise vend plus mais manque d'argent." },
  { term: "« Compatible (non prouvée) »", plain: "Les chiffres vont dans le sens de l'hypothèse ; mais avec quelques années d'une seule entreprise, on ne peut pas prouver une relation de cause à effet." },
];

export interface DefenseKit {
  /** L'essentiel à dire à l'oral (première personne). */
  pitch: string[];
  /** Questions probables du jury et réponses chiffrées. */
  questions: Array<{ question: string; answer: string }>;
  glossary: GlossaryEntry[];
}

const lower = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const unquoted = (s: string) => s.replace(/\.$/, "");

export function buildDefenseKit(input: { dossier: FinanceDossier; computation: FinanceComputation; diagnosis: Diagnosis | null; links: LinkStructure[]; results: HypothesisResult[]; reasoning: FinanceReasoning | null; checks: CheckResult[]; provenance: FinanceProvenanceKind | null; acceptedGaps: number; company: string; mainQuestion: string; recommendations: string[] }): DefenseKit {
  const { dossier, computation, diagnosis, reasoning } = input;
  const labels = computation.exercises.map((e) => e.label);
  const n = labels.length;
  const period = n > 1 ? `${labels[0]} à ${labels.at(-1)}` : (labels[0] ?? "");
  const last = n - 1;
  const value = (code: string) => computation.values[last]?.[code]?.value ?? null;
  const money = (v: number | null) => formatValue(v, "montant", dossier.company);
  const calc = (id: string) => {
    const e = explainIndicator(id, computation, dossier);
    const line = e?.lines.at(-1);
    return e && line && !line.unavailable ? `${line.steps.join(" ; ")} (${line.exercise}).` : null;
  };

  const pitch: string[] = [];
  pitch.push(`J'ai analysé les états financiers de ${input.company} sur ${n > 1 ? `${n} exercices, de ${period}` : `l'exercice ${period}`} : bilan, compte de résultat${computation.exercises.some((e) => Object.keys(dossier.values[e.id] ?? {}).some((c) => /^[FZ]/.test(c))) ? " et tableau des flux de trésorerie" : ""}, établis selon le SYSCOHADA révisé, en ${currencySuffix(dossier.company)}.`);
  if (diagnosis) pitch.push(`Avant d'examiner mon sujet, j'ai établi l'état de l'entreprise : ${lower(diagnosis.headline)}.${diagnosis.reasons[0] ? ` La raison principale : ${lower(unquoted(diagnosis.reasons[0]))}.` : ""}`);
  for (const r of reasoning?.readings ?? []) {
    if (r.verdict === "not_examined") continue;
    const result = input.results.find((x) => x.link.rowId === r.rowId);
    const pro = result?.results.filter((x) => x.status === "respecte" && x.plain).map((x) => x.plain) ?? [];
    const contra = result?.results.filter((x) => (x.status === "contraire" || x.status === "non_respecte") && x.plain).map((x) => x.plain) ?? [];
    pitch.push(`${r.title} — « ${unquoted(r.statement)} » : ${lower(r.verdictLabel)}.${pro.length ? ` Ce qui va dans son sens : ${pro.join(" ; ")}.` : ""}${contra.length ? ` ${pro.length ? "Mais " : "Ce qui s'en éloigne : "}${contra.join(" ; ")}.` : ""}`);
  }
  if (n > 1) pitch.push(`Avec ${n} exercices d'une seule entreprise, je n'ai pas fait de test statistique : j'ai vérifié si les indicateurs évoluent dans le sens de mes hypothèses et j'ai appuyé mes conclusions sur des mécanismes comptables. C'est pourquoi je ne conclus pas à une relation de cause à effet.`);
  if (input.recommendations[0]) pitch.push(`Ma principale recommandation : ${lower(input.recommendations[0])}`);

  const questions: DefenseKit["questions"] = [];
  const bz = value("BZ");
  const xi = value("XI");
  const gaps = input.checks.filter((c) => c.status === "gap" && c.severity === "blocking");
  questions.push({
    question: "D'où viennent vos chiffres ? Sont-ils fiables ?",
    answer: `Ils proviennent de ${input.provenance ? lower(FINANCE_PROVENANCE_LABELS[input.provenance]) : "documents dont la provenance n'a pas été déclarée"}. J'ai vérifié chaque montant avec le document d'origine, et ACADIA a contrôlé la cohérence comptable : le bilan est équilibré${bz !== null ? ` (total actif = total passif = ${money(bz)} en ${labels[last]})` : ""}, le résultat est le même au bilan et au compte de résultat${xi !== null ? ` (${money(xi)})` : ""}, et la trésorerie du tableau des flux correspond à celle du bilan.${gaps.length ? ` ${input.acceptedGaps} écart(s) ont été acceptés et justifiés : je les signale dans mes limites.` : ""}`,
  });
  if (diagnosis) questions.push({ question: `Pourquoi dites-vous que l'entreprise est « ${lower(diagnosis.headline.split(" en ")[0])} » ?`, answer: `Pour ${diagnosis.reasons.length} raison(s) principale(s) : ${diagnosis.reasons.map((r, i) => `${i + 1}) ${lower(unquoted(r))}`).join(" ; ")}. ACADIA juge chaque dimension (liquidité, solvabilité, rentabilité, activité, équilibre) à l'aide de repères usuels ajustés au secteur, selon des règles écrites dans l'annexe : ce n'est ni un audit ni un avis d'expert-comptable.` });
  const explained = new Set<string>();
  for (const link of input.links) {
    for (const concept of [link.independent, link.dependent]) {
      if (!concept || explained.has(concept.id)) continue;
      explained.add(concept.id);
      const id = input.results.find((r) => r.link.rowId === link.rowId)?.results.flatMap((x) => x.criterion.indicators).find((x) => concept.indicators.includes(x)) ?? concept.indicators[0];
      const text = calc(id);
      if (text) questions.push({ question: `Comment avez-vous mesuré « ${lower(concept.label)} » ?`, answer: `Par l'indicateur « ${explainIndicator(id, computation, dossier)!.label} ». Calcul : ${text} ${explainIndicator(id, computation, dossier)!.meaning[2] ?? ""}`.trim() });
    }
  }
  for (const r of reasoning?.readings ?? []) {
    if (r.verdict === "not_examined") continue;
    const result = input.results.find((x) => x.link.rowId === r.rowId);
    const pro = result?.results.filter((x) => x.status === "respecte" && x.plain).map((x) => x.plain) ?? [];
    const contra = result?.results.filter((x) => (x.status === "contraire" || x.status === "non_respecte") && x.plain).map((x) => x.plain) ?? [];
    questions.push({
      question: `${r.title} : votre hypothèse est-elle confirmée ?`,
      answer: `${r.verdictLabel}. En une phrase : ${[...pro, ...contra].join(" ; ")}. Dans le détail — ${r.approaches.length ? `Ce qui va dans son sens : ${r.approaches.map((a) => lower(unquoted(a))).join(" ; ")}. ` : ""}${r.distances.length ? `Ce qui s'en éloigne : ${r.distances.map((a) => lower(unquoted(a))).join(" ; ")}. ` : ""}${r.mechanism ? `${r.mechanism} ` : ""}Je dis « compatible » et non « prouvée » : ${n} exercices d'une seule entreprise décrivent une évolution, ils ne permettent pas d'établir une relation générale de cause à effet.`,
    });
  }
  if (n > 1)
    questions.push({ question: "Pourquoi n'avez-vous pas fait de test statistique (corrélation, régression) ?", answer: `Parce que je n'ai que ${n} observations d'une seule entreprise, et que ces observations ne sont pas indépendantes (chaque bilan découle du précédent). Un test n'aurait aucune valeur avec si peu de points. L'analyse financière procède autrement : par des ratios comparés à des repères, par leur évolution, et par des identités comptables (fonds de roulement, besoin de financement et trésorerie ; effet de levier).` });
  const concepts = new Set(input.links.flatMap((l) => [l.independent?.id, l.dependent?.id, ...l.described.map((c) => c.id)]));
  if ([...concepts].some((c) => c && ["endettement", "effet_levier", "rentabilite_financiere", "credit_bancaire", "frais_financiers"].includes(c))) {
    const text = calc("effet_levier");
    if (text) questions.push({ question: "Qu'est-ce que l'effet de levier et que montre-t-il ici ?", answer: `Emprunter augmente la rentabilité des propriétaires seulement si l'outil de l'entreprise rapporte plus que ce que coûte la dette (rentabilité financière = rentabilité économique + (rentabilité économique − coût de la dette) × dettes ÷ capitaux propres). Calcul : ${text}` });
  }
  if ([...concepts].some((c) => c && ["tresorerie", "bfr", "credit_clients", "stocks", "equilibre_financier", "liquidite"].includes(c))) {
    const fr = calc("fr");
    const bf = computation.series.bf?.values[last].value ?? null;
    const tn = computation.series.tn?.values[last].value ?? null;
    if (fr && bf !== null && tn !== null)
      questions.push({ question: "Comment expliquez-vous l'évolution de la trésorerie ?", answer: `Par l'équilibre du bilan : trésorerie nette = fonds de roulement − besoin de financement. En ${labels[last]} : ${fr.replace(/\.$/, "")} ; besoin de financement global ${money(bf)} ; donc trésorerie nette ${money(tn)}. Quand les stocks et les créances clients augmentent plus vite que les ressources durables, la trésorerie baisse, même si l'entreprise fait des bénéfices.` });
  }
  if (dossier.company.currency === "CDF" && n > 1)
    questions.push({ question: "Les montants sont en francs congolais : l'inflation ne fausse-t-elle pas vos conclusions ?", answer: "Elle peut gonfler les montants (chiffre d'affaires, dettes) d'une année à l'autre. C'est pourquoi je m'appuie surtout sur des ratios (divisions entre montants de la même année), peu sensibles à l'inflation, et je signale cette limite. Une comparaison en dollars, au taux de change de clôture, permettrait de la vérifier." });
  if (reasoning?.limits.length) questions.push({ question: "Quelles sont les limites de votre travail ?", answer: reasoning.limits.join(" ") });
  if (input.recommendations.length) questions.push({ question: "Que recommandez-vous à l'entreprise ?", answer: input.recommendations.slice(0, 4).join(" ") });
  return { pitch, questions, glossary: GLOSSARY };
}
