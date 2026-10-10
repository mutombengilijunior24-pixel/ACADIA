/**
 * Classificateur central : décrit un jeu de données selon des axes indépendants de l'interface
 * (source, unité d'analyse, structure des observations, nature des variables, objectifs de recherche).
 * Chaque caractéristique porte son origine (saisie, fichier, déduction, proposition), sa confiance
 * et sa justification. Une déduction n'est jamais présentée comme un fait confirmé, et un type de
 * variable confirmé par l'utilisateur n'est jamais modifié.
 */
import type { StatisticalType } from "@/lib/core/data/types";
import type { InstrumentKind } from "@/lib/core/journey/instrument";
import type { DataProvenance } from "@/lib/core/journey/provenance";
import type { ColumnKind } from "@/lib/core/journey/structure";
import type { ResearchUnderstandingInput } from "@/lib/core/understanding/types";
import { fold } from "@/lib/core/understanding/text";

import { domainOf, specialtyOf, suggestSpecialties, type DomainId, type SpecialtyId } from "./taxonomy";

/* ---------------------------------------------------------------- */
/* Axes                                                              */
/* ---------------------------------------------------------------- */

export type SourceType = "survey" | "interviews_text" | "financial_statements" | "economic_time_series" | "transactional" | "administrative_geographic" | "other";
export type AnalysisUnit = "individual" | "dyad" | "group" | "organization" | "transaction" | "accounting_item" | "territory" | "economic_period" | "multilevel" | "undetermined";
export type ObservationStructure = "cross_sectional" | "time_series" | "panel" | "paired_repeated" | "grouped_hierarchical" | "mixed_undetermined";
export type VariableNature =
  | "nominal"
  | "ordinal"
  | "quantitative_discrete"
  | "quantitative_continuous"
  | "date_time"
  | "free_text"
  | "geographic"
  | "multiple_response"
  | "identifier"
  | "derived"
  | "undetermined";
export type ResearchObjective = "describe" | "compare" | "associate" | "explain" | "predict" | "evaluate_effect" | "understand_qualitative" | "diagnose" | "reconcile";

export const SOURCE_LABELS: Record<SourceType, string> = {
  survey: "Questionnaire ou enquête",
  interviews_text: "Entretiens et données textuelles",
  financial_statements: "Documents financiers et comptables",
  economic_time_series: "Données économiques et séries temporelles",
  transactional: "Données transactionnelles et opérationnelles",
  administrative_geographic: "Données administratives, documentaires ou géographiques",
  other: "Autre source ou source non déterminée",
};
export const UNIT_LABELS: Record<AnalysisUnit, string> = {
  individual: "Individu",
  dyad: "Couple ou dyade",
  group: "Groupe ou équipe",
  organization: "Entreprise ou organisation",
  transaction: "Transaction ou opération",
  accounting_item: "Document ou poste comptable",
  territory: "Territoire ou unité géographique",
  economic_period: "Période économique",
  multilevel: "Données multiniveaux",
  undetermined: "Unité non déterminée",
};
export const STRUCTURE_LABELS: Record<ObservationStructure, string> = {
  cross_sectional: "Coupe transversale",
  time_series: "Série temporelle",
  panel: "Panel",
  paired_repeated: "Mesures appariées ou répétées",
  grouped_hierarchical: "Observations groupées ou hiérarchiques",
  mixed_undetermined: "Données mixtes ou structure non déterminée",
};
export const NATURE_LABELS: Record<VariableNature, string> = {
  nominal: "Qualitative nominale",
  ordinal: "Qualitative ordinale",
  quantitative_discrete: "Quantitative discrète",
  quantitative_continuous: "Quantitative continue",
  date_time: "Date et temps",
  free_text: "Texte libre",
  geographic: "Géographique",
  multiple_response: "Réponse multiple",
  identifier: "Identifiant",
  derived: "Variable dérivée ou indicateur composite",
  undetermined: "Nature à confirmer",
};
export const OBJECTIVE_KIND_LABELS: Record<ResearchObjective, string> = {
  describe: "Décrire",
  compare: "Comparer",
  associate: "Examiner une association",
  explain: "Expliquer un phénomène",
  predict: "Prédire",
  evaluate_effect: "Évaluer un effet",
  understand_qualitative: "Comprendre un phénomène qualitativement",
  diagnose: "Diagnostiquer une organisation",
  reconcile: "Effectuer un rapprochement comptable ou financier",
};

