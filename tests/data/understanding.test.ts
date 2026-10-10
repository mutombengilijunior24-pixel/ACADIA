import { describe, expect, it } from "vitest";

import { addOperation, createPreparation } from "@/lib/core/data/preparation";
import { profileDataset } from "@/lib/core/data/profile";
import { allQuestions } from "@/lib/core/data/research";
import type { ImportedDataset, PreparationState, VariableMetadata } from "@/lib/core/data/types";
import { buildUnderstanding, type UnderstandingInput } from "@/lib/core/data/understanding";
import { generateQuestionnaire } from "@/lib/core/questionnaire/QuestionnaireEngine";
import { questionnaireTestResearch } from "@/lib/core/questionnaire/QuestionnaireTestData";
import type { ResearchProject } from "@/lib/core/research/ResearchTypes";

import { importOk, utf8 } from "./helpers";

// Données SYNTHÉTIQUES de test.

async function understand(csv: string, extra: Partial<UnderstandingInput> & { prepare?: (state: PreparationState, ds: ImportedDataset) => PreparationState } = {}) {
  const dataset = await importOk("donnees.csv", utf8(csv));
  let preparation = createPreparation(dataset);
  if (extra.prepare) preparation = extra.prepare(preparation, dataset);
  const profile = profileDataset(dataset, preparation);
  const state = buildUnderstanding({ ...extra, dataset, profile, preparation });
  const v = (name: string) => state.variables.find((variable) => variable.technicalName === name) as VariableMetadata;
  return { dataset, state, v };
}

const SURVEY = [
  "id_repondant,telephone,ville,satisfaction,revenu,age,abonne,date_enquete,avis,accord,score_mixte",
  "1,0991234561,Lubumbashi,4,120.5,23,Oui,05/03/2026,Le service était rapide et le personnel très accueillant,Tout à fait d'accord,12",
  "2,0991234562,Likasi,5,98.25,31,Non,13/03/2026,Attente beaucoup trop longue au guichet principal,D'accord,15",
  "3,0991234563,Kolwezi,3,143.75,45,Oui,14/03/2026,Personnel compétent mais locaux mal entretenus,Neutre,abc",
  "4,0991234564,Lubumbashi,2,87.4,27,Non,15/03/2026,Je recommanderais ce service à mes collègues,Pas d'accord,20",
  "5,0991234565,Likasi,4,110.1,38,Oui,16/03/2026,Les horaires d'ouverture ne conviennent pas aux étudiants,D'accord,18",
  "6,0991234566,Kolwezi,1,132.8,52,Oui,17/03/2026,Aucune remarque particulière sur la qualité de l'accueil,Pas du tout d'accord,11",
  "7,0991234567,Lubumbashi,5,105.6,29,Non,18/03/2026,Très satisfait de la rapidité du traitement des dossiers,Tout à fait d'accord,14",
  "8,0991234568,Likasi,3,99.9,41,Oui,19/03/2026,Le coût est trop élevé pour la majorité des familles,Neutre,16",
  "9,0991234569,Kolwezi,4,121.3,36,Non,20/03/2026,Bonne communication avec les responsables de service,D'accord,19",
  "10,0991234570,Lubumbashi,2,93.7,47,Oui,21/03/2026,Les procédures administratives restent trop complexes,Pas d'accord,13",
  "11,0991234571,Likasi,4,117.2,33,Oui,22/03/2026,Accueil chaleureux mais délais encore trop longs,D'accord,17",
  "12,0991234572,Kolwezi,5,128.4,26,Non,23/03/2026,Service globalement satisfaisant dans l'ensemble,Tout à fait d'accord,10",
].join("\n");

