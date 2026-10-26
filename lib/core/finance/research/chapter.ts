/**
 * Plan proposé du chapitre « Présentation, analyse et interprétation des résultats », construit à partir
 * de la chaîne de la recherche et des résultats : pour chaque section, son but, les tableaux et figures à
 * présenter et une proposition de rédaction chiffrée (à reformuler par l'étudiant). Plan modifiable.
 */
import type { FinanceComputation } from "../compute";
import type { Diagnosis } from "../diagnosis";
import { currencySuffix, formatValue } from "../format";
import { INDICATOR_BY_ID } from "../indicators/catalogue";
import type { Reflex } from "../reflexes";
import { FINANCE_PROVENANCE_LABELS, type FinanceDossier, type FinanceProvenanceKind } from "../types";
import type { HypothesisResult } from "./evaluate";
import type { FinanceReasoning } from "./interpret";
import { chosenIndicators, type IndicatorChoices, type IndicatorTarget, type LinkStructure } from "./structure";

export interface ChapterSection {
  id: string;
  title: string;
  purpose: string;
  /** Tableaux et figures à présenter. */
  contents: string[];
  /** Indicateurs présentés (tableaux et courbes). */
  indicators: string[];
  /** Proposition de rédaction (à reformuler). */
  draft: string[];
}

export interface ChapterPlan {
  title: string;
  sections: ChapterSection[];
}

export interface ChapterDecisions {
  order?: string[];
  removed?: string[];
}

/** Recommandations de gestion associées aux réflexes (pistes, à discuter). */
const RECOMMENDATIONS: Record<string, string> = {
  tn_negative: "Restaurer la trésorerie : renégocier la structure des crédits (consolider les crédits de trésorerie à moyen terme) et mieux piloter le cycle d'exploitation.",
  delai_clients: "Renforcer le recouvrement des créances : suivi de la balance âgée, relances systématiques, conditions de paiement plus strictes ou escompte pour paiement rapide.",
  delai_stocks: "Rationaliser les stocks : identifier les références lentes, ajuster les commandes à la demande.",
  levier_negatif: "Réduire le coût de la dette (renégociation des taux) ou améliorer la rentabilité économique avant tout nouvel emprunt.",
  capacite_remb: "Adapter l'échéancier des emprunts à la capacité d'autofinancement réelle.",
  dettes_fiscales: "Régulariser les dettes fiscales et sociales et négocier un échéancier pour éviter pénalités et redressements.",
  resultat_hao: "Présenter la performance courante (résultat des activités ordinaires) distinctement des gains exceptionnels.",
  ciseaux: "Accompagner la croissance d'un financement adapté du besoin de financement d'exploitation (ressources stables, maîtrise des délais).",
  cp_demi_capital: "Reconstituer les capitaux propres (apport des associés, incorporation de comptes courants, mise en réserve des bénéfices).",
  ebe_negatif: "Restaurer la marge d'exploitation : prix de vente, coûts d'achat, maîtrise des charges de personnel et des services extérieurs.",
};

/** Recommandations de gestion associées aux réflexes déclenchés (pistes, à discuter). */
export const recommendationsFor = (reflexes: Reflex[]) => reflexes.map((r) => RECOMMENDATIONS[r.id]).filter((x): x is string => !!x);