/* ---------------------------------------------------------------- */
/* Fiche                                                             */
/* ---------------------------------------------------------------- */

export type Origin = "user" | "file" | "inferred" | "proposed";
export type Confidence = "high" | "medium" | "low";

export const ORIGIN_LABELS: Record<Origin, string> = { user: "Renseigné par vous", file: "Détecté dans le fichier", inferred: "Déduit par ACADIA", proposed: "Proposé, non validé" };
export const CONFIDENCE_LABELS: Record<Confidence, string> = { high: "confiance élevée", medium: "confiance moyenne", low: "confiance faible" };

export interface Characteristic<T> {
  value: T;
  origin: Origin;
  confidence: Confidence;
  justification: string;
  /** Vrai seulement si l'utilisateur l'a saisie ou confirmée. */
  confirmed: boolean;
}

export interface DatasetColumnView {
  /** Identifiant stable (indépendant du libellé). */
  id: string;
  column: number;
  header: string;
  /** Valeurs présentes (non manquantes), sous forme de libellés. */
  values: string[];
  statisticalType: StatisticalType;
  confirmedByUser: boolean;
  structureKind: ColumnKind | null;
}

export interface DatasetView {
  datasetId: string;
  fileName: string;
  format: string;
  rowCount: number;
  columns: DatasetColumnView[];
}

export interface ClassificationOverrides {
  source?: SourceType;
  unit?: AnalysisUnit;
  structure?: ObservationStructure;
  objectives?: ResearchObjective[];
}

export interface Uncertainty {
  id: "domain" | "source" | "unit" | "structure" | "objective";
  question: string;
  options: Array<{ value: string; label: string }>;
  /** Pourquoi la réponse peut changer le choix des moteurs. */
  impact: string;
}

export interface ClassificationInput {
  domain?: DomainId | null;
  specialty?: SpecialtyId | null;
  secondary?: SpecialtyId[];
  research?: ResearchUnderstandingInput | null;
  instrument?: InstrumentKind | null;
  data?: DatasetView | null;
  provenance?: DataProvenance | null;
  preparation?: { qualityConfirmed: boolean; rowsUsed: number; uncertainTypes: number; excludedRows: number } | null;
  overrides?: ClassificationOverrides;
}

export interface ClassificationSheet {
  datasetId: string | null;
  fileName: string | null;
  domain: Characteristic<DomainId | null>;
  specialty: Characteristic<SpecialtyId | null>;
  secondary: SpecialtyId[];
  source: Characteristic<SourceType>;
  unit: Characteristic<AnalysisUnit>;
  structure: Characteristic<ObservationStructure>;
  variables: Array<{ id: string; column: number; header: string; nature: Characteristic<VariableNature>; tags: VariableNature[] }>;
  objectives: Array<Characteristic<ResearchObjective>>;
  provenance: { value: DataProvenance | null; note: string };
  preparation: { status: "no_data" | "imported" | "verified"; detail: string };
  uncertainties: Uncertainty[];
}

/* ---------------------------------------------------------------- */
/* Indices                                                           */
/* ---------------------------------------------------------------- */

const norm = (s: string) => ` ${fold(s).replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ")} `;
const has = (text: string, words: string[]) => words.filter((w) => text.includes(` ${w}`));

