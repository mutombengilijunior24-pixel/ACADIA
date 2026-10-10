import type { ConceptRegistry, ExtractionResult } from "./concepts";
import { MARKERS, VAGUE_TERMS } from "./knowledge";
import { fold, hashKey } from "./text";
import type {
  HypothesisAnalysis,
  RelationNature,
  RelationProposal,
  ResearchUnderstandingInput,
  StudyNatureResult,
  UnderstandingDecisions,
  VariableCard,
} from "./types";

const DIRECTION_WORD = { positive: "positivement ", negative: "négativement ", unspecified: "" } as const;

function examines(nature: RelationNature | "unknown", x: string, y: string, direction: HypothesisAnalysis["direction"], names: string[]): string {
  if (nature === "association") {
    const sense =
      direction === "positive"
        ? `plus « ${x} » est élevé, plus « ${y} » tend à l'être`
        : direction === "negative"
          ? `plus « ${x} » est élevé, plus « ${y} » tend à être faible`
          : "le sens de cette association n'est pas précisé";
    return `Elle suppose une association entre « ${x} » et « ${y} » : ${sense}. Elle n'affirme pas que « ${x} » cause « ${y} ».`;
  }
  if (nature === "causal_claim") {
    const sense = direction === "positive" ? " (effet supposé positif)" : direction === "negative" ? " (effet supposé négatif)" : "";
    return `Elle suppose que « ${x} » agit sur « ${y} »${sense}, c'est-à-dire une relation de cause à effet. Une corrélation ne suffira pas à la soutenir : il faudra un dispositif qui écarte les autres explications.`;
  }
  if (nature === "difference") return `Elle suppose que « ${y} » diffère selon « ${x} ».`;
  if (names.length) return `Elle porte sur ${names.map((n) => `« ${n} »`).join(", ")}, mais la relation examinée n'est pas explicite.`;
  return "Aucun concept du sujet n'a été reconnu dans cette hypothèse : son objet doit être précisé.";
}

export interface HypothesisContext {
  input: ResearchUnderstandingInput;
  extraction: ExtractionResult;
  registry: ConceptRegistry;
  nature: StudyNatureResult;
  relations: RelationProposal[];
  variables: VariableCard[];
  decisions: UnderstandingDecisions;
}

export function analyzeHypotheses(context: HypothesisContext): HypothesisAnalysis[] {
  const { input, extraction, registry, nature, variables, decisions } = context;
  const nameOf = (key: string) => variables.find((v) => v.key === key)?.name ?? key;
  const frameTexts = [input.mainQuestion, input.generalObjective, ...input.specificObjectives, ...input.specificQuestions].filter(Boolean);
  const frameConcepts = new Set(frameTexts.flatMap((text) => registry.mentions(text).map((m) => m.concept.key)));
  const exploratory = nature.nature === "exploratory" || input.approach === "qualitative";

  return input.hypotheses.map((text, index) => {
    const id = `h-${hashKey(fold(text))}`;
    const folded = fold(text);
    const raw = extraction.raw.find((r) => r.sources[0].element === `hypothesis:${index}`);
    const mentioned = registry.mentions(text).map((m) => m.concept.key);
    const concepts = [...new Set([...(raw ? [raw.from, raw.to] : []), ...mentioned])];
    const relationNature: RelationNature | "unknown" = raw?.nature ?? (MARKERS.causal.test(folded) ? "causal_claim" : MARKERS.association.test(folded) ? "association" : "unknown");
    const direction = raw?.direction ?? "unspecified";
    const x = raw ? nameOf(raw.from) : "";
    const y = raw ? nameOf(raw.to) : "";

    const issues: string[] = [];
    if (concepts.length < 2 && relationNature !== "unknown") issues.push("Moins de deux concepts reconnus : une hypothèse relationnelle doit mettre en lien au moins deux variables identifiables.");
    if (concepts.length === 0) issues.push("Aucun concept du sujet n'est reconnu : l'hypothèse ne semble pas porter sur les éléments de la recherche.");
    if ((relationNature === "association" || relationNature === "causal_claim") && direction === "unspecified") issues.push("Le sens attendu de la relation (positif ou négatif) n'est pas précisé.");
    const relationMarkers = (folded.match(new RegExp(MARKERS.causal.source, "g")) ?? []).length + (folded.match(new RegExp(MARKERS.association.source, "g")) ?? []).length;
    const compound = relationMarkers > 1 && /\s(?:et|ainsi que)\s/.test(folded) && concepts.length > 2;
    if (compound) issues.push("Plusieurs relations semblent réunies dans une même hypothèse : scindez-la pour pouvoir tester chaque relation séparément.");
    if (relationNature === "causal_claim") issues.push("Formulation causale : sans dispositif expérimental, quasi expérimental ou longitudinal, seule une association pourra être examinée.");
    if (exploratory) issues.push("Étude exploratoire ou qualitative : une hypothèse n'est pas exigée ; elle peut être conservée comme proposition de travail.");

    const vagueTerms = VAGUE_TERMS.filter((term) => new RegExp(`\\b${term}\\b`).test(folded)).filter(
      (term) => !(["impact", "effet", "influence"].includes(term) && direction !== "unspecified"),
    );

    let reformulation: string | undefined;
    if (raw && (relationNature === "causal_claim" || direction === "unspecified" || compound)) {
      const sense = DIRECTION_WORD[direction];
      reformulation =
        relationNature === "difference"
          ? `« ${y} » diffère selon « ${x} » (préciser quels groupes sont comparés).`
          : `« ${x} » est ${sense}associé(e) à « ${y} »${direction === "unspecified" ? " (préciser : positivement ou négativement)" : ""}${input.population ? ` chez ${input.population}` : ""}.`;
    }

    const operationalNeeds: string[] = [];
    for (const key of concepts) {
      const card = variables.find((v) => v.key === key);
      if (!card || card.definition?.origin !== "user") operationalNeeds.push(`Définir « ${nameOf(key)} » et choisir ses indicateurs de mesure.`);
    }
    if (!input.population) operationalNeeds.push("Préciser la population sur laquelle l'hypothèse sera testée.");
    if (!input.period) operationalNeeds.push("Préciser la période à laquelle se rapportent les données.");

    const missing = concepts.filter((key) => !frameConcepts.has(key));
    const alignment: HypothesisAnalysis["alignment"] =
      frameTexts.length === 0
        ? { aligned: null, detail: "Impossible de vérifier : ni question ni objectif ne sont fournis." }
        : concepts.length === 0
          ? { aligned: false, detail: "Aucun concept commun avec la question et les objectifs." }
          : missing.length === 0
            ? { aligned: true, detail: "Les concepts de l'hypothèse figurent dans la question ou les objectifs." }
            : { aligned: false, detail: `${missing.map((k) => `« ${nameOf(k)} »`).join(", ")} ne figure(nt) ni dans la question ni dans les objectifs.` };

    const decision = decisions.hypotheses[id];
    return {
      id,
      index,
      text,
      origin: "user",
      status: decision === "rejected" ? "rejected" : decision === "retained" ? "retained" : "provided_untested",
      concepts,
      relationNature,
      direction,
      examines: examines(relationNature, x, y, direction, concepts.map(nameOf)),
      alignment,
      vagueTerms,
      issues,
      reformulation,
      operationalNeeds,
      empiricalStatus: "untested",
    };
  });
}

