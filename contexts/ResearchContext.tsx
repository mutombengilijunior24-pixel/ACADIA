"use client";

// ============================================================
// ACADIA — RESEARCH CONTEXT
//
// RESPONSABILITÉ
// ------------------------------------------------------------
// Le Context fait le pont entre :
//
// UI / Research Wizard
//        ↓
// ResearchData
//        ↓
// ResearchCore
//        ↓
// ResearchProject
//
// L'intelligence IA est exécutée uniquement lorsque
// analyzeCurrentResearch() est appelée.
//
// Le Context ne contient aucune logique scientifique.
// ============================================================

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useAuth } from "@/contexts/AuthContext";
import { trackClientEvent } from "@/lib/client/trackEvent";

import type {
  Research,
  ResearchData,
} from "@/types/Research";

import {
  initialResearchData,
} from "@/types/Research";

import type {
  ResearchProject,
  ResearchHypothesis,
  ResearchVariable,
  TheoreticalOrientation,
  ResearchQuestion,
  ResearchObjective,
  ProposalStatus,
  ResearchMethodology,
  ResearchAnalysisVersion,
} from "@/lib/core/research/ResearchTypes";

import type {
  GeneratedQuestionnaire,
  InterviewGuide,
  QuestionnaireQuestion,
  QuestionType,
} from "@/lib/core/questionnaire/QuestionnaireTypes";

import {
  inferQuestionType,
} from "@/lib/core/questionnaire/QuestionnaireGenerationEngine";

import type {
  Dataset,
} from "@/lib/core/dataset/DatasetTypes";

import type {
  ValidationStatus,
} from "@/lib/core/analysis/EconomicInterpretationTypes";

import type {
  BibliographyReference,
} from "@/lib/core/scientific-work/ScientificWorkTypes";

import type {
  TheoreticalFrameworkEntry,
} from "@/lib/core/research/TheoreticalFrameworkTypes";

import type {
  ExportHistoryEntry,
} from "@/lib/core/export/DocumentTypes";

import {
  buildDatasetFromInstrument,
  buildDatasetFromInterviewGuide,
} from "@/lib/core/dataset/DatasetEngine";

import {
  createResearchProject,
  archiveResearchProject,
  completeResearchProject,
  updateResearchProject,
} from "@/lib/core/research/ResearchCore";

// ------------------------------------------------------------
// IMPORTANT — frontière client/serveur
//
// ResearchIntelligenceEngine (A1/A2) importe le SDK OpenAI et
// des prompts système sensibles. Ce Context est un composant
// "use client" : il ne doit JAMAIS importer analyzeResearch
// (ou tout autre export exécutable de ce module) directement.
//
// Seul le TYPE est importé ici — `import type` est effacé à la
// compilation, aucun code du moteur n'est donc inclus dans le
// bundle navigateur. L'exécution réelle passe exclusivement par
// POST /api/ai/research-intelligence (voir analyzeCurrentResearch
// ci-dessous), qui exécute A1/A2 côté serveur.
// ------------------------------------------------------------

import type {
  ResearchIntelligenceResult,
} from "@/lib/core/research/ResearchIntelligenceEngine";

// Même règle que ci-dessus : TYPE uniquement (mission Preview WOW —
// la preview appelle désormais A1 directement, même contrat que le
// parcours authentifié). SubjectUnderstandingAI importe aussi le SDK
// OpenAI transitivement ; seul son contrat de données est nécessaire
// ici pour convertir le résultat déjà reçu du client en
// ResearchUnderstanding (voir createResearchFromPreview ci-dessous).
import type {
  AIResearchUnderstanding,
} from "@/lib/ai/openai/SubjectUnderstandingAI";

// Mapping A1 → ResearchUnderstanding partagé avec
// ResearchIntelligenceEngine.ts (voir AIUnderstandingMapper.ts) — ce
// module ne dépend que de types purs, jamais du SDK OpenAI, donc
// importable en toute sécurité ici.
import { convertAIUnderstanding } from "@/lib/core/research/AIUnderstandingMapper";

// Contexte réellement sourcé (recherche web, voir
// lib/ai/openai/PhenomenonContextAI.ts) — type uniquement, même
// raison que ci-dessus. Reporté depuis la preview pour ne plus être
// perdu à l'inscription (Research Intelligence V2).
import type {
  PhenomenonContextItem,
} from "@/lib/ai/openai/PhenomenonContextAI";

import {
  calculateSampleSize,
  type SamplingResult,
} from "@/lib/core/methodology/SamplingEngine";


// ============================================================
// PERSISTANCE (P2.4)
//
// Aucune base de données n'existe dans ce projet (audité :
// aucun ORM, aucune route API de stockage). localStorage est
// déjà utilisé ailleurs dans l'app (QuestionnaireBuilder) pour
// le même rôle — on réutilise le même mécanisme plutôt que
// d'en inventer un nouveau.
//
// `researches` (liste légère) et `projects` (ResearchProject
// complet — variables/relations/hypothèses — par id) sont
// persistés séparément, comme ils le sont déjà en mémoire.
// La cohérence/readiness n'est jamais stockée : elle est
// recalculée à la volée (fonction pure) à partir du
// ResearchProject persisté.
// ============================================================

const RESEARCHES_STORAGE_KEY = "acadia-researches";
const PROJECTS_STORAGE_KEY = "acadia-projects";
const INSTRUMENTS_STORAGE_KEY = "acadia-instruments";
const DATASETS_STORAGE_KEY = "acadia-datasets";
const ANNOTATIONS_STORAGE_KEY = "acadia-annotations";
const BIBLIOGRAPHY_STORAGE_KEY = "acadia-bibliography";
const EXPORT_HISTORY_STORAGE_KEY = "acadia-export-history";
const THEORETICAL_FRAMEWORK_STORAGE_KEY = "acadia-theoretical-framework";

// ------------------------------------------------------------
// ISOLATION PAR UTILISATEUR (P13) — chaque clé localStorage est
// préfixée par l'identifiant du compte connecté, pour qu'un second
// compte utilisé sur le même navigateur ne voie jamais les données
// du précédent. Limite assumée et documentée (voir
// ACADIA_P13_AUTH_ARCHITECTURE.md) : ces données restent locales à
// ce navigateur, pas encore synchronisées entre appareils.
// ------------------------------------------------------------

function scopedStorageKey(base: string, userId: string): string {
  return `${base}:${userId}`;
}

// ------------------------------------------------------------
// ANNOTATIONS (P9/P10) — statut de validation humaine + texte
// édité pour un bloc d'interprétation/discussion identifié par un
// id stable (ex. "interp:econ:model-xxx:coef:EVAL_2"). Le contenu
// GÉNÉRÉ n'est jamais stocké ici (recalculé à la volée depuis
// P6/P7/P8, comme les résultats eux-mêmes) — seul ce que le
// chercheur a explicitement validé/modifié est persisté, jamais
// écrasé par un recalcul automatique.
// ------------------------------------------------------------

export interface AnnotationRecord {
  status: ValidationStatus;
  editedContent?: string;
  datasetVersionAtEdit?: string;
  updatedAt: string;
}

// ------------------------------------------------------------
// INSTRUMENT DE COLLECTE (P4)
//
// Stocké séparément du ResearchProject : c'est un artefact
// éditable par le chercheur (texte, type, statut de chaque
// question), pas une donnée recalculée. `status` ici ne
// signifie jamais "ACADIA garantit la validité scientifique" —
// uniquement "le chercheur a accepté cette proposition".
// ------------------------------------------------------------

export interface InstrumentRecord {
  questionnaire?: GeneratedQuestionnaire;
  interviewGuide?: InterviewGuide;
  status: "draft" | "accepted";
}

function reviveDates<T extends { createdAt: unknown; updatedAt: unknown }>(
  raw: T
): T {
  return {
    ...raw,
    createdAt: raw.createdAt ? new Date(raw.createdAt as string) : new Date(),
    updatedAt: raw.updatedAt ? new Date(raw.updatedAt as string) : new Date(),
  };
}

function loadResearchesFromStorage(key: string): Research[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed.map((item) => reviveDates(item) as Research);
  } catch {
    return [];
  }
}

function loadProjectsFromStorage(key: string): Record<string, ResearchProject> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    const result: Record<string, ResearchProject> = {};
    for (const [id, value] of Object.entries(parsed)) {
      result[id] = reviveDates(value as ResearchProject) as ResearchProject;
    }
    return result;
  } catch {
    return {};
  }
}

function loadInstrumentsFromStorage(key: string): Record<string, InstrumentRecord> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    return parsed as Record<string, InstrumentRecord>;
  } catch {
    return {};
  }
}

function loadDatasetsFromStorage(key: string): Record<string, Dataset> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    return parsed as Record<string, Dataset>;
  } catch {
    return {};
  }
}

function loadAnnotationsFromStorage(key: string): Record<string, Record<string, AnnotationRecord>> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    return parsed as Record<string, Record<string, AnnotationRecord>>;
  } catch {
    return {};
  }
}

function loadBibliographyFromStorage(key: string): Record<string, BibliographyReference[]> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    return parsed as Record<string, BibliographyReference[]>;
  } catch {
    return {};
  }
}

