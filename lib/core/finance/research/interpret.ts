/**
 * Le raisonnement d'ACADIA sur le sujet : pour chaque hypothèse (ou objectif descriptif), ce qui
 * rapproche les chiffres de l'hypothèse, ce qui l'en éloigne, le mécanisme comptable chiffré et une
 * conclusion prudente ; puis l'état de l'entreprise au regard du sujet, les réflexes ciblés, des angles
 * d'interprétation (pistes de la littérature, à vérifier) et les limites. Règles déterministes, sans IA.
 */
import type { FinanceComputation } from "../compute";
import type { Diagnosis } from "../diagnosis";
import { LEVEL_LABELS } from "../diagnosis";
import { formatValue } from "../format";
import { DIMENSION_LABELS, type FamilyId } from "../indicators/types";
import type { Reflex } from "../reflexes";
import type { FinanceDossier } from "../types";
import type { HypothesisResult } from "./evaluate";
import { FINANCE_VERDICT_LABELS } from "./evaluate";
import type { LinkStructure } from "./structure";

export interface HypothesisReading {
  rowId: string;
  title: string;
  statement: string;
  verdictLabel: string;
  verdict: HypothesisResult["verdict"];
  approaches: string[];
  distances: string[];
  unverifiable: string[];
  mechanism: string | null;
  conclusion: string;
}

export interface Angle {
  title: string;
  text: string;
}

export interface FinanceReasoning {
  readings: HypothesisReading[];
  companyState: string[];
  reflexes: Reflex[];
  angles: Angle[];
  limits: string[];
  mainAnswer: string;
}

const ANGLES: Record<string, Angle[]> = {
  levier: [
    { title: "L'effet de levier financier", text: "Rentabilité financière = rentabilité économique + (rentabilité économique − coût de la dette) × dettes ÷ capitaux propres : l'endettement n'améliore la rentabilité des associés que si l'outil économique rapporte plus que ce que coûte la dette." },
    { title: "La structure financière (Modigliani et Miller, 1958 et 1963)", text: "Sans impôt, la structure financière serait neutre sur la valeur ; avec l'impôt, la déductibilité des intérêts avantage la dette. À discuter au regard du coût réel du crédit bancaire." },
    { title: "Théorie du compromis et financement hiérarchique (Myers et Majluf, 1984)", text: "L'entreprise arbitre entre l'avantage fiscal de la dette et le risque de difficultés financières ; elle préfère l'autofinancement, puis la dette, puis les apports nouveaux." },
  ],
  cycle: [
    { title: "Le cycle d'exploitation et l'équilibre fonctionnel", text: "Trésorerie nette = fonds de roulement − besoin de financement : quand les stocks et les créances clients croissent plus vite que les ressources stables, la trésorerie se dégrade, même si l'entreprise est bénéficiaire." },
    { title: "La politique de crédit clients", text: "Accorder des délais soutient les ventes mais immobilise la trésorerie et accroît le risque d'impayés : un arbitrage entre croissance et liquidité (effet ciseaux)." },
  ],
  rentabilite: [{ title: "La décomposition de la rentabilité (Dupont)", text: "Rentabilité financière = marge nette × rotation de l'actif × (actif ÷ capitaux propres) : elle permet de dire si la rentabilité vient des marges, de l'utilisation des actifs ou de l'endettement." }],
  financement: [
    { title: "Le financement de la croissance", text: "La capacité d'autofinancement finance en priorité les investissements et le remboursement des dettes ; la distribution de dividendes réduit d'autant l'autofinancement." },
    { title: "La théorie de l'agence (Jensen et Meckling, 1976)", text: "Dividendes et endettement peuvent discipliner l'usage des liquidités par les dirigeants : piste à discuter selon la gouvernance de l'entreprise." },
  ],
  solvabilite: [
    { title: "Approches patrimoniale et fonctionnelle", text: "L'approche patrimoniale juge la capacité à payer les dettes (liquidité, solvabilité) ; l'approche fonctionnelle juge l'équilibre entre emplois et ressources : les deux lectures se complètent." },
    { title: "La prévision de la défaillance", text: "Les scores (Altman, 1968 ; Conan et Holder, 1979) combinent plusieurs ratios ; calibrés ailleurs, ils ne valent qu'à titre indicatif pour une entreprise congolaise." },
  ],
  contexte: [{ title: "Le contexte de la RDC", text: "Inflation et dépréciation du franc congolais, dollarisation de l'économie, coût élevé du crédit bancaire et garanties exigées, délais de paiement des clients publics : autant d'éléments de contexte qui éclairent les ratios." }],
};