const ACCOUNTING = ["actif", "passif", "bilan", "capitaux propres", "immobilisation", "stock", "creance", "dette", "chiffre d'affaires", "resultat net", "resultat d'exploitation", "charges", "produits", "amortissement", "tresorerie", "fonds propres", "total actif", "total passif", "poste", "exercice", "compte"];
const ECONOMIC = ["taux", "inflation", "change", "pib", "indice", "masse monetaire", "prix", "cours", "reserves", "credit interieur", "exportation", "importation"];
const PERIOD_HEADER = ["mois", "annee", "date", "periode", "trimestre", "semestre", "semaine", "jour", "an", "exercice"];
const TRANSACTION = ["montant", "transaction", "facture", "commande", "vente", "achat", "paiement", "operation", "quantite", "prix unitaire"];
const CAMPAIGN = ["campagne", "impressions", "clics", "conversions", "cout", "budget", "canal", "taux de clic", "leads", "audience"];
const GEO = ["commune", "province", "ville", "pays", "quartier", "territoire", "region", "localite", "latitude", "longitude", "gps", "marche", "district", "village"];
const GROUP = ["equipe", "groupe", "service", "departement", "agence", "classe", "ecole", "succursale", "direction"];
const DYAD = ["conjoint", "conjointe", "epoux", "epouse", "couple", "binome", "dyade", "partenaire"];
const ORG = ["entreprise", "societe", "organisation", "pme", "firme", "etablissement", "cooperative", "institution"];
const PAIRED = /\b(avant|apres|pre|post|t0|t1|t2|initial|final|debut|fin)\b/;

const isPeriodValue = (v: string) => /^(\d{4}([-/]\d{1,2}([-/]\d{1,2})?)?|\d{1,2}[-/]\d{4}|(janv|fevr|mars|avr|mai|juin|juil|aout|sept|oct|nov|dec)\w*\.? ?\d{2,4}|t[1-4] ?\d{4}|\d{4} ?t[1-4]|q[1-4] ?\d{4})$/.test(fold(v).trim());
const isNumeric = (t: StatisticalType) => t === "quantitative_continuous" || t === "quantitative_discrete";
/** Colonne numérique : type confirmé/détecté, ou valeurs presque toutes numériques (type encore à confirmer). */
const numericLike = (c: DatasetColumnView) => isNumeric(c.statisticalType) || (c.values.length > 0 && c.values.filter((v) => /^-?[\d\s.,]+%?$/.test(v.trim())).length / c.values.length >= 0.9);
const distinct = (values: string[]) => new Set(values.map((v) => v.trim())).size;

function periodColumn(data: DatasetView): DatasetColumnView | null {
  return (
    data.columns.find((c) => c.structureKind === "date" || c.statisticalType === "temporal") ??
    data.columns.find((c) => has(norm(c.header), PERIOD_HEADER).length > 0 && c.values.length > 0 && c.values.filter(isPeriodValue).length / c.values.length >= 0.8) ??
    null
  );
}

/** Colonne d'entités (pays, entreprise, territoire…) répétées : indice de panel ou de groupes. */
function entityColumn(data: DatasetView, exclude: number | null): DatasetColumnView | null {
  return (
    data.columns.find((c) => c.column !== exclude && (c.statisticalType === "nominal" || c.statisticalType === "identifier") && c.structureKind !== "technical" && c.values.length >= 4 && distinct(c.values) >= 2 && distinct(c.values) < c.values.length && has(norm(c.header), [...ORG, ...GEO, "pays", "id", "code", "nom", "individu", "menage"]).length > 0) ?? null
  );
}

function pairedColumns(data: DatasetView): string[] {
  const numeric = data.columns.filter((c) => numericLike(c) || c.statisticalType === "ordinal");
  const stems = new Map<string, string[]>();
  for (const c of numeric) {
    const h = fold(c.header);
    if (!PAIRED.test(h)) continue;
    const stem = h.replace(PAIRED, "").replace(/[^a-z]+/g, " ").trim();
    stems.set(stem, [...(stems.get(stem) ?? []), c.header]);
  }
  return [...stems.values()].filter((v) => v.length >= 2).flat();
}

const characteristic = <T>(value: T, origin: Origin, confidence: Confidence, justification: string): Characteristic<T> => ({ value, origin, confidence, justification, confirmed: origin === "user" });

/* ---------------------------------------------------------------- */
/* Axes : déduction                                                  */
/* ---------------------------------------------------------------- */

function researchText(r: ResearchUnderstandingInput | null | undefined): string {
  if (!r) return "";
  return [r.title, r.mainQuestion, r.problem, r.generalObjective, ...r.specificObjectives, ...r.hypotheses, ...r.specificQuestions, r.population, r.field, r.context].filter(Boolean).join(" \n ");
}