function loadExportHistoryFromStorage(key: string): Record<string, ExportHistoryEntry[]> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    return parsed as Record<string, ExportHistoryEntry[]>;
  } catch {
    return {};
  }
}

function loadTheoreticalFrameworkFromStorage(key: string): Record<string, TheoreticalFrameworkEntry[]> {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return {};

    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};

    return parsed as Record<string, TheoreticalFrameworkEntry[]>;
  } catch {
    return {};
  }
}

function persistToStorage(key: string, value: unknown) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Quota dépassé / navigation privée : l'état en mémoire
    // continue de fonctionner, seule la persistance échoue
    // silencieusement (pas d'erreur visible pour l'utilisateur).
  }
}


// ============================================================
// TYPE DU CONTEXTE
// ============================================================

type ResearchContextType = {

  // Statut réel de la dernière tentative d'écriture PostgreSQL
  // (write-through) — "saved" uniquement après confirmation HTTP.
  saveStatus: "idle" | "saving" | "saved" | "error";

  // MVP simplification (10/09/2026) — true une fois l'hydratation
  // initiale (localStorage puis serveur, voir plus bas) terminée pour
  // l'utilisateur courant. Un composant qui MUTE l'état juste après
  // le montage (ex. createResearchFromPreview sur /dashboard/preview-resume)
  // doit attendre ce signal : muter avant hydratation expose à une
  // course où l'hydratation écrase ensuite la mutation avec un état
  // vide/obsolète.
  isHydrated: boolean;

  // ----------------------------------------------------------
  // PROJETS ENREGISTRÉS
  // ----------------------------------------------------------

  researches: Research[];

  // ----------------------------------------------------------
  // PROJETS SCIENTIFIQUES COMPLETS PERSISTÉS
  //
  // ResearchProject complet (variables/relations/hypothèses)
  // par id de recherche — survit au rechargement, contrairement
  // à currentProject qui ne reflète que la session en cours.
  // ----------------------------------------------------------

  projects: Record<string, ResearchProject>;

  // ----------------------------------------------------------
  // DONNÉES DU WIZARD
  // ----------------------------------------------------------

  currentResearch: ResearchData;

  // ----------------------------------------------------------
  // PROJET SCIENTIFIQUE ACTUEL
  // ----------------------------------------------------------

  currentProject:
    | ResearchProject
    | null;

  // ----------------------------------------------------------
  // RÉSULTAT DE L'INTELLIGENCE IA
  // ----------------------------------------------------------

  intelligence:
    | ResearchIntelligenceResult
    | null;

  // ----------------------------------------------------------
  // MÉTHODOLOGIE
  // ----------------------------------------------------------

  methodology:
    | ResearchProject["methodology"]
    | undefined;

  // ----------------------------------------------------------
  // ÉCHANTILLON
  // ----------------------------------------------------------

  sample:
    SamplingResult;

  // ----------------------------------------------------------
  // WIZARD
  // ----------------------------------------------------------

  updateCurrentResearch: (
    field: keyof ResearchData,
    value:
      | string
      | number
      | string[]
  ) => void;

  resetCurrentResearch: () => void;

  // ----------------------------------------------------------
  // PROJET
  // ----------------------------------------------------------

  buildCurrentProject:
    () => ResearchProject;

  createCurrentResearch:
    () => Research;

  // MVP simplification (10/09/2026) — crée un projet directement à
  // partir d'un sujet + d'une preview déjà obtenus sans compte (voir
  // app/api/preview/route.ts, components/landing/SubjectPreviewOverlay.tsx),
  // sans relancer l'IA. Même moteur que createCurrentResearch
  // (createResearchProject), point d'entrée distinct car il n'y a
  // pas encore de currentResearch/currentProject ambiant à ce stade.
  createResearchFromPreview:
    (subject: string, understanding: AIResearchUnderstanding, contextItems?: PhenomenonContextItem[] | null) => Research;

  // Analyse en profondeur (10/09/2026) — remplace l'état local d'UN
  // projet par la version déjà persistée côté serveur (voir
  // POST /api/research/[id]/deep-analysis, qui fait le travail réel
  // via A1/A2 réutilisés). Ne relance jamais l'IA ici.
  applyProjectUpdate:
    (id: string, project: ResearchProject) => void;

  updateTheoreticalOrientationStatus:
    (id: string, orientationId: string, status: ProposalStatus) => void;

  // ----------------------------------------------------------
  // QUESTION DE RECHERCHE / OBJECTIFS — ÉCRITURE MANUELLE
  //
  // Contrairement aux variables/hypothèses/orientations (proposées
  // par l'IA puis acceptées/rejetées), la question de recherche et
  // les objectifs sont ici directement écrits par l'étudiant quand
  // ResearchConsistencyEngine signale leur absence — jamais générés
  // ni reformulés par ACADIA à cet endroit.
  // ----------------------------------------------------------

  setResearchQuestion:
    (id: string, text: string) => void;

  setGeneralObjective:
    (id: string, text: string) => void;

  addSpecificObjective:
    (id: string, text: string) => void;

  removeObjective:
    (id: string, objectiveId: string) => void;

  // ----------------------------------------------------------
  // INTELLIGENCE IA
  // ----------------------------------------------------------

  analyzeCurrentResearch:
    () => Promise<ResearchIntelligenceResult>;

  // ----------------------------------------------------------
  // GESTION DES PROJETS
  // ----------------------------------------------------------

  addResearch:
    (research: Research) => void;

  updateResearch:
    (research: Research) => void;

  deleteResearch:
    (id: string) => void;

  archiveResearch:
    (id: string) => void;

  restoreResearch:
    (id: string) => void;

  // ----------------------------------------------------------
  // MÉTHODOLOGIE (P3)
  // ----------------------------------------------------------

  validateMethodology:
    (id: string) => void;

  /**
   * P16 (Bloc H) — permet au chercheur de modifier/corriger un ou
   * plusieurs champs de la méthodologie proposée par ACADIA (ex.
   * technique d'échantillonnage, taille d'échantillon, devis de
   * recherche...) avant ou après validation. "Contester" une
   * proposition ACADIA se fait ainsi : en la remplaçant par sa
   * propre valeur, jamais par un simple rejet sans alternative.
   * Si la méthodologie était déjà "accepted", une modification la
   * repasse à "draft" — une méthodologie modifiée redevient une
   * proposition à revalider, cohérent avec le sens de "valider".
   */
  updateMethodologyFields:
    (id: string, changes: Partial<ResearchMethodology>) => void;

  // ----------------------------------------------------------
  // HYPOTHÈSES SECONDAIRES (P13.2)
  // ----------------------------------------------------------

  addHypothesis:
    (id: string, hypothesis: ResearchHypothesis) => void;

  updateHypothesisStatus:
    (id: string, hypothesisId: string, status: ProposalStatus) => void;

  updateHypothesisStatement:
    (id: string, hypothesisId: string, statement: string) => void;

  // ----------------------------------------------------------
  // VALIDATION HUMAINE DES VARIABLES (A2)
  // ----------------------------------------------------------

  updateVariableStatus:
    (id: string, variableId: string, status: ProposalStatus) => void;

  updateVariableName:
    (id: string, variableId: string, name: string) => void;

  // ----------------------------------------------------------
  // INSTRUMENT DE COLLECTE (P4)
  // ----------------------------------------------------------

  instruments:
    Record<string, InstrumentRecord>;

  generateInstrument:
    (id: string) => Promise<void>;

  // Applique un questionnaire déjà importé/restructuré côté serveur
  // (Bloc D, 11/09/2026, voir POST /api/research/[id]/questionnaire/
  // import) — même état final que generateInstrument, mais sans
  // relancer l'IA ici : la conversion a déjà eu lieu côté serveur.
  setImportedInstrument:
    (id: string, questionnaire: GeneratedQuestionnaire) => void;

  updateInstrumentQuestionText:
    (id: string, questionId: string, text: string) => void;

  // ----------------------------------------------------------
  // ÉDITION AVANCÉE DE L'INSTRUMENT (P4-FINAL)
  // ----------------------------------------------------------

  updateInstrumentQuestion:
    (id: string, questionId: string, patch: Partial<QuestionnaireQuestion>) => void;

  addInstrumentQuestion:
    (
      id: string,
      sectionId: string,
      payload: {
        text: string;
        type: QuestionType;
        variableId?: string;
        dimensionId?: string;
        indicatorId?: string;
        variable?: string;
        dimension?: string;
        indicator?: string;
      }
    ) => void;

  deleteInstrumentQuestion:
    (id: string, questionId: string) => void;

  reorderInstrumentQuestion:
    (id: string, questionId: string, direction: "up" | "down") => void;

  acceptInstrument:
    (id: string) => void;

  // ----------------------------------------------------------
  // DATASET / DONNÉES (P5)
  // ----------------------------------------------------------

  datasets:
    Record<string, Dataset>;

  generateDataset:
    (id: string) => void;

  // P17 — dataset importé (CSV, Module 2/Missions 4-7) : même
  // colonne Prisma que `datasets` ci-dessus (voir
  // ResearchStateService.syncResearchState), donc câblé sur le
  // MÊME state que generateDataset. Sans ceci, la synchronisation
  // globale débouncée écraserait silencieusement le dataset importé
  // au prochain enregistrement (elle réécrit `datasets[id]` en
  // entier à chaque frappe ailleurs dans l'app).
  setImportedDataset:
    (id: string, dataset: Dataset) => void;

  addObservation:
    (id: string, values: Dataset["rows"][number]["values"], respondentId?: string) => void;

  updateObservationValue:
    (id: string, rowId: string, columnId: string, value: Dataset["rows"][number]["values"][string]) => void;

  deleteObservation:
    (id: string, rowId: string) => void;

  // ----------------------------------------------------------
  // ANNOTATIONS — VALIDATION / ÉDITION HUMAINE (P9/P10)
  // ----------------------------------------------------------

  annotations:
    Record<string, Record<string, AnnotationRecord>>;

  setAnnotation:
    (researchId: string, blockId: string, patch: Partial<AnnotationRecord>) => void;

  // ----------------------------------------------------------
  // BIBLIOGRAPHIE (P11) — jamais de référence inventée : uniquement
  // ce que le chercheur ajoute explicitement.
  // ----------------------------------------------------------

  bibliography:
    Record<string, BibliographyReference[]>;

  addBibliographyReference:
    (researchId: string, reference: BibliographyReference) => void;

  removeBibliographyReference:
    (researchId: string, referenceId: string) => void;

  // ----------------------------------------------------------
  // HISTORIQUE D'EXPORT (P12) — un enregistrement par export DOCX/PDF
  // effectivement produit, jamais une entrée générée automatiquement.
  // ----------------------------------------------------------

  exportHistory:
    Record<string, ExportHistoryEntry[]>;

  addExportHistoryEntry:
    (researchId: string, entry: ExportHistoryEntry) => void;

  // ----------------------------------------------------------
  // CADRE THÉORIQUE (P13.2) — jamais généré ou déduit par ACADIA,
  // uniquement ce que le chercheur renseigne explicitement.
  // ----------------------------------------------------------

  theoreticalFramework:
    Record<string, TheoreticalFrameworkEntry[]>;

  addTheoreticalFrameworkEntry:
    (researchId: string, entry: TheoreticalFrameworkEntry) => void;

  removeTheoreticalFrameworkEntry:
    (researchId: string, entryId: string) => void;
};


