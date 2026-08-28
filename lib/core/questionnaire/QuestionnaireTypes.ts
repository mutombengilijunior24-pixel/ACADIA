/* =========================================================
   MODES DE RECHERCHE
========================================================= */

export type ResearchQuestionnaireMode =
  | "quantitative"
  | "qualitative"
  | "mixed";


/* =========================================================
   TYPES DE QUESTIONS
========================================================= */

export type QuestionType =
  | "single_choice"
  | "multiple_choice"
  | "likert"
  | "yes_no"
  | "number"
  | "text"
  | "long_text"
  | "frequency"
  | "importance"
  | "date"
  | "percentage"
  | "conditional";


/* =========================================================
   STATUT D'UNE QUESTION (P4)

   Réutilise le vocabulaire déjà employé ailleurs dans le
   projet (ResearchTypes.ProposalStatus + "needs_review",
   déjà introduit sur ResearchRelation en P2.1) plutôt que
   d'inventer une nouvelle terminologie.
========================================================= */

export type QuestionnaireQuestionStatus =
  | "proposed"
  | "accepted"
  | "needs_review"
  | "rejected";


/* =========================================================
   TYPES DE SECTIONS
========================================================= */

export type QuestionnaireSectionType =
  | "introduction"
  | "profile"
  | "independent_variable"
  | "dependent_variable"
  | "relationship"
  | "objectives"
  | "complementary"
  | "open_comment";


/* =========================================================
   STATUT DU QUESTIONNAIRE
========================================================= */

export type QuestionnaireStatus =
  | "draft"
  | "published"
  | "closed";


/* =========================================================
   OPTION DE RÉPONSE
========================================================= */

export interface QuestionnaireOption {
  label: string;
  value: string;
}


/* =========================================================
   QUESTION
========================================================= */

export interface QuestionnaireQuestion {
  id: string;

  number: number;

  sectionId: string;

  type: QuestionType;

  text: string;

  required: boolean;


  /* -------------------------------------------------------
     STRUCTURE SCIENTIFIQUE

     `variable`/`dimension`/`indicator` (noms, existants)
     restent utilisés par QuestionnaireMatrix/Validator/
     QualityEngine, inchangés. `variableId`/`dimensionId`/
     `indicatorId` (P4, nouveaux) sont les identifiants réels
     dans ResearchProject — c'est la vraie traçabilité
     scientifique : une question générée depuis
     l'opérationnalisation (P2.2) référence l'id exact de la
     variable/dimension/indicateur dont elle provient.
     Absents pour une question sans lien scientifique établi
     (ex. section socio-démographique) — jamais inventés.
  ------------------------------------------------------- */

  variable?: string;

  dimension?: string;

  objective?: string;

  objectiveIndex?: number;

  objectiveRole?: "general" | "specific";

  indicator?: string;

  variableId?: string;

  dimensionId?: string;

  indicatorId?: string;

  /**
   * Statut de la question — "proposed" par défaut pour toute
   * question générée automatiquement ; "needs_review" lorsque
   * le lien scientifique n'a pas pu être établi avec certitude
   * ou qu'une modification humaine l'a rompu.
   */
  status?: QuestionnaireQuestionStatus;

  /**
   * Ordre d'affichage explicite (indépendant de `number`, qui
   * reste la numérotation globale du questionnaire) — permet
   * de réordonner une section sans renuméroter tout l'instrument.
   */
  order?: number;


  /* -------------------------------------------------------
     JUSTIFICATION MÉTHODOLOGIQUE
  ------------------------------------------------------- */

  methodologicalPurpose?: string;

  analysisHint?: string;


  /* -------------------------------------------------------
     RÉPONSES
  ------------------------------------------------------- */

  options?: QuestionnaireOption[];

  scale?: QuestionnaireOption[];


  /* -------------------------------------------------------
     EXPLICATION
  ------------------------------------------------------- */

  explanation?: string;

  /* -------------------------------------------------------
     QUESTION CONDITIONNELLE (P15)

     Condition d'affichage en texte libre (ex. « Si Q5 = Oui »)
     — jamais déduite automatiquement, toujours renseignée
     explicitement par le chercheur via l'éditeur.
  ------------------------------------------------------- */

  conditionOn?: string;
}


/* =========================================================
   SECTION
========================================================= */

export interface QuestionnaireSection {
  id: string;

  title: string;

  description: string;

  type: QuestionnaireSectionType;

  questions: QuestionnaireQuestion[];
}


/* =========================================================
   VARIABLE DE RECHERCHE
========================================================= */

export interface QuestionnaireVariable {
  id: string;

  name: string;

  /**
   * Élargi (P4) aux 6 rôles déjà prévus par
   * ResearchTypes.VariableRole (P2.1) — une variable de
   * contrôle ou descriptive ne doit plus être écartée.
   */
  role:
    | "independent"
    | "dependent"
    | "mediating"
    | "moderating"
    | "control"
    | "descriptive";

  dimensions: string[];

  indicators: string[];
}


/* =========================================================
   GUIDE D'ENTRETIEN (P4 — recherche qualitative)

   Une recherche qualitative n'est pas transformée en
   questionnaire Likert : elle produit un guide d'entretien
   thématique distinct, structuré autour des dimensions
   (pas des indicateurs isolés — un entretien explore un
   thème, pas une case à cocher).
========================================================= */

export interface InterviewGuideTheme {
  id: string;

  theme: string;

  mainQuestion: string;

  followUps: string[];

  variableId?: string;

  dimensionId?: string;

  objective?: string;

  status?: QuestionnaireQuestionStatus;
}

export interface InterviewGuide {
  id: string;

  title: string;

  description: string;

  themes: InterviewGuideTheme[];

  generatedAt: string;
}


/* =========================================================
   PUBLICATION
========================================================= */

export interface QuestionnairePublication {
  id: string;

  publicId: string;

  status: QuestionnaireStatus;

  publishedAt?: string;

  closedAt?: string;

  responseCount: number;

  publicUrl: string;
}


/* =========================================================
   QUESTIONNAIRE GÉNÉRÉ
========================================================= */

export interface GeneratedQuestionnaire {
  id: string;

  title: string;

  description: string;

  researchType: ResearchQuestionnaireMode;


  /* -------------------------------------------------------
     STRUCTURE SCIENTIFIQUE
  ------------------------------------------------------- */

  variables: QuestionnaireVariable[];

  sections: QuestionnaireSection[];


  /* -------------------------------------------------------
     STATISTIQUES DU QUESTIONNAIRE
  ------------------------------------------------------- */

  totalQuestions: number;

  estimatedDuration: number;


  /* -------------------------------------------------------
     NOTES MÉTHODOLOGIQUES
  ------------------------------------------------------- */

  methodologyNotes: string[];


  /* -------------------------------------------------------
     GÉNÉRATION
  ------------------------------------------------------- */

  generatedAt: string;


  /* -------------------------------------------------------
     PUBLICATION
     
     Optionnel pendant la phase de création.
     Devient renseigné lorsque l'utilisateur publie.
  ------------------------------------------------------- */

  publication?: QuestionnairePublication;

  /**
   * Renseigné uniquement pour une recherche mixte : la partie
   * qualitative reste un guide d'entretien distinct, jamais
   * fusionnée dans les sections quantitatives ci-dessus
   * (P4, Étape 10 — ne pas mélanger les deux instruments).
   */
  interviewGuide?: InterviewGuide;
}