function inferSource(input: ClassificationInput): { sheet: Characteristic<SourceType>; competing: SourceType[] } {
  const data = input.data;
  const scores = new Map<SourceType, { score: number; why: string[] }>();
  const add = (s: SourceType, score: number, why: string) => {
    const e = scores.get(s) ?? { score: 0, why: [] };
    e.score += score;
    e.why.push(why);
    scores.set(s, e);
  };
  if (data) {
    const headers = norm(data.columns.map((c) => c.header).join(" | "));
    const textValues = norm(data.columns.filter((c) => !numericLike(c)).flatMap((c) => c.values.slice(0, 80)).join(" | "));
    const numeric = data.columns.filter(numericLike).length;
    const accounting = new Set([...has(headers, ACCOUNTING), ...has(textValues, ACCOUNTING)]);
    if (accounting.size >= 3 && numeric >= 1) add("financial_statements", accounting.size, `termes comptables dans le fichier (${[...accounting].slice(0, 5).join(", ")})`);
    const period = periodColumn(data);
    const economic = has(headers, ECONOMIC);
    if (period && numeric >= 1) {
      const unique = distinct(period.values) === period.values.length;
      if (unique && economic.length) add("economic_time_series", 4 + economic.length, `colonne de période « ${period.header} » (une ligne par période) et indicateurs économiques (${economic.join(", ")})`);
      else if (unique) add("economic_time_series", 2, `colonne de période « ${period.header} » sans répétition`);
    }
    const tx = has(headers, TRANSACTION);
    if (tx.length >= 2) add("transactional", tx.length, `en-têtes d'opérations (${tx.join(", ")})`);
    const campaign = has(headers, CAMPAIGN);
    if (campaign.length >= 2) add("transactional", campaign.length + 1, `données de campagne (${campaign.join(", ")})`);
    const questionHeaders = data.columns.filter((c) => /\?\s*$/.test(c.header) || /^\s*q\d+/i.test(c.header)).length;
    const technical = data.columns.filter((c) => /submission|respondent|repondant|horodat|submitted/i.test(c.header)).length;
    const categorical = data.columns.filter((c) => c.statisticalType === "nominal" || c.statisticalType === "ordinal").length;
    if (questionHeaders / Math.max(1, data.columns.length) >= 0.25 || technical >= 1) add("survey", 3 + questionHeaders / 2, `${questionHeaders} en-tête(s) formulé(s) comme des questions${technical ? ", colonnes d'identification de répondants" : ""}`);
    else if (categorical >= Math.max(3, data.columns.length * 0.5) && !period) add("survey", 2, "majorité de réponses à modalités");
    const text = data.columns.filter((c) => c.statisticalType === "free_text").length;
    if (text >= Math.max(1, data.columns.length * 0.5)) add("interviews_text", 4, "majorité de colonnes de texte libre");
    const geo = has(headers, GEO);
    if (geo.length && !period && data.columns.some((c) => has(norm(c.header), GEO).length && distinct(c.values) === c.values.length && c.values.length >= 3)) add("administrative_geographic", 3, `une ligne par unité géographique (${geo.join(", ")})`);
  }
  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  const best = ranked[0];
  const instrumentSource: Partial<Record<InstrumentKind, SourceType>> = { questionnaire: "survey", interview_guide: "interviews_text", documentary: "administrative_geographic" };
  const declared = input.instrument ? instrumentSource[input.instrument] : undefined;
  if (input.overrides?.source) return { sheet: characteristic(input.overrides.source, "user", "high", "Type de données confirmé par vous."), competing: [] };
  const competing = ranked.filter(([, v]) => best && v.score >= best[1].score * 0.6).map(([k]) => k);
  if (declared && best && best[0] !== declared && best[1].score >= 4) {
    return { sheet: characteristic(best[0], "file", "medium", `Vous avez indiqué « ${input.instrument} », mais le fichier ressemble à : ${best[1].why.join(" ; ")}. À confirmer.`), competing: [declared, best[0]] };
  }
  if (declared) return { sheet: characteristic(declared, "user", best?.[0] === declared ? "high" : "medium", `Mode de collecte indiqué par vous${best?.[0] === declared ? ` et cohérent avec le fichier (${best[1].why.join(" ; ")})` : ""}.`), competing: [] };
  if (!best) return { sheet: characteristic<SourceType>("other", "inferred", "low", data ? "Aucun indice suffisant dans le fichier." : "Aucun fichier importé."), competing: [] };
  return { sheet: characteristic(best[0], "file", competing.length > 1 ? "low" : best[1].score >= 4 ? "high" : "medium", best[1].why.join(" ; ")), competing: competing.length > 1 ? competing : [] };
}