export function buildChapter(input: { dossier: FinanceDossier; computation: FinanceComputation; diagnosis: Diagnosis | null; links: LinkStructure[]; results: HypothesisResult[]; reasoning: FinanceReasoning; targets: IndicatorTarget[]; choices: IndicatorChoices; reflexes: Reflex[]; provenance: FinanceProvenanceKind | null; company: string; acceptedGaps: number }, decisions: ChapterDecisions = {}): ChapterPlan {
  const { dossier, computation, diagnosis, links, results, reasoning } = input;
  const labels = computation.exercises.map((e) => e.label);
  const period = labels.length > 1 ? `${labels[0]}–${labels.at(-1)}` : (labels[0] ?? "");
  const indicatorsOf = (conceptId: string) => {
    const target = input.targets.find((t) => t.key === `concept:${conceptId}`);
    return target ? chosenIndicators(target, input.choices) : [];
  };
  const describe = (id: string) => {
    const s = computation.series[id];
    if (!s) return null;
    const pts = s.values.map((v, i) => ({ v: v.value, i })).filter((p) => p.v !== null);
    if (!pts.length) return null;
    const first = pts[0];
    const end = pts.at(-1)!;
    const f = (v: number) => formatValue(v, s.def.unit, dossier.company);
    return pts.length > 1 ? `${s.def.label} passe de ${f(first.v!)} en ${labels[first.i]} à ${f(end.v!)} en ${labels[end.i]}.` : `${s.def.label} : ${f(end.v!)} en ${labels[end.i]}.`;
  };

  const sections: ChapterSection[] = [
    {
      id: "presentation",
      title: "Présentation de l'entreprise et des données",
      purpose: "Situer l'entreprise et justifier la fiabilité des chiffres analysés.",
      contents: [`Tableau : bilans condensés ${period}`, `Tableau : comptes de résultat et soldes intermédiaires de gestion ${period}`, "Encadré : provenance des états, contrôles comptables et corrections"],
      indicators: [],
      draft: [
        `L'analyse porte sur les états financiers de ${input.company}${dossier.company.city ? ` (${dossier.company.city})` : ""} pour ${labels.length > 1 ? `les exercices ${period}` : `l'exercice ${period}`}, établis selon le SYSCOHADA révisé et exprimés en ${currencySuffix(dossier.company)}.`,
        `Provenance : ${input.provenance ? FINANCE_PROVENANCE_LABELS[input.provenance].toLowerCase() : "non déclarée"}. ${input.acceptedGaps ? `${input.acceptedGaps} écart(s) comptable(s) ont été acceptés et justifiés.` : "Les contrôles comptables (équilibre du bilan, concordance du résultat et de la trésorerie entre les états) sont conformes."}`,
      ],
    },
    {
      id: "diagnostic",
      title: "Diagnostic financier d'ensemble",
      purpose: "Donner au lecteur l'état général de l'entreprise avant d'examiner les hypothèses.",
      contents: ["Tableau : indicateurs clés par dimension (liquidité, solvabilité, rentabilité, activité, équilibre)", "Figure : évolution du chiffre d'affaires, de l'EBE et du résultat net", "Figure : fonds de roulement, besoin de financement d'exploitation et trésorerie nette"],
      indicators: ["chiffre_affaires", "ebe", "resultat_net", "fr", "bfe", "tn", "lg", "autonomie", "gearing", "roe", "marge_nette"],
      draft: diagnosis ? [`Au terme de l'analyse, la situation financière de ${input.company} apparaît ${diagnosis.headline.charAt(0).toLowerCase()}${diagnosis.headline.slice(1)}.`, ...diagnosis.reasons.map((r) => `En effet, ${r.charAt(0).toLowerCase()}${r.slice(1)}`)] : [],
    },
  ];

  let h = 0;
  let o = 0;
  for (const link of links) {
    const result = results.find((r) => r.link.rowId === link.rowId);
    const reading = reasoning.readings.find((r) => r.rowId === link.rowId);
    const isHypothesis = link.statementKind === "hypothesis";
    const tag = isHypothesis ? `hypothèse ${++h}` : `objectif ${++o}`;
    const concepts = link.independent && link.dependent ? [link.independent, link.dependent] : link.described;
    for (const concept of concepts) {
      if (sections.some((s) => s.id === `concept:${concept.id}`)) continue;
      const ids = indicatorsOf(concept.id);
      sections.push({
        id: `concept:${concept.id}`,
        title: `Analyse : ${concept.label.toLowerCase()}`,
        purpose: `Mesurer ${concept.label.toLowerCase()} à l'aide des indicateurs retenus${link.independent?.id === concept.id ? " (variable explicative)" : link.dependent?.id === concept.id ? " (variable expliquée)" : ""}.`,
        contents: [`Tableau : ${ids.map((id) => INDICATOR_BY_ID[id]?.label ?? id).join(", ")} (${period})`, ...(labels.length > 1 ? [`Figure : évolution de ${INDICATOR_BY_ID[ids[0]]?.label ?? concept.label}`] : [])],
        indicators: ids,
        draft: ids.map(describe).filter((x): x is string => !!x),
      });
    }
    sections.push({
      id: `link:${link.rowId}`,
      title: `Vérification de l'${tag} : ${link.statement}`,
      purpose: isHypothesis ? "Confronter l'hypothèse aux critères retenus et conclure prudemment." : "Répondre à l'objectif à partir des indicateurs.",
      contents: ["Tableau : critères de vérification, attendu et observé par exercice", ...(reading?.mechanism ? ["Encadré : mécanisme comptable chiffré"] : [])],
      indicators: result?.results.flatMap((r) => r.criterion.indicators) ?? [],
      draft: [...(reading?.approaches.slice(0, 2).map((a) => `Ce qui rapproche les données de l'${tag} : ${a}`) ?? []), ...(reading?.distances.slice(0, 2).map((d) => `Ce qui l'en éloigne : ${d}`) ?? []), ...(reading?.mechanism ? [reading.mechanism] : []), ...(reading ? [`Conclusion : ${reading.conclusion}`] : [])],
    });
  }

  const recommendations = recommendationsFor(input.reflexes);
  sections.push(
    {
      id: "discussion",
      title: "Discussion des résultats",
      purpose: "Relier les résultats à la littérature et au contexte, sans conclure à une causalité.",
      contents: ["Confrontation aux théories mobilisées dans votre cadre théorique", "Comparaison, si possible, avec des études sur des entreprises comparables"],
      indicators: [],
      draft: [...(reasoning.mainAnswer ? [reasoning.mainAnswer] : []), ...reasoning.angles.map((a) => `${a.title} : ${a.text}`)],
    },
    {
      id: "limites",
      title: "Limites et recommandations",
      purpose: "Présenter honnêtement les limites et proposer des pistes de gestion.",
      contents: ["Limites de l'étude", "Recommandations à l'entreprise"],
      indicators: [],
      draft: [...reasoning.limits, ...recommendations.slice(0, 6).map((r) => `Recommandation : ${r}`)],
    },
  );

  const removed = new Set(decisions.removed ?? []);
  const order = decisions.order ?? [];
  const ordered = [...sections].sort((a, b) => {
    const ia = order.indexOf(a.id);
    const ib = order.indexOf(b.id);
    return (ia === -1 ? 1e6 + sections.indexOf(a) : ia) - (ib === -1 ? 1e6 + sections.indexOf(b) : ib);
  });
  return { title: "Présentation, analyse et interprétation des résultats", sections: ordered.filter((s) => !removed.has(s.id)) };
}
