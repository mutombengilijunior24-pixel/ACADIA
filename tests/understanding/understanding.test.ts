import { describe, expect, it } from "vitest";

import {
  addVariable,
  buildAiRequest,
  buildUnderstandingReport,
  emptyDecisions,
  requestAiEnrichment,
  setHypothesisDecision,
  setRelationDecision,
  setVariableDecision,
  validateResearchInput,
  type AiEnrichment,
  type AiProvider,
  type ResearchUnderstandingInput,
  type UnderstandingReport,
} from "@/lib/core/understanding";

// Cas SYNTHÉTIQUES de recherche (aucune donnée réelle).

function input(raw: Record<string, unknown>): ResearchUnderstandingInput {
  const validation = validateResearchInput(raw);
  if (!validation.ok) throw new Error(JSON.stringify(validation.errors));
  return validation.input;
}

const LUBUMBASHI = {
  title: "Digitalisation des activités commerciales et création de valeur à Lubumbashi.",
  problem: "La présence en ligne d'une PME ne garantit pas nécessairement une création de valeur.",
  mainQuestion: "Dans quelle mesure la digitalisation des activités commerciales est-elle associée à la création de valeur des PME étudiées à Lubumbashi ?",
  generalObjective: "Examiner la relation entre la digitalisation des activités commerciales et la création de valeur.",
  hypotheses: ["La digitalisation des activités commerciales est positivement associée à la création de valeur."],
  notes: "Contraintes possibles à étudier : accès à Internet, disponibilité de l'électricité, confiance des clients et livraison.",
};

const card = (report: UnderstandingReport, name: string) => {
  const found = report.variables.find((v) => v.name === name);
  if (!found) throw new Error(`Variable absente : ${name} (présentes : ${report.variables.map((v) => v.name).join(", ")})`);
  return found;
};
const diagnostic = (report: UnderstandingReport, id: string) => report.diagnostics.find((d) => d.id === id);