function inferUnit(input: ClassificationInput, source: SourceType, structure: ObservationStructure): Characteristic<AnalysisUnit> {
  if (input.overrides?.unit) return characteristic(input.overrides.unit, "user", "high", "Unité d'analyse confirmée par vous.");
  const population = norm(input.research?.population ?? "");
  const headers = norm((input.data?.columns ?? []).map((c) => c.header).join(" | "));
  if (structure === "panel") return characteristic<AnalysisUnit>("multilevel", "inferred", "medium", "Les mêmes entités sont observées à plusieurs périodes : deux niveaux (entité, période).");
  if (source === "financial_statements") return characteristic<AnalysisUnit>("accounting_item", "inferred", "high", "Chaque ligne est un poste comptable d'un état financier.");
  if (source === "economic_time_series") return characteristic<AnalysisUnit>("economic_period", "inferred", "high", "Chaque ligne correspond à une période (mois, trimestre, année).");
  if (source === "transactional") return characteristic<AnalysisUnit>("transaction", "inferred", "medium", "Chaque ligne correspond à une opération (vente, transaction, campagne).");
  if (source === "administrative_geographic") return characteristic<AnalysisUnit>("territory", "inferred", "medium", "Chaque ligne correspond à une unité géographique.");
  if (has(population, DYAD).length || has(headers, DYAD).length >= 2) return characteristic<AnalysisUnit>("dyad", "inferred", "medium", "La population ou les questions portent sur des couples ou des binômes.");
  if (has(population, GROUP).length) return characteristic<AnalysisUnit>("group", "inferred", "medium", "La population ciblée est formée de groupes ou d'équipes.");
  if (has(population, ORG).length && !/\bentrepreneur/.test(population)) return characteristic<AnalysisUnit>("organization", "inferred", "medium", "La population ciblée est formée d'entreprises ou d'organisations.");
  if (source === "survey" || source === "interviews_text") return characteristic<AnalysisUnit>("individual", "inferred", population.trim() ? "high" : "medium", structure === "grouped_hierarchical" ? "Chaque ligne correspond à un répondant ; les répondants sont regroupés (équipes, services…), ce qui crée un second niveau à discuter." : "Chaque ligne correspond à un répondant.");
  return characteristic<AnalysisUnit>("undetermined", "inferred", "low", "L'unité d'analyse n'a pas pu être déterminée.");
}

