import { natureOfText, type ConceptRegistry, type ExtractionResult } from "./concepts";
import { NATURE_LABELS, ROLE_LABELS, elementLabel } from "./labels";
import { contentStems, fold, stemSet } from "./text";
import type {
  ClarificationQuestion,
  Diagnostic,
  HypothesisAnalysis,
  Improvement,
  RelationProposal,
  ResearchUnderstandingInput,
  StudyNature,
  StudyNatureResult,
  VariableCard,
} from "./types";

export interface CoherenceContext {
  input: ResearchUnderstandingInput;
  extraction: ExtractionResult;
  registry: ConceptRegistry;
  nature: StudyNatureResult;
  relations: RelationProposal[];
  variables: VariableCard[];
  hypotheses: HypothesisAnalysis[];
}

const RELATIONAL: StudyNature[] = ["explanatory", "associative", "comparative"];

export function diagnose(context: CoherenceContext): Diagnostic[] {
  const { input, registry, nature, relations, variables, hypotheses } = context;
  const diagnostics: Diagnostic[] = [];
  const add = (d: Omit<Diagnostic, "origin">) => diagnostics.push({ ...d, origin: "engine" });
  const keysIn = (text: string) => new Set(registry.mentions(text).map((m) => m.concept.key));
  const nameOf = (key: string) => variables.find((v) => v.key === key)?.name ?? key;
  const names = (keys: Iterable<string>) => [...keys].map((k) => `« ${nameOf(k)} »`).join(", ");
  const central = variables.filter((v) => v.group === "central" && v.status !== "rejected");

  // --- Sujet ----------------------------------------------------------
  if (contentStems(input.title).length < 3) {
    add({
      id: "title-short",
      kind: "improvement",
      severity: "low",
      elements: ["title"],
      title: "Sujet très court",
      problem: "Le sujet contient peu de mots porteurs de sens.",
      whyItMatters: "Un sujet trop bref laisse ouverts l'objet, le terrain et la population : plusieurs recherches différentes pourraient s'y reconnaître.",
      proposal: "Faire apparaître dans le sujet le phénomène étudié, l'unité d'analyse et le terrain.",
    });
  }

  // --- Problématique ----------------------------------------------------
  const problemKeys = keysIn(input.problem);
  const objectiveKeys = keysIn([input.generalObjective, ...input.specificObjectives].join("\n"));
  const questionKeys = keysIn(input.mainQuestion);
  if (!input.problem) {
    add({
      id: "problem-missing",
      kind: "missing",
      severity: "high",
      elements: ["problem"],
      title: "Problématique absente",
      problem: "Aucune problématique n'est fournie.",
      whyItMatters: "La problématique justifie la question de recherche : sans elle, on ne peut pas vérifier que la question répond à un problème réel.",
      needed: "Décrivez le constat ou la difficulté de départ, et ce qui reste à comprendre.",
    });
  } else {
    const titleKeys = keysIn(input.title);
    if (problemKeys.size === 0) {
      add({
        id: "problem-no-concepts",
        kind: "improvement",
        severity: "medium",
        elements: ["problem", "title"],
        title: "Problématique sans lien explicite avec les concepts du sujet",
        problem: "La problématique ne reprend aucun des concepts identifiés dans le sujet, les questions ou les objectifs.",
        whyItMatters: "Le lecteur doit pouvoir passer du problème posé aux concepts étudiés ; sinon la problématique paraît détachée de la recherche.",
        proposal: `Reformuler le problème en mobilisant explicitement ${names(titleKeys.size ? titleKeys : central.map((v) => v.key)) || "les concepts du sujet"}.`,
      });
    }
    if (objectiveKeys.size > 0 && problemKeys.size > 0 && [...objectiveKeys].every((k) => !problemKeys.has(k))) {
      add({
        id: "problem-objective-mismatch",
        kind: "contradiction",
        severity: "high",
        elements: ["problem", "generalObjective"],
        title: "La problématique et l'objectif ne portent pas sur les mêmes concepts",
        problem: `La problématique traite de ${names(problemKeys)}, alors que l'objectif porte sur ${names(objectiveKeys)}.`,
        whyItMatters: "L'objectif doit découler de la problématique : s'ils divergent, les résultats obtenus ne répondront pas au problème posé.",
        proposal: "Réaligner l'objectif sur le problème décrit, ou reformuler la problématique si l'objectif reflète votre intention réelle.",
      });
    }
    if (questionKeys.size > 0 && problemKeys.size > 0 && [...questionKeys].every((k) => !problemKeys.has(k))) {
      add({
        id: "problem-question-mismatch",
        kind: "contradiction",
        severity: "high",
        elements: ["problem", "mainQuestion"],
        title: "La question principale ne découle pas de la problématique",
        problem: `La problématique traite de ${names(problemKeys)}, la question principale de ${names(questionKeys)}.`,
        whyItMatters: "La question de recherche est la traduction interrogative du problème : elle doit en reprendre l'objet.",
        proposal: "Reformuler la question à partir du problème décrit.",
      });
    }
    // Lien établi par un synonyme : on le signale pour que l'utilisateur le confirme.
    for (const mention of registry.mentions(input.problem).filter((m) => m.viaAlias)) {
      add({
        id: `problem-alias-${mention.concept.key}`,
        kind: "improvement",
        severity: "low",
        elements: ["problem"],
        title: `« ${mention.viaAlias} » rapproché de « ${nameOf(mention.concept.key)} »`,
        problem: `La problématique parle de « ${mention.viaAlias} », que le moteur rattache au concept « ${nameOf(mention.concept.key)} ».`,
        whyItMatters: "Si ces deux termes ne désignent pas la même réalité dans votre étude, la problématique et le sujet ne parlent pas exactement de la même chose.",
        proposal: `Préciser si « ${mention.viaAlias} » est une dimension de « ${nameOf(mention.concept.key)} » ou seulement l'un de ses signes visibles.`,
      });
    }
  }

  // --- Question principale ↔ objectif ----------------------------------
  if (!input.mainQuestion) {
    add({
      id: "question-missing",
      kind: "missing",
      severity: "high",
      elements: ["mainQuestion"],
      title: "Question principale absente",
      problem: "Aucune question principale n'est formulée.",
      whyItMatters: "La question principale fixe ce que l'étude doit établir ; tout le dispositif (objectifs, hypothèses, données) en dépend.",
      needed: "Formulez la question à laquelle votre étude doit répondre.",
      proposal: candidateQuestion(context) ?? undefined,
    });
  }
  if (!input.generalObjective) {
    add({
      id: "objective-missing",
      kind: "missing",
      severity: "medium",
      elements: ["generalObjective"],
      title: "Objectif général absent",
      problem: "Aucun objectif général n'est indiqué.",
      whyItMatters: "L'objectif général traduit la question en action de recherche (décrire, examiner, comparer…) et permet de juger si les résultats sont atteints.",
      needed: "Indiquez ce que l'étude doit permettre de faire.",
    });
  }
  if (input.mainQuestion && input.generalObjective) {
    const objectiveOnly = keysIn(input.generalObjective);
    if (questionKeys.size > 0 && objectiveOnly.size > 0) {
      const shared = [...questionKeys].filter((k) => objectiveOnly.has(k));
      if (shared.length === 0) {
        add({
          id: "question-objective-mismatch",
          kind: "contradiction",
          severity: "high",
          elements: ["mainQuestion", "generalObjective"],
          title: "La question principale et l'objectif général ne portent pas sur les mêmes concepts",
          problem: `La question porte sur ${names(questionKeys)}, l'objectif sur ${names(objectiveOnly)}.`,
          whyItMatters: "Un objectif qui ne répond pas à la question conduit à collecter des données qui ne permettront pas d'y répondre.",
          proposal: "Formuler l'objectif général comme la réponse attendue à la question principale.",
        });
      } else {
        const onlyQuestion = [...questionKeys].filter((k) => !objectiveOnly.has(k));
        const onlyObjective = [...objectiveOnly].filter((k) => !questionKeys.has(k));
        if (onlyQuestion.length || onlyObjective.length) {
          add({
            id: "question-objective-partial",
            kind: "improvement",
            severity: "low",
            elements: ["mainQuestion", "generalObjective"],
            title: "Question et objectif partiellement alignés",
            problem: [onlyQuestion.length ? `${names(onlyQuestion)} figure(nt) dans la question mais pas dans l'objectif` : "", onlyObjective.length ? `${names(onlyObjective)} figure(nt) dans l'objectif mais pas dans la question` : ""].filter(Boolean).join(" ; ") + ".",
            whyItMatters: "Un concept présent d'un seul côté risque de ne pas être étudié, ou de l'être sans question qui le justifie.",
            proposal: "Aligner les deux formulations sur les mêmes concepts.",
          });
        }
      }
    }
    const qNature = natureOfText(input.mainQuestion);
    const oNature = natureOfText(input.generalObjective);
    const relational = (n: StudyNature) => n === "associative" || n === "explanatory";
    if ((qNature === "exploratory" && relational(oNature)) || (oNature === "exploratory" && relational(qNature))) {
      add({
        id: "question-objective-nature",
        kind: "contradiction",
        severity: "high",
        elements: ["mainQuestion", "generalObjective"],
        title: "Question et objectif de natures différentes",
        problem: `La question est de nature ${NATURE_LABELS[qNature].toLowerCase()}, l'objectif de nature ${NATURE_LABELS[oNature].toLowerCase()}.`,
        whyItMatters: "Comprendre des perceptions (démarche exploratoire) et mesurer une relation (démarche explicative) demandent des données et des méthodes différentes.",
        proposal: "Choisir la démarche visée et harmoniser la question et l'objectif.",
      });
    } else if ((qNature === "descriptive" && relational(oNature)) || (oNature === "descriptive" && relational(qNature))) {
      add({
        id: "question-objective-scope",
        kind: "improvement",
        severity: "medium",
        elements: ["mainQuestion", "generalObjective"],
        title: "Question et objectif d'ambition différente",
        problem: `L'un vise à décrire, l'autre à examiner une relation (question : ${NATURE_LABELS[qNature].toLowerCase()} ; objectif : ${NATURE_LABELS[oNature].toLowerCase()}).`,
        whyItMatters: "Décrire ne permet pas de répondre à une question relationnelle, et inversement.",
        proposal: "Aligner la portée de l'objectif sur celle de la question.",
      });
    }
  }

  // --- Questions spécifiques ↔ objectifs spécifiques ---------------------
  if (input.specificQuestions.length && !input.specificObjectives.length) {
    add({
      id: "specific-objectives-missing",
      kind: "missing",
      severity: "low",
      elements: ["specificObjectives"],
      title: "Objectifs spécifiques absents",
      problem: `${input.specificQuestions.length} question(s) spécifique(s) sans objectif spécifique correspondant.`,
      whyItMatters: "Chaque question spécifique se traduit habituellement en un objectif spécifique qui guide la collecte.",
      needed: "Associez un objectif spécifique à chaque question spécifique.",
    });
  }
  if (input.specificQuestions.length && input.specificObjectives.length) {
    const objectiveStems = input.specificObjectives.map(stemSet);
    input.specificQuestions.forEach((question, i) => {
      const stems = contentStems(question);
      const best = Math.max(...objectiveStems.map((set) => stems.filter((s) => set.has(s)).length));
      if (best < Math.min(2, stems.length)) {
        add({
          id: `specific-question-${i}`,
          kind: "improvement",
          severity: "medium",
          elements: [`specificQuestion:${i}`],
          title: `Question spécifique ${i + 1} sans objectif correspondant`,
          problem: "Aucun objectif spécifique ne reprend les termes de cette question.",
          whyItMatters: "Une question sans objectif risque de ne pas être traitée dans la collecte et l'analyse.",
          proposal: "Ajouter ou reformuler un objectif spécifique qui y répond.",
        });
      }
    });
    if (input.specificQuestions.length !== input.specificObjectives.length) {
      add({
        id: "specific-count",
        kind: "improvement",
        severity: "low",
        elements: ["specificQuestions", "specificObjectives"],
        title: "Nombre de questions et d'objectifs spécifiques différent",
        problem: `${input.specificQuestions.length} question(s) spécifique(s) pour ${input.specificObjectives.length} objectif(s) spécifique(s).`,
        whyItMatters: "Ce n'est pas une erreur en soi, mais la correspondance entre questions et objectifs doit pouvoir être expliquée.",
        proposal: "Vérifier que chaque question a son objectif et inversement.",
      });
    }
  }

  // --- Hypothèses --------------------------------------------------------
  const exploratory = nature.nature === "exploratory" || input.approach === "qualitative";
  for (const hypothesis of hypotheses) {
    if (hypothesis.alignment.aligned === false && hypothesis.concepts.length > 0) {
      add({
        id: `hypothesis-${hypothesis.index}-alignment`,
        kind: "contradiction",
        severity: "high",
        elements: [`hypothesis:${hypothesis.index}`, "mainQuestion", "generalObjective"],
        title: `Hypothèse ${hypothesis.index + 1} non reliée à la question ou aux objectifs`,
        problem: hypothesis.alignment.detail,
        whyItMatters: "Une hypothèse est une réponse provisoire à la question de recherche : elle doit porter sur les concepts que la question et les objectifs annoncent.",
        proposal: "Ajouter ce concept à la question ou aux objectifs, ou retirer l'hypothèse.",
      });
    }
  }
  if (exploratory && hypotheses.length) {
    add({
      id: "hypotheses-exploratory",
      kind: "improvement",
      severity: "low",
      elements: ["hypotheses"],
      title: "Hypothèses dans une étude exploratoire",
      problem: "L'étude est exploratoire ou qualitative mais formule des hypothèses à vérifier.",
      whyItMatters: "Ce n'est pas une contradiction : des hypothèses de travail sont possibles. Mais une démarche exploratoire ne permet pas de les tester statistiquement.",
      proposal: "Présenter ces hypothèses comme des propositions de travail, ou préciser une phase quantitative.",
    });
  }
  if (!hypotheses.length && RELATIONAL.includes(nature.nature) && !exploratory) {
    add({
      id: "hypotheses-none",
      kind: "improvement",
      severity: "low",
      elements: ["hypotheses"],
      title: "Aucune hypothèse fournie",
      problem: "L'étude examine une relation mais ne formule pas d'hypothèse.",
      whyItMatters: "Ce n'est pas obligatoire dans toutes les traditions, mais une hypothèse précise ce qui sera vérifié et guide le choix des tests.",
      proposal: "Examiner les hypothèses candidates proposées et, si elles vous conviennent, les retenir ou les reformuler.",
    });
  }

  // --- Formulation causale -------------------------------------------------
  const causal = relations.filter((r) => r.nature === "causal_claim" && r.status !== "rejected");
  if (causal.length) {
    add({
      id: "causal-wording",
      kind: "improvement",
      severity: "medium",
      elements: [...new Set(causal.flatMap((r) => r.sources.map((s) => s.element)))],
      title: "Formulation causale (« effet », « impact », « influence »…)",
      problem: `La relation entre ${causal.map((r) => `« ${nameOf(r.from)} » et « ${nameOf(r.to)} »`).join(", ")} est formulée comme un effet.`,
      whyItMatters: "Une enquête à un moment donné montre au mieux une association. Affirmer un effet suppose d'écarter les autres explications (antériorité, groupe de comparaison, contrôle des facteurs concurrents).",
      proposal: "Parler d'association, ou préciser le dispositif qui permettra d'approcher la causalité (comparaison avant/après, groupe témoin, données sur plusieurs périodes).",
    });
  }

  // --- Relations et rôles ---------------------------------------------------
  if (RELATIONAL.includes(nature.nature) && relations.length === 0) {
    add({
      id: "relation-missing",
      kind: "missing",
      severity: "medium",
      elements: ["mainQuestion", "generalObjective"],
      title: "Relation étudiée non identifiable",
      problem: "Les textes évoquent une relation, mais le moteur n'a pas pu repérer entre quels concepts.",
      whyItMatters: "Sans relation explicite, on ne peut ni attribuer de rôle aux variables ni formuler d'hypothèse.",
      needed: "Formulez la relation sous la forme « relation entre A et B » ou « A est associé à B ».",
    });
  }
  if (nature.nature === "undetermined") {
    add({
      id: "nature-undetermined",
      kind: "missing",
      severity: "medium",
      elements: ["mainQuestion", "generalObjective"],
      title: "Nature de l'étude indéterminée",
      problem: "Les textes ne permettent pas de savoir si l'étude vise à décrire, à explorer, à comparer ou à expliquer.",
      whyItMatters: "La nature de l'étude détermine la place des hypothèses, le rôle des variables et les analyses possibles.",
      needed: "Précisez la démarche visée dans la question ou l'objectif (décrire, comprendre, comparer, examiner une relation…).",
    });
  }

  // --- Définitions opérationnelles -----------------------------------------
  for (const variable of variables.filter((v) => v.status !== "rejected" && (v.group === "central" || v.role === "explanatory" || v.role === "dependent"))) {
    if (variable.definition?.origin === "user") continue;
    const important = variable.role === "dependent" || variable.role === "explanatory" || variable.group === "central";
    add({
      id: `definition-${variable.key}`,
      kind: "missing",
      severity: important && variable.ambiguity ? "high" : "medium",
      elements: [`variable:${variable.key}`],
      title: `${variable.role === "explanatory" ? "Mesure" : "Définition opérationnelle"} de « ${variable.name} » à expliciter`,
      problem: variable.ambiguity ?? "Le concept n'est pas défini dans le contexte de l'étude.",
      whyItMatters: "Sans définition opérationnelle, on ne sait pas quelles données collecter ni comment interpréter les résultats ; deux lecteurs pourraient comprendre le concept différemment.",
      proposal: variable.pitfall,
      needed: `Indiquez ce que « ${variable.name} » recouvre dans votre étude et comment vous comptez l'observer ou le mesurer.`,
    });
  }

  // --- Terrain, population, période --------------------------------------
  if (!input.population) {
    const hint = (fold(`${input.title} ${input.mainQuestion}`).match(/\b(pme|entreprises?|menages|etudiants|eleves|agents|employes|salaries|clients|patients|femmes|jeunes|commercants|agriculteurs|enseignants|banques|cooperatives)\b/) ?? [])[0];
    add({
      id: "population-missing",
      kind: "missing",
      severity: "high",
      elements: ["population"],
      title: "Population ou unité d'analyse non précisée",
      problem: hint ? `Vos textes évoquent « ${hint} », mais la population étudiée n'est pas définie.` : "La population ou l'unité d'analyse n'est pas indiquée.",
      whyItMatters: "La population détermine qui sera interrogé ou observé, la taille de l'échantillon et la portée des conclusions.",
      needed: "Précisez l'unité d'analyse (individus, entreprises, ménages…), les critères d'inclusion et, si possible, l'effectif.",
    });
  }
  if (!input.field) {
    add({
      id: "field-missing",
      kind: "missing",
      severity: context.extraction.locations.length ? "low" : "medium",
      elements: ["field"],
      title: "Terrain d'étude non précisé",
      problem: context.extraction.locations.length ? `Le sujet cite ${context.extraction.locations.map((l) => `« ${l.text} »`).join(", ")}, mais le terrain (zone, communes, sites) n'est pas décrit.` : "Le terrain ou la zone d'étude n'est pas indiqué.",
      whyItMatters: "Le terrain délimite où les données seront recueillies et à quelle réalité les conclusions s'appliquent.",
      needed: "Décrivez la zone d'étude et, si besoin, les sites retenus.",
    });
  } else {
    const fieldFolded = fold(input.field);
    for (const location of context.extraction.locations) {
      if (!fieldFolded.includes(fold(location.text))) {
        add({
          id: `field-location-${fold(location.text)}`,
          kind: "contradiction",
          severity: "medium",
          elements: [location.source.element, "field"],
          title: "Lieu du sujet différent du terrain indiqué",
          problem: `${elementLabel(location.source.element)} cite « ${location.text} », absent du terrain indiqué (« ${input.field} »).`,
          whyItMatters: "Le sujet et le terrain doivent désigner la même zone, sinon la portée de l'étude est ambiguë.",
          proposal: "Harmoniser le lieu du sujet et la description du terrain (ou préciser que l'un inclut l'autre).",
        });
      }
    }
  }
  if (!input.period) {
    add({
      id: "period-missing",
      kind: "missing",
      severity: variables.some((v) => /creation-de-valeur|performance|rentabilite/.test(v.matchedAlias ? fold(v.matchedAlias).replace(/\s+/g, "-") : "")) ? "medium" : "low",
      elements: ["period"],
      title: "Période étudiée non précisée",
      problem: "Aucune période de référence n'est indiquée.",
      whyItMatters: "Les pratiques et les résultats évoluent dans le temps : sans période, les données recueillies ne sont pas comparables entre répondants.",
      needed: "Indiquez la période à laquelle se rapportent les données (par exemple l'année écoulée).",
    });
  }

  return diagnostics.filter((d, i) => diagnostics.findIndex((x) => x.id === d.id) === i);
}

