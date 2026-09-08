// ============================================================
// ACADIA — SCIENTIFIC DISCUSSION TYPES (P10)
//
// P10 répond à : "Comment comprendre ces résultats dans le cadre
// scientifique de la recherche ?" — distinct de P9 ("Que montrent
// les données ?"). Aucune théorie ni référence bibliographique
// n'est inventée : ResearchProject ne possède actuellement AUCUN
// champ théorie/littérature — ces sections restent donc toujours
// dans leur état "non renseigné", jamais hallucinées.
// ============================================================

/**
 * "rejected" ajouté par Mission 6 (incrément 4) pour le workflow de
 * validation humaine de ScientificInterpretationContent — un
 * chercheur rejette explicitement une formulation IA plutôt que de
 * simplement l'ignorer, distinct de "needs_review" (signalé
 * automatiquement par un garde-fou, pas encore examiné).
 */
export type ValidationStatus = "generated" | "needs_review" | "accepted" | "edited" | "rejected";

export interface DiscussionSection {
  id: string;
  title: string;
  statements: string[];
}

// ============================================================
// P10.2 — CADRE THÉORIQUE (jamais inventé)
// ============================================================

export type TheoryStatus = "none_registered" | "available";

// ============================================================
// P10.3 — LITTÉRATURE (modèle préparé pour un futur bloc — aucune
// donnée n'est encore enregistrable dans ce sprint, jamais inventée)
// ============================================================

export type LiteratureComparisonStatus =
  | "convergence"
  | "divergence"
  | "complementarity"
  | "not_comparable"
  | "insufficient_literature";

export interface LiteratureReference {
  id: string;
  author: string;
  year: number;
  title: string;
  field?: string;
  method?: string;
  result?: string;
  conclusion?: string;
  relationToResult?: LiteratureComparisonStatus;
  citation?: string;
}

// ============================================================
// P10.6 — LIMITES (jamais inventées, dérivées des données réelles)
// ============================================================

export type LimitationSeverity = "detected" | "potential_risk";

export interface LimitationItem {
  id: string;
  category: string;
  description: string;
  severity: LimitationSeverity;
}

// ============================================================
// P10.1 — STRUCTURE DE LA DISCUSSION PAR RÉSULTAT
// ============================================================

export interface ResultDiscussion {
  resultRef: string;
  resultSummary: DiscussionSection;
  economicInterpretation: DiscussionSection;
  hypothesisConfrontation: DiscussionSection;
  theoreticalConfrontation: DiscussionSection;
  literatureComparison: DiscussionSection;
  context: DiscussionSection;
  scientificImplication: DiscussionSection;
  practicalImplication?: DiscussionSection;
}

export interface ScientificDiscussion {
  projectId: string;
  datasetId?: string;
  generatedAt: string;

  results: ResultDiscussion[];

  theoryStatus: TheoryStatus;
  literature: LiteratureReference[];

  limitations: LimitationItem[];
}