function inferStructure(input: ClassificationInput, source: SourceType): { sheet: Characteristic<ObservationStructure>; signals: ObservationStructure[] } {
  if (input.overrides?.structure) return { sheet: characteristic(input.overrides.structure, "user", "high", "Structure des observations confirmée par vous."), signals: [] };
  const data = input.data;
  const text = norm(researchText(input.research));
  const signals: Array<[ObservationStructure, string]> = [];
  if (data) {
    const period = periodColumn(data);
    const entity = entityColumn(data, period?.column ?? null);
    if (period && entity) {
      const pairs = new Set(period.values.map((p, i) => `${entity.values[i]}|${p}`));
      if (distinct(period.values) < period.values.length && pairs.size === Math.min(period.values.length, entity.values.length)) signals.push(["panel", `les entités de « ${entity.header} » sont observées à plusieurs périodes (« ${period.header} »)`]);
    }
    if (period && distinct(period.values) === period.values.length && period.values.length >= 6 && source !== "survey") signals.push(["time_series", `une observation par période dans « ${period.header} » (${period.values.length} périodes)`]);
    const paired = pairedColumns(data);
    if (paired.length) signals.push(["paired_repeated", `mesures répétées sur les mêmes unités : ${paired.slice(0, 4).map((h) => `« ${h} »`).join(", ")}`]);
    const group = data.columns.find((c) => has(norm(c.header), GROUP).length && c.statisticalType === "nominal" && distinct(c.values) >= 2 && distinct(c.values) <= c.values.length / 3);
    if (group && source !== "financial_statements") signals.push(["grouped_hierarchical", `répondants regroupés selon « ${group.header} » (${distinct(group.values)} groupes)`]);
  }
  if (/ avant (et|puis) apres | pre test | post test | pretest | posttest | mesures repetees /.test(text)) signals.push(["paired_repeated", "le cadre de recherche évoque des mesures avant/après sur les mêmes unités"]);
  const unique = [...new Map(signals.map(([s, why]) => [s, why])).entries()];
  // Les observations groupées n'empêchent pas une première lecture transversale : signal secondaire.
  const strong = unique.filter(([s]) => s !== "grouped_hierarchical");
  if (strong.length > 1) return { sheet: characteristic<ObservationStructure>("mixed_undetermined", "inferred", "low", `Plusieurs structures possibles : ${strong.map(([s, why]) => `${STRUCTURE_LABELS[s]} (${why})`).join(" ; ")}.`), signals: strong.map(([s]) => s) };
  if (strong.length === 1) return { sheet: characteristic(strong[0][0], data ? "file" : "inferred", "medium", `${strong[0][1]}.`), signals: [strong[0][0]] };
  if (unique.length) return { sheet: characteristic(unique[0][0], "file", "medium", `${unique[0][1]}.`), signals: [unique[0][0]] };
  if (source === "financial_statements") return { sheet: characteristic<ObservationStructure>("mixed_undetermined", "inferred", "medium", "Postes comptables présentés par exercice : structure propre aux états financiers, ni coupe transversale d'unités indépendantes ni série temporelle classique."), signals: [] };
  if (!data) return { sheet: characteristic<ObservationStructure>("mixed_undetermined", "inferred", "low", "Aucun fichier importé."), signals: [] };
  return { sheet: characteristic<ObservationStructure>("cross_sectional", "inferred", source === "survey" ? "high" : "medium", "Une ligne par unité, observée une seule fois, sans dimension temporelle repérée."), signals: [] };
}

const TYPE_NATURE: Record<StatisticalType, VariableNature> = {
  nominal: "nominal",
  ordinal: "ordinal",
  quantitative_discrete: "quantitative_discrete",
  quantitative_continuous: "quantitative_continuous",
  temporal: "date_time",
  identifier: "identifier",
  free_text: "free_text",
  to_confirm: "undetermined",
  unclassified: "undetermined",
};

function inferVariables(data: DatasetView | null | undefined): ClassificationSheet["variables"] {
  if (!data) return [];
  return data.columns.map((c) => {
    const header = norm(c.header);
    const tags: VariableNature[] = [];
    if (has(header, GEO).length) tags.push("geographic");
    if (/ (score|indice composite|index|total|moyenne|somme|ratio) /.test(header) && isNumeric(c.statisticalType)) tags.push("derived");
    let nature: Characteristic<VariableNature>;
    if (c.confirmedByUser) nature = characteristic(TYPE_NATURE[c.statisticalType], "user", "high", "Type confirmé par vous : il n'est jamais modifié par le classificateur.");
    else if (c.structureKind === "technical" || c.structureKind === "identifier") nature = characteristic<VariableNature>("identifier", "file", "high", "Colonne technique ou d'identification (pas une réponse).");
    else if (c.structureKind === "date") nature = characteristic<VariableNature>("date_time", "file", "high", "Valeurs de dates ou d'horodatage.");
    else if (c.structureKind === "multi_choice_item") nature = characteristic<VariableNature>("multiple_response", "file", "high", "Colonne d'une question à choix multiples.");
    else if (c.structureKind === "option_of") nature = characteristic<VariableNature>("nominal", "file", "high", "Colonne vrai/faux répétant une modalité d'une question à choix unique (mise de côté).");
    else if (tags.includes("geographic") && (c.statisticalType === "nominal" || c.statisticalType === "to_confirm" || c.statisticalType === "unclassified")) nature = characteristic<VariableNature>("geographic", "inferred", "medium", "L'en-tête désigne un lieu.");
    else if (tags.includes("derived")) nature = characteristic<VariableNature>("derived", "inferred", "medium", "L'en-tête désigne un score, un total ou un indicateur calculé.");
    else nature = characteristic(TYPE_NATURE[c.statisticalType], "file", c.statisticalType === "to_confirm" || c.statisticalType === "unclassified" ? "low" : "medium", "Type détecté dans les valeurs ; à confirmer à l'étape Vérification.");
    return { id: c.id, column: c.column, header: c.header, nature, tags: tags.filter((t) => t !== nature.value) };
  });
}