describe("A3 — classification des variables", () => {
  it("distingue identifiant, nominale, ordinale, quantitatives, binaire, date, texte libre, Likert textuel et type ambigu", async () => {
    const { v } = await understand(SURVEY);
    expect(v("id_repondant").detected).toMatchObject({ storageType: "integer", statisticalType: "identifier", confidence: "high" });
    expect(v("telephone").detected).toMatchObject({ statisticalType: "identifier", rule: "identifier_name_unique", confidence: "high" });
    expect(v("ville").detected).toMatchObject({ storageType: "string", statisticalType: "nominal" });
    expect(v("satisfaction").detected).toMatchObject({ statisticalType: "ordinal", confidence: "medium", scale: { min: 1, max: 5 } });
    expect(v("revenu").detected).toMatchObject({ storageType: "decimal", statisticalType: "quantitative_continuous", confidence: "high" });
    expect(v("age").detected).toMatchObject({ storageType: "integer", statisticalType: "quantitative_discrete" });
    expect(v("abonne").detected).toMatchObject({ statisticalType: "nominal", binary: true, confidence: "high" });
    expect(v("date_enquete").detected).toMatchObject({ storageType: "date", statisticalType: "temporal", confidence: "high" });
    expect(v("avis").detected).toMatchObject({ statisticalType: "free_text" });
    expect(v("accord").detected).toMatchObject({ statisticalType: "ordinal", rule: "likert_labels" });
    expect(v("score_mixte").detected).toMatchObject({ storageType: "ambiguous", statisticalType: "to_confirm", confidence: "low" });
  });

  it("un identifiant répété (doublon de ligne) reste un identifiant, jamais une échelle Likert", async () => {
    const { v } = await understand(["id_repondant,note", "1,12", "2,15", "3,11", "4,14", "5,13", "6,16", "7,10", "8,17", "9,12", "10,18", "5,13"].join(String.fromCharCode(10)));
    expect(v("id_repondant").detected).toMatchObject({ statisticalType: "identifier", rule: "identifier_name_mostly_unique", confidence: "medium" });
    expect(v("id_repondant").detected.reasons[0]).toContain("1 valeur(s) se répètent");
    // Petit échantillon : 6 valeurs dont une répétée (même cas que le parcours navigateur).
    const small = await understand(["id_repondant,note", "1,12", "2,15", "3,11", "4,14", "5,13", "5,13"].join(String.fromCharCode(10)));
    expect(small.v("id_repondant").detected).toMatchObject({ statisticalType: "identifier", rule: "identifier_name_mostly_unique" });
    // Trop de répétitions : ce n'est plus un identifiant présumé.
    const grouped = await understand(["code_ville,note", "1,12", "1,15", "2,11", "2,14", "3,13", "3,13"].join(String.fromCharCode(10)));
    expect(grouped.v("code_ville").detected.statisticalType).not.toBe("identifier");
  });

  it("des nombres à zéros en tête sont des codes, même sans nom évocateur", async () => {
    const { v } = await understand(["contact_parent,note", "0991234561,12", "0991234562,15", "0991234561,11"].join(String.fromCharCode(10)));
    expect(v("contact_parent").detected).toMatchObject({ storageType: "integer", statisticalType: "identifier", rule: "leading_zero_codes", confidence: "medium" });
  });

  it("un type incertain doit être confirmé avant toute analyse ; la confirmation est tracée et la détection conservée", async () => {
    const before = await understand(SURVEY);
    expect(before.v("satisfaction")).toMatchObject({ needsConfirmation: true, analysisReady: false, effectiveType: "ordinal", typeSource: "auto" });
    expect(before.v("score_mixte").analysisReady).toBe(false);
    expect(before.state.questionsForUser).toContain("« satisfaction » (valeurs 1 à 5) est-elle une échelle ordonnée ?");

    const after = await understand(SURVEY, {
      prepare: (state, ds) => addOperation(state, { type: "set_statistical_type", column: ds.columns.findIndex((c) => c.technicalName === "age"), statisticalType: "quantitative_continuous" }),
    });
    const age = after.v("age");
    expect(age).toMatchObject({ effectiveType: "quantitative_continuous", typeSource: "user", needsConfirmation: false, analysisReady: true });
    expect(age.detected.statisticalType).toBe("quantitative_discrete");
    expect(age.confirmed?.by).toBe("user");
  });

  it("n'invente aucun rôle dépendant / indépendant à partir des données ou du titre", async () => {
    const { state } = await understand(SURVEY, {
      researchData: { ...questionnaireTestResearch, title: "Impact de la satisfaction sur la performance" },
    });
    const roles = state.variables.map((variable) => variable.role?.value).filter(Boolean);
    expect(roles).not.toContain("dependent");
    expect(roles).not.toContain("independent");
    expect(state.variables.find((v) => v.technicalName === "id_repondant")?.role).toEqual({ value: "identifier", source: "classification" });
    expect(state.variables.find((v) => v.technicalName === "avis")?.role).toEqual({ value: "qualitative_text", source: "classification" });
    expect(state.missingInformation.some((m) => m.startsWith("Aucune variable dépendante ou indépendante"))).toBe(true);
  });
});

