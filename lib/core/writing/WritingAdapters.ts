// ============================================================
// ACADIA — ADAPTATEURS DE RÉDACTION DÉTERMINISTES (Mission 9)
//
// DISCUSSION/CONCLUSION/RECOMMENDATIONS ne déclenchent JAMAIS un appel
// OpenAI dédié à ce module : ce sont des moteurs déjà construits,
// validés et éprouvés (Mission 6 — ScientificInterpretation ; Mission 7
// — ScientificConclusion) que ces fonctions se contentent de REFORMATER
// en blocs de rédaction. Ne recalcule et ne redécide jamais un contenu
// scientifique — même principe que ScientificConclusionEngine.ts vis-
// à-vis de HypothesisAssessment ("ne fait que composer des décisions
// déjà tranchées"). Choisit toujours la génération la plus RÉCENTE et,
// pour la conclusion, la formulation la mieux validée disponible
// (content si validationStatus est "accepted"/"edited", sinon les
// champs déterministes bruts) — jamais une reformulation en compétition
// avec une décision humaine déjà prise.
// ============================================================

import type { ResearchProject } from "@/lib/core/research/ResearchTypes";
import type { WritingBlock } from "./WritingTypes";

function placeholder(id: string, text: string): WritingBlock {
  return { id, type: "NOTE", text, hasPlaceholder: true };
}

function paragraph(id: string, text: string): WritingBlock {
  return { id, type: "PARAGRAPH", text };
}

function list(id: string, text: string, items: string[]): WritingBlock {
  return { id, type: "LIST", text, items };
}

export function buildDiscussionBlocks(project: ResearchProject): WritingBlock[] {
  const interpretations = project.scientificInterpretations ?? [];
  const latest = [...interpretations].reverse().find((i) => i.content);
  if (!latest?.content) {
    return [placeholder("disc-empty", "Aucune interprétation scientifique validée n'est encore disponible pour ce projet — générez et validez d'abord une interprétation (module Analyse) avant de rédiger la discussion.")];
  }

  const c = latest.content;
  const blocks: WritingBlock[] = [paragraph("disc-summary", c.summary)];
  if (c.findings.length > 0) {
    blocks.push(list("disc-findings", "Constats principaux", c.findings.map((f) => f.statement)));
  }
  if (c.recommendations.length > 0) {
    blocks.push(list("disc-recommendations", "Recommandations issues de l'interprétation", c.recommendations));
  }
  if (c.limitations.length > 0) {
    blocks.push(list("disc-limitations", "Limites identifiées", c.limitations));
  }
  return blocks;
}

export function buildConclusionBlocks(project: ResearchProject): WritingBlock[] {
  const conclusions = project.scientificConclusions ?? [];
  const latest = conclusions[conclusions.length - 1];
  if (!latest) {
    return [placeholder("concl-empty", "Aucune conclusion scientifique n'est encore disponible pour ce projet — générez d'abord une conclusion (module Analyse) avant de rédiger cette section.")];
  }

  const useAiContent = latest.content && (latest.content.validationStatus === "accepted" || latest.content.validationStatus === "edited");
  const blocks: WritingBlock[] = [];

  if (useAiContent && latest.content) {
    if (latest.content.researchQuestionConclusion) blocks.push(paragraph("concl-rq", latest.content.researchQuestionConclusion));
    if (latest.content.objectiveConclusions.length > 0) {
      blocks.push(list("concl-obj", "Conclusions par objectif", latest.content.objectiveConclusions.map((o) => o.statement)));
    }
    if (latest.content.hypothesisConclusions.length > 0) {
      blocks.push(list("concl-hyp", "Conclusions par hypothèse", latest.content.hypothesisConclusions.map((h) => h.statement)));
    }
    blocks.push(paragraph("concl-general", latest.content.generalConclusion));
    if (latest.content.limitations.length > 0) blocks.push(list("concl-limits", "Limites", latest.content.limitations));
  } else {
    if (latest.researchQuestionConclusion) blocks.push(paragraph("concl-rq", latest.researchQuestionConclusion.conclusion));
    if (latest.objectiveConclusions.length > 0) {
      blocks.push(list("concl-obj", "Conclusions par objectif", latest.objectiveConclusions.map((o) => o.conclusion)));
    }
    if (latest.hypothesisConclusions.length > 0) {
      blocks.push(list("concl-hyp", "Conclusions par hypothèse", latest.hypothesisConclusions.map((h) => h.conclusion)));
    }
    blocks.push(paragraph("concl-general", latest.generalConclusion));
    if (latest.limitations.length > 0) blocks.push(list("concl-limits", "Limites", latest.limitations));
  }

  return blocks;
}

export function buildRecommendationsBlocks(project: ResearchProject): WritingBlock[] {
  const interpretations = project.scientificInterpretations ?? [];
  const latest = [...interpretations].reverse().find((i) => i.content?.recommendations?.length);
  if (!latest?.content) {
    return [placeholder("rec-empty", "Aucune recommandation n'est encore disponible — elles sont dérivées de l'interprétation scientifique (module Analyse), à générer et valider d'abord.")];
  }
  return [list("rec-list", "Recommandations", latest.content.recommendations)];
}