describe("Cas de validation — digitalisation et création de valeur à Lubumbashi", () => {
  const report = buildUnderstandingReport(input(LUBUMBASHI));

  it("identifie les deux concepts centraux et leurs rôles proposés, sans les valider", () => {
    const central = report.variables.filter((v) => v.group === "central").map((v) => v.name);
    expect(central).toEqual(["Digitalisation des activités commerciales", "Création de valeur"]);
    const digital = card(report, "Digitalisation des activités commerciales");
    const value = card(report, "Création de valeur");
    expect(digital.role).toBe("explanatory");
    expect(value.role).toBe("dependent");
    expect([digital.status, value.status]).toEqual(["proposed", "proposed"]);
    expect([digital.confidence, value.confidence]).toEqual(["medium", "medium"]);
    expect(digital.justification[0]).toContain("question principale");
  });

  it("qualifie la relation d'association supposée (positive), jamais de causalité démontrée", () => {
    expect(report.nature.nature).toBe("associative");
    expect(report.nature.causalLanguage).toBe(false);
    expect(report.relations).toHaveLength(1);
    const [relation] = report.relations;
    expect(relation).toMatchObject({ nature: "association", direction: "positive", directed: true, evidenceStatus: "assumed", status: "proposed" });
    expect(relation.sources.map((s) => s.element)).toEqual(["title", "mainQuestion", "generalObjective", "hypothesis:0"]);
    expect(relation.note).toContain("ne signifie pas que l'un des concepts cause l'autre");
  });

  it("analyse l'hypothèse fournie sans la déclarer confirmée", () => {
    expect(report.hypotheses).toHaveLength(1);
    const [h] = report.hypotheses;
    expect(h.status).toBe("provided_untested");
    expect(h.empiricalStatus).toBe("untested");
    expect(h.relationNature).toBe("association");
    expect(h.direction).toBe("positive");
    expect(h.alignment.aligned).toBe(true);
    expect(h.examines).toContain("n'affirme pas que « Digitalisation des activités commerciales » cause « Création de valeur »");
    expect(h.reformulation).toBeUndefined();
    expect(report.candidateHypotheses).toEqual([]);
    expect(report.hypothesesNote).toContain("aucune donnée empirique n'a été analysée");
  });

  it("exige l'explicitation de la mesure de la digitalisation et de la définition de la création de valeur", () => {
    const value = diagnostic(report, "definition-creation-valeur");
    expect(value).toMatchObject({ kind: "missing", severity: "high", title: "Définition opérationnelle de « Création de valeur » à expliciter" });
    expect(value?.proposal).toContain("Ne pas réduire automatiquement la création de valeur au chiffre d'affaires");
    const digital = diagnostic(report, "definition-digitalisation-activit-commercial");
    expect(digital).toMatchObject({ kind: "missing", severity: "high", title: "Mesure de « Digitalisation des activités commerciales » à expliciter" });
    expect(digital?.proposal).toContain("réseaux sociaux");
    expect(report.diagnostics.filter((d) => d.kind === "contradiction")).toEqual([]);
  });

  it("propose des dimensions et indicateurs multiples, marqués comme suggestions du moteur", () => {
    const value = card(report, "Création de valeur");
    expect(value.definition?.origin).toBe("engine");
    expect(value.dimensions.map((d) => d.name)).toEqual(["Valeur économique et financière", "Valeur commerciale (clients)", "Valeur organisationnelle", "Valeur sociale et partenariale"]);
    const digital = card(report, "Digitalisation des activités commerciales");
    expect(digital.dimensions.map((d) => d.name)).toContain("Transactions numériques");
    expect(digital.dimensions.flatMap((d) => d.indicators).length).toBeGreaterThanOrEqual(8);
    expect(digital.toClarify[0]).toContain("Définition opérationnelle à expliciter");
  });

  it("repère les contraintes sans leur imposer un rôle, et pose la question", () => {
    const contextual = report.variables.filter((v) => v.group === "contextual");
    expect(contextual.map((v) => v.name)).toEqual(["Accès à Internet", "Disponibilité de l'électricité", "Confiance des clients", "Livraison"]);
    for (const v of contextual) {
      expect(v.role).toBe("undetermined");
      expect(v.candidateRoles).toEqual(["control", "moderator"]);
      expect(v.confidence).toBe("low");
    }
    expect(report.clarifications.find((q) => q.id === "q-contextual")?.priority).toBe(2);
  });

  it("signale le rapprochement « présence en ligne » ↔ digitalisation et les informations manquantes", () => {
    expect(diagnostic(report, "problem-alias-digitalisation-activit-commercial")?.kind).toBe("improvement");
    expect(report.missingEssential.map((m) => m.field)).toEqual(["population", "field"]);
    expect(diagnostic(report, "population-missing")?.severity).toBe("high");
    expect(diagnostic(report, "field-missing")?.problem).toContain("« Lubumbashi »");
    expect(report.clarifications[0].priority).toBe(1);
    expect(report.synthesis).toContain("Aucun résultat empirique n'est établi");
  });

  it("est déterministe", () => {
    expect(buildUnderstandingReport(input(LUBUMBASHI))).toEqual(report);
  });
});

describe("Diagnostic de cohérence", () => {
  it("détecte une problématique et une question qui ne correspondent pas à l'objectif", () => {
    const report = buildUnderstandingReport(
      input({
        title: "Motivation du personnel et productivité dans les entreprises de Kolwezi",
        problem: "Les entreprises de Kolwezi constatent une baisse de la productivité qui serait liée à une faible motivation du personnel.",
        mainQuestion: "Quel est l'effet de la motivation du personnel sur la productivité ?",
        generalObjective: "Décrire la satisfaction des clients des banques commerciales.",
        population: "Employés des entreprises minières",
        field: "Kolwezi",
        period: "2024",
      }),
    );
    const mismatch = diagnostic(report, "problem-objective-mismatch");
    expect(mismatch).toMatchObject({ kind: "contradiction", severity: "high" });
    expect(mismatch?.problem).toBe("La problématique traite de « Motivation du personnel », « Productivité », alors que l'objectif porte sur « Satisfaction des clients ».");
    expect(diagnostic(report, "question-objective-mismatch")?.kind).toBe("contradiction");
    expect(diagnostic(report, "question-objective-scope")?.kind).toBe("improvement");
    expect(report.clarifications.some((q) => q.id === "q-problem-objective-mismatch" && q.priority === 1)).toBe(true);
  });

  it("signale un lieu du sujet absent du terrain déclaré", () => {
    const report = buildUnderstandingReport(input({ ...LUBUMBASHI, field: "Kinshasa (commune de la Gombe)" }));
    const d = report.diagnostics.find((x) => x.id.startsWith("field-location"));
    expect(d).toMatchObject({ kind: "contradiction", elements: ["title", "field"] });
  });

  it("ne déclare pas d'incohérence pour un sujet qui ne suit pas un modèle unique (exploratoire)", () => {
    const report = buildUnderstandingReport(
      input({
        title: "Perceptions des étudiants de l'UNILU sur l'enseignement à distance",
        problem: "Depuis 2020, l'enseignement à distance s'est développé sans que l'on sache comment les étudiants le vivent.",
        mainQuestion: "Comment les étudiants perçoivent-ils l'enseignement à distance ?",
        generalObjective: "Comprendre les perceptions et le vécu des étudiants face à l'enseignement à distance.",
        approach: "qualitative",
        population: "Étudiants de licence de l'UNILU",
        field: "Université de Lubumbashi",
      }),
    );
    expect(report.diagnostics.filter((d) => d.kind === "contradiction")).toEqual([]);
    expect(report.nature.nature).toBe("exploratory");
    expect(report.variables.map((v) => v.role)).toEqual(["qualitative_category", "qualitative_category", "qualitative_category"]);
    expect(report.variables.some((v) => v.role === "explanatory" || v.role === "dependent")).toBe(false);
    expect(report.relations).toEqual([]);
    expect(report.candidateHypotheses).toEqual([]);
    expect(report.hypothesesNote).toContain("le moteur n'en invente pas");
    expect(diagnostic(report, "hypotheses-none")).toBeUndefined();
  });
});