// ============================================================
// CONTEXT
// ============================================================

const ResearchContext =
  createContext<
    ResearchContextType | null
  >(null);


// ============================================================
// PROVIDER
// ============================================================

export function ResearchProvider({
  children,
}: {
  children: ReactNode;
}) {

  // ==========================================================
  // PROJETS ENREGISTRÉS
  // ==========================================================

  const [
    researches,
    setResearches,
  ] = useState<Research[]>([]);


  // ==========================================================
  // PROJETS SCIENTIFIQUES PERSISTÉS
  // ==========================================================

  const [
    projects,
    setProjects,
  ] = useState<Record<string, ResearchProject>>({});


  // ==========================================================
  // INSTRUMENTS DE COLLECTE PERSISTÉS (P4)
  // ==========================================================

  const [
    instruments,
    setInstruments,
  ] = useState<Record<string, InstrumentRecord>>({});


  // ==========================================================
  // DATASETS PERSISTÉS (P5)
  // ==========================================================

  const [
    datasets,
    setDatasets,
  ] = useState<Record<string, Dataset>>({});


  // ==========================================================
  // ANNOTATIONS PERSISTÉES (P9/P10)
  // ==========================================================

  const [
    annotations,
    setAnnotations,
  ] = useState<Record<string, Record<string, AnnotationRecord>>>({});


  // ==========================================================
  // BIBLIOGRAPHIE PERSISTÉE (P11)
  // ==========================================================

  const [
    bibliography,
    setBibliography,
  ] = useState<Record<string, BibliographyReference[]>>({});


  // ==========================================================
  // HISTORIQUE D'EXPORT PERSISTÉ (P12)
  // ==========================================================

  const [
    exportHistory,
    setExportHistory,
  ] = useState<Record<string, ExportHistoryEntry[]>>({});


  // ==========================================================
  // CADRE THÉORIQUE PERSISTÉ (P13.2)
  // ==========================================================

  const [
    theoreticalFramework,
    setTheoreticalFramework,
  ] = useState<Record<string, TheoreticalFrameworkEntry[]>>({});


  // ==========================================================
  // HYDRATATION DEPUIS localStorage — ISOLÉE PAR UTILISATEUR (P13)
  //
  // Démarrage volontairement vide (researches/projects = [],{})
  // pour que le premier rendu client corresponde au rendu
  // serveur (localStorage n'existe pas côté serveur) — on
  // hydrate ensuite dans un effet, après le montage. L'hydratation
  // attend explicitement que la session (useAuth) soit résolue et
  // se ré-exécute si l'identifiant utilisateur change (changement
  // de compte dans le même onglet) — jamais une clé anonyme
  // partagée entre deux comptes.
  // ==========================================================

  const { user, isLoading: isAuthLoading } = useAuth();
  const userId = user?.id;

  const [
    isHydrated,
    setIsHydrated,
  ] = useState(false);

  // Statut réel de la dernière écriture PostgreSQL (write-through,
  // voir plus bas) — jamais "saved" sans confirmation HTTP effective.
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");

  useEffect(() => {
    if (isAuthLoading) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsHydrated(false);

    if (!userId) {
      // Aucune session : rien à isoler, l'état reste vide (les
      // routes /dashboard sont de toute façon protégées par proxy.ts).
      setResearches([]);
      setProjects({});
      setInstruments({});
      setDatasets({});
      setAnnotations({});
      setBibliography({});
      setExportHistory({});
      setTheoreticalFramework({});
      setIsHydrated(true);
      return;
    }

    setResearches(loadResearchesFromStorage(scopedStorageKey(RESEARCHES_STORAGE_KEY, userId)));
    setProjects(loadProjectsFromStorage(scopedStorageKey(PROJECTS_STORAGE_KEY, userId)));
    setInstruments(loadInstrumentsFromStorage(scopedStorageKey(INSTRUMENTS_STORAGE_KEY, userId)));
    setDatasets(loadDatasetsFromStorage(scopedStorageKey(DATASETS_STORAGE_KEY, userId)));
    setAnnotations(loadAnnotationsFromStorage(scopedStorageKey(ANNOTATIONS_STORAGE_KEY, userId)));
    setBibliography(loadBibliographyFromStorage(scopedStorageKey(BIBLIOGRAPHY_STORAGE_KEY, userId)));
    setExportHistory(loadExportHistoryFromStorage(scopedStorageKey(EXPORT_HISTORY_STORAGE_KEY, userId)));
    setTheoreticalFramework(loadTheoreticalFrameworkFromStorage(scopedStorageKey(THEORETICAL_FRAMEWORK_STORAGE_KEY, userId)));
    setIsHydrated(true);
  }, [userId, isAuthLoading]);

  useEffect(() => {
    if (!isHydrated || !userId) return;
    persistToStorage(scopedStorageKey(RESEARCHES_STORAGE_KEY, userId), researches);
  }, [researches, isHydrated, userId]);

  useEffect(() => {
    if (!isHydrated || !userId) return;
    persistToStorage(scopedStorageKey(PROJECTS_STORAGE_KEY, userId), projects);
  }, [projects, isHydrated, userId]);

  useEffect(() => {
    if (!isHydrated || !userId) return;
    persistToStorage(scopedStorageKey(INSTRUMENTS_STORAGE_KEY, userId), instruments);
  }, [instruments, isHydrated, userId]);

  useEffect(() => {
    if (!isHydrated || !userId) return;
    persistToStorage(scopedStorageKey(DATASETS_STORAGE_KEY, userId), datasets);
  }, [datasets, isHydrated, userId]);

  useEffect(() => {
    if (!isHydrated || !userId) return;
    persistToStorage(scopedStorageKey(ANNOTATIONS_STORAGE_KEY, userId), annotations);
  }, [annotations, isHydrated, userId]);

  useEffect(() => {
    if (!isHydrated || !userId) return;
    persistToStorage(scopedStorageKey(BIBLIOGRAPHY_STORAGE_KEY, userId), bibliography);
  }, [bibliography, isHydrated, userId]);

  useEffect(() => {
    if (!isHydrated || !userId) return;
    persistToStorage(scopedStorageKey(EXPORT_HISTORY_STORAGE_KEY, userId), exportHistory);
  }, [exportHistory, isHydrated, userId]);

  useEffect(() => {
    if (!isHydrated || !userId) return;
    persistToStorage(scopedStorageKey(THEORETICAL_FRAMEWORK_STORAGE_KEY, userId), theoreticalFramework);
  }, [theoreticalFramework, isHydrated, userId]);


  // ==========================================================
  // P17 — LA BASE DE DONNÉES DEVIENT LA SOURCE DE VÉRITÉ
  //
  // localStorage reste un cache d'écriture simultanée (write-
  // through) pour la fluidité perçue de l'UI — il n'est plus la
  // source de vérité pour un compte authentifié. Voir
  // ACADIA_P17_PRODUCTION_ARCHITECTURE.md §4 /
  // ACADIA_P17_MIGRATION_GUIDE.md.
  //
  // 1) Juste après l'hydratation locale : on interroge la base.
  //    Si elle contient déjà des données, elles priment sur le
  //    cache local (rechargées dans l'état React). Si la base est
  //    vide mais que le cache local contient des données (compte
  //    créé avant P17), une migration ponctuelle les transmet.
  // ==========================================================

  useEffect(() => {
    if (!isHydrated || !userId) return;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/research-state", { cache: "no-store" });
        if (!res.ok || cancelled) return;
        const data = await res.json();
        const state = data.state;
        const hasServerData = Array.isArray(state?.researches) && state.researches.length > 0;

        if (hasServerData) {
          setResearches(state.researches.map(reviveDates));
          setProjects(state.projects ?? {});
          setInstruments(state.instruments ?? {});
          setDatasets(state.datasets ?? {});
          setAnnotations(state.annotations ?? {});
          setBibliography(state.bibliography ?? {});
          setExportHistory(state.exportHistory ?? {});
          setTheoreticalFramework(state.theoreticalFramework ?? {});
        } else if (researches.length > 0) {
          await fetch("/api/research-state", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ researches, projects, instruments, datasets, annotations, bibliography, exportHistory, theoreticalFramework }),
          });
        }
      } catch {
        // Serveur indisponible / hors-ligne : le cache local reste
        // utilisable, aucune erreur visible pour l'utilisateur.
      }
    })();

    return () => {
      cancelled = true;
    };
    // Volontairement limité à [isHydrated, userId] : on ne veut
    // exécuter cette synchronisation initiale qu'une fois par
    // hydratation, jamais à chaque changement de collection (voir
    // l'effet d'écriture simultanée ci-dessous pour ce cas).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrated, userId]);

  // 2) À chaque changement d'une des 8 collections après
  //    l'hydratation initiale : synchronisation différée
  //    (best-effort, jamais bloquante pour l'UI) vers la base.
  const researchStateSyncTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isHydrated || !userId) return;

    if (researchStateSyncTimeout.current) clearTimeout(researchStateSyncTimeout.current);
    researchStateSyncTimeout.current = setTimeout(() => {
      setSaveStatus("saving");
      fetch("/api/research-state", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ researches, projects, instruments, datasets, annotations, bibliography, exportHistory, theoreticalFramework }),
      })
        .then((res) => setSaveStatus(res.ok ? "saved" : "error"))
        .catch(() => {
          // Écriture simultanée best-effort : une panne réseau laisse
          // le cache local intact, mais l'indicateur doit refléter
          // honnêtement l'échec plutôt que de rester silencieux.
          setSaveStatus("error");
        });
    }, 1500);

    return () => {
      if (researchStateSyncTimeout.current) clearTimeout(researchStateSyncTimeout.current);
    };
  }, [researches, projects, instruments, datasets, annotations, bibliography, exportHistory, theoreticalFramework, isHydrated, userId]);


  // ==========================================================
  // DONNÉES DU WIZARD
  // ==========================================================

  const [
    currentResearch,
    setCurrentResearch,
  ] = useState<ResearchData>({
    ...initialResearchData,
    objectives: [],
  });


  // ==========================================================
  // PROJET SCIENTIFIQUE ACTUEL
  // ==========================================================

  const [
    currentProject,
    setCurrentProject,
  ] = useState<
    ResearchProject | null
  >(null);


  // ==========================================================
  // INTELLIGENCE IA
  // ==========================================================

  const [
    intelligence,
    setIntelligence,
  ] = useState<
    ResearchIntelligenceResult | null
  >(null);


  // ==========================================================
  // ÉCHANTILLON
  // ==========================================================

  const sample =
    useMemo(
      () =>
        calculateSampleSize(
          currentResearch.populationSize
        ),
      [
        currentResearch.populationSize,
      ]
    );


  // ==========================================================
  // MÉTHODOLOGIE
  //
  // Elle provient exclusivement du ResearchProject.
  // ==========================================================

  const methodology =
    currentProject?.methodology;


  // ==========================================================
  // MISE À JOUR DU WIZARD
  // ==========================================================

  function updateCurrentResearch(
    field: keyof ResearchData,
    value:
      | string
      | number
      | string[]
  ) {

    setCurrentResearch(
      (previous) => ({
        ...previous,
        [field]: value,
      })
    );


    // --------------------------------------------------------
    // Les anciennes analyses deviennent obsolètes.
    // --------------------------------------------------------

    setCurrentProject(null);

    setIntelligence(null);
  }


  // ==========================================================
  // RÉINITIALISATION
  // ==========================================================

  function resetCurrentResearch() {

    setCurrentResearch({
      ...initialResearchData,
      objectives: [],
    });

    setCurrentProject(null);

    setIntelligence(null);
  }


  // ==========================================================
  // CONSTRUIRE LE RESEARCH PROJECT
  //
  // ResearchData → ResearchCore → ResearchProject
  // ==========================================================

  function buildCurrentProject():
    ResearchProject {

    const project =
      createResearchProject(
        currentResearch
      );

    setCurrentProject(
      project
    );

    return project;
  }


  // ==========================================================
  // ANALYSER LA RECHERCHE AVEC L'IA
  //
  // Client → POST /api/ai/research-intelligence → A1 → A2 →
  // Adapter → Core (tout le côté IA s'exécute sur le serveur ;
  // ce Context ne fait qu'appeler l'API et propager le résultat).
  //
  // En cas d'échec, l'erreur est propagée (throw) pour que
  // l'appelant puisse distinguer succès / chargement / erreur
  // au lieu de recevoir un faux succès avec un projet vide.
  // ==========================================================

  async function analyzeCurrentResearch():
    Promise<ResearchIntelligenceResult> {

    const response =
      await fetch(
        "/api/ai/research-intelligence",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(currentResearch),
        }
      );

    const payload =
      await response
        .json()
        .catch(() => null);

    if (
      !response.ok ||
      !payload?.success
    ) {

      const message =
        payload?.error?.message ??
        "L'analyse IA a échoué.";

      throw new Error(message);
    }

    const result =
      payload.data as ResearchIntelligenceResult;

    setIntelligence(
      result
    );


    // --------------------------------------------------------
    // Le moteur IA produit déjà un ResearchProject complet.
    // --------------------------------------------------------

    setCurrentProject(
      result.project
    );


    return result;
  }


  // ==========================================================
  // CRÉER UNE RECHERCHE ENREGISTRÉE
  //
  // Cette fonction crée l'entrée utilisée par le dashboard.
  //
  // Le ResearchProject complet reste dans currentProject.
  // ==========================================================

  function createCurrentResearch():
    Research {

    const project =
      currentProject ??
      createResearchProject(
        currentResearch
      );


    // --------------------------------------------------------
    // Synchroniser le projet courant.
    // --------------------------------------------------------

    setCurrentProject(
      project
    );


    // --------------------------------------------------------
    // Le type Research correspond au modèle dashboard.
    //
    // Il conserve les données saisies dans le Wizard.
    // --------------------------------------------------------

    const research:
      Research = {

      ...currentResearch,

      id:
        project.id,

      title:
        project.title,

      description:
        project.description,

      status:
        project.status,

      progress:
        0,

      createdAt:
        project.metadata.createdAt
          ? new Date(
              project.metadata.createdAt
            )
          : new Date(),

      updatedAt:
        project.metadata.updatedAt
          ? new Date(
              project.metadata.updatedAt
            )
          : new Date(),
    };


    // --------------------------------------------------------
    // Enregistrer / remplacer.
    // --------------------------------------------------------

    setResearches(
      (previous) => [
        research,

        ...previous.filter(
          (item) =>
            item.id !== research.id
        ),
      ]
    );


    // --------------------------------------------------------
    // Persister le ResearchProject complet (variables,
    // relations, hypothèses, méthodologie) sous le même id —
    // c'est ce qui permet de le retrouver après rechargement
    // sans relancer A1/A2.
    // --------------------------------------------------------

    setProjects(
      (previous) => ({
        ...previous,
        [project.id]: project,
      })
    );


    return research;
  }


  // Conversion PreviewNarrative → ResearchUnderstanding — champs
  // Mission Preview WOW — toResearchUnderstanding (mapping ad hoc du
  // format PreviewNarrative) a disparu : la preview produit désormais
  // EXACTEMENT le même contrat A1 (AIResearchUnderstanding) que le
  // parcours authentifié, converti par la même fonction partagée
  // (convertAIUnderstanding, voir AIUnderstandingMapper.ts) — plus
  // aucune divergence possible entre "ce que la preview affiche" et
  // "ce que le projet retient après inscription".

  // MVP simplification (10/09/2026, unifié sur A1 — mission Preview
  // WOW) — voir le commentaire sur createResearchFromPreview dans le
  // type du contexte. Construit un projet directement depuis un sujet
  // + une compréhension A1 déjà obtenue (jamais un nouvel appel IA
  // ici), puis suit exactement le même chemin de persistance que
  // createCurrentResearch.
  function createResearchFromPreview(
    subject: string,
    understanding: AIResearchUnderstanding,
    contextItems?: PhenomenonContextItem[] | null
  ): Research {
    // Le champ "problem" alimente à la fois project.problem.statement
    // et project.researchQuestions (voir ResearchCore.buildResearchQuestions,
    // qui n'extrait désormais que la dernière phrase interrogative) —
    // on y met le problème identifié par A1 suivi de la vraie question
    // de recherche qu'il propose, jamais une question inventée par ce
    // contexte.
    const problemText = [understanding.problem, understanding.researchQuestion].filter(Boolean).join(" ");

    const research: ResearchData = {
      ...initialResearchData,
      title: subject.trim(),
      problem: problemText,
      objective: understanding.generalObjective,
      objectives: understanding.specificObjectives,
      population: understanding.population ?? "",
      location: understanding.location ?? "",
    };

    const base = createResearchProject(research);

    // Mission Server Contracts & Research Persistence — la toute
    // première analyse d'un projet devient elle aussi une VERSION
    // (analysisHistory[0]), jamais un simple champ isolé : un
    // chercheur qui relance une analyse en profondeur après
    // inscription verra sa preview conservée comme version 1, pas
    // écrasée. "generated" (jamais "validated" d'office) : cliquer
    // "Utiliser cette proposition" accepte de partir de cette base,
    // pas de la valider scientifiquement — la validation explicite
    // reste un acte distinct (voir /api/research/[id]/understanding/validate).
    const firstVersion: ResearchAnalysisVersion = {
      id: `analysis-version-preview-${Date.now()}`,
      version: 1,
      engineVersion: understanding.engineVersion,
      provenance: "AI_INFERENCE",
      validation: "generated",
      createdAt: new Date().toISOString(),
      understanding: convertAIUnderstanding(understanding),
      variables: [],
      relations: [],
      hypothesesAdded: [],
    };

    const project = updateResearchProject(base, {
      understanding: firstVersion.understanding,
      analysisHistory: [firstVersion],
      // Research Intelligence V2 — auparavant jamais reporté ici : les
      // sources réellement trouvées par PhenomenonContextAI
      // disparaissaient silencieusement à l'inscription. Toujours
      // distinct du raisonnement d'A1 (provenance figée).
      sourcedContext: (contextItems ?? [])
        .filter((item) => item?.sourceUrl && item?.text)
        .map((item) => ({
          text: item.text,
          sourceUrl: item.sourceUrl,
          sourceTitle: item.sourceTitle,
          provenance: "PROVENANT_D_UNE_SOURCE" as const,
        })),
    });

    setCurrentProject(project);
    setCurrentResearch(research);

    const researchRecord: Research = {
      ...research,
      id: project.id,
      title: project.title,
      description: project.description,
      status: project.status,
      progress: 0,
      createdAt: project.metadata.createdAt ? new Date(project.metadata.createdAt) : new Date(),
      updatedAt: project.metadata.updatedAt ? new Date(project.metadata.updatedAt) : new Date(),
    };

    setResearches((previous) => [researchRecord, ...previous.filter((item) => item.id !== researchRecord.id)]);
    setProjects((previous) => ({ ...previous, [project.id]: project }));

    return researchRecord;
  }

  // Analyse en profondeur — voir le commentaire sur applyProjectUpdate
  // dans le type du contexte. Simple synchronisation d'état, aucune
  // logique d'analyse ici (déjà faite côté serveur).
  function applyProjectUpdate(
    id: string,
    project: ResearchProject
  ) {
    setProjects((previous) => ({ ...previous, [id]: project }));

    if (currentProject?.id === id) {
      setCurrentProject(project);
    }
  }

  // Même patron que updateVariableStatus, appliqué aux orientations
  // théoriques (analyse en profondeur, 10/09/2026).
  function updateTheoreticalOrientationStatus(
    id: string,
    orientationId: string,
    status: ProposalStatus
  ) {

    function applyStatus(orientations: TheoreticalOrientation[] | undefined): TheoreticalOrientation[] | undefined {
      return orientations?.map((o) => (o.id === orientationId ? { ...o, status } : o));
    }

    setProjects(
      (previous) => {
        const existing = previous[id];
        if (!existing) return previous;
        return {
          ...previous,
          [id]: {
            ...existing,
            theoreticalOrientations: applyStatus(existing.theoreticalOrientations),
            updatedAt: new Date(),
          },
        };
      }
    );

    if (currentProject?.id === id) {
      setCurrentProject(
        (project) =>
          project
            ? { ...project, theoreticalOrientations: applyStatus(project.theoreticalOrientations), updatedAt: new Date() }
            : project
      );
    }
  }

  // Applique une transformation au projet ciblé, à la fois dans
  // `projects` et dans `currentProject` s'il s'agit du même —
  // factorise le patron répété par updateTheoreticalOrientationStatus
  // et updateVariableStatus pour les 4 mutateurs manuels ci-dessous.
  function mutateProject(
    id: string,
    apply: (project: ResearchProject) => ResearchProject
  ) {
    setProjects((previous) => {
      const existing = previous[id];
      if (!existing) return previous;
      return { ...previous, [id]: apply(existing) };
    });

    if (currentProject?.id === id) {
      setCurrentProject((project) => (project ? apply(project) : project));
    }
  }

  // La question de recherche est ici écrite directement par
  // l'étudiant (jamais générée ni reformulée par ACADIA à cet
  // endroit) : elle est donc immédiatement "accepted", au sens où
  // c'est déjà l'auteur qui valide son propre texte.
  function setResearchQuestion(id: string, text: string) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return;

    mutateProject(id, (project) => {
      const existing = project.researchQuestions.find((q) => q.type === "main");
      const question: ResearchQuestion = {
        id: existing?.id ?? "question-main",
        text: clean,
        type: "main",
        status: "accepted",
        confidence: "high",
      };
      return {
        ...project,
        researchQuestions: existing
          ? project.researchQuestions.map((q) => (q.id === existing.id ? question : q))
          : [...project.researchQuestions, question],
        updatedAt: new Date(),
      };
    });
  }

  function setGeneralObjective(id: string, text: string) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return;

    mutateProject(id, (project) => {
      const existing = project.objectives.find((o) => o.role === "general");
      const objective: ResearchObjective = {
        id: existing?.id ?? "objective-general",
        text: clean,
        title: clean,
        role: "general",
        type: "general",
        status: "accepted",
        confidence: "high",
      };
      return {
        ...project,
        objectives: existing
          ? project.objectives.map((o) => (o.id === existing.id ? objective : o))
          : [...project.objectives, objective],
        updatedAt: new Date(),
      };
    });
  }

  function addSpecificObjective(id: string, text: string) {
    const clean = text.replace(/\s+/g, " ").trim();
    if (!clean) return;

    mutateProject(id, (project) => {
      const specificCount = project.objectives.filter((o) => o.role === "specific").length;
      const objective: ResearchObjective = {
        id: `objective-specific-manual-${Date.now()}`,
        text: clean,
        title: clean,
        role: "specific",
        type: "specific",
        index: specificCount + 1,
        order: specificCount + 1,
        status: "accepted",
        confidence: "high",
      };
      return {
        ...project,
        objectives: [...project.objectives, objective],
        updatedAt: new Date(),
      };
    });
  }

  function removeObjective(id: string, objectiveId: string) {
    mutateProject(id, (project) => ({
      ...project,
      objectives: project.objectives.filter((o) => o.id !== objectiveId),
      updatedAt: new Date(),
    }));
  }


  // ==========================================================
  // AJOUTER UNE RECHERCHE
  // ==========================================================

  function addResearch(
    research: Research
  ) {

    setResearches(
      (previous) => [
        research,

        ...previous.filter(
          (item) =>
            item.id !== research.id
        ),
      ]
    );
  }


  // ==========================================================
  // MODIFIER UNE RECHERCHE
  // ==========================================================

  function updateResearch(
    research: Research
  ) {

    setResearches(
      (previous) =>
        previous.map(
          (item) =>
            item.id === research.id
              ? research
              : item
        )
    );


    // --------------------------------------------------------
    // Si la recherche modifiée est le projet courant,
    // on ne reconstruit pas artificiellement le ResearchProject.
    // --------------------------------------------------------

    if (
      currentProject?.id === research.id
    ) {

      setCurrentProject(
        (project) => {

          if (!project) {
            return null;
          }

          return {
            ...project,

            title:
              research.title,

            domain:
              research.domain || undefined,

            level:
              research.level || undefined,

            university:
              research.university || undefined,

            location:
              research.location || undefined,

            researchType:
              project.researchType,

            updatedAt:
              new Date(),
          };
        }
      );
    }


    // --------------------------------------------------------
    // Répercuter le même patch sur le projet persisté, quel
    // que soit le projet actif de la session en cours.
    // --------------------------------------------------------

    setProjects(
      (previous) => {

        const existing =
          previous[research.id];

        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [research.id]: {
            ...existing,
            title: research.title,
            domain: research.domain || undefined,
            level: research.level || undefined,
            university: research.university || undefined,
            location: research.location || undefined,
            updatedAt: new Date(),
          },
        };
      }
    );
  }


  // ==========================================================
  // SUPPRIMER UNE RECHERCHE
  // ==========================================================

  function deleteResearch(
    id: string
  ) {

    setResearches(
      (previous) =>
        previous.filter(
          (item) =>
            item.id !== id
        )
    );


    if (
      currentProject?.id === id
    ) {

      setCurrentProject(
        null
      );

      setIntelligence(
        null
      );
    }


    setProjects(
      (previous) => {
        const next = { ...previous };
        delete next[id];
        return next;
      }
    );
  }


  // ==========================================================
  // ARCHIVER UNE RECHERCHE
  // ==========================================================

  function archiveResearch(
    id: string
  ) {

    setResearches(
      (previous) =>
        previous.map(
          (item) =>
            item.id === id
              ? {
                  ...item,

                  status:
                    "archived",

                  updatedAt:
                    new Date(),
                }
              : item
        )
    );


    // --------------------------------------------------------
    // Le ResearchCore reste responsable du projet scientifique.
    // --------------------------------------------------------

    if (
      currentProject?.id === id
    ) {

      setCurrentProject(
        archiveResearchProject(
          currentProject
        )
      );
    }
  }


  // ==========================================================
  // RESTAURER UNE RECHERCHE
  // ==========================================================

  function restoreResearch(
    id: string
  ) {

    const updatedAt =
      new Date();


    setResearches(
      (previous) =>
        previous.map(
          (item) =>
            item.id === id
              ? {
                  ...item,

                  status:
                    "draft",

                  updatedAt,
                }
              : item
        )
    );


    // --------------------------------------------------------
    // Si le projet courant correspond à la recherche restaurée,
    // on passe par le Core pour préserver son contrat.
    // --------------------------------------------------------

    if (
      currentProject?.id === id
    ) {

      setCurrentProject(
        updateResearchProject(
          currentProject,
          {
            status:
              "draft",
          }
        )
      );
    }
  }


  // ==========================================================
  // VALIDER LA MÉTHODOLOGIE (P3)
  //
  // "Valider" signifie "le chercheur accepte cette proposition",
  // pas "ACADIA a raison" — on se contente de faire passer
  // methodology.status à "accepted" (statut déjà prévu par
  // MethodologyStatus), rien d'autre n'est recalculé.
  // ==========================================================

  function validateMethodology(
    id: string
  ) {

    setProjects(
      (previous) => {

        const existing =
          previous[id];

        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [id]: {
            ...existing,
            methodology: {
              ...existing.methodology,
              status: "accepted",
            },
            updatedAt: new Date(),
          },
        };
      }
    );

    if (
      currentProject?.id === id
    ) {

      setCurrentProject(
        (project) =>
          project
            ? {
                ...project,
                methodology: {
                  ...project.methodology,
                  status: "accepted",
                },
                updatedAt: new Date(),
              }
            : project
      );
    }

    trackClientEvent("METHODOLOGY_COMPLETED", { projectId: id });
  }


  // ==========================================================
  // MODIFIER LA MÉTHODOLOGIE (Bloc H, P16)
  //
  // Permet au chercheur de corriger/remplacer un ou plusieurs
  // champs de methodology.* (ex. samplingMethod, sampleSize,
  // researchDesignType, populationSize...) — c'est ainsi qu'on
  // "conteste" une proposition ACADIA : en la remplaçant, jamais
  // par un simple rejet sans alternative. Une modification après
  // acceptation repasse le statut à "draft" (une proposition
  // modifiée redevient une proposition à revalider) ; avant
  // acceptation, le statut reste inchangé.
  // ==========================================================

  function updateMethodologyFields(
    id: string,
    changes: Partial<ResearchMethodology>
  ) {

    setProjects(
      (previous) => {

        const existing =
          previous[id];

        if (!existing) {
          return previous;
        }

        const nextStatus =
          existing.methodology.status === "accepted"
            ? "draft"
            : existing.methodology.status;

        return {
          ...previous,
          [id]: {
            ...existing,
            methodology: {
              ...existing.methodology,
              ...changes,
              status: nextStatus,
            },
            updatedAt: new Date(),
          },
        };
      }
    );

    if (
      currentProject?.id === id
    ) {

      setCurrentProject(
        (project) =>
          project
            ? {
                ...project,
                methodology: {
                  ...project.methodology,
                  ...changes,
                  status:
                    project.methodology.status === "accepted"
                      ? "draft"
                      : project.methodology.status,
                },
                updatedAt: new Date(),
              }
            : project
      );
    }

    trackClientEvent("METHODOLOGY_EDITED", { projectId: id });
  }


  // ==========================================================
  // HYPOTHÈSES SECONDAIRES (P13.2)
  //
  // addHypothesis ajoute une hypothèse déjà entièrement formée
  // (jamais générée ici — voir HypothesisProposalEngine, purement
  // déterministe, dérivée des dimensions déjà opérationnalisées).
  // updateHypothesisStatus permet d'accepter/rejeter une hypothèse
  // proposée, même mécanisme que le reste de l'application
  // (statuts déjà définis par ResearchTypes.ts).
  // ==========================================================

  function addHypothesis(
    id: string,
    hypothesis: ResearchHypothesis
  ) {

    setProjects(
      (previous) => {

        const existing = previous[id];

        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [id]: {
            ...existing,
            hypotheses: [...existing.hypotheses, hypothesis],
            updatedAt: new Date(),
          },
        };
      }
    );

    if (currentProject?.id === id) {
      setCurrentProject(
        (project) =>
          project
            ? { ...project, hypotheses: [...project.hypotheses, hypothesis], updatedAt: new Date() }
            : project
      );
    }
  }

  function updateHypothesisStatus(
    id: string,
    hypothesisId: string,
    status: ProposalStatus
  ) {

    function applyStatus(hypotheses: ResearchHypothesis[]): ResearchHypothesis[] {
      return hypotheses.map((h) => (h.id === hypothesisId ? { ...h, status } : h));
    }

    setProjects(
      (previous) => {

        const existing = previous[id];

        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [id]: {
            ...existing,
            hypotheses: applyStatus(existing.hypotheses),
            updatedAt: new Date(),
          },
        };
      }
    );

    if (currentProject?.id === id) {
      setCurrentProject(
        (project) =>
          project
            ? { ...project, hypotheses: applyStatus(project.hypotheses), updatedAt: new Date() }
            : project
      );
    }
  }

  // P15 — permet au chercheur de modifier librement le texte d'une
  // hypothèse (proposée par ACADIA ou la sienne) sans devoir la
  // rejeter puis en ajouter une nouvelle.
  function updateHypothesisStatement(
    id: string,
    hypothesisId: string,
    statement: string
  ) {

    function applyStatement(hypotheses: ResearchHypothesis[]): ResearchHypothesis[] {
      return hypotheses.map((h) => (h.id === hypothesisId ? { ...h, statement } : h));
    }

    setProjects(
      (previous) => {

        const existing = previous[id];

        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [id]: {
            ...existing,
            hypotheses: applyStatement(existing.hypotheses),
            updatedAt: new Date(),
          },
        };
      }
    );

    if (currentProject?.id === id) {
      setCurrentProject(
        (project) =>
          project
            ? { ...project, hypotheses: applyStatement(project.hypotheses), updatedAt: new Date() }
            : project
      );
    }
  }

  // Validation humaine des variables A2 (accepter/rejeter) — même
  // patron que updateHypothesisStatus : une variable rejetée par le
  // chercheur reste en base (traçabilité) mais n'est plus affichée
  // ni utilisée en aval (méthodologie, hypothèses, questionnaire).
  function updateVariableStatus(
    id: string,
    variableId: string,
    status: ProposalStatus
  ) {

    function applyStatus(variables: ResearchVariable[]): ResearchVariable[] {
      return variables.map((v) => (v.id === variableId ? { ...v, status } : v));
    }

    setProjects(
      (previous) => {

        const existing = previous[id];

        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [id]: {
            ...existing,
            variables: applyStatus(existing.variables),
            updatedAt: new Date(),
          },
        };
      }
    );

    if (currentProject?.id === id) {
      setCurrentProject(
        (project) =>
          project
            ? { ...project, variables: applyStatus(project.variables), updatedAt: new Date() }
            : project
      );
    }
  }

  // Permet au chercheur de corriger le nom d'une variable proposée
  // par ACADIA sans devoir la rejeter puis en ajouter une nouvelle —
  // même patron que updateHypothesisStatement.
  function updateVariableName(
    id: string,
    variableId: string,
    name: string
  ) {

    function applyName(variables: ResearchVariable[]): ResearchVariable[] {
      return variables.map((v) => (v.id === variableId ? { ...v, name } : v));
    }

    setProjects(
      (previous) => {

        const existing = previous[id];

        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [id]: {
            ...existing,
            variables: applyName(existing.variables),
            updatedAt: new Date(),
          },
        };
      }
    );

    if (currentProject?.id === id) {
      setCurrentProject(
        (project) =>
          project
            ? { ...project, variables: applyName(project.variables), updatedAt: new Date() }
            : project
      );
    }
  }


  // ==========================================================
  // INSTRUMENT DE COLLECTE (P4)
  //
  // generateInstrument() ne régénère JAMAIS un instrument déjà
  // présent — une régénération effacerait silencieusement les
  // modifications humaines déjà acceptées, ce que P4 interdit
  // explicitement. Le moteur structurel (déterministe, aucun appel
  // OpenAI, voir QuestionnaireGenerationEngine.ts) est appelé une
  // seule fois par projet, côté serveur (Bloc A, 11/09/2026) via
  // POST /api/research/[id]/questionnaire/generate, qui l'enrichit
  // ensuite d'une formulation IA — la clé OpenAI ne peut pas être
  // exposée côté client, d'où cet appel réseau.
  // ==========================================================

  async function generateInstrument(
    id: string
  ) {

    if (instruments[id]) {
      return;
    }

    if (!projects[id]) {
      return;
    }

    const res = await fetch(`/api/research/${id}/questionnaire/generate`, {
      method: "POST",
    });

    const result = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(result.error ?? "ACADIA n'a pas pu générer le questionnaire pour le moment.");
    }

    setInstruments(
      (previous) => ({
        ...previous,
        [id]: {
          questionnaire: result.questionnaire,
          interviewGuide: result.interviewGuide,
          status: "draft",
        },
      })
    );
  }

  function setImportedInstrument(
    id: string,
    questionnaire: GeneratedQuestionnaire
  ) {

    if (instruments[id]) {
      return;
    }

    setInstruments(
      (previous) => ({
        ...previous,
        [id]: {
          questionnaire,
          status: "draft",
        },
      })
    );
  }


  // ==========================================================
  // MODIFIER LE TEXTE D'UNE QUESTION (P4, Étape 17)
  //
  // Une modification manuelle conserve le lien scientifique
  // existant (variableId/dimensionId/indicatorId) tel quel —
  // aucune invention, aucune rupture silencieuse.
  // ==========================================================

  function updateInstrumentQuestionText(
    id: string,
    questionId: string,
    text: string
  ) {

    setInstruments(
      (previous) => {

        const existing =
          previous[id];

        if (
          !existing?.questionnaire
        ) {
          return previous;
        }

        const updatedSections =
          existing.questionnaire.sections.map(
            (section) => ({
              ...section,
              questions: section.questions.map(
                (question) =>
                  question.id === questionId
                    ? { ...question, text }
                    : question
              ),
            })
          );

        return {
          ...previous,
          [id]: {
            ...existing,
            questionnaire: {
              ...existing.questionnaire,
              sections: updatedSections,
            },
          },
        };
      }
    );
  }


  // ==========================================================
  // ACCEPTER L'INSTRUMENT (P4, Étape 18)
  //
  // Signifie « le chercheur accepte cet instrument » —
  // jamais « ACADIA garantit la validité scientifique ».
  // ==========================================================

  function acceptInstrument(
    id: string
  ) {

    setInstruments(
      (previous) => {

        const existing =
          previous[id];

        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [id]: {
            ...existing,
            status: "accepted",
          },
        };
      }
    );
  }


  // ==========================================================
  // MODIFIER UNE QUESTION (P4-FINAL, A2/A6/A7)
  //
  // Patch générique (type, options, scale, required...). Une
  // modification du texte seul ne touche jamais variableId/
  // dimensionId/indicatorId (A8) : ce patch ne les inclut
  // jamais lui-même. Seul un changement de TYPE est vérifié
  // pour cohérence avec l'indicateur mesuré (A6) — le système
  // avertit (needs_review) sans jamais bloquer la modification
  // humaine.
  // ==========================================================

  function updateInstrumentQuestion(
    id: string,
    questionId: string,
    patch: Partial<QuestionnaireQuestion>
  ) {

    setInstruments((previous) => {

      const existing = previous[id];

      if (!existing?.questionnaire) {
        return previous;
      }

      const project = projects[id];

      const updatedSections = existing.questionnaire.sections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => {

          if (question.id !== questionId) {
            return question;
          }

          const merged: QuestionnaireQuestion = { ...question, ...patch };

          if (patch.type && merged.indicatorId && project) {

            const indicator = project.variables
              .flatMap((v) => v.dimensions ?? [])
              .flatMap((d) => d.indicators ?? [])
              .find((i) => i.id === merged.indicatorId);

            if (indicator) {
              const expectedType = inferQuestionType(indicator);

              merged.status =
                expectedType === merged.type ? "proposed" : "needs_review";
            }
          }

          return merged;
        }),
      }));

      return {
        ...previous,
        [id]: {
          ...existing,
          questionnaire: {
            ...existing.questionnaire,
            sections: updatedSections,
          },
        },
      };
    });
  }


  // ==========================================================
  // AJOUTER UNE QUESTION (P4-FINAL, A3)
  //
  // Le chercheur associe explicitement la question à une
  // variable/dimension/indicateur réels (ids issus du
  // ResearchProject) — ou choisit de créer une question
  // générale/descriptive. Sans lien, status = needs_review :
  // jamais un lien inventé.
  // ==========================================================

  function addInstrumentQuestion(
    id: string,
    sectionId: string,
    payload: {
      text: string;
      type: QuestionType;
      variableId?: string;
      dimensionId?: string;
      indicatorId?: string;
      variable?: string;
      dimension?: string;
      indicator?: string;
    }
  ) {

    setInstruments((previous) => {

      const existing = previous[id];

      if (!existing?.questionnaire) {
        return previous;
      }

      const hasLink = Boolean(
        payload.variableId && payload.dimensionId && payload.indicatorId
      );

      const nextNumber = existing.questionnaire.totalQuestions + 1;

      const newQuestion: QuestionnaireQuestion = {
        id: `custom-${Date.now()}`,
        number: nextNumber,
        order: nextNumber,
        sectionId,
        type: payload.type,
        text: payload.text,
        required: false,
        variable: payload.variable,
        dimension: payload.dimension,
        indicator: payload.indicator,
        variableId: payload.variableId,
        dimensionId: payload.dimensionId,
        indicatorId: payload.indicatorId,
        status: hasLink ? "proposed" : "needs_review",
      };

      const updatedSections = existing.questionnaire.sections.map((section) =>
        section.id === sectionId
          ? { ...section, questions: [...section.questions, newQuestion] }
          : section
      );

      return {
        ...previous,
        [id]: {
          ...existing,
          questionnaire: {
            ...existing.questionnaire,
            sections: updatedSections,
            totalQuestions: nextNumber,
          },
        },
      };
    });
  }


  // ==========================================================
  // SUPPRIMER UNE QUESTION (P4-FINAL, A4)
  //
  // La confirmation est portée par l'UI (jamais silencieuse).
  // La couverture/validation/nombre de questions sont toujours
  // recalculées à la volée par analyzeInstrument() — aucun état
  // dérivé n'est stocké ici, donc rien à recalculer manuellement.
  // ==========================================================

  function deleteInstrumentQuestion(
    id: string,
    questionId: string
  ) {

    setInstruments((previous) => {

      const existing = previous[id];

      if (!existing?.questionnaire) {
        return previous;
      }

      let n = 1;

      const updatedSections = existing.questionnaire.sections.map((section) => ({
        ...section,
        questions: section.questions
          .filter((question) => question.id !== questionId)
          .map((question) => {
            const num = n++;
            return { ...question, number: num, order: num };
          }),
      }));

      return {
        ...previous,
        [id]: {
          ...existing,
          questionnaire: {
            ...existing.questionnaire,
            sections: updatedSections,
            totalQuestions: n - 1,
          },
        },
      };
    });
  }


  // ==========================================================
  // RÉORDONNER UNE QUESTION (P4-FINAL, A5)
  //
  // Échange avec le voisin immédiat dans la même section, puis
  // renumérote l'ensemble de l'instrument de façon séquentielle
  // (number ET order restent synchronisés — le Validator détecte
  // déjà les doublons de numéro).
  // ==========================================================

  function reorderInstrumentQuestion(
    id: string,
    questionId: string,
    direction: "up" | "down"
  ) {

    setInstruments((previous) => {

      const existing = previous[id];

      if (!existing?.questionnaire) {
        return previous;
      }

      const swappedSections = existing.questionnaire.sections.map((section) => {

        const index = section.questions.findIndex((q) => q.id === questionId);

        if (index === -1) {
          return section;
        }

        const targetIndex = direction === "up" ? index - 1 : index + 1;

        if (targetIndex < 0 || targetIndex >= section.questions.length) {
          return section;
        }

        const questions = [...section.questions];
        [questions[index], questions[targetIndex]] = [questions[targetIndex], questions[index]];

        return { ...section, questions };
      });

      let n = 1;

      const renumbered = swappedSections.map((section) => ({
        ...section,
        questions: section.questions.map((question) => {
          const num = n++;
          return { ...question, number: num, order: num };
        }),
      }));

      return {
        ...previous,
        [id]: {
          ...existing,
          questionnaire: {
            ...existing.questionnaire,
            sections: renumbered,
          },
        },
      };
    });
  }


  // ==========================================================
  // DATASET (P5)
  //
  // generateDataset() ne régénère jamais un dataset déjà présent
  // — même logique que generateInstrument() : ne jamais effacer
  // silencieusement des observations déjà saisies.
  // ==========================================================

  function generateDataset(
    id: string
  ) {

    if (datasets[id]) {
      return;
    }

    const project = projects[id];
    const instrument = instruments[id];

    if (!project) {
      return;
    }

    let dataset: Dataset | undefined;

    if (instrument?.questionnaire) {
      dataset = buildDatasetFromInstrument(project, instrument.questionnaire);
    } else if (instrument?.interviewGuide) {
      dataset = buildDatasetFromInterviewGuide(project, instrument.interviewGuide);
    }

    if (!dataset) {
      return;
    }

    const built = dataset;

    setDatasets(
      (previous) => ({
        ...previous,
        [id]: built,
      })
    );
  }

  // Voir le commentaire sur setImportedDataset dans le type du
  // contexte : synchronise l'état local avec un dataset déjà
  // persisté côté serveur (POST .../dataset/import ou PATCH
  // .../dataset/mapping) pour que la sync globale débouncée ne
  // l'efface pas silencieusement au prochain enregistrement.
  function setImportedDataset(
    id: string,
    dataset: Dataset
  ) {
    setDatasets(
      (previous) => ({
        ...previous,
        [id]: dataset,
      })
    );
  }


  // ==========================================================
  // AJOUTER UNE OBSERVATION (P5, B12)
  // ==========================================================

  function addObservation(
    id: string,
    values: Dataset["rows"][number]["values"],
    respondentId?: string
  ) {

    setDatasets((previous) => {

      const existing = previous[id];

      if (!existing) {
        return previous;
      }

      const row: Dataset["rows"][number] = {
        id: `obs-${Date.now()}`,
        respondentId,
        submittedAt: new Date().toISOString(),
        values,
      };

      return {
        ...previous,
        [id]: {
          ...existing,
          rows: [...existing.rows, row],
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }


  // ==========================================================
  // MODIFIER UNE VALEUR D'OBSERVATION
  // ==========================================================

  function updateObservationValue(
    id: string,
    rowId: string,
    columnId: string,
    value: Dataset["rows"][number]["values"][string]
  ) {

    setDatasets((previous) => {

      const existing = previous[id];

      if (!existing) {
        return previous;
      }

      return {
        ...previous,
        [id]: {
          ...existing,
          rows: existing.rows.map((row) =>
            row.id === rowId
              ? { ...row, values: { ...row.values, [columnId]: value } }
              : row
          ),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }


  // ==========================================================
  // SUPPRIMER UNE OBSERVATION
  // ==========================================================

  function deleteObservation(
    id: string,
    rowId: string
  ) {

    setDatasets((previous) => {

      const existing = previous[id];

      if (!existing) {
        return previous;
      }

      return {
        ...previous,
        [id]: {
          ...existing,
          rows: existing.rows.filter((row) => row.id !== rowId),
          updatedAt: new Date().toISOString(),
        },
      };
    });
  }


  // ==========================================================
  // ANNOTATION — VALIDATION / ÉDITION HUMAINE (P9/P10)
  //
  // Un `blockId` identifie un bloc d'interprétation/discussion
  // précis (ex. "interp:econ:model-x:coef:EVAL_2" ou
  // "discussion:proj-x:limits"). Le contenu GÉNÉRÉ n'est jamais
  // stocké ici — seul le statut de validation et, le cas échéant,
  // le texte édité par le chercheur le sont. `patch` fusionne sur
  // l'enregistrement existant : accepter puis éditer conserve la
  // date de première acceptation à moins d'être explicitement
  // remplacée par l'appelant.
  // ==========================================================

  function setAnnotation(
    researchId: string,
    blockId: string,
    patch: Partial<AnnotationRecord>
  ) {

    setAnnotations(
      (previous) => {

        const existingForResearch =
          previous[researchId] ?? {};

        const existingRecord =
          existingForResearch[blockId];

        const nextRecord: AnnotationRecord = {
          ...existingRecord,
          ...patch,
          status: patch.status ?? existingRecord?.status ?? "generated",
          updatedAt: new Date().toISOString(),
        };

        return {
          ...previous,
          [researchId]: {
            ...existingForResearch,
            [blockId]: nextRecord,
          },
        };
      }
    );
  }


  // ==========================================================
  // BIBLIOGRAPHIE (P11) — ajout/suppression explicites uniquement,
  // jamais une référence générée automatiquement.
  // ==========================================================

  function addBibliographyReference(
    researchId: string,
    reference: BibliographyReference
  ) {

    setBibliography(
      (previous) => ({
        ...previous,
        [researchId]: [
          ...(previous[researchId] ?? []),
          reference,
        ],
      })
    );
  }

  function removeBibliographyReference(
    researchId: string,
    referenceId: string
  ) {

    setBibliography(
      (previous) => {

        const existing = previous[researchId];

        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [researchId]: existing.filter((r) => r.id !== referenceId),
        };
      }
    );
  }


  // ==========================================================
  // HISTORIQUE D'EXPORT (P12) — un enregistrement ajouté uniquement
  // après un export DOCX/PDF réellement produit.
  // ==========================================================

  function addExportHistoryEntry(
    researchId: string,
    entry: ExportHistoryEntry
  ) {

    setExportHistory(
      (previous) => ({
        ...previous,
        [researchId]: [
          ...(previous[researchId] ?? []),
          entry,
        ],
      })
    );
  }


  // ==========================================================
  // CADRE THÉORIQUE (P13.2) — ajout/suppression explicites
  // uniquement, jamais une entrée générée automatiquement.
  // ==========================================================

  function addTheoreticalFrameworkEntry(
    researchId: string,
    entry: TheoreticalFrameworkEntry
  ) {

    setTheoreticalFramework(
      (previous) => ({
        ...previous,
        [researchId]: [
          ...(previous[researchId] ?? []),
          entry,
        ],
      })
    );
  }

  function removeTheoreticalFrameworkEntry(
    researchId: string,
    entryId: string
  ) {

    setTheoreticalFramework(
      (previous) => {

        const existing = previous[researchId];

        if (!existing) {
          return previous;
        }

        return {
          ...previous,
          [researchId]: existing.filter((e) => e.id !== entryId),
        };
      }
    );
  }


  // ==========================================================
  // CONTEXT VALUE
  // ==========================================================

  return (
    <ResearchContext.Provider
      value={{

        saveStatus,
        isHydrated,

        // ----------------------------------------------------
        // Projets
        // ----------------------------------------------------

        researches,

        projects,


        // ----------------------------------------------------
        // Wizard
        // ----------------------------------------------------

        currentResearch,


        // ----------------------------------------------------
        // Projet scientifique
        // ----------------------------------------------------

        currentProject,


        // ----------------------------------------------------
        // Intelligence
        // ----------------------------------------------------

        intelligence,


        // ----------------------------------------------------
        // Méthodologie
        // ----------------------------------------------------

        methodology,


        // ----------------------------------------------------
        // Échantillon
        // ----------------------------------------------------

        sample,


        // ----------------------------------------------------
        // Wizard
        // ----------------------------------------------------

        updateCurrentResearch,

        resetCurrentResearch,


        // ----------------------------------------------------
        // Création
        // ----------------------------------------------------

        createCurrentResearch,
        createResearchFromPreview,
        applyProjectUpdate,
        updateTheoreticalOrientationStatus,
        setResearchQuestion,
        setGeneralObjective,
        addSpecificObjective,
        removeObjective,

        buildCurrentProject,


        // ----------------------------------------------------
        // Intelligence
        // ----------------------------------------------------

        analyzeCurrentResearch,


        // ----------------------------------------------------
        // Gestion
        // ----------------------------------------------------

        addResearch,

        updateResearch,

        deleteResearch,

        archiveResearch,

        restoreResearch,

        validateMethodology,
        updateMethodologyFields,

        addHypothesis,

        updateHypothesisStatus,
        updateHypothesisStatement,
        updateVariableStatus,
        updateVariableName,

        instruments,

        generateInstrument,
        setImportedInstrument,

        updateInstrumentQuestionText,

        updateInstrumentQuestion,

        addInstrumentQuestion,

        deleteInstrumentQuestion,

        reorderInstrumentQuestion,

        acceptInstrument,


        // ----------------------------------------------------
        // Dataset (P5)
        // ----------------------------------------------------

        datasets,

        generateDataset,
        setImportedDataset,

        addObservation,

        updateObservationValue,

        deleteObservation,


        // ----------------------------------------------------
        // Annotations — validation / édition humaine (P9/P10)
        // ----------------------------------------------------

        annotations,

        setAnnotation,


        // ----------------------------------------------------
        // Bibliographie (P11)
        // ----------------------------------------------------

        bibliography,

        addBibliographyReference,

        removeBibliographyReference,

        exportHistory,

        addExportHistoryEntry,

        theoreticalFramework,

        addTheoreticalFrameworkEntry,

        removeTheoreticalFrameworkEntry,
      }}
    >
      {children}
    </ResearchContext.Provider>
  );
}


// ============================================================
// HOOK
// ============================================================

export function useResearch() {

  const context =
    useContext(
      ResearchContext
    );


  if (!context) {

    throw new Error(
      "useResearch must be used inside ResearchProvider"
    );
  }


  return context;
}