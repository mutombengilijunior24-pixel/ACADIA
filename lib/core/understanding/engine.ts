import type { AiEnrichmentResult } from "./ai";
import { clarifications, diagnose, improvements } from "./coherence";
import { detectStudyNature, extractConcepts } from "./concepts";
import { analyzeHypotheses, candidateHypotheses, hypothesesNote } from "./hypotheses";
import { ESSENTIAL_FIELDS, FIELD_LABELS, providedFields } from "./input";
import { RELATION_LABELS } from "./labels";
import { conceptKey, contentStems, excerpt, hashKey, stemSet } from "./text";
import {
  UNDERSTANDING_ENGINE_VERSION,
  type AiSection,
  type ClarificationQuestion,
  type Diagnostic,
  type ResearchUnderstandingInput,
  type UnderstandingDecisions,
  type UnderstandingReport,
  type VariableCard,
  type VariableDecision,
  type VariableRole,
} from "./types";
import { buildRelations, buildVariables } from "./variables";

export function emptyDecisions(): UnderstandingDecisions {
  return { variables: {}, added: [], hypotheses: {}, relations: {} };
}

/** Empreinte des entrées : un rapport dont l'empreinte diffère du formulaire est périmé. */
export function inputKey(input: ResearchUnderstandingInput): string {
  return hashKey(input);
}

/**
 * Analyse complète, déterministe. `ai` (facultatif) ajoute des suggestions marquées « ai »
 * sans jamais modifier ce que le moteur ou l'utilisateur ont établi.
 */
export function buildUnderstandingReport(
  input: ResearchUnderstandingInput,
  decisions: UnderstandingDecisions = emptyDecisions(),
  ai: AiEnrichmentResult | null = null,
): UnderstandingReport {
  const extraction = extractConcepts(input);
  const registry = extraction.registry;
  const nature = detectStudyNature(input);
  const relations = buildRelations(extraction, decisions);
  let cards = buildVariables(input, extraction, nature, relations, decisions);
  const aiQuestions: ClarificationQuestion[] = [];
  const aiDiagnostics: Diagnostic[] = [];
  if (ai?.status === "ok") cards = mergeAi(cards, ai, input, decisions, aiQuestions, aiDiagnostics);

  const variables = sortCards(cards.filter((c) => c.status !== "rejected"));
  const rejectedVariables = cards.filter((c) => c.status === "rejected");
  const hypothesisContext = { input, extraction, registry, nature, relations, variables, decisions };
  const hypotheses = analyzeHypotheses(hypothesisContext);
  const candidates = candidateHypotheses(hypothesisContext);
  const coherenceContext = { input, extraction, registry, nature, relations, variables, hypotheses };
  const diagnostics = [...diagnose(coherenceContext), ...aiDiagnostics];
  const questions = [...clarifications(coherenceContext, diagnostics), ...aiQuestions].sort((a, b) => a.priority - b.priority);

  const provided = providedFields(input);
  const knownIds = new Set([...hypotheses, ...candidates].map((h) => h.id));
  const relationIds = new Set(relations.map((r) => r.id));
  const cardKeys = new Set(cards.map((c) => c.key));
  const orphanDecisions = [
    ...Object.keys(decisions.variables).filter((key) => !cardKeys.has(key)).map((key) => `Variable « ${decisions.variables[key].name ?? key} »`),
    ...Object.keys(decisions.hypotheses).filter((id) => !knownIds.has(id)).map(() => "Décision sur une hypothèse qui n'existe plus"),
    ...Object.keys(decisions.relations).filter((id) => !relationIds.has(id)).map(() => "Décision sur une relation qui n'existe plus"),
  ];

  const aiSection: AiSection = !ai
    ? { status: "not_requested" }
    : ai.status === "ok"
      ? { status: "ok", model: ai.model }
      : { status: ai.status, message: ai.message };

  return {
    engineVersion: UNDERSTANDING_ENGINE_VERSION,
    inputKey: inputKey(input),
    nature,
    synthesis: synthesis(input, variables, relations, nature.explanation),
    provided: provided.map((field) => ({ field, label: FIELD_LABELS[field] })),
    missingEssential: ESSENTIAL_FIELDS.filter((field) => !provided.includes(field)).map((field) => ({ field, label: FIELD_LABELS[field] })),
    mainQuestion: input.mainQuestion ? { text: input.mainQuestion, origin: "user" } : null,
    specificQuestions: input.specificQuestions,
    generalObjective: input.generalObjective || null,
    specificObjectives: input.specificObjectives,
    hypotheses,
    candidateHypotheses: candidates,
    hypothesesNote: hypothesesNote(input, nature, candidates.length),
    variables,
    rejectedVariables,
    relations,
    diagnostics,
    clarifications: questions,
    improvements: improvements(coherenceContext, diagnostics),
    orphanDecisions,
    ai: aiSection,
  };
}