/** Proposition de question principale à partir des relations repérées (suggestion, jamais imposée). */
export function candidateQuestion(context: Pick<CoherenceContext, "input" | "relations" | "variables" | "nature">): string | null {
  const relation = context.relations.find((r) => r.status !== "rejected");
  if (!relation) return null;
  const nameOf = (key: string) => context.variables.find((v) => v.key === key)?.name ?? key;
  const where = context.input.population ? ` chez ${context.input.population}` : "";
  if (relation.nature === "difference") return `Question possible : « ${nameOf(relation.to)} » diffère-t-il selon « ${nameOf(relation.from)} »${where} ?`;
  return `Question possible : dans quelle mesure « ${nameOf(relation.from)} » est-il associé à « ${nameOf(relation.to)} »${where} ?`;
}

export function clarifications(context: CoherenceContext, diagnostics: Diagnostic[]): ClarificationQuestion[] {
  const { input, nature, variables, relations } = context;
  const nameOf = (key: string) => variables.find((v) => v.key === key)?.name ?? key;
  const questions: ClarificationQuestion[] = [];
  const add = (q: Omit<ClarificationQuestion, "origin">) => {
    if (!questions.some((x) => x.id === q.id)) questions.push({ ...q, origin: "engine" });
  };

  if (nature.nature === "undetermined") {
    add({ id: "q-nature", priority: 1, target: "study", question: "Votre étude cherche-t-elle à décrire une situation, à comprendre des perceptions ou des pratiques, à comparer des groupes, ou à examiner une relation entre des concepts ?", why: "La réponse fixe la place des hypothèses et le rôle des variables." });
  }
  for (const d of diagnostics.filter((d) => d.kind === "missing" && d.needed)) {
    const target = d.elements[0] ?? "study";
    add({ id: `q-${d.id}`, priority: d.severity === "high" ? 1 : d.severity === "medium" ? 2 : 3, target, question: d.needed!, why: d.whyItMatters });
  }
  for (const d of diagnostics.filter((d) => d.kind === "contradiction")) {
    add({ id: `q-${d.id}`, priority: 1, target: d.elements[0] ?? "study", question: `${d.title} : laquelle des deux formulations reflète votre intention ?`, why: d.problem });
  }
  for (const relation of relations.filter((r) => !r.directed && r.status !== "rejected")) {
    const a = variables.find((v) => v.key === relation.from);
    const b = variables.find((v) => v.key === relation.to);
    if (a?.role === "undetermined" || b?.role === "undetermined") {
      add({
        id: `q-direction-${relation.id}`,
        priority: 1,
        target: `variable:${relation.from}`,
        question: `Dans votre étude, est-ce « ${nameOf(relation.from)} » qui est supposé expliquer « ${nameOf(relation.to)} », l'inverse, ou souhaitez-vous seulement décrire leur association ?`,
        why: "Le sujet met les deux concepts en relation sans indiquer de sens ; le moteur ne choisit pas à votre place.",
      });
    }
  }
  const contextual = variables.filter((v) => v.group === "contextual" && v.role === "undetermined" && v.status !== "rejected");
  if (contextual.length) {
    add({
      id: "q-contextual",
      priority: 2,
      target: `variable:${contextual[0].key}`,
      question: `${contextual.map((v) => `« ${v.name} »`).join(", ")} : ces éléments doivent-ils être neutralisés dans l'analyse (variables de contrôle), ou pensez-vous qu'ils modifient la relation étudiée (variables modératrices) ?`,
      why: "Le rôle de ces éléments change les analyses à prévoir et les données à collecter.",
    });
  }
  if (input.approach === "unspecified" && RELATIONAL.includes(nature.nature)) {
    add({ id: "q-approach", priority: 3, target: "study", question: "Envisagez-vous une approche quantitative (questionnaire, mesures), qualitative (entretiens) ou mixte ?", why: "L'approche détermine le type d'indicateurs à retenir pour chaque concept." });
  }
  for (const v of variables.filter((v) => v.role === "mediator" && v.roleOrigin === "engine" && v.status === "proposed")) {
    add({ id: `q-mediator-${v.key}`, priority: 2, target: `variable:${v.key}`, question: `« ${v.name} » est-il un mécanisme intermédiaire (variable médiatrice) entre les autres concepts, ou un objet d'étude à part entière ?`, why: v.justification[0] ?? "Position intermédiaire repérée dans vos formulations." });
  }
  return questions.sort((a, b) => a.priority - b.priority);
}

export function improvements(context: CoherenceContext, diagnostics: Diagnostic[]): Improvement[] {
  const list: Improvement[] = [];
  for (const d of diagnostics.filter((d) => d.proposal)) {
    list.push({ id: `i-${d.id}`, origin: d.origin, target: d.elements[0] ?? "study", proposal: d.proposal!, justification: d.whyItMatters });
  }
  for (const h of context.hypotheses.filter((h) => h.reformulation)) {
    list.push({
      id: `i-reform-${h.id}`,
      origin: "engine",
      target: `hypothesis:${h.index}`,
      proposal: `Reformulation possible de l'hypothèse ${h.index + 1} : ${h.reformulation}`,
      justification: h.issues.join(" "),
    });
  }
  for (const v of context.variables.filter((v) => v.pitfall && v.status !== "rejected" && v.definition?.origin !== "user")) {
    if (list.some((i) => i.proposal === v.pitfall)) continue;
    list.push({ id: `i-pitfall-${v.key}`, origin: "engine", target: `variable:${v.key}`, proposal: v.pitfall!, justification: `Mise en garde méthodologique sur « ${v.name} » (${ROLE_LABELS[v.role].toLowerCase()}).` });
  }
  return list;
}
