import type { Concept, ExtractionResult } from "./concepts";
import { knowledgeFor } from "./concepts";
import { elementLabel, ROLE_LABELS } from "./labels";
import { contentStems } from "./text";
import type {
  Confidence,
  ElementRef,
  RelationProposal,
  ResearchUnderstandingInput,
  StudyNatureResult,
  UnderstandingDecisions,
  VariableCard,
  VariableRole,
} from "./types";

const STRONG_SOURCES = (ref: ElementRef) => ref === "mainQuestion" || ref === "generalObjective" || ref.startsWith("hypothesis") || ref.startsWith("specificQuestion") || ref.startsWith("specificObjective");

export function relationId(from: string, to: string, directed: boolean): string {
  return directed ? `rel:${from}>${to}` : `rel:${[from, to].sort().join("~")}`;
}

export function buildRelations(extraction: ExtractionResult, decisions: UnderstandingDecisions): RelationProposal[] {
  return extraction.relations.map((relation) => {
    const id = relationId(relation.from, relation.to, relation.directed);
    const note =
      relation.nature === "causal_claim"
        ? "Formulée en termes d'effet ou d'influence. C'est une relation supposée : une causalité ne pourra être soutenue qu'avec des données et un dispositif adaptés (antériorité de la cause, contrôle des autres explications)."
        : relation.nature === "difference"
          ? "Différence supposée entre groupes, à vérifier sur des données."
          : "Association supposée, à examiner sur des données. Une association ne signifie pas que l'un des concepts cause l'autre.";
    return {
      id,
      from: relation.from,
      to: relation.to,
      directed: relation.directed,
      nature: relation.nature,
      direction: relation.direction,
      sources: relation.sources,
      evidenceStatus: "assumed",
      note,
      status: decisions.relations[id] ?? "proposed",
    };
  });
}

function unitLabel(input: ResearchUnderstandingInput): string {
  return input.population ? `l'unité étudiée (${input.population})` : "l'unité étudiée";
}

function sourceList(refs: ElementRef[]): string {
  return [...new Set(refs.map((ref) => elementLabel(ref).toLowerCase()))].join(", ");
}