const GROUP_ORDER = { central: 0, contextual: 1, secondary: 2 } as const;
const ROLE_ORDER: Record<VariableRole, number> = { explanatory: 0, mediator: 1, moderator: 2, dependent: 3, control: 4, descriptive: 5, qualitative_category: 6, undetermined: 7 };

function sortCards(cards: VariableCard[]): VariableCard[] {
  return cards
    .map((card, index) => ({ card, index }))
    .sort((a, b) => GROUP_ORDER[a.card.group] - GROUP_ORDER[b.card.group] || (a.card.group === "central" ? ROLE_ORDER[a.card.role] - ROLE_ORDER[b.card.role] : 0) || a.index - b.index)
    .map(({ card }) => card);
}

function synthesis(input: ResearchUnderstandingInput, variables: VariableCard[], relations: UnderstandingReport["relations"], natureText: string): string {
  const nameOf = (key: string) => variables.find((v) => v.key === key)?.name ?? key;
  const central = variables.filter((v) => v.group === "central");
  const parts: string[] = [];
  parts.push(`Le sujet « ${input.title} » porte sur ${central.length ? central.map((v) => `« ${v.name} »`).join(" et ") : "un objet que le moteur n'a pas pu isoler"}.`);
  const active = relations.filter((r) => r.status !== "rejected");
  if (active.length) {
    parts.push(
      `Relation(s) envisagée(s) : ${active
        .map((r) => {
          const sense = r.direction === "positive" ? ", sens supposé positif" : r.direction === "negative" ? ", sens supposé négatif" : "";
          return r.directed ? `${RELATION_LABELS[r.nature].toLowerCase()} de « ${nameOf(r.from)} » vers « ${nameOf(r.to)} »${sense}` : `${RELATION_LABELS[r.nature].toLowerCase()} entre « ${nameOf(r.from)} » et « ${nameOf(r.to)} » (sens non indiqué)`;
        })
        .join(" ; ")}.`,
    );
  }
  parts.push(
    `Population : ${input.population || "non précisée"} ; terrain : ${input.field || "non précisé"} ; période : ${input.period || "non précisée"}.`,
  );
  if (input.problem) parts.push(`Problème de départ (vos termes) : « ${excerpt(input.problem, 240)} »`);
  parts.push(natureText);
  parts.push("Aucun résultat empirique n'est établi à ce stade : les relations restent des suppositions à examiner sur des données.");
  return parts.join(" ");
}

const PRIORITY = { essential: 1, important: 2, useful: 3 } as const;

