// ============================================================
// ACADIA — RESEARCH WRITING ENGINE — TYPES (Mission 9)
//
// Transforme un "état de recherche" déjà validé (questions, objectifs,
// hypothèses, méthodologie, interprétation, conclusion — Missions 1 à 8)
// en prose académique traçable et modifiable par le chercheur. Un
// WritingSection est TOUJOURS rattaché à un ResearchProject et stocké
// dans son payload JSON (même convention que scientificInterpretations/
// scientificConclusions, voir ResearchStateService.ts) — pas de table
// Prisma dédiée, pour rester cohérent avec l'architecture existante.
//
// Règle d'or (mission §37/§52) : l'IA PROPOSE, le chercheur VALIDE.
// Un bloc ne peut citer QUE des claims déjà créés par le chercheur
// (voir ClaimService.ts — "le texte d'un claim est toujours saisi par
// le chercheur, jamais généré par l'IA") : le moteur de rédaction ne
// crée jamais de nouveau ResearchClaim, il ne fait que RÉFÉRENCER des
// claims existants via claimIds.
// ============================================================

import type { ResearchModeTag } from "@/lib/core/research/ResearchTypes";

/**
 * Limité volontairement à 5 types (mission §17, limitation documentée) :
 * un tableau statistique, une équation, une figure ou un marqueur de
 * référence bibliographique automatique ne sont PAS représentés ici —
 * ils restent du ressort du compilateur déterministe existant
 * (ScientificWorkEngine.ts / DocumentBuilder.ts), jamais dupliqués ici.
 */
export type WritingBlockType = "PARAGRAPH" | "HEADING" | "LIST" | "QUOTE" | "NOTE";

export interface WritingBlock {
  id: string;
  type: WritingBlockType;
  /** Texte du bloc — pour LIST, sert de titre optionnel de la liste. */
  text: string;
  /** Uniquement pour LIST. */
  items?: string[];
  /** Uniquement pour HEADING (2 = sous-section, 3 = sous-sous-section). */
  level?: 2 | 3;
  /** ResearchClaim.id RÉELLEMENT existants et réutilisés — jamais inventés (voir ClaimService.ts). */
  claimIds?: string[];
  /** true si ce bloc est un espace réservé ("À compléter par le chercheur") faute de matière source suffisante — jamais un contenu inventé pour combler. */
  hasPlaceholder?: boolean;
}

export type WritingSectionType =
  | "INTRODUCTION"
  | "PROBLEMATIC"
  | "LITERATURE_REVIEW"
  | "METHODOLOGY"
  | "DISCUSSION"
  | "CONCLUSION"
  | "RECOMMENDATIONS";

/**
 * Les 4 états mandatés par la mission (§26) + REJECTED, ajouté pour la
 * même raison que ScientificInterpretationContent.validationStatus
 * (Mission 6, incrément 4) : un chercheur qui rejette explicitement une
 * proposition IA n'est pas dans le même état que "jamais encore
 * examinée" (AI_PROPOSED) — distinction déjà établie dans ce module,
 * reprise ici pour rester cohérent plutôt que d'introduire une
 * troisième convention de statut dans le même domaine (analysis).
 */
export type WritingSectionStatus = "DRAFT" | "AI_PROPOSED" | "USER_EDITED" | "VALIDATED" | "REJECTED";

export type WritingSectionSource = "ai_generated" | "user_edit" | "regeneration" | "adapter";

export interface WritingSectionVersion {
  id: string;
  status: WritingSectionStatus;
  blocks: WritingBlock[];
  source: WritingSectionSource;
  /** Modèle OpenAI réellement utilisé — absent pour "adapter" (aucun appel IA) ou "user_edit". */
  model?: string;
  guardWarnings?: string[];
  createdAt: string;
}

export interface WritingSection {
  id: string;
  projectId: string;
  type: WritingSectionType;
  title: string;
  status: WritingSectionStatus;
  /** Contenu courant — toujours identique à versions[versions.length - 1].blocks. */
  blocks: WritingBlock[];
  /** Snapshot des modes de recherche actifs au moment de la génération (mission §7 — awareness du mode). */
  researchModeTags?: ResearchModeTag[];
  /** Union de tous les claimIds jamais cités dans un bloc de cette section — pour l'audit de cohérence. */
  sourceClaimIds: string[];
  /** Alertes du garde-fou anti-hallucination (voir WritingGuard.ts) — jamais bloquant après coup, seulement informatif une fois persisté. */
  guardWarnings?: string[];
  versions: WritingSectionVersion[];
  generatedAt: string;
  updatedAt: string;
}

export interface WritingCoherenceIssue {
  id: string;
  severity: "info" | "warning" | "blocking";
  sectionType?: WritingSectionType;
  message: string;
}

export interface WritingCoherenceReport {
  projectId: string;
  generatedAt: string;
  issues: WritingCoherenceIssue[];
  /** Comptage positionnel (aucune clé étrangère Question↔Objectif dans ResearchTypes.ts — correspondance par index, mission §13). */
  objectivesCovered: number;
  objectivesTotal: number;
  questionsCovered: number;
  questionsTotal: number;
}

export const WRITING_SECTION_LABELS: Record<WritingSectionType, string> = {
  INTRODUCTION: "Introduction",
  PROBLEMATIC: "Problématique",
  LITERATURE_REVIEW: "Cadre théorique et revue de la littérature",
  METHODOLOGY: "Méthodologie",
  DISCUSSION: "Discussion",
  CONCLUSION: "Conclusion",
  RECOMMENDATIONS: "Recommandations",
};

/**
 * Types génériquement rédigés par l'IA (contexte + prompt dédiés dans
 * ResearchWritingAI.ts). DISCUSSION/CONCLUSION/RECOMMENDATIONS ne sont
 * PAS dans cette liste : ce sont des adaptateurs déterministes qui
 * reformatent un contenu DÉJÀ validé (Mission 6/7) en blocs, sans
 * appel OpenAI dédié à ce module — voir WritingAdapters.ts et le
 * rapport final (section EXISTANT/REUSE) pour la justification.
 */
export const AI_GENERATED_SECTION_TYPES: WritingSectionType[] = ["INTRODUCTION", "PROBLEMATIC", "LITERATURE_REVIEW", "METHODOLOGY"];

export const ADAPTER_SECTION_TYPES: WritingSectionType[] = ["DISCUSSION", "CONCLUSION", "RECOMMENDATIONS"];
