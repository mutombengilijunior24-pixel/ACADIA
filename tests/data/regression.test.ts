import { describe, expect, it } from "vitest";

import { calculateSampleSize } from "@/lib/core/methodology/SamplingEngine";
import { generateQuestionnaire } from "@/lib/core/questionnaire/QuestionnaireEngine";
import { buildQuestionnaireMatrix, getMatrixSummary } from "@/lib/core/questionnaire/QuestionnaireMatrix";
import { questionnaireTestResearch } from "@/lib/core/questionnaire/QuestionnaireTestData";

/**
 * Non-régression des modules à préserver (non modifiés par le chantier A).
 * - Yamane : valeurs attendues recalculées indépendamment, n = ⌈N / (1 + N·e²)⌉.
 * - Questionnaire et matrice : comportement observé lors de l'audit (référence de non-régression,
 *   pas une validation méthodologique).
 */

const yamane = (n: number, e: number) => Math.ceil(n / (1 + n * e * e));

describe("Non-régression — modules existants", () => {
  it("Yamane : résultats de référence", () => {
    for (const [population, margin, expected] of [
      [247, 0.05, 153],
      [6200, 0.05, 376],
      [3000, 0.05, 353],
      [50, 0.05, 45],
      [247, 0.1, 72],
      [10, 0.05, 10],
    ] as const) {
      expect(yamane(population, margin)).toBe(expected);
      expect(calculateSampleSize(population, margin).sampleSize).toBe(expected);
    }
    expect(calculateSampleSize(0).sampleSize).toBeNull();
  });

  it("génération déterministe du questionnaire", () => {
    const first = generateQuestionnaire(questionnaireTestResearch);
    const second = generateQuestionnaire(questionnaireTestResearch);
    const questions = first.sections.flatMap((section) => section.questions);
    expect(first.sections).toHaveLength(7);
    expect(questions).toHaveLength(43);
    const types = questions.reduce<Record<string, number>>((acc, q) => ({ ...acc, [q.type]: (acc[q.type] ?? 0) + 1 }), {});
    expect(types).toEqual({ single_choice: 4, likert: 25, long_text: 14 });
    expect(questions.find((q) => q.type === "likert")?.scale?.map((o) => o.value)).toEqual(["1", "2", "3", "4", "5"]);
    expect(second.sections.flatMap((s) => s.questions.map((q) => q.text))).toEqual(questions.map((q) => q.text));
  });

  it("couverture de la matrice du questionnaire", () => {
    const questionnaire = generateQuestionnaire(questionnaireTestResearch);
    expect(getMatrixSummary(buildQuestionnaireMatrix(questionnaireTestResearch, questionnaire))).toEqual([
      "3 objectif(s) spécifique(s) analysé(s).",
      "3 objectif(s) couvert(s).",
      "3 variable(s) structurée(s).",
      "13 dimension(s) identifiée(s).",
      "21 indicateur(s) identifié(s).",
      "43 question(s) structurée(s).",
      "Taux de couverture des objectifs : 100 %.",
    ]);
  });
});
