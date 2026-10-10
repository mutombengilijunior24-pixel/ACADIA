/**
 * Cartographie : concept → variable de recherche → question de collecte → colonne(s) → type.
 * Les concepts viennent du moteur de compréhension ; les questions de l'instrument (ou, à défaut,
 * les en-têtes du fichier) ; les colonnes de la structure du fichier. Tout rapprochement est une
 * proposition, que l'utilisateur confirme ou corrige.
 */
import { statisticalTypeLabel } from "@/lib/core/data/preparation";
import type { StatisticalType } from "@/lib/core/data/types";
import { ROLE_LABELS, type UnderstandingReport, type VariableRole } from "@/lib/core/understanding";

import type { InstrumentQuestion, QuestionLink } from "./instrument";
import { corpusOf, coverage, tokensOf } from "./match";
import type { FileStructure, QuestionUnit } from "./structure";

export type UnitRole = "key" | "context" | "other" | "technical";

export interface MappingCandidate {
  unitId: string;
  score: number;
  reason: string;
}

export interface ConceptMapping {
  conceptKey: string;
  name: string;
  role: VariableRole;
  roleLabel: string;
  definition: string | null;
  candidates: MappingCandidate[];
  unitId: string | null;
  status: "proposed" | "confirmed" | "missing";
  /** Origine du rapprochement retenu. */
  origin: "auto" | "user";
  confidence: "high" | "medium" | "low" | "none";
  ambiguity: string | null;
}

export interface UnitMapping {
  unit: QuestionUnit;
  role: UnitRole;
  conceptKey: string | null;
  question: InstrumentQuestion | null;
  typeLabel: string;
  reason: string;
}

export interface Cartography {
  concepts: ConceptMapping[];
  units: UnitMapping[];
  /** Question prioritaire unique pour débloquer l'étape, s'il en faut une. */
  clarification: string | null;
  issues: string[];
}

export interface MappingDecisions {
  /** manual : rapprochement choisi par l'utilisateur (et non proposé par ACADIA). */
  concepts: Record<string, { unitId: string | null; confirmed: boolean; manual?: boolean }>;
  unitRoles: Record<string, UnitRole>;
}

export const emptyMappingDecisions = (): MappingDecisions => ({ concepts: {}, unitRoles: {} });

/** Questions de profil des répondants ou des unités (contexte), reconnues par leur intitulé. */
const CONTEXT = /\b(age|ages|tranche d.age|sexe|genre|niveau d.etudes?|etudes|instruction|scolarit|etat civil|statut matrimonial|situation matrimoniale|profession|occupation|activit[ea]s?\s*(?:exercee|principale)?|secteur|anciennete|experience|commune|quartier|ville|province|marche|lieu|localisation|residence|taille du menage|religion|nationalit|statut juridique|forme juridique|effectif|nombre d.employes|revenu)\b/;

function foldText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[’']/g, ".");
}