const OBJECTIVE_RULES: Array<{ objective: ResearchObjective; pattern: RegExp; note?: string }> = [
  { objective: "describe", pattern: /\b(decrire|description|identifier|caracteriser|presenter|recenser|dresser|profil|etat des lieux|inventorier)\b/ },
  { objective: "compare", pattern: /\b(comparer|comparaison|difference[s]? entre|differer|selon le|selon la|ecart[s]? entre)\b/ },
  { objective: "associate", pattern: /\b(relation|lien|liee?s?|associ\w*|correl\w*)\b/ },
  { objective: "explain", pattern: /\b(expliqu\w*|facteurs?|determinants?|causes? de|pourquoi)\b/ },
  { objective: "predict", pattern: /\b(predire|prediction|prevoir|prevision|anticiper)\b/ },
  { objective: "evaluate_effect", pattern: /\b(impact|effets?|influence\w*|incidence|contribution)\b/, note: "Le mot employé évoque un effet ; une évaluation causale exige un dispositif adapté (groupe de comparaison, avant/après, expérimentation). ACADIA n'en déduit pas une causalité." },
  { objective: "understand_qualitative", pattern: /\b(comprendre|perceptions?|vecu|representations?|experiences?|opinions?|ressenti)\b/ },
  { objective: "diagnose", pattern: /\b(diagnosti\w*|evaluer la situation|analyser la situation|sante financiere|performance financiere)\b/ },
  { objective: "reconcile", pattern: /\b(rapprochement|reconciliation|concordance des comptes|ecart[s]? comptables?)\b/ },
];

function inferObjectives(input: ClassificationInput): Array<Characteristic<ResearchObjective>> {
  if (input.overrides?.objectives?.length) return input.overrides.objectives.map((o) => characteristic(o, "user", "high", "Objectif confirmé par vous."));
  const r = input.research;
  if (!r) return [];
  const sources: Array<[string, string]> = [
    ["l'objectif général", r.generalObjective],
    ...r.specificObjectives.map((o, i): [string, string] => [`l'objectif spécifique ${i + 1}`, o]),
    ["la question principale", r.mainQuestion],
    ...r.hypotheses.map((h, i): [string, string] => [`l'hypothèse ${i + 1}`, h]),
    ["le sujet", r.title],
  ];
  const found = new Map<ResearchObjective, Characteristic<ResearchObjective>>();
  for (const [where, raw] of sources) {
    const text = fold(raw ?? "");
    if (!text.trim()) continue;
    for (const rule of OBJECTIVE_RULES) {
      const m = rule.pattern.exec(text);
      if (!m || found.has(rule.objective)) continue;
      const declared = where.startsWith("l'objectif");
      found.set(rule.objective, characteristic(rule.objective, "inferred", declared ? "high" : "medium", `« ${m[0]} » dans ${where}.${rule.note ? ` ${rule.note}` : ""}`));
    }
  }
  // Repéré dans vos textes, mais classé par ACADIA : reste une déduction tant que vous ne le confirmez pas.
  return [...found.values()];
}

/* ---------------------------------------------------------------- */
/* Fiche complète                                                    */
/* ---------------------------------------------------------------- */