describe("Variables et hypothèses", () => {
  const EXPLICATIVE = {
    title: "Effet de la formation et du leadership sur la performance des agents de la SNEL",
    mainQuestion: "Quel est l'effet de la formation sur la performance des agents ?",
    generalObjective: "Analyser l'effet de la formation du personnel sur la performance des agents.",
    hypotheses: ["La formation améliore la performance des agents.", "Le leadership influence la performance."],
    notes: "Variables de contrôle : ancienneté, niveau d'études.",
  };

  it("distingue variables explicatives, variable à expliquer et variables de contrôle", () => {
    const report = buildUnderstandingReport(input(EXPLICATIVE));
    expect(report.nature.nature).toBe("explanatory");
    expect(report.variables.map((v) => [v.name, v.role])).toEqual([
      ["Formation", "explanatory"],
      ["Leadership", "explanatory"],
      ["Performance", "dependent"],
      ["Ancienneté", "control"],
      ["Niveau d'études", "control"],
    ]);
    expect(report.relations.map((r) => r.nature)).toEqual(["causal_claim", "causal_claim"]);
    expect(diagnostic(report, "causal-wording")?.kind).toBe("improvement");
  });

  it("analyse chaque hypothèse : sens, formulation causale, alignement, reformulation utile", () => {
    const report = buildUnderstandingReport(input(EXPLICATIVE));
    const [h1, h2] = report.hypotheses;
    expect(h1).toMatchObject({ relationNature: "causal_claim", direction: "positive", status: "provided_untested" });
    expect(h1.reformulation).toBe("« Formation » est positivement associé(e) à « Performance ».");
    expect(h1.alignment.aligned).toBe(true);
    expect(h2.direction).toBe("unspecified");
    expect(h2.issues).toContain("Le sens attendu de la relation (positif ou négatif) n'est pas précisé.");
    expect(h2.vagueTerms).toEqual(["influence", "performance"]);
    expect(h2.alignment).toEqual({ aligned: false, detail: "« Leadership » ne figure(nt) ni dans la question ni dans les objectifs." });
    expect(diagnostic(report, "hypothesis-1-alignment")?.kind).toBe("contradiction");
    expect(h2.operationalNeeds).toContain("Préciser la population sur laquelle l'hypothèse sera testée.");
  });

  it("sans hypothèse : propose une hypothèse candidate, présentée comme non validée", () => {
    const report = buildUnderstandingReport(input({ ...LUBUMBASHI, hypotheses: [] }));
    expect(report.hypotheses).toEqual([]);
    expect(report.candidateHypotheses).toHaveLength(1);
    const [candidate] = report.candidateHypotheses;
    expect(candidate).toMatchObject({ origin: "engine", status: "candidate", empiricalStatus: "untested" });
    expect(candidate.text).toBe("« Digitalisation des activités commerciales » est associé(e) à « Création de valeur ».");
    expect(candidate.issues[0]).toContain("Le sens attendu n'est pas indiqué");
    expect(diagnostic(report, "hypotheses-none")).toMatchObject({ kind: "improvement", severity: "low" });
    expect(report.hypothesesNote).toContain("propositions à valider, pas des résultats");
  });

  it("informations insuffisantes : le rôle reste à préciser et une question ciblée est posée", () => {
    const report = buildUnderstandingReport(input({ title: "Microfinance et pauvreté" }));
    expect(report.variables.map((v) => [v.name, v.role, v.candidateRoles])).toEqual([
      ["Microfinance", "undetermined", ["explanatory", "dependent"]],
      ["Pauvreté", "undetermined", ["explanatory", "dependent"]],
    ]);
    expect(report.relations[0]).toMatchObject({ directed: false, nature: "association" });
    expect(report.nature.nature).toBe("undetermined");
    expect(report.missingEssential.map((m) => m.field)).toEqual(["problem", "mainQuestion", "generalObjective", "population", "field"]);
    const direction = report.clarifications.find((q) => q.id.startsWith("q-direction"));
    expect(direction?.priority).toBe(1);
    expect(direction?.question).toContain("est-ce « Microfinance » qui est supposé expliquer « Pauvreté », l'inverse");
    expect(diagnostic(report, "question-missing")?.proposal).toBe("Question possible : dans quelle mesure « Microfinance » est-il associé à « Pauvreté » ?");
  });

  it("termes ambigus : signale les mots vagues et l'ambiguïté du concept", () => {
    const report = buildUnderstandingReport(
      input({
        title: "Gouvernance et performance des coopératives agricoles",
        mainQuestion: "Dans quelle mesure la gouvernance est-elle associée à la performance des coopératives ?",
        hypotheses: ["La gouvernance a un effet significatif sur la performance."],
      }),
    );
    const [h] = report.hypotheses;
    expect(h.vagueTerms).toEqual(["effet", "performance", "significatif"]);
    const performance = card(report, "Performance");
    expect(performance.ambiguity).toContain("financière, commerciale, opérationnelle, sociale");
    expect(diagnostic(report, `definition-${performance.key}`)?.severity).toBe("high");
    expect(card(report, "Gouvernance").ambiguity).toContain("Le terme est large");
  });
});

