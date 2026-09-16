// ============================================================
// ACADIA — GARDE-FOU ANTI-HALLUCINATION DE LA RÉDACTION (Mission 9)
//
// Vérifie a posteriori une prose IA (WritingBlock[]) avant persistance.
// Réutilise les fonctions génériques de InterpretationGuards.ts
// (Mission 6, généralisées Mission 7) plutôt que de réécrire une
// détection de vocabulaire de certitude absolue — même discipline que
// ScientificConclusionValidator.ts. N'ajoute qu'un garde-fou réellement
// nouveau à ce module : la validité des claimIds cités.
// ============================================================

import type { GuardViolation } from "@/lib/core/analysis/ScientificInterpretationTypes";
import { checkContradiction, checkNumericConsistency, type TextField } from "@/lib/core/analysis/InterpretationGuards";
import type { AIWritingBlock } from "@/lib/ai/openai/ResearchWritingAI";

function collectTextFields(blocks: AIWritingBlock[]): TextField[] {
  return blocks.flatMap((b, i) => {
    const fields: TextField[] = [{ field: `blocks[${i}].text`, text: b.text }];
    b.items.forEach((item, j) => fields.push({ field: `blocks[${i}].items[${j}]`, text: item }));
    return fields;
  });
}

/**
 * Seul garde-fou réellement nouveau de ce module : un claimId cité par
 * l'IA doit exister tel quel dans la liste des claims transmis dans le
 * contexte (déjà saisis par le chercheur, voir ClaimService.ts) —
 * jamais un identifiant halluciné.
 */
export function checkClaimIdValidity(blocks: AIWritingBlock[], validClaimIds: string[]): GuardViolation[] {
  const known = new Set(validClaimIds);
  const violations: GuardViolation[] = [];
  blocks.forEach((b, i) => {
    for (const claimId of b.claimIds) {
      if (!known.has(claimId)) {
        violations.push({
          guard: "numeric_consistency",
          field: `blocks[${i}].claimIds`,
          snippet: claimId,
          reason: `Le claimId "${claimId}" cité par l'IA ne correspond à aucun claim réellement transmis dans le contexte — probable invention, jamais un claim créé par le chercheur.`,
        });
      }
    }
  });
  return violations;
}

export function runWritingGuards(blocks: AIWritingBlock[], validClaimIds: string[], knownNumbers?: number[]): GuardViolation[] {
  const fields = collectTextFields(blocks);
  const overclaimViolations = checkContradiction(
    fields.map((f) => ({ field: f.field, text: f.text })),
    new Map()
  );
  const claimViolations = checkClaimIdValidity(blocks, validClaimIds);
  const numericViolations = knownNumbers ? checkNumericConsistency(fields, knownNumbers) : [];

  return [...overclaimViolations, ...claimViolations, ...numericViolations];
}
