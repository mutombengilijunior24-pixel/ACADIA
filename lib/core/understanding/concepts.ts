import { KNOWLEDGE, MARKERS, POPULATION_NOUNS, type KnowledgeConcept } from "./knowledge";
import { capitalize, cleanPhrase, contentStems, containsStems, excerpt, fold, splitEnumeration, stemSet } from "./text";
import type {
  ElementRef,
  RelationNature,
  ResearchUnderstandingInput,
  SourceRef,
  StudyNature,
  StudyNatureResult,
  VariableRole,
} from "./types";

export interface TextElement {
  ref: ElementRef;
  text: string;
}

export function elementsOf(input: ResearchUnderstandingInput): TextElement[] {
  const elements: TextElement[] = [
    { ref: "title", text: input.title },
    { ref: "context", text: input.context },
    { ref: "problem", text: input.problem },
    { ref: "mainQuestion", text: input.mainQuestion },
    ...input.specificQuestions.map((text, i) => ({ ref: `specificQuestion:${i}` as const, text })),
    { ref: "generalObjective", text: input.generalObjective },
    ...input.specificObjectives.map((text, i) => ({ ref: `specificObjective:${i}` as const, text })),
    ...input.hypotheses.map((text, i) => ({ ref: `hypothesis:${i}` as const, text })),
    { ref: "field", text: input.field },
    { ref: "period", text: input.period },
    { ref: "population", text: input.population },
    ...input.concepts.map((text, i) => ({ ref: `concept:${i}` as const, text })),
    { ref: "notes", text: input.notes },
  ];
  return elements.filter((element) => element.text.trim().length > 0);
}

/** Copie en minuscules sans accents, de MÊME longueur que l'original (les indices restent valables). */
function foldSameLength(text: string): string {
  return text
    .split("")
    .map((char) => {
      if (char === "’" || char === "`") return "'";
      const base = char.normalize("NFD")[0] ?? char;
      const lower = base.toLowerCase();
      return lower.length === 1 ? lower : char;
    })
    .join("");
}

export interface Concept {
  key: string;
  label: string;
  stems: string[];
  origin: "user" | "engine";
  group: "central" | "contextual" | "secondary";
  userDefinition?: { text: string; source: SourceRef };
  knowledge?: KnowledgeConcept;
  sources: SourceRef[];
  roleHint?: { roles: VariableRole[]; source: SourceRef; reason: string };
}

export interface ExtractedRelation {
  from: string;
  to: string;
  directed: boolean;
  nature: RelationNature;
  direction: "positive" | "negative" | "unspecified";
  sources: SourceRef[];
}