const ANGLE_OF_CONCEPT: Record<string, string[]> = {
  endettement: ["levier"], effet_levier: ["levier"], credit_bancaire: ["levier"], frais_financiers: ["levier"], rentabilite_financiere: ["levier", "rentabilite"],
  rentabilite: ["rentabilite"], rentabilite_economique: ["rentabilite"], performance_financiere: ["rentabilite"], marge_nette: ["rentabilite"],
  credit_clients: ["cycle"], stocks: ["cycle"], bfr: ["cycle"], tresorerie: ["cycle"], credit_fournisseurs: ["cycle"], croissance: ["cycle"],
  autofinancement: ["financement"], investissement: ["financement"], dividendes: ["financement"],
  solvabilite: ["solvabilite"], liquidite: ["solvabilite"], risque_faillite: ["solvabilite"], equilibre_financier: ["solvabilite", "cycle"], situation_financiere: ["solvabilite", "rentabilite"],
};

export function interpretFinance(input: { links: LinkStructure[]; results: HypothesisResult[]; computation: FinanceComputation; diagnosis: Diagnosis | null; reflexes: Reflex[]; dossier: FinanceDossier; mainQuestion: string; company: string }): FinanceReasoning {
  const { links, results, computation, diagnosis, dossier } = input;
  const labels = computation.exercises.map((e) => e.label);
  const last = labels.length - 1;
  const at = (id: string, i = last) => computation.series[id]?.values[i]?.value ?? null;
  const fmt = (id: string, v: number | null) => formatValue(v, computation.series[id].def.unit, dossier.company);
  let hypothesisCount = 0;
  let objectiveCount = 0;

  const readings: HypothesisReading[] = results.map((r) => {
    const link = r.link;
    const title = link.statementKind === "hypothesis" ? `Hypothèse ${++hypothesisCount}` : `Objectif ${++objectiveCount}`;
    const approaches = r.results.filter((x) => x.status === "respecte").map((x) => `${x.criterion.label} : ${x.observed}`);
    const distances = r.results.filter((x) => x.status === "contraire" || x.status === "non_respecte").map((x) => `${x.criterion.label}${x.status === "contraire" ? " — sens contraire" : " — non vérifié"} : ${x.observed}`);
    const unverifiable = r.results.filter((x) => x.status === "non_verifiable").map((x) => `${x.criterion.label} : ${x.observed}`);
    let mechanism: string | null = null;
    const mech = r.results.find((x) => x.criterion.kind === "mechanism")?.criterion.mechanism;
    if (mech === "levier" && at("re_nette") !== null && at("cout_dette") !== null) {
      const iNet = at("cout_dette")! * (1 - computation.params.taux_is);
      const effect = at("effet_levier");
      mechanism = `En ${labels[last]} : rentabilité économique après impôt ${fmt("re_nette", at("re_nette"))} ; coût de la dette après impôt ${formatValue(iNet, "pct")} ; dettes financières et bancaires ÷ capitaux propres ${fmt("endettement_brut", at("endettement_brut"))}. ${effect !== null ? `Selon la formule de l'effet de levier, l'endettement ${effect >= 0 ? "ajoute" : "retire"} environ ${formatValue(Math.abs(effect), "pct").replace(" %", " points")} à la rentabilité financière (${fmt("roe", at("roe"))}). ` : ""}Décomposition approchée : le résultat net comprend aussi le résultat financier hors intérêts et les éléments HAO.`;
    } else if (mech === "bfr_tresorerie" && labels.length > 1 && at("fr", 0) !== null && at("fr") !== null) {
      mechanism = `De ${labels[0]} à ${labels[last]} : fonds de roulement ${fmt("fr", at("fr", 0))} → ${fmt("fr", at("fr"))} ; besoin de financement global ${fmt("bf", at("bf", 0))} → ${fmt("bf", at("bf"))} ; trésorerie nette ${fmt("tn", at("tn", 0))} → ${fmt("tn", at("tn"))}. La trésorerie est la différence entre les deux premiers : c'est une identité comptable, vérifiable dans les bilans.`;
    } else if (mech === "autofinancement" && at("autofinancement") !== null) {
      mechanism = `En ${labels[last]} : autofinancement ${fmt("autofinancement", at("autofinancement"))} ; couverture des investissements par l'autofinancement ${fmt("autofin_invest", at("autofin_invest"))} (au moins 1 : investissements entièrement autofinancés).`;
    }
    const n = labels.length;
    const conclusion = `${FINANCE_VERDICT_LABELS[r.verdict]}. ${n > 1 ? `Sur ${n} exercices d'une seule entreprise, ces constats décrivent une évolution : ils ne permettent pas d'établir un lien général de cause à effet.` : "Avec un seul exercice, seul le niveau des indicateurs peut être jugé, pas leur évolution."}`;
    return { rowId: link.rowId, title, statement: link.statement, verdict: r.verdict, verdictLabel: FINANCE_VERDICT_LABELS[r.verdict], approaches, distances, unverifiable, mechanism, conclusion };
  });

  // Concepts et familles du sujet.
  const concepts = links.flatMap((l) => [l.independent, l.dependent, ...l.described]).filter((c): c is NonNullable<typeof c> => !!c);
  const families = new Set<FamilyId>(concepts.flatMap((c) => c.families));
  const companyState = diagnosis
    ? diagnosis.latest.dimensions
        .filter((d) => families.has(d.id as FamilyId) || (d.id === "equilibre" && (families.has("flux") || families.has("equilibre"))))
        .map((d) => `${DIMENSION_LABELS[d.id]} : ${LEVEL_LABELS[d.level].toLowerCase()} en ${diagnosis.latest.label}${d.reasons[0] ? ` — ${d.reasons[0]}` : ""}`)
    : [];
  const reflexes = input.reflexes.filter((r) => r.severity === "critique" || r.families.some((f) => families.has(f))).slice(0, 6);
  const angleKeys = [...new Set(concepts.flatMap((c) => ANGLE_OF_CONCEPT[c.id] ?? []))];
  const angles = [...angleKeys.flatMap((k) => ANGLES[k]), ...(dossier.company.currency === "CDF" || dossier.company.city ? ANGLES.contexte : [])];

  const limits = [
    `Analyse portant sur ${labels.length} exercice(s) d'une seule entreprise : aucune généralisation statistique n'est possible ; les verdicts décrivent la cohérence entre les hypothèses et les chiffres.`,
    "Les repères des indicateurs sont des conventions usuelles, à discuter avec votre encadreur, pas des normes.",
    "Les indicateurs dépendent de la qualité des états financiers fournis (non audités le cas échéant) et des écarts comptables éventuellement acceptés.",
    ...(dossier.company.currency === "CDF" && labels.length > 1 ? ["Montants en francs congolais courants : les évolutions comprennent l'effet de l'inflation et du change."] : []),
  ];

  const verdicts = readings.map((r) => `${r.title} (« ${r.statement} ») : ${r.verdictLabel.toLowerCase()}`);
  const mainAnswer = input.mainQuestion.trim()
    ? `À la question « ${input.mainQuestion.trim()} », les états financiers de ${input.company} apportent les éléments suivants : ${verdicts.join(" ; ")}.`
    : verdicts.length
      ? `Les états financiers de ${input.company} apportent les éléments suivants : ${verdicts.join(" ; ")}.`
      : "";
  return { readings, companyState, reflexes, angles, limits, mainAnswer };
}