describe("A3 — liaison avec le questionnaire et la recherche", () => {
  const questionnaire = generateQuestionnaire(questionnaireTestResearch);
  const questions = allQuestions(questionnaire);
  const likert = questions.find((q) => q.type === "likert" && q.variable && !q.variable.includes("→"))!;
  const open = questions.find((q) => q.type === "long_text")!;

  it("propose des correspondances (texte exact, code de question) sans jamais les confirmer, et laisse les autres colonnes sans correspondance", async () => {
    const csv = [`id,"${likert.text.replace(/"/g, '""')}",Q${open.number},autre_colonne`, "1,4,Très bonne évaluation du travail réalisé,x", "2,5,Rien à signaler pour le moment,y"].join("\n");
    const { state, v } = await understand(csv, { questionnaire });
    const exact = v(state.variables[1].technicalName);
    expect(exact.mapping).toMatchObject({ questionId: likert.id, source: "auto_exact_text", confidence: "high", confirmed: false, variable: likert.variable });
    // Classée d'après le type de question, mais confiance moyenne tant que la correspondance n'est pas confirmée.
    expect(exact.detected).toMatchObject({ statisticalType: "ordinal", rule: "questionnaire:likert", confidence: "medium" });
    expect(exact.typeSource).toBe("questionnaire");
    expect(v(`q${open.number}`).mapping).toMatchObject({ questionNumber: open.number, source: "auto_question_code", confidence: "medium", confirmed: false });
    expect(v("autre_colonne").mapping).toBeUndefined();
    expect(state.questionsForUser.some((q) => q.includes(`question ${likert.number}`))).toBe(true);
    expect(state.structure.find((s) => s.family === "questionnaire")).toMatchObject({ confidence: "medium", status: "proposed" });
  });

  it("une correspondance confirmée par l'utilisateur rend la classification certaine et rattache le rôle de la variable de recherche", async () => {
    const project = {
      id: "p1",
      title: questionnaireTestResearch.title,
      status: "draft",
      researchType: "quantitative",
      createdAt: new Date(),
      updatedAt: new Date(),
      researchQuestions: [],
      objectives: [],
      relations: [],
      hypotheses: [],
      variables: [
        { id: "v-dep", name: likert.variable!, role: "dependent", definition: "", dimensions: [], indicators: [], linkedObjectiveIds: [], status: "proposed", confidence: "medium" },
      ],
    } as unknown as ResearchProject;
    const csv = ["id,Q99", "1,4", "2,5"].join("\n");
    const { v } = await understand(csv, {
      questionnaire,
      project,
      prepare: (state) =>
        addOperation(state, {
          type: "set_mapping",
          column: 1,
          mapping: { column: 1, questionId: likert.id, questionNumber: likert.number, questionType: "likert", variable: likert.variable, researchVariableId: "v-dep", source: "user", confidence: "high", confirmed: true, reasons: ["Association manuelle."] },
        }),
    });
    const column = v("q99");
    expect(column.mapping).toMatchObject({ source: "user", confirmed: true });
    expect(column.detected).toMatchObject({ statisticalType: "ordinal", confidence: "high" });
    expect(column.analysisReady).toBe(true);
    expect(column.role).toMatchObject({ value: "dependent", source: "research_variable" });
    expect(column.role?.detail).toContain("non confirmé");
  });

  it("étude descriptive sans hypothèse : signalé comme information absente, sans blocage de la préparation", async () => {
    const { state } = await understand(SURVEY, { researchData: { ...questionnaireTestResearch, researchType: "Descriptive" } });
    expect(state.facts.find((f) => f.key === "hypotheses")).toMatchObject({ provenance: "unknown" });
    expect(state.facts.find((f) => f.key === "hypotheses")?.note).toContain("étude descriptive");
    expect(state.dataPrepared).toBe(true);
    expect(state.readyForAnalysisSelection).toBe(false);
  });

  it("recherche aux informations incomplètes : tout ce qui manque est listé, rien n'est complété", async () => {
    const { state } = await understand("a,b\n1,x\n2,y\n");
    expect(state.missingInformation[0]).toContain("Aucun projet de recherche");
    for (const key of ["title", "problem", "research_question", "hypotheses", "variables"]) {
      expect(state.facts.find((f) => f.key === key)?.provenance).toBe("unknown");
    }
    expect(state.facts.every((f) => f.provenance === "unknown" || f.value)).toBe(true);
  });

  it("plusieurs variables : prêt pour le choix d'une analyse seulement après toutes les décisions", async () => {
    const csv = ["id_repondant,age,revenu", "1,23,10.5", "2,31,12.25", "3,45,9.75", "4,27,11.5", "5,38,13.1", "6,52,8.9", "7,29,10.2", "8,41,12.7", "9,36,9.4", "10,47,11.9", "11,33,10.8"].join("\n");
    const pending = await understand(csv);
    expect(pending.state.readyForAnalysisSelection).toBe(false);
    const done = await understand(csv, {
      prepare: (state, ds) => {
        let next = addOperation(state, { type: "set_statistical_type", column: ds.columns.findIndex((c) => c.technicalName === "age"), statisticalType: "quantitative_discrete" });
        next = addOperation(next, { type: "confirm_structure", family: "cross_sectional" });
        return next;
      },
    });
    expect(done.state.variables.every((variable) => variable.analysisReady)).toBe(true);
    expect(done.state.confirmedStructure).toBe("cross_sectional");
    expect(done.state.structure.find((s) => s.family === "cross_sectional")?.status).toBe("confirmed");
    expect(done.state.readyForAnalysisSelection).toBe(true);
  });

  it("structure : plusieurs dates ne suffisent pas à conclure à une série temporelle ; un panel exige des unités répétées", async () => {
    const dates = await understand(["debut,fin,montant", "01/01/2026,13/01/2026,10.5", "02/01/2026,14/01/2026,11.25"].join("\n"));
    expect(dates.state.structure.map((s) => s.family)).not.toContain("time_series");

    const panel = await understand(
      ["entreprise,annee_date,ventes", ...["A", "B", "C"].flatMap((unit, u) => ["2024-01-01", "2025-01-01", "2026-01-01"].map((d, i) => `${unit},${d},${(u + 1) * 10 + i}.5`))].join("\n"),
    );
    expect(panel.state.structure.find((s) => s.family === "panel")).toMatchObject({ confidence: "low", status: "proposed" });
  });
});
