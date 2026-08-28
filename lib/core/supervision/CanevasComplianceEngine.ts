// ============================================================
// ACADIA — CONFORMITÉ AU CANEVAS DU DIRECTEUR (P16)
//
// Le canevas du directeur ne remplace jamais le moteur
// scientifique ACADIA (Partie 24 du sprint) : il vient au-dessus,
// et ses règles sont toujours celles configurées par CE directeur
// — jamais une règle universelle câblée en dur (Partie 25).
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { SupervisionCanevas, CanevasComplianceItem } from "./SupervisionTypes";

export function checkCanevasCompliance(
  canevas: SupervisionCanevas | undefined,
  project: ResearchProject
): CanevasComplianceItem[] {
  if (!canevas?.hypothesisRules?.length) return [];

  const rule = canevas.hypothesisRules.find((r) => r.level === project.level);
  if (!rule) return [];

  const secondaryCount = project.hypotheses.filter((h) => h.role === "specific" && h.status !== "rejected").length;
  const compliant = secondaryCount >= rule.minSecondary && secondaryCount <= rule.maxSecondary;

  return [
    {
      ruleLabel: `Nombre d'hypothèses secondaires (niveau ${project.level ?? "non précisé"})`,
      expected: rule.minSecondary === rule.maxSecondary ? `${rule.minSecondary}` : `entre ${rule.minSecondary} et ${rule.maxSecondary}`,
      actual: `${secondaryCount}`,
      compliant,
    },
  ];
}