export function classify(input: ClassificationInput): ClassificationSheet {
  const text = researchText(input.research);
  // Domaine et spécialité : choisis par l'utilisateur ; à défaut, déduits du sujet (à confirmer).
  const suggestions = suggestSpecialties(text);
  const chosen = specialtyOf(input.specialty ?? null);
  const domain: Characteristic<DomainId | null> = input.domain
    ? characteristic(input.domain, "user", "high", `Domaine choisi par vous : ${domainOf(input.domain)?.label}.`)
    : suggestions.length
      ? characteristic(suggestions[0].specialty.domain, "proposed", suggestions.length > 1 && suggestions[1].specialty.domain !== suggestions[0].specialty.domain ? "low" : "medium", `Le sujet évoque ${suggestions[0].specialty.label.toLowerCase()} (${suggestions[0].hits.join(", ")}).`)
      : characteristic<DomainId | null>(null, "proposed", "low", "Domaine non renseigné.");
  const specialty: Characteristic<SpecialtyId | null> = chosen
    ? characteristic(chosen.id, "user", "high", `Spécialité choisie par vous : ${chosen.label}.`)
    : suggestions.length
      ? characteristic(suggestions.find((s) => !input.domain || s.specialty.domain === input.domain)?.specialty.id ?? null, "proposed", "low", `Proposée d'après les mots du sujet : ${suggestions[0].hits.join(", ")}.`)
      : characteristic<SpecialtyId | null>(null, "proposed", "low", "Spécialité non renseignée.");

  const source = inferSource(input);
  const structure = inferStructure(input, source.sheet.value);
  const unit = inferUnit(input, source.sheet.value, structure.sheet.value);
  const objectives = inferObjectives(input);
  const variables = inferVariables(input.data);

  const uncertainties: Uncertainty[] = [];
  if (!input.domain && (suggestions.length === 0 || domain.confidence === "low")) {
    uncertainties.push({ id: "domain", question: "Dans quel domaine s'inscrit votre recherche ?", options: [{ value: "management", label: "Gestion" }, { value: "economics", label: "Économie" }, { value: "interdisciplinary", label: "Interdisciplinaire / autre" }], impact: "Le domaine oriente l'interprétation des résultats (pas le choix des tests)." });
  }
  if (input.data && (source.competing.length > 1 || source.sheet.confidence === "low")) {
    const options = (source.competing.length > 1 ? source.competing : (Object.keys(SOURCE_LABELS) as SourceType[])).map((s) => ({ value: s, label: SOURCE_LABELS[s] }));
    uncertainties.push({ id: "source", question: "Quel type de données contient votre fichier ?", options, impact: "Un questionnaire, des états financiers ou une série temporelle ne s'analysent pas avec les mêmes moteurs." });
  }
  if (input.data && structure.sheet.value === "mixed_undetermined" && structure.sheet.confidence === "low" && !input.overrides?.structure) {
    const options = (structure.signals.length ? structure.signals : (["cross_sectional", "time_series", "panel", "paired_repeated"] as ObservationStructure[])).map((s) => ({ value: s, label: STRUCTURE_LABELS[s] }));
    uncertainties.push({ id: "structure", question: "Comment vos observations sont-elles organisées ?", options, impact: "Des mesures répétées ou une série temporelle interdisent les tests prévus pour des observations indépendantes." });
  }
  const prep = input.preparation;
  return {
    datasetId: input.data?.datasetId ?? null,
    fileName: input.data?.fileName ?? null,
    domain,
    specialty,
    secondary: input.secondary ?? [],
    source: source.sheet,
    unit,
    structure: structure.sheet,
    variables,
    objectives,
    provenance: { value: input.provenance ?? null, note: input.provenance ? "Déclarée par vous ; non vérifiée indépendamment par ACADIA." : "Non renseignée." },
    preparation: !input.data
      ? { status: "no_data", detail: "Aucun fichier importé." }
      : prep?.qualityConfirmed
        ? { status: "verified", detail: `État des données confirmé : ${prep.rowsUsed} ligne(s) utilisée(s)${prep.excludedRows ? `, ${prep.excludedRows} exclue(s) par vous` : ""} ; ${prep.uncertainTypes} type(s) encore incertain(s).` }
        : { status: "imported", detail: `Fichier importé (${input.data.rowCount} ligne(s)) ; vérification des données non encore confirmée.` },
    uncertainties,
  };
}