function mergeAi(
  cards: VariableCard[],
  ai: Extract<AiEnrichmentResult, { status: "ok" }>,
  input: ResearchUnderstandingInput,
  decisions: UnderstandingDecisions,
  questions: ClarificationQuestion[],
  diagnostics: Diagnostic[],
): VariableCard[] {
  const result = [...cards];
  const userText = stemSet(JSON.stringify(input));
  for (const concept of ai.data.concepts) {
    const suggestion = { definition: concept.contextualDefinition, dimensions: concept.dimensions, ambiguities: concept.ambiguities, evidence: concept.evidence };
    const target = findCard(result, concept.engineConcept) ?? findCard(result, concept.name);
    if (target) {
      target.ai = suggestion;
      continue;
    }
    const key = conceptKey(concept.name);
    if (!key) continue;
    const decision: VariableDecision = decisions.variables[key] ?? {};
    const inText = contentStems(concept.name).every((s) => userText.has(s));
    result.push({
      key,
      name: decision.name ?? concept.name,
      origin: "ai",
      group: "secondary",
      definition: decision.definition ? { text: decision.definition, origin: "user" } : null,
      role: decision.role ?? "undetermined",
      candidateRoles: [],
      roleOrigin: decision.role ? "user" : "engine",
      justification: [
        inText ? "Concept suggéré par l'IA à partir de vos textes." : "Concept suggéré par l'IA, absent mot pour mot de vos textes : à examiner avec prudence.",
        ...(concept.evidence ? [`Passage cité : « ${concept.evidence} »`] : []),
      ],
      relationNotes: [],
      dimensions: [],
      toClarify: decision.definition ? [] : ["Définition opérationnelle à expliciter.", "Rôle dans l'étude à préciser."],
      confidence: decision.status === "confirmed" ? "high" : "low",
      confidenceReason: decision.status === "confirmed" ? "Validé par vous." : "Suggestion de l'IA non vérifiée par le moteur déterministe.",
      status: decision.status ?? "proposed",
      sources: [],
      ai: suggestion,
    });
  }
  ai.data.clarificationQuestions.forEach((q, i) => questions.push({ id: `ai-q-${i}`, priority: PRIORITY[q.priority], origin: "ai", target: "study", question: q.question, why: q.why }));
  ai.data.observations.forEach((o, i) =>
    diagnostics.push({
      id: `ai-d-${i}`,
      kind: o.kind,
      severity: "medium",
      origin: "ai",
      elements: [o.element === "study" ? "title" : o.element],
      title: o.kind === "contradiction" ? "Incohérence signalée par l'IA" : o.kind === "missing" ? "Information manquante signalée par l'IA" : "Amélioration suggérée par l'IA",
      problem: o.observation,
      whyItMatters: o.whyItMatters,
    }),
  );
  return result;
}

function findCard(cards: VariableCard[], name: string): VariableCard | undefined {
  const stems = contentStems(name);
  if (!stems.length) return undefined;
  const set = new Set(stems);
  return (
    cards.find((c) => c.key === stems.join("-")) ??
    cards.find((c) => {
      const cs = contentStems(c.name);
      return cs.length > 0 && (cs.every((s) => set.has(s)) || stems.every((s) => cs.includes(s)));
    })
  );
}

/* ------------------------------------------------------------------ */
/* Décisions de l'utilisateur (fonctions pures)                        */
/* ------------------------------------------------------------------ */

export function setVariableDecision(decisions: UnderstandingDecisions, key: string, patch: VariableDecision): UnderstandingDecisions {
  const added = decisions.added.find((a) => a.key === key);
  if (added) {
    if (patch.status === "rejected") return { ...decisions, added: decisions.added.filter((a) => a.key !== key) };
    return {
      ...decisions,
      added: decisions.added.map((a) => (a.key === key ? { ...a, name: patch.name ?? a.name, definition: patch.definition ?? a.definition, role: patch.role ?? a.role } : a)),
    };
  }
  const merged = { ...decisions.variables[key], ...patch };
  for (const field of Object.keys(merged) as Array<keyof VariableDecision>) if (merged[field] === undefined || merged[field] === "") delete merged[field];
  return { ...decisions, variables: { ...decisions.variables, [key]: merged } };
}

export function resetVariableDecision(decisions: UnderstandingDecisions, key: string): UnderstandingDecisions {
  const variables = { ...decisions.variables };
  delete variables[key];
  return { ...decisions, variables };
}

export function addVariable(decisions: UnderstandingDecisions, name: string, role: VariableRole, definition?: string): UnderstandingDecisions {
  const key = `user-${conceptKey(name)}`;
  if (!contentStems(name).length || decisions.added.some((a) => a.key === key)) return decisions;
  return { ...decisions, added: [...decisions.added, { key, name: name.trim(), role, definition: definition?.trim() || undefined }] };
}

export function setHypothesisDecision(decisions: UnderstandingDecisions, id: string, value: "retained" | "rejected" | null): UnderstandingDecisions {
  const hypotheses = { ...decisions.hypotheses };
  if (value) hypotheses[id] = value;
  else delete hypotheses[id];
  return { ...decisions, hypotheses };
}

export function setRelationDecision(decisions: UnderstandingDecisions, id: string, value: "confirmed" | "rejected" | null): UnderstandingDecisions {
  const relations = { ...decisions.relations };
  if (value) relations[id] = value;
  else delete relations[id];
  return { ...decisions, relations };
}