/** Hypothèses candidates : seulement pour une étude relationnelle sans hypothèse fournie. */
export function candidateHypotheses(context: HypothesisContext): HypothesisAnalysis[] {
  const { input, nature, relations, variables, decisions } = context;
  if (input.hypotheses.length > 0) return [];
  if (!["associative", "explanatory", "comparative"].includes(nature.nature) || input.approach === "qualitative") return [];
  const nameOf = (key: string) => variables.find((v) => v.key === key)?.name ?? key;
  return relations
    .filter((r) => r.status !== "rejected")
    .map((relation, index) => {
      const x = nameOf(relation.from);
      const y = nameOf(relation.to);
      const sense = DIRECTION_WORD[relation.direction];
      const text =
        relation.nature === "difference"
          ? `« ${y} » diffère selon « ${x} ».`
          : relation.directed
            ? `« ${x} » est ${sense}associé(e) à « ${y} »${input.population ? ` chez ${input.population}` : ""}.`
            : `Il existe une association entre « ${x} » et « ${y} »${input.population ? ` chez ${input.population}` : ""}.`;
      const id = `c-${hashKey(text)}`;
      const decision = decisions.hypotheses[id];
      const directionUnknown = relation.nature !== "difference" && relation.direction === "unspecified";
      return {
        id,
        index,
        text,
        origin: "engine" as const,
        status: decision === "rejected" ? ("rejected" as const) : decision === "retained" ? ("retained" as const) : ("candidate" as const),
        concepts: [relation.from, relation.to],
        relationNature: relation.nature === "causal_claim" ? ("association" as const) : relation.nature,
        direction: relation.direction,
        examines:
          `Proposition construite à partir de la relation repérée dans : ${relation.sources.map((s) => s.excerpt).join(" / ")}. ` +
          (relation.nature === "causal_claim" ? "Votre formulation évoque un effet ; la proposition est volontairement formulée comme une association, seule vérifiable sans dispositif causal." : "Formulée comme une association, sans affirmer de causalité."),
        alignment: { aligned: true, detail: "Construite à partir de vos propres formulations." },
        vagueTerms: [],
        issues: directionUnknown ? ["Le sens attendu n'est pas indiqué dans vos textes : précisez-le avant de retenir cette hypothèse."] : [],
        operationalNeeds: [`Définir et mesurer « ${x} » et « ${y} ».`],
        empiricalStatus: "untested" as const,
      };
    });
}

export function hypothesesNote(input: ResearchUnderstandingInput, nature: StudyNatureResult, candidates: number): string {
  if (input.hypotheses.length > 0) return "Hypothèses fournies : aucune n'est confirmée ni infirmée, car aucune donnée empirique n'a été analysée.";
  if (nature.nature === "exploratory" || input.approach === "qualitative") return "Aucune hypothèse fournie. Pour une étude exploratoire ou qualitative, des hypothèses ne sont pas indispensables : le moteur n'en invente pas.";
  if (nature.nature === "descriptive") return "Aucune hypothèse fournie. Une étude descriptive n'exige pas d'hypothèse : le moteur n'en invente pas.";
  if (candidates > 0) return "Aucune hypothèse fournie. Des hypothèses candidates sont proposées à partir de vos formulations : ce sont des propositions à valider, pas des résultats.";
  return "Aucune hypothèse fournie. La nature de l'étude ou les relations visées doivent être précisées avant d'envisager des hypothèses.";
}
