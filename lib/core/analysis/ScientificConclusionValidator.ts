// ============================================================
// ACADIA — VALIDATEUR DE CONCLUSION SCIENTIFIQUE (Mission 7, bloc 2)
//
// Contrôle strict appliqué à la sortie de ScientificConclusionAI.ts
// AVANT toute persistance — contrairement à Mission 6
// (InterpretationGuards.ts), une violation ici REJETTE la génération
// entière (mission §31-33 : "validator FAIL"), elle ne bascule jamais
// silencieusement en "needs_review". Réutilise directement
// checkCausality/checkNumericConsistency/checkContradiction/
// collectKnownNumbers (InterpretationGuards.ts, généralisées pour
// Mission 7 — même code, jamais dupliqué).
//
// Contrôles couverts (mission §31) :
// 1/7. Tout objectiveId cité existe dans cette conclusion.
// 2.   Tout hypothesisId cité existe dans cette conclusion.
// 4/10. Décisions immuables — ContradictionGuard réutilisé.
// 5/6. Aucun nouveau chiffre — NumericConsistencyGuard réutilisé.
// 8.   Aucun lien causal abusif — CausalityGuard réutilisé.
// 9.   Aucun "prouvé"/"démontré" — inclus dans ContradictionGuard
//      (OVERCLAIM_PATTERN), qui s'applique à TOUT texte, pas
//      seulement aux hypothèses.
// 13.  Les limitations établies par le moteur déterministe ne sont
//      pas silencieusement supprimées par l'IA.
// ============================================================

import type { ScientificConclusion } from "./ScientificConclusionTypes";
import type { ScientificConclusionAIResult } from "@/lib/ai/openai/ScientificConclusionAI";
import type { ScientificInterpretationContext } from "@/lib/ai/openai/ScientificInterpretationAI";
import type { GuardViolation } from "./ScientificInterpretationTypes";
import {
  checkCausality,
  checkNumericConsistency,
  checkContradiction,
  collectKnownNumbers,
  type TextField,
  type ContradictionCheckItem,
} from "./InterpretationGuards";

export function validateScientificConclusion(
  aiResult: ScientificConclusionAIResult,
  conclusion: ScientificConclusion,
  context: ScientificInterpretationContext
): GuardViolation[] {
  const violations: GuardViolation[] = [];

  const knownObjectiveIds = new Set(conclusion.objectiveConclusions.map((o) => o.objectiveId));
  const knownHypothesisIds = new Set(conclusion.hypothesisConclusions.map((h) => h.hypothesisId));

  aiResult.objectiveConclusions.forEach((oc, i) => {
    if (!knownObjectiveIds.has(oc.objectiveId)) {
      violations.push({
        guard: "numeric_consistency",
        field: `objectiveConclusions[${i}].objectiveId`,
        snippet: oc.objectiveId,
        reason: "objectiveId inconnu — ne correspond à aucun objectif de cette conclusion.",
      });
    }
  });

  aiResult.hypothesisConclusions.forEach((hc, i) => {
    if (!knownHypothesisIds.has(hc.hypothesisId)) {
      violations.push({
        guard: "numeric_consistency",
        field: `hypothesisConclusions[${i}].hypothesisId`,
        snippet: hc.hypothesisId,
        reason: "hypothesisId inconnu — ne correspond à aucune hypothèse de cette conclusion.",
      });
    }
  });

  const fields: TextField[] = [
    { field: "researchQuestionConclusion", text: aiResult.researchQuestionConclusion },
    ...aiResult.objectiveConclusions.map((o, i) => ({ field: `objectiveConclusions[${i}].statement`, text: o.statement })),
    ...aiResult.hypothesisConclusions.map((h, i) => ({ field: `hypothesisConclusions[${i}].statement`, text: h.statement })),
    { field: "generalConclusion", text: aiResult.generalConclusion },
    ...aiResult.limitations.map((l, i) => ({ field: `limitations[${i}]`, text: l })),
    ...aiResult.warnings.map((w, i) => ({ field: `warnings[${i}]`, text: w })),
  ];

  violations.push(...checkCausality(fields));
  violations.push(...checkNumericConsistency(fields, collectKnownNumbers(context)));

  const contradictionItems: ContradictionCheckItem[] = [
    ...aiResult.hypothesisConclusions.map((h, i) => ({
      field: `hypothesisConclusions[${i}].statement`,
      text: h.statement,
      hypothesisId: h.hypothesisId,
    })),
    // Les textes sans hypothesisId (researchQuestionConclusion, objectifs, conclusion générale)
    // sont malgré tout passés à checkContradiction pour l'OVERCLAIM_PATTERN ("prouve"/"démontre"),
    // qui s'applique indépendamment de tout hypothesisId.
    { field: "researchQuestionConclusion", text: aiResult.researchQuestionConclusion },
    ...aiResult.objectiveConclusions.map((o, i) => ({ field: `objectiveConclusions[${i}].statement`, text: o.statement })),
    { field: "generalConclusion", text: aiResult.generalConclusion },
  ];
  const decisionByHypothesisId = new Map(conclusion.hypothesisConclusions.map((h) => [h.hypothesisId, { decision: h.decision }]));
  violations.push(...checkContradiction(contradictionItems, decisionByHypothesisId));

  if (conclusion.limitations.length > 0 && aiResult.limitations.length === 0) {
    violations.push({
      guard: "contradiction",
      field: "limitations",
      snippet: "[]",
      reason: "Les limitations méthodologiques établies par le moteur déterministe ont été omises par la reformulation IA.",
    });
  }

  return violations;
}