export function buildVariables(
  input: ResearchUnderstandingInput,
  extraction: ExtractionResult,
  nature: StudyNatureResult,
  relations: RelationProposal[],
  decisions: UnderstandingDecisions,
): VariableCard[] {
  const active = relations.filter((r) => r.status !== "rejected");
  const nameOf = (key: string) => decisions.variables[key]?.name ?? extraction.registry.concepts.find((c) => c.key === key)?.label ?? key;
  const qualitativeStudy = nature.nature === "exploratory" || input.approach === "qualitative";

  const cards = extraction.registry.concepts.map((concept) => cardFor(concept));

  for (const added of decisions.added) {
    if (cards.some((card) => card.key === added.key)) continue;
    const known = knowledgeFor(contentStems(added.name));
    cards.push({
      key: added.key,
      name: added.name,
      origin: "user",
      group: "secondary",
      definition: added.definition ? { text: added.definition, origin: "user" } : null,
      role: added.role,
      candidateRoles: [],
      roleOrigin: "user",
      justification: ["Ajoutée par vous."],
      relationNotes: [],
      dimensions: known?.concept.dimensions ?? [],
      pitfall: known?.concept.pitfall,
      ambiguity: added.definition ? undefined : known?.concept.ambiguity,
      toClarify: added.definition ? [] : ["Définition opérationnelle à préciser."],
      confidence: "high",
      confidenceReason: "Variable ajoutée et validée par vous.",
      status: "confirmed",
      sources: [],
      matchedAlias: known?.concept.label,
    });
  }
  return cards;

  function cardFor(concept: Concept): VariableCard {
    const decision = decisions.variables[concept.key] ?? {};
    const outs = active.filter((r) => r.directed && r.from === concept.key);
    const ins = active.filter((r) => r.directed && r.to === concept.key);
    const undirected = active.filter((r) => !r.directed && (r.from === concept.key || r.to === concept.key));
    const justification: string[] = [];
    let role: VariableRole = "undetermined";
    let candidateRoles: VariableRole[] = [];
    let confidence: Confidence = "low";
    let confidenceReason = "";

    if (qualitativeStudy && concept.group !== "contextual") {
      role = "qualitative_category";
      justification.push(
        input.approach === "qualitative"
          ? "Approche qualitative déclarée : le concept est traité comme une catégorie d'analyse, sans distinction imposée entre variables dépendantes et indépendantes."
          : "Étude de nature exploratoire : aucune relation de cause à effet n'est postulée ; le concept est traité comme une catégorie d'analyse.",
      );
      confidence = "medium";
      confidenceReason = "Déduit de la nature de l'étude, pas d'une relation formulée.";
    } else if (concept.roleHint && concept.group !== "central") {
      if (concept.roleHint.roles.length === 1) role = concept.roleHint.roles[0];
      else candidateRoles = concept.roleHint.roles;
      justification.push(`Éléments ${concept.roleHint.reason} (${elementLabel(concept.roleHint.source.element).toLowerCase()}).`);
      confidence = "low";
      confidenceReason = "Rôle suggéré par la manière dont l'élément est présenté ; son effet sur la relation étudiée n'est pas précisé.";
    } else if (concept.roleHint) {
      role = concept.roleHint.roles[0];
      justification.push(`${ROLE_LABELS[role]} : ${concept.roleHint.reason} (${elementLabel(concept.roleHint.source.element).toLowerCase()}).`);
      confidence = "medium";
      confidenceReason = "Rôle explicitement formulé dans vos textes.";
    } else if (outs.length && ins.length) {
      role = "mediator";
      candidateRoles = ["mediator", "explanatory", "dependent"];
      justification.push(`Expliqué par « ${ins.map((r) => nameOf(r.from)).join(" », « ")} » et supposé agir sur « ${outs.map((r) => nameOf(r.to)).join(" », « ")} » : position intermédiaire.`);
      confidence = "low";
      confidenceReason = "Position intermédiaire déduite de plusieurs formulations : à confirmer.";
    } else if (outs.length) {
      role = "explanatory";
      const refs = outs.flatMap((r) => r.sources.map((s) => s.element));
      justification.push(`Placé comme facteur supposé dans : ${sourceList(refs)}.`);
      confidence = refs.some(STRONG_SOURCES) ? "medium" : "low";
      confidenceReason = refs.some(STRONG_SOURCES) ? "Rôle déduit de la formulation de vos questions, objectifs ou hypothèses." : "Rôle déduit du seul sujet.";
    } else if (ins.length) {
      role = "dependent";
      const refs = ins.flatMap((r) => r.sources.map((s) => s.element));
      justification.push(`Placé comme phénomène à expliquer dans : ${sourceList(refs)}.`);
      confidence = refs.some(STRONG_SOURCES) ? "medium" : "low";
      confidenceReason = refs.some(STRONG_SOURCES) ? "Rôle déduit de la formulation de vos questions, objectifs ou hypothèses." : "Rôle déduit du seul sujet.";
    } else if (undirected.length) {
      candidateRoles = ["explanatory", "dependent"];
      justification.push(`Mis en relation avec « ${undirected.map((r) => nameOf(r.from === concept.key ? r.to : r.from)).join(" », « ")} » sans que le sens de la relation soit indiqué (${sourceList(undirected.flatMap((r) => r.sources.map((s) => s.element)))}).`);
      confidenceReason = "Le sens de la relation n'est pas indiqué : le moteur ne choisit pas à votre place.";
    } else if (nature.nature === "descriptive") {
      role = "descriptive";
      justification.push("Étude descriptive : le concept sera décrit, sans relation postulée.");
      confidence = "medium";
      confidenceReason = "Déduit de la nature descriptive de l'étude.";
    } else {
      justification.push("Aucune relation avec les autres concepts n'a été repérée dans vos textes.");
      confidenceReason = "Rôle impossible à déduire des informations fournies.";
    }
    if (concept.sources.length) justification.push(`Mentionné dans : ${sourceList(concept.sources.map((s) => s.element))}.`);

    const relationNotes: string[] = [];
    for (const relation of active.filter((r) => r.from === concept.key || r.to === concept.key)) {
      const other = nameOf(relation.from === concept.key ? relation.to : relation.from);
      const direction = relation.direction === "positive" ? " (sens supposé positif)" : relation.direction === "negative" ? " (sens supposé négatif)" : "";
      if (relation.nature === "causal_claim") {
        relationNotes.push(relation.from === concept.key ? `Supposé agir sur « ${other} »${direction} — effet non démontré.` : `Supposé influencé par « ${other} »${direction} — effet non démontré.`);
      } else if (relation.nature === "difference") {
        relationNotes.push(relation.from === concept.key ? `Groupes à comparer pour « ${other} ».` : `Supposé varier selon « ${other} ».`);
      } else {
        relationNotes.push(`Association supposée avec « ${other} »${direction}, à examiner sur des données.`);
      }
    }
    if (concept.group === "contextual") {
      const core = active.find((r) => r.directed) ?? active[0];
      if (core) relationNotes.push(`Pourrait modifier la relation « ${nameOf(core.from)} » – « ${nameOf(core.to)} » (modération) ou devoir être neutralisé dans l'analyse (contrôle).`);
    }

    const userDefinition = decision.definition ?? concept.userDefinition?.text;
    const definition = userDefinition
      ? { text: userDefinition, origin: "user" as const }
      : concept.knowledge
        ? { text: concept.knowledge.definition.replace("{unit}", unitLabel(input)), origin: "engine" as const }
        : null;

    const toClarify: string[] = [];
    if (!userDefinition) {
      toClarify.push(
        concept.knowledge?.ambiguity
          ? `Définition opérationnelle à expliciter : ${concept.knowledge.ambiguity}`
          : "Définition opérationnelle à expliciter : précisez ce que recouvre ce concept dans votre étude.",
      );
    }
    if (concept.knowledge) toClarify.push(...concept.knowledge.precisions);
    else toClarify.push("Aucune dimension connue du moteur pour ce concept : décrivez les aspects que vous comptez observer ou mesurer.");

    const finalRole = decision.role ?? role;
    if (finalRole === "undetermined") toClarify.push(candidateRoles.length ? `Rôle à préciser parmi : ${candidateRoles.map((r) => ROLE_LABELS[r].toLowerCase()).join(", ")}.` : "Rôle dans l'étude à préciser.");

    const confirmed = decision.status === "confirmed";
    return {
      key: concept.key,
      name: decision.name ?? concept.label,
      origin: concept.origin,
      group: concept.group,
      definition,
      role: finalRole,
      candidateRoles: decision.role ? [] : candidateRoles,
      roleOrigin: decision.role ? "user" : "engine",
      justification,
      relationNotes,
      dimensions: concept.knowledge?.dimensions ?? [],
      pitfall: concept.knowledge?.pitfall,
      ambiguity: userDefinition ? undefined : concept.knowledge?.ambiguity,
      toClarify,
      confidence: confirmed || decision.role ? "high" : confidence,
      confidenceReason: confirmed ? "Validé par vous." : decision.role ? "Rôle choisi par vous." : confidenceReason,
      status: decision.status ?? "proposed",
      sources: concept.sources,
      matchedAlias: concept.knowledge?.label,
    };
  }
}
