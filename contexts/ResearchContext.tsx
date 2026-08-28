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
  ProposalStatus,
} from "@/lib/core/research/ResearchTypes";

import type {
  GeneratedQuestionnaire,
  InterviewGuide,
  QuestionnaireQuestion,
  QuestionType,
} from "@/lib/core/questionnaire/QuestionnaireTypes";

import {
  generateInstrumentFromProject,
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
  // INSTRUMENT DE COLLECTE (P4)
  // ----------------------------------------------------------

  instruments:
    Record<string, InstrumentRecord>;

  generateInstrument:
    (id: string) => void;

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


  // ==========================================================
  // INSTRUMENT DE COLLECTE (P4)
  //
  // generateInstrument() ne régénère JAMAIS un instrument déjà
  // présent — une régénération effacerait silencieusement les
  // modifications humaines déjà acceptées, ce que P4 interdit
  // explicitement. Le moteur (déterministe, aucun appel OpenAI)
  // est appelé une seule fois par projet.
  // ==========================================================

  function generateInstrument(
    id: string
  ) {

    if (instruments[id]) {
      return;
    }

    const project = projects[id];

    if (!project) {
      return;
    }

    const result =
      generateInstrumentFromProject(
        project
      );

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

        addHypothesis,

        updateHypothesisStatus,
        updateHypothesisStatement,

        instruments,

        generateInstrument,

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