describe("Propositions et corrections de l'utilisateur", () => {
  const base = input({ title: "Microfinance et pauvreté", population: "Ménages bénéficiaires de microcrédits à Likasi" });

  it("aucune proposition n'est validée par défaut ; la confiance « élevée » est réservée aux validations", () => {
    const report = buildUnderstandingReport(input(LUBUMBASHI));
    expect(report.variables.every((v) => v.status === "proposed")).toBe(true);
    expect(report.variables.some((v) => v.confidence === "high")).toBe(false);
    expect(report.relations.every((r) => r.status === "proposed")).toBe(true);
  });

  it("une correction de rôle, de nom ou de définition est appliquée et fait disparaître les questions résolues", () => {
    const before = buildUnderstandingReport(base);
    const [micro, poverty] = before.variables;
    let decisions = setVariableDecision(emptyDecisions(), micro.key, { role: "explanatory", status: "confirmed", name: "Accès au microcrédit" });
    decisions = setVariableDecision(decisions, poverty.key, { role: "dependent", definition: "Revenu mensuel du ménage par personne inférieur au seuil retenu." });
    const after = buildUnderstandingReport(base, decisions);
    const correctedMicro = after.variables.find((v) => v.key === micro.key)!;
    expect(correctedMicro).toMatchObject({ name: "Accès au microcrédit", role: "explanatory", roleOrigin: "user", status: "confirmed", confidence: "high" });
    const correctedPoverty = after.variables.find((v) => v.key === poverty.key)!;
    expect(correctedPoverty.definition).toEqual({ text: "Revenu mensuel du ménage par personne inférieur au seuil retenu.", origin: "user" });
    expect(correctedPoverty.status).toBe("proposed");
    expect(after.clarifications.some((q) => q.id.startsWith("q-direction"))).toBe(false);
    expect(diagnostic(after, `definition-${poverty.key}`)).toBeUndefined();
    expect(diagnostic(after, `definition-${micro.key}`)).toBeDefined();
    expect(after.synthesis).toContain("« Accès au microcrédit »");
    // Les entrées ne sont pas modifiées par les décisions.
    expect(after.inputKey).toBe(before.inputKey);
  });

  it("écarter, ajouter, retenir une hypothèse candidate : jamais présentée comme confirmée empiriquement", () => {
    const report = buildUnderstandingReport(input({ ...LUBUMBASHI, hypotheses: [] }));
    const internet = card(report, "Accès à Internet");
    let decisions = setVariableDecision(emptyDecisions(), internet.key, { status: "rejected" });
    decisions = addVariable(decisions, "Taille de l'entreprise", "control", "Nombre de salariés permanents.");
    decisions = setHypothesisDecision(decisions, report.candidateHypotheses[0].id, "retained");
    const after = buildUnderstandingReport(input({ ...LUBUMBASHI, hypotheses: [] }), decisions);
    expect(after.variables.some((v) => v.key === internet.key)).toBe(false);
    expect(after.rejectedVariables.map((v) => v.name)).toEqual(["Accès à Internet"]);
    expect(card(after, "Taille de l'entreprise")).toMatchObject({ origin: "user", role: "control", status: "confirmed" });
    expect(after.candidateHypotheses[0]).toMatchObject({ status: "retained", empiricalStatus: "untested" });
  });

  it("écarter une relation retire les rôles qui en découlaient", () => {
    const report = buildUnderstandingReport(input(LUBUMBASHI));
    const decisions = setRelationDecision(emptyDecisions(), report.relations[0].id, "rejected");
    const after = buildUnderstandingReport(input(LUBUMBASHI), decisions);
    expect(after.relations[0].status).toBe("rejected");
    expect(card(after, "Création de valeur").role).toBe("undetermined");
  });

  it("signale les décisions devenues orphelines après une modification des textes", () => {
    const decisions = setVariableDecision(emptyDecisions(), "concept-disparu", { role: "control", name: "Concept disparu" });
    expect(buildUnderstandingReport(base, decisions).orphanDecisions).toEqual(["Variable « Concept disparu »"]);
  });
});