const FRAMING =
  /^(?:(?:dans quelle mesure|en quoi|comment|pourquoi|quel(?:le)?s?\s+(?:est|sont)|existe-t-il|y a-t-il|l'objectif (?:general |principal )?(?:de cette (?:etude|recherche) )?(?:est|consiste) (?:de |d'|a )?|cette (?:etude|recherche) vise a|il s'agit d[e']|nous (?:voulons|cherchons a|proposons d[e'])|(?:il est )?suppose que|on suppose que|nous supposons que|examiner|analyser|etudier|evaluer|mesurer|determiner|identifier|verifier|montrer|apprecier|decrire|comprendre|explorer|demontrer|contribuer a|savoir si|(?:une |l')?analyse (?:de |du |des |d')|(?:une |l')?etude (?:de |du |des |d')|(?:une |l')?evaluation (?:de |du |des |d'))\s*)+/;

const ART = "(?:de\\s+la\\s+|de\\s+l'|du\\s+|des\\s+|de\\s+|d')";
const PATTERNS: Array<{ regex: RegExp; build: (m: RegExpExecArray) => { x: [number, number]; y: [number, number]; directed: boolean; nature: RelationNature; direction: string } | null }> = [
  {
    // « effet / impact / influence / rôle de X sur Y »
    regex: new RegExp(`(?:^|\\s)(?:l'|les?\\s+|la\\s+|un\\s+|une\\s+)?(?:effets?|impacts?|influences?|incidences?|role|contribution|apport)\\s+(?:(positif|negatif|positive|negative)\\s+)?${ART}(.+?)\\s+(?:sur|dans|a l'egard de|au niveau de)\\s+(.+)$`),
    build: (m) => ({ x: span(m, 2), y: span(m, 3), directed: true, nature: "causal_claim", direction: m[1] ?? "" }),
  },
  {
    // « différence / écart de X selon Y » ; « comparer X selon Y »
    regex: new RegExp(`(?:differences?|ecarts?|compar\\w*)\\s+${ART}?(.+?)\\s+(?:selon|en fonction de|suivant)\\s+(.+)$`),
    build: (m) => ({ x: span(m, 2), y: span(m, 1), directed: true, nature: "difference", direction: "" }),
  },
  {
    // « relation / lien / association entre X et Y »
    regex: /(?:relations?|liens?|rapports?|associations?|correlations?)\s+(?:qui existe\s+|existant\s+)?entre\s+(.+?)\s+et\s+(.+)$/,
    build: (m) => ({ x: span(m, 1), y: span(m, 2), directed: false, nature: "association", direction: "" }),
  },
  {
    // « X est (positivement) associé(e) / lié(e) à Y »
    regex: /^(.+?)\s+(?:est|sont|serait|seraient|soit|soient)(?:-(?:il|elle|ils|elles))?\s+(?:(positivement|negativement|significativement|fortement|statistiquement)\s+)?(?:associee?s?|liee?s?|correlee?s?|en relation)\s+(?:a la\s+|a l'|au\s+|aux\s+|a\s+|avec\s+)(.+)$/,
    build: (m) => ({ x: span(m, 1), y: span(m, 3), directed: true, nature: "association", direction: m[2] ?? "" }),
  },
  {
    // « X a un effet (positif) sur Y »
    regex: /^(.+?)\s+(?:a|ont|aurait|auraient)\s+(?:un|une)\s+(?:effet|impact|influence|incidence)\s+(?:(positif|negatif|positive|negative|significatif|significative)\s+)?sur\s+(.+)$/,
    build: (m) => ({ x: span(m, 1), y: span(m, 3), directed: true, nature: "causal_claim", direction: m[2] ?? "" }),
  },
  {
    // « X influence / améliore / réduit Y »
    regex: /^(.+?)\s+(influence(?:nt)?|influe(?:nt)? sur|ameliore(?:nt)?|favorise(?:nt)?|reduit|reduisent|augmente(?:nt)?|diminue(?:nt)?|determine(?:nt)?|affecte(?:nt)?|contribue(?:nt)? a|explique(?:nt)?|conditionne(?:nt)?|stimule(?:nt)?|renforce(?:nt)?)(?:-t-(?:il|elle|ils|elles)|-(?:il|elle|ils|elles))?\s+(?:(positivement|negativement|significativement|fortement)\s+)?(.+)$/,
    build: (m) => ({ x: span(m, 1), y: span(m, 4), directed: true, nature: "causal_claim", direction: `${m[2]} ${m[3] ?? ""}` }),
  },
];

/** Positions [début, fin] du groupe n dans la chaîne d'origine. */
function span(m: RegExpExecArray, group: number): [number, number] {
  const value = m[group];
  if (value === undefined) return [0, 0];
  const start = m.indices?.[group]?.[0] ?? m.index + m[0].indexOf(value);
  return [start, start + value.length];
}

function directionOf(text: string): "positive" | "negative" | "unspecified" {
  if (/(positi|amelior|favoris|augment|stimul|renforc)/.test(text)) return "positive";
  if (/(negati|redui|diminu)/.test(text)) return "negative";
  return "unspecified";
}

const PERIOD = /[\s,]*\(?\s*(?:(?:de|entre|depuis|en|pour la periode|au cours de(?: la periode)?|sur la periode)\s+)?(?:19|20)\d{2}(?:\s*(?:-|–|a|et|au)\s*(?:19|20)\d{2})?\s*\)?\s*$/;

export interface ExtractionContext {
  populationStems: Set<string>;
}

/** Nettoie une expression extraite : lieu, période, population et déterminants retirés. */
export function cleanConceptPhrase(original: string, context: ExtractionContext): string {
  let phrase = original.replace(/\s+/g, " ").trim();
  // Sous-titre (« : cas de… ») et ponctuation finale.
  phrase = phrase.split(/\s*(?::|\s[–—]\s|\s-\s)\s*/)[0];
  phrase = phrase.replace(/[?.!;,]+\s*$/, "");
  // Période
  for (let i = 0; i < 2; i += 1) {
    const folded = foldSameLength(phrase);
    const period = PERIOD.exec(folded);
    if (period && period.index > 0) phrase = phrase.slice(0, period.index);
  }
  // Expression connue telle quelle (« accès à Internet », « satisfaction des clients ») : rien à retirer.
  if (knowledgeFor(contentStems(phrase), true)) return cleanPhrase(phrase);
  // Lieu : « à Lubumbashi », « dans la ville de Kolwezi », « en RDC »
  const location = /\s+(?:à|a|au|aux|en|dans\s+(?:la|le|les)\s+(?:ville|province|commune|région|cité|territoire|quartier)s?\s+(?:de|d['’]))\s*(?=[A-ZÉÈÀ])(?!Internet\b)/.exec(phrase);
  if (location && location.index > 0) phrase = phrase.slice(0, location.index);
  const locationLower = /\s+dans\s+(?:la|le|les)\s+(?:ville|province|commune|région|cité|territoire|quartier)s?\s+(?:de|d['’]).*$/i.exec(phrase);
  if (locationLower && locationLower.index > 0) phrase = phrase.slice(0, locationLower.index);
  // Population (« des PME étudiées »), sauf si l'expression complète est un concept connu.
  if (!knowledgeFor(contentStems(phrase), true)) {
    const folded = foldSameLength(phrase);
    const qualifier = /\s+(?:des|du|de la|de l'|chez les|aupres des|au sein des?|dans les|pour les|parmi les)\s+([a-z0-9-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = qualifier.exec(folded))) {
      const word = m[1];
      const isPopulation = POPULATION_NOUNS.includes(word) || context.populationStems.has(contentStems(word)[0] ?? "");
      // « satisfaction des clients » est un concept en soi : on ne coupe pas avant « clients ».
      const partOfKnown = knowledgeFor(contentStems(phrase.slice(0, m.index + m[0].length)), true);
      if (isPopulation && !partOfKnown && contentStems(phrase.slice(0, m.index)).length > 0) {
        phrase = phrase.slice(0, m.index);
        break;
      }
    }
  }
  return cleanPhrase(phrase.replace(/\s+(?:et|ou|de|des|du|la|le|les|à|a)$/i, ""));
}

/** Concept connu dont un synonyme est inclus dans les racines données (synonyme le plus long). */
export function knowledgeFor(stems: string[], exact = false): { concept: KnowledgeConcept; alias: string } | null {
  let best: { concept: KnowledgeConcept; alias: string; size: number } | null = null;
  const set = new Set(stems);
  for (const concept of KNOWLEDGE) {
    for (const alias of concept.aliases) {
      const aliasStems = contentStems(alias);
      if (aliasStems.length === 0) continue;
      const match = exact ? aliasStems.length === stems.length && aliasStems.every((s) => set.has(s)) : aliasStems.every((s) => set.has(s));
      if (match && (!best || aliasStems.length > best.size)) best = { concept, alias, size: aliasStems.length };
    }
  }
  return best ? { concept: best.concept, alias: best.alias } : null;
}

export class ConceptRegistry {
  readonly concepts: Concept[] = [];

  find(stems: string[]): Concept | undefined {
    if (stems.length === 0) return undefined;
    const set = new Set(stems);
    return (
      this.concepts.find((c) => c.stems.length === stems.length && c.stems.every((s) => set.has(s))) ??
      this.concepts.find((c) => {
        const cs = new Set(c.stems);
        return c.stems.every((s) => set.has(s)) || stems.every((s) => cs.has(s));
      })
    );
  }

  add(label: string, origin: "user" | "engine", group: Concept["group"], source: SourceRef): Concept | null {
    const clean = cleanPhrase(label);
    const stems = contentStems(clean);
    if (stems.length === 0 || clean.length < 2) return null;
    const existing = this.find(stems);
    if (existing) {
      if (!existing.sources.some((s) => s.element === source.element)) existing.sources.push(source);
      if (origin === "user") existing.origin = "user";
      if (group === "central" && existing.group !== "central") existing.group = "central";
      return existing;
    }
    const known = knowledgeFor(stems);
    const concept: Concept = {
      key: stems.join("-"),
      label: capitalize(clean),
      stems,
      origin,
      group,
      knowledge: known?.concept,
      sources: [source],
    };
    this.concepts.push(concept);
    return concept;
  }

  /** Concepts mentionnés dans un texte (mot à mot ou par un synonyme connu). */
  mentions(text: string): Array<{ concept: Concept; viaAlias?: string }> {
    const stems = stemSet(text);
    const result: Array<{ concept: Concept; viaAlias?: string }> = [];
    for (const concept of this.concepts) {
      if (containsStems(stems, concept.stems)) {
        result.push({ concept });
        continue;
      }
      const alias = concept.knowledge?.aliases.find((a) => {
        const aliasStems = contentStems(a);
        return aliasStems.length > 0 && aliasStems.every((s) => stems.has(s));
      });
      if (alias) result.push({ concept, viaAlias: alias });
    }
    return result;
  }
}

const RELATIONAL_REFS = (ref: ElementRef) =>
  ref === "title" || ref === "mainQuestion" || ref === "generalObjective" || ref.startsWith("specificQuestion") || ref.startsWith("specificObjective") || ref.startsWith("hypothesis");

function splitConjunction(text: string, context: ExtractionContext): string[] {
  const whole = cleanConceptPhrase(text, context);
  if (knowledgeFor(contentStems(whole), true)) return [whole];
  const parts = text.split(/\s+(?:et|ainsi que)\s+/).map((part) => cleanConceptPhrase(part, context));
  if (parts.length > 1 && parts.every((part) => contentStems(part).length > 0)) return parts;
  return contentStems(whole).length ? [whole] : [];
}

/** Extrait les relations formulées dans une phrase. */
function relationsInSentence(text: string, ref: ElementRef, context: ExtractionContext): Array<{ x: string; y: string; directed: boolean; nature: RelationNature; direction: ExtractedRelation["direction"] }> {
  const original = text.replace(/\s+/g, " ").trim();
  const folded = foldSameLength(original);
  const framing = FRAMING.exec(folded);
  const offset = framing ? framing[0].length : 0;
  const body = folded.slice(offset);
  for (const pattern of PATTERNS) {
    const flags = pattern.regex.flags.includes("d") ? pattern.regex.flags : `${pattern.regex.flags}d`;
    const regex = new RegExp(pattern.regex.source, flags);
    const m = regex.exec(body);
    if (!m) continue;
    const built = pattern.build(m);
    if (!built) continue;
    // « effet de la formation et du leadership sur… » : deux facteurs distincts.
    const xs = splitConjunction(original.slice(offset + built.x[0], offset + built.x[1]), context);
    const ys = splitConjunction(original.slice(offset + built.y[0], offset + built.y[1]), context);
    if (xs.length === 0 || ys.length === 0) continue;
    return xs.flatMap((x) => ys.map((y) => ({ x, y, directed: built.directed, nature: built.nature, direction: directionOf(built.direction) })));
  }
  if (ref === "title") {
    // Sujet de la forme « X et Y » : association dont le sens n'est pas indiqué.
    const titleBody = original.slice(offset).split(/\s*(?::|\s[–—]\s)\s*/)[0];
    const parts = titleBody.split(/\s+et\s+/);
    if (parts.length === 2) {
      const x = cleanConceptPhrase(parts[0], context);
      const y = cleanConceptPhrase(parts[1], context);
      if (contentStems(x).length > 0 && contentStems(y).length > 0 && !/^\d/.test(y)) {
        return [{ x, y, directed: false, nature: "association", direction: "unspecified" }];
      }
    }
  }
  return [];
}

const LIST_HEADS: Array<{ regex: RegExp; roles: VariableRole[]; reason: string }> = [
  { regex: /variables?\s+de\s+contr[ôo]le/i, roles: ["control"], reason: "présentés comme variables de contrôle" },
  { regex: /variables?\s+mod[ée]ratrices?|mod[ée]rateurs?/i, roles: ["moderator"], reason: "présentés comme modérateurs" },
  { regex: /variables?\s+m[ée]diatrices?|m[ée]diateurs?/i, roles: ["mediator"], reason: "présentés comme médiateurs" },
  { regex: /d[ée]terminants?|facteurs?\s+explicatifs?/i, roles: ["explanatory"], reason: "présentés comme facteurs explicatifs" },
  { regex: /contraintes?|obstacles?|freins?|conditions?|facteurs?/i, roles: ["control", "moderator"], reason: "présentés comme contraintes ou conditions" },
];

export interface ExtractionResult {
  registry: ConceptRegistry;
  /** Relations dédoublonnées (toutes leurs sources conservées). */
  relations: ExtractedRelation[];
  /** Relations telles que formulées, élément par élément (une source chacune). */
  raw: ExtractedRelation[];
  locations: { text: string; source: SourceRef }[];
}

export function extractConcepts(input: ResearchUnderstandingInput): ExtractionResult {
  const registry = new ConceptRegistry();
  const context: ExtractionContext = { populationStems: stemSet(input.population) };
  const relations: ExtractedRelation[] = [];

  // 1. Concepts déclarés par l'utilisateur (« Concept : définition »).
  input.concepts.forEach((entry, i) => {
    const [name, ...rest] = entry.split(/\s*(?::|\s[–—]\s|\s-\s)\s*/);
    const definition = rest.join(" : ").trim();
    const source: SourceRef = { element: `concept:${i}`, excerpt: excerpt(entry) };
    const concept = registry.add(name, "user", "secondary", source);
    if (concept && definition) concept.userDefinition = { text: definition, source };
  });

  // 2. Relations formulées dans le sujet, les questions, les objectifs et les hypothèses.
  for (const element of elementsOf(input).filter((e) => RELATIONAL_REFS(e.ref))) {
    const source: SourceRef = { element: element.ref, excerpt: excerpt(element.text) };
    for (const found of relationsInSentence(element.text, element.ref, context)) {
      const from = registry.add(found.x, "engine", "central", source);
      const to = registry.add(found.y, "engine", "central", source);
      if (!from || !to || from === to) continue;
      relations.push({ from: from.key, to: to.key, directed: found.directed, nature: found.nature, direction: found.direction, sources: [source] });
    }
  }

  // 2b. Objectif sans relation repérée : son objet devient un concept (« Décrire la satisfaction des clients… »).
  for (const element of elementsOf(input).filter((e) => e.ref === "generalObjective" || e.ref.startsWith("specificObjective"))) {
    if (relations.some((r) => r.sources[0].element === element.ref)) continue;
    const framing = FRAMING.exec(foldSameLength(element.text));
    if (!framing) continue;
    const source: SourceRef = { element: element.ref, excerpt: excerpt(element.text) };
    const parts = element.text.slice(framing[0].length).split(/\s+(?:sur|face à|à l['’]égard d[eu]s?|vis-à-vis d[eu]s?)\s+/i);
    for (const label of parts.flatMap((part) => splitConjunction(part, context))) {
      const stems = contentStems(label);
      if (stems.length === 0) continue;
      // Expression longue : seulement rattachée à un concept existant, jamais créée telle quelle.
      if (stems.length > 5) {
        const existing = registry.find(stems);
        if (existing && !existing.sources.some((s) => s.element === source.element)) existing.sources.push(source);
        continue;
      }
      registry.add(label, "engine", "secondary", source);
    }
  }

  // 3. Sujet sans relation repérée : l'expression principale devient un concept.
  if (!relations.some((r) => r.sources[0].element === "title")) {
    // « Perceptions des étudiants sur l'enseignement à distance » → deux concepts, sans relation supposée.
    const body = input.title.replace(FRAMING_TITLE, "").split(/\s*(?::|\s[–—]\s)\s*/)[0];
    for (const part of body.split(/\s+(?:sur|face à|à l['’]égard d[eu]s?|vis-à-vis d[eu]s?)\s+/i)) {
      registry.add(cleanConceptPhrase(part, context), "engine", "central", { element: "title", excerpt: excerpt(input.title) });
    }
  }

  // 4. Énumérations de contraintes, facteurs, variables de contrôle…
  const listSources: TextElement[] = elementsOf(input).filter((e) => e.ref === "notes" || e.ref === "context" || e.ref === "problem");
  for (const element of listSources) {
    for (const line of element.text.split(/\n|(?<=[.!?])\s+/)) {
      const colon = line.indexOf(":");
      if (colon < 0) continue;
      const head = line.slice(0, colon);
      const rule = LIST_HEADS.find((r) => r.regex.test(head));
      if (!rule) continue;
      const source: SourceRef = { element: element.ref, excerpt: excerpt(line) };
      for (const item of splitEnumeration(line.slice(colon + 1))) {
        const label = cleanConceptPhrase(item, context);
        const concept = registry.add(label, "engine", "contextual", source);
        if (concept && concept.group !== "central" && !concept.roleHint) concept.roleHint = { roles: rule.roles, source, reason: rule.reason };
      }
    }
  }

  // 5. Médiation / modération formulées explicitement (« par l'intermédiaire de… », « en fonction de… »).
  for (const element of elementsOf(input).filter((e) => RELATIONAL_REFS(e.ref))) {
    const folded = foldSameLength(element.text);
    for (const [kind, regex] of [
      ["mediator", /(?:par l'intermediaire|par le biais|a travers|via)\s+(?:de la\s+|de l'|du\s+|des\s+|de\s+|d')?(.+?)(?=\s*[,.?;]|$)/],
      ["moderator", /(?:en fonction d[eu]s?|conditionnee? par|moderee? par|selon que)\s+(?:la\s+|le\s+|les\s+|l')?(.+?)(?=\s*[,.?;]|$)/],
    ] as const) {
      const m = regex.exec(folded);
      if (!m || !m[1]) continue;
      // Le groupe 1 termine la correspondance (l'anticipation finale ne consomme rien).
      const end = m.index + m[0].length;
      const start = end - m[1].length;
      const label = cleanConceptPhrase(element.text.slice(start, end), context);
      const source: SourceRef = { element: element.ref, excerpt: excerpt(element.text) };
      const concept = registry.add(label, "engine", "central", source);
      if (concept) concept.roleHint = { roles: [kind], source, reason: kind === "mediator" ? "relation présentée comme passant par ce concept" : "relation présentée comme dépendant de ce concept" };
    }
  }

  // 6. Lieux cités dans le sujet ou la question (pour contrôler la cohérence avec le terrain).
  const locations: ExtractionResult["locations"] = [];
  for (const element of elementsOf(input).filter((e) => e.ref === "title" || e.ref === "mainQuestion")) {
    const regex = /\s(?:à|au|aux|en)\s+((?:[A-ZÉÈÀ][\p{L}'-]+)(?:\s+[A-ZÉÈÀ][\p{L}'-]+)*)/gu;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(element.text))) if (m[1] !== "Internet") locations.push({ text: m[1], source: { element: element.ref, excerpt: excerpt(element.text) } });
  }

  return { registry, relations: dedupeRelations(relations), raw: relations, locations };
}

const FRAMING_TITLE = /^\s*(?:(?:analyse|étude|etude|évaluation|evaluation|examen|essai|approche|contribution à l['’]étude)\s+(?:de\s+la|de\s+l['’]|du|des|de|d['’])\s*)/i;

/** Une relation orientée remplace la même paire non orientée ; les sources sont conservées dans l'ordre. */
function dedupeRelations(relations: ExtractedRelation[]): ExtractedRelation[] {
  const result: ExtractedRelation[] = [];
  for (const relation of relations) {
    const same = result.find((r) => (r.from === relation.from && r.to === relation.to) || (r.from === relation.to && r.to === relation.from));
    if (!same) {
      result.push({ ...relation, sources: [...relation.sources] });
      continue;
    }
    for (const source of relation.sources) if (!same.sources.some((s) => s.element === source.element)) same.sources.push(source);
    if (!same.directed && relation.directed) {
      same.from = relation.from;
      same.to = relation.to;
      same.directed = true;
    }
    if (relation.nature === "causal_claim") same.nature = "causal_claim";
    if (same.direction === "unspecified") same.direction = relation.direction;
  }
  return result;
}

/* ---------------------------------------------------------------- */
/* Nature de l'étude                                                 */
/* ---------------------------------------------------------------- */

const NATURE_TEXT: Record<StudyNature, string> = {
  explanatory: "Étude explicative : elle cherche à expliquer un phénomène par d'autres facteurs (la formulation suggère une relation de cause à effet).",
  associative: "Étude relationnelle : elle examine l'association entre des concepts, sans postuler à ce stade une causalité démontrée.",
  comparative: "Étude comparative : elle compare des groupes ou des situations.",
  descriptive: "Étude descriptive : elle cherche à décrire ou à caractériser un phénomène, sans examiner de relation.",
  exploratory: "Étude exploratoire ou qualitative : elle cherche à comprendre des perceptions, des pratiques ou des logiques ; des variables dépendantes et indépendantes ne sont pas requises.",
  undetermined: "Nature de l'étude indéterminée : les textes fournis ne permettent pas de savoir si l'étude vise à décrire, à explorer ou à expliquer.",
};

export function detectStudyNature(input: ResearchUnderstandingInput): StudyNatureResult {
  const weights: Partial<Record<string, number>> = { mainQuestion: 3, generalObjective: 3, title: 1 };
  const scores: Record<Exclude<StudyNature, "undetermined">, number> = { explanatory: 0, associative: 0, comparative: 0, descriptive: 0, exploratory: 0 };
  const evidence: Record<keyof typeof scores, SourceRef[]> = { explanatory: [], associative: [], comparative: [], descriptive: [], exploratory: [] };
  let causalLanguage = false;
  for (const element of elementsOf(input).filter((e) => RELATIONAL_REFS(e.ref))) {
    const weight = weights[element.ref] ?? (element.ref.startsWith("hypothesis") ? 2 : 1);
    const text = fold(element.text);
    const source = { element: element.ref, excerpt: excerpt(element.text) };
    const hit = (nature: keyof typeof scores) => {
      scores[nature] += weight;
      evidence[nature].push(source);
    };
    if (MARKERS.causal.test(text)) {
      hit("explanatory");
      causalLanguage = true;
    }
    if (MARKERS.association.test(text)) hit("associative");
    if (MARKERS.comparative.test(text)) hit("comparative");
    if (MARKERS.descriptive.test(text)) hit("descriptive");
    if (MARKERS.exploratory.test(text) || MARKERS.qualitative.test(text)) hit("exploratory");
  }
  if (input.approach === "qualitative") {
    scores.exploratory += 3;
    evidence.exploratory.push({ element: "notes", excerpt: "Approche qualitative choisie" });
  }
  const top = Math.max(...Object.values(scores));
  const tied = (Object.keys(scores) as Array<keyof typeof scores>).filter((n) => top > 0 && scores[n] === top);
  let nature: StudyNature = tied.length ? tied[0] : "undetermined";
  if (tied.length > 1) {
    // Association et effet à égalité : on retient la formulation la plus prudente (association).
    // Toute autre égalité (ex. décrire ou expliquer) n'est pas tranchée.
    nature = tied.every((n) => n === "associative" || n === "explanatory") ? "associative" : "undetermined";
  }
  return {
    nature,
    causalLanguage,
    evidence: nature === "undetermined" ? [] : evidence[nature as keyof typeof scores],
    explanation: NATURE_TEXT[nature],
  };
}

/** Nature d'un seul texte (sert aux comparaisons question ↔ objectif). */
export function natureOfText(text: string): StudyNature {
  const folded = fold(text);
  if (MARKERS.exploratory.test(folded) || MARKERS.qualitative.test(folded)) return "exploratory";
  if (MARKERS.association.test(folded)) return "associative";
  if (MARKERS.causal.test(folded)) return "explanatory";
  if (MARKERS.comparative.test(folded)) return "comparative";
  if (MARKERS.descriptive.test(folded)) return "descriptive";
  return "undetermined";
}