export function buildCartography(input: {
  report: UnderstandingReport;
  structure: FileStructure;
  questions: InstrumentQuestion[];
  links: QuestionLink[];
  decisions: MappingDecisions;
}): Cartography {
  const { report, structure, questions, links, decisions } = input;
  const analyzable = structure.units.filter((u) => u.kind !== "technical");
  const questionOf = (unitId: string) => {
    const link = links.find((l) => l.unitId === unitId);
    return link ? (questions.find((q) => q.id === link.questionId) ?? null) : null;
  };
  // Texte de référence d'une unité : en-tête + texte de la question de l'instrument rapprochée.
  const unitText = (unit: QuestionUnit) => `${unit.text} ${questionOf(unit.id)?.text ?? ""}`;
  const corpus = corpusOf(analyzable.map(unitText));

  const concepts = report.variables.filter((v) => v.status !== "rejected");
  const scored = concepts.map((concept) => {
    const tokens = tokensOf(concept.name);
    const candidates = analyzable
      .map((unit) => {
        const match = coverage(tokens, tokensOf(unitText(unit)), corpus);
        const words = match.matched.filter((m) => m.similarity >= 0.5).map((m) => (m.similarity === 1 ? m.with : `${m.with} (≈ ${m.token})`));
        return { unitId: unit.id, score: match.score, reason: words.length ? `Mots communs : ${words.join(", ")}.` : "" };
      })
      .filter((c) => c.score >= 0.3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4);
    return { concept, candidates };
  });

  // Attribution : décisions de l'utilisateur d'abord, puis meilleures correspondances (une unité par concept).
  const taken = new Set<string>(Object.values(decisions.concepts).map((d) => d.unitId).filter((id): id is string => !!id));
  const assigned = new Map<string, string | null>();
  for (const { concept } of scored) {
    const decision = decisions.concepts[concept.key];
    if (decision) assigned.set(concept.key, decision.unitId);
  }
  for (const { concept, candidates } of [...scored].sort((a, b) => (b.candidates[0]?.score ?? 0) - (a.candidates[0]?.score ?? 0))) {
    if (assigned.has(concept.key)) continue;
    const best = candidates.find((c) => c.score >= 0.45 && !taken.has(c.unitId));
    assigned.set(concept.key, best?.unitId ?? null);
    if (best) taken.add(best.unitId);
  }

  const conceptMappings: ConceptMapping[] = scored.map(({ concept, candidates }) => {
    const decision = decisions.concepts[concept.key];
    const unitId = assigned.get(concept.key) ?? null;
    const best = candidates.find((c) => c.unitId === unitId);
    const second = candidates.find((c) => c.unitId !== unitId);
    const score = best?.score ?? 0;
    return {
      conceptKey: concept.key,
      name: concept.name,
      role: concept.role,
      roleLabel: ROLE_LABELS[concept.role],
      definition: concept.definition?.text ?? null,
      candidates,
      unitId,
      status: decision?.confirmed ? "confirmed" : unitId ? "proposed" : "missing",
      origin: decision?.manual ? "user" : "auto",
      confidence: decision?.confirmed ? "high" : !unitId ? "none" : score >= 0.75 ? "high" : score >= 0.55 ? "medium" : "low",
      ambiguity: !decision && best && second && second.score >= best.score - 0.1 ? `Deux questions sont proches (${Math.round(best.score * 100)} % et ${Math.round(second.score * 100)} %) : vérifiez laquelle mesure « ${concept.name} ».` : null,
    };
  });

  const units: UnitMapping[] = structure.units.map((unit) => {
    const concept = conceptMappings.find((c) => c.unitId === unit.id);
    const override = decisions.unitRoles[unit.id];
    const question = questionOf(unit.id);
    let role: UnitRole;
    let reason: string;
    if (unit.kind === "technical") {
      role = "technical";
      reason = unit.reason;
    } else if (concept) {
      role = "key";
      reason = `Mesure le concept « ${concept.name} » (${concept.roleLabel.toLowerCase()}).`;
    } else if (override) {
      role = override;
      reason = override === "context" ? "Classée par vous comme question de contexte." : "Classée par vous comme hors du champ de la question de recherche.";
    } else if (CONTEXT.test(foldText(unit.text))) {
      role = "context";
      reason = "Question de contexte : décrit les répondants ou leurs conditions d'activité ; utile pour la description de l'échantillon, pas pour répondre directement à la question de recherche.";
    } else {
      role = "other";
      reason = "Question non reliée aux concepts de la recherche : elle ne sera pas analysée sauf décision contraire.";
    }
    return { unit, role, conceptKey: concept?.conceptKey ?? null, question, typeLabel: statisticalTypeLabel(unit.type as StatisticalType), reason };
  });

  const missing = conceptMappings.filter((c) => c.status === "missing" && (c.role !== "undetermined" || report.variables.find((v) => v.key === c.conceptKey)?.group === "central"));
  const ambiguous = conceptMappings.filter((c) => c.ambiguity && c.status !== "confirmed");
  const unconfirmed = conceptMappings.filter((c) => c.status === "proposed");
  const issues = [
    ...missing.map((c) => `Aucune question du fichier ne semble mesurer « ${c.name} ».`),
    ...ambiguous.map((c) => c.ambiguity!),
  ];
  const central = conceptMappings.filter((c) => report.variables.find((v) => v.key === c.conceptKey)?.group === "central");
  const firstMissing = central.find((c) => c.status === "missing");
  const firstAmbiguous = central.find((c) => c.ambiguity && c.status !== "confirmed");
  const clarification = firstMissing
    ? `Quelle question de votre questionnaire mesure « ${firstMissing.name} » ?`
    : firstAmbiguous
      ? firstAmbiguous.ambiguity
      : unconfirmed.length
        ? `Les rapprochements proposés pour ${unconfirmed.map((c) => `« ${c.name} »`).join(", ")} sont-ils corrects ?`
        : null;
  return { concepts: conceptMappings, units, clarification, issues };
}

/** Analyses que la variable rend possibles, selon son type confirmé (indicatif, avant le plan). */
export function possibleAnalyses(type: StatisticalType | undefined, kind: QuestionUnit["kind"]): string[] {
  if (kind === "multi_choice") return ["Fréquence de chaque option (une personne peut en cocher plusieurs)"];
  switch (type) {
    case "nominal":
      return ["Effectifs et pourcentages", "Tableau croisé et Chi² / Fisher avec une autre variable qualitative", "Comparaison de moyennes d'une variable quantitative entre ses groupes"];
    case "ordinal":
      return ["Distribution et médiane", "Corrélation de Spearman", "Tableau croisé et Chi²"];
    case "quantitative_discrete":
    case "quantitative_continuous":
      return ["Moyenne, médiane, dispersion", "Corrélation de Pearson ou de Spearman", "Comparaison entre groupes (Welch, ANOVA)"];
    default:
      return ["Type à confirmer avant toute analyse"];
  }
}