describe("Validation des entrées", () => {
  it("refuse une entrée vide ou invalide avec un message par champ", () => {
    expect(validateResearchInput({ title: "   " })).toEqual({ ok: false, errors: [{ field: "title", message: "Le sujet ou titre provisoire est obligatoire." }] });
    expect(validateResearchInput({ title: "?? !!" })).toMatchObject({ ok: false, errors: [{ field: "title" }] });
    expect(validateResearchInput(null)).toMatchObject({ ok: false, errors: [{ field: "form" }] });
    expect(validateResearchInput([])).toMatchObject({ ok: false, errors: [{ field: "form" }] });
    expect(validateResearchInput({})).toMatchObject({ ok: false, errors: [{ field: "title" }] });
    expect(validateResearchInput({ title: 42 })).toMatchObject({ ok: false, errors: [{ field: "title" }] });
    expect(validateResearchInput({ title: "Sujet", hypotheses: "pas une liste" })).toMatchObject({ ok: false, errors: [{ field: "hypotheses" }] });
    expect(validateResearchInput({ title: "Sujet", approach: "astrologique" })).toMatchObject({ ok: false, errors: [{ field: "approach" }] });
    expect(validateResearchInput({ title: "Sujet", problem: "x".repeat(4001) })).toMatchObject({ ok: false, errors: [{ field: "problem" }] });
    expect(validateResearchInput({ title: "Sujet", hypotheses: Array.from({ length: 21 }, () => "h") })).toMatchObject({ ok: false, errors: [{ field: "hypotheses" }] });
  });

  it("nettoie les entrées et accepte un sujet seul (analyse partielle possible)", () => {
    const validation = validateResearchInput({ title: "  Microfinance   et pauvreté ", hypotheses: ["", "  H1  "] });
    expect(validation).toMatchObject({ ok: true, input: { title: "Microfinance et pauvreté", hypotheses: ["H1"], approach: "unspecified" } });
  });
});

