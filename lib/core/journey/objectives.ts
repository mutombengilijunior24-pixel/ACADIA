/**
 * Couverture des objectifs de recherche par les analyses (prévues ou réalisées).
 * Un objectif n'est « examiné par un test » que si un test de relation porte réellement sur
 * les concepts qu'il nomme ; un objectif descriptif est « décrit » si chacun de ses concepts
 * fait l'objet d'une analyse. Les concepts nommés sans analyse sont signalés.
 */
import { cleanHeader } from "./structure";
import { coverage, tokensOf } from "./match";

export type ObjectiveStatus = "tested" | "described" | "partial" | "not_addressed";

export const OBJECTIVE_LABELS: Record<ObjectiveStatus, string> = {
  tested: "Examiné par un test",
  described: "Décrit par les analyses",
  partial: "Partiellement couvert",
  not_addressed: "Non couvert par les analyses",
};

export interface CoverageAnalysis {
  title: string;
  level: "relation" | "descriptive";
  variables: Array<{ name: string; header: string }>;
  /** Résultat lisible (après calcul) ; absent au stade du plan. */
  verdict?: string;
}

export interface ObjectiveCoverage {
  text: string;
  kind: "général" | "spécifique";
  intent: "relation" | "description";
  status: ObjectiveStatus;
  /** Concepts nommés par l'objectif sans aucune analyse correspondante. */
  missing: string[];
  analyses: string[];
  detail: string;
}

const RELATIONAL = /\b(relation|lien|li[ée]e?s?\s+[àa]|associ|effet|influen|impact|d[ée]termin|facteurs?|expliqu|compar|diff[ée]ren|corr[ée]l|d[ée]pend|contribu)/i;

export const objectiveIntent = (text: string): "relation" | "description" => (RELATIONAL.test(text) ? "relation" : "description");

const mentionsName = (objective: string[], name: string) => coverage(tokensOf(name), objective).score >= 0.6;
// L'intitulé d'une question est long : c'est l'objectif qui doit être (presque) entièrement couvert par lui.
const mentionsHeader = (objective: string[], header: string) => objective.length >= 2 && coverage(objective, tokensOf(cleanHeader(header))).score >= 0.75;
const VERBS = new Set(tokensOf("décrire identifier examiner analyser étudier mesurer évaluer caractériser déterminer connaître comprendre montrer vérifier relation lien entre chez"));

export function coverObjectives(
  objectives: Array<{ text: string; kind: "général" | "spécifique" }>,
  analyses: CoverageAnalysis[],
  concepts: string[],
): ObjectiveCoverage[] {
  return objectives
    .filter(({ text }) => tokensOf(text).length > 0)
    .map(({ text, kind }) => {
      const tokens = tokensOf(text);
      const content = tokens.filter((t) => !VERBS.has(t));
      const intent = objectiveIntent(text);
      const relevant = analyses.filter((a) => a.variables.some((v) => mentionsName(tokens, v.name) || mentionsHeader(content, v.header)));
      const covers = (concept: string) => analyses.some((a) => a.variables.some((v) => v.name === concept || mentionsName(tokensOf(v.name), concept) || coverage(tokensOf(concept), tokensOf(cleanHeader(v.header))).score >= 0.75));
      const missing = concepts.filter((c) => mentionsName(tokens, c) && !covers(c));
      const tests = relevant.filter((a) => a.level === "relation" && a.variables.filter((v) => mentionsName(tokens, v.name) || mentionsHeader(content, v.header)).length >= 2);
      const list = (items: CoverageAnalysis[]) => items.map((a) => (a.verdict ? `« ${a.title} » : ${a.verdict}` : `« ${a.title} »`)).join(" ; ");
      const missingText = missing.length ? ` Non couvert : ${missing.map((m) => `« ${m} »`).join(", ")} ne fait l'objet d'aucune analyse.` : "";
      let status: ObjectiveStatus;
      let detail: string;
      if (intent === "relation") {
        if (tests.length) {
          status = missing.length ? "partial" : "tested";
          detail = `${list(tests)}.${missingText}`;
        } else if (relevant.length) {
          status = "partial";
          detail = `Variables seulement décrites (${list(relevant)}) : aucun test ne porte sur la relation visée par cet objectif.${missingText}`;
        } else {
          status = "not_addressed";
          detail = `Aucune analyse ne porte sur les concepts de cet objectif.${missingText} Complétez la correspondance des variables ou le plan si nécessaire.`;
        }
      } else if (relevant.length) {
        status = missing.length ? "partial" : "described";
        detail = `${list(relevant)}.${missingText}`;
      } else {
        status = "not_addressed";
        detail = `Aucune analyse ne porte sur les concepts de cet objectif.${missingText} Complétez la correspondance des variables ou le plan si nécessaire.`;
      }
      return { text, kind, intent, status, missing, analyses: relevant.map((a) => a.title), detail };
    });
}