describe("Enrichissement IA (fournisseur simulé — tests uniquement)", () => {
  const research = input(LUBUMBASHI);
  const deterministic = buildUnderstandingReport(research);
  const valid: AiEnrichment = {
    concepts: [
      {
        name: "Création de valeur",
        engineConcept: "Création de valeur",
        contextualDefinition: "Valeur économique et commerciale dégagée par les PME grâce à leurs ventes.",
        dimensions: [{ name: "Valeur client", indicators: [{ label: "Clients récurrents", dataType: "quantitative", measure: "nombre par mois", example: "registre des ventes" }] }],
        ambiguities: ["Valeur pour l'entreprise ou pour le client ?"],
        evidence: "création de valeur",
      },
      { name: "Compétences numériques des dirigeants", engineConcept: "", contextualDefinition: "Capacité des dirigeants à utiliser les outils numériques.", dimensions: [], ambiguities: [], evidence: "" },
    ],
    clarificationQuestions: [{ question: "Les PME étudiées vendent-elles des biens ou des services ?", why: "Les indicateurs de valeur diffèrent.", priority: "important" }],
    observations: [{ element: "problem", kind: "improvement", observation: "Le problème pourrait préciser la période observée.", whyItMatters: "La création de valeur se mesure dans le temps." }],
  };
  const provider = (answer: string): AiProvider => async () => answer;

  it("intègre une réponse valide comme suggestions « ai », sans rien valider", async () => {
    const ai = await requestAiEnrichment(research, deterministic, provider(JSON.stringify(valid)), "modele-test");
    expect(ai).toMatchObject({ status: "ok", model: "modele-test" });
    const report = buildUnderstandingReport(research, emptyDecisions(), ai);
    expect(report.ai).toEqual({ status: "ok", model: "modele-test" });
    const value = card(report, "Création de valeur");
    expect(value.ai?.definition).toBe("Valeur économique et commerciale dégagée par les PME grâce à leurs ventes.");
    expect(value.definition?.origin).toBe("engine");
    const added = card(report, "Compétences numériques des dirigeants");
    expect(added).toMatchObject({ origin: "ai", status: "proposed", role: "undetermined", confidence: "low" });
    expect(added.justification[0]).toContain("absent mot pour mot de vos textes");
    expect(report.clarifications.find((q) => q.origin === "ai")).toMatchObject({ priority: 2, question: "Les PME étudiées vendent-elles des biens ou des services ?" });
    expect(report.diagnostics.find((d) => d.origin === "ai")?.kind).toBe("improvement");
    // L'analyse déterministe reste intacte.
    expect(report.relations).toEqual(deterministic.relations);
    expect(report.hypotheses[0].status).toBe("provided_untested");
  });

  it("erreur du service : statut d'erreur explicite, clé masquée, aucune simulation", async () => {
    const failing: AiProvider = async () => {
      throw new Error("401 Incorrect API key provided: sk-proj-ABCDEFGHIJ1234567890");
    };
    const ai = await requestAiEnrichment(research, deterministic, failing);
    expect(ai.status).toBe("error");
    expect(ai.status === "error" && ai.message).toBe("Le service d'IA n'a pas répondu : 401 Incorrect API key provided: [clé masquée]");
    const report = buildUnderstandingReport(research, emptyDecisions(), ai);
    expect(report.ai.status).toBe("error");
    expect(report.variables.some((v) => v.origin === "ai" || v.ai)).toBe(false);
    expect(report.variables).toEqual(deterministic.variables);
  });

  it("rejette une réponse illisible ou non conforme au schéma", async () => {
    expect(await requestAiEnrichment(research, deterministic, provider("pas du JSON"))).toEqual({ status: "error", message: "Réponse de l'IA illisible (JSON invalide) : elle a été ignorée." });
    const wrongEnum = { ...valid, observations: [{ ...valid.observations[0], kind: "hypothesis_confirmed" }] };
    const result = await requestAiEnrichment(research, deterministic, provider(JSON.stringify(wrongEnum)));
    expect(result.status).toBe("error");
    expect(result.status === "error" && result.message).toContain("observations.0.kind");
    const missing = await requestAiEnrichment(research, deterministic, provider(JSON.stringify({ concepts: [] })));
    expect(missing.status).toBe("error");
  });

  it("la requête impose une sortie JSON stricte et interdit de confirmer une hypothèse", () => {
    const request = buildAiRequest(research, deterministic);
    expect(request.schema).toMatchObject({ type: "object", additionalProperties: false, required: ["concepts", "clarificationQuestions", "observations"] });
    expect(request.system).toContain("Ne déclare jamais une hypothèse confirmée");
    expect(request.user).toContain("Digitalisation des activités commerciales");
  });
});

// La route /api/research-understanding (enrichissement IA facultatif) n'est pas déployée dans cette application :
// ses tests restent dans le dépôt d'origine.
