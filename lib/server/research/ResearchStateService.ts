// ============================================================
// ACADIA — SERVICE D'ÉTAT DE RECHERCHE (P17)
//
// Remplace localStorage comme source de vérité pour un utilisateur
// authentifié (voir ACADIA_P17_PRODUCTION_ARCHITECTURE.md §4). Une
// ligne ResearchProject par recherche, ownerId toujours dérivé de
// la session — jamais du client (Partie 19 du sprint P16, conservée
// ici). Ne supprime jamais une ligne (limite assumée documentée
// dans ACADIA_P17_TEST_REPORT.md) : seules les créations/mises à
// jour sont synchronisées automatiquement.
// ============================================================

import { prisma } from "@/lib/server/db/prisma";
import { logAudit } from "@/lib/server/audit/AuditLog";
import type { Research } from "@/types/Research";
import type { ResearchProject as ScientificProject } from "@/lib/core/research/ResearchTypes";
import type { Dataset as ScientificDataset } from "@/lib/core/dataset/DatasetTypes";
import type { InstrumentRecord } from "@/contexts/ResearchContext";
import type { TheoreticalFrameworkEntry } from "@/lib/core/research/TheoreticalFrameworkTypes";

export interface ResearchStateBundle {
  researches: Research[];
  projects: Record<string, ScientificProject>;
  instruments: Record<string, InstrumentRecord>;
  datasets: Record<string, unknown>;
  annotations: Record<string, Record<string, unknown>>;
  bibliography: Record<string, unknown[]>;
  exportHistory: Record<string, unknown[]>;
  theoreticalFramework: Record<string, TheoreticalFrameworkEntry[]>;
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export async function getResearchState(ownerId: string): Promise<ResearchStateBundle> {
  const rows = await prisma.researchProject.findMany({ where: { ownerId } });

  const bundle: ResearchStateBundle = {
    researches: [],
    projects: {},
    instruments: {},
    datasets: {},
    annotations: {},
    bibliography: {},
    exportHistory: {},
    theoreticalFramework: {},
  };

  for (const row of rows) {
    const research = safeParse<Research | null>(row.researchData, null);
    if (research) {
      bundle.researches.push({ ...research, createdAt: new Date(research.createdAt), updatedAt: new Date(research.updatedAt) });
    }
    bundle.projects[row.id] = safeParse(row.payload, {} as ScientificProject);
    if (row.instrument) bundle.instruments[row.id] = safeParse(row.instrument, {} as InstrumentRecord);
    if (row.dataset) bundle.datasets[row.id] = safeParse(row.dataset, {});
    if (row.annotations) bundle.annotations[row.id] = safeParse(row.annotations, {});
    if (row.bibliography) bundle.bibliography[row.id] = safeParse(row.bibliography, []);
    if (row.exportHistory) bundle.exportHistory[row.id] = safeParse(row.exportHistory, []);
    if (row.theoreticalFramework) bundle.theoreticalFramework[row.id] = safeParse(row.theoreticalFramework, []);
  }

  return bundle;
}

export async function hasAnyResearchState(ownerId: string): Promise<boolean> {
  const count = await prisma.researchProject.count({ where: { ownerId } });
  return count > 0;
}

// ------------------------------------------------------------
// ACCÈS PAR PROJET UNIQUE (additif — ne remplace pas
// getResearchState/syncResearchState, utilisé par les nouvelles
// routes /api/research/:id pour éviter de resynchroniser
// l'intégralité de l'état d'un utilisateur quand un seul projet
// est concerné).
// ------------------------------------------------------------

export interface SingleResearchProjectRecord {
  ownerId: string;
  research: Research | null;
  project: ScientificProject;
  instrument: InstrumentRecord | null;
  dataset: unknown;
  annotations: Record<string, unknown> | null;
  bibliography: unknown[];
  exportHistory: unknown[];
  theoreticalFramework: TheoreticalFrameworkEntry[];
}

export async function getResearchProjectRecord(id: string): Promise<SingleResearchProjectRecord | null> {
  const row = await prisma.researchProject.findUnique({ where: { id } });
  if (!row) return null;

  const research = safeParse<Research | null>(row.researchData, null);

  return {
    ownerId: row.ownerId,
    research: research ? { ...research, createdAt: new Date(research.createdAt), updatedAt: new Date(research.updatedAt) } : null,
    project: safeParse(row.payload, {} as ScientificProject),
    instrument: row.instrument ? safeParse(row.instrument, null) : null,
    dataset: row.dataset ? safeParse(row.dataset, null) : null,
    annotations: row.annotations ? safeParse(row.annotations, null) : null,
    bibliography: row.bibliography ? safeParse(row.bibliography, []) : [],
    exportHistory: row.exportHistory ? safeParse(row.exportHistory, []) : [],
    theoreticalFramework: row.theoreticalFramework ? safeParse(row.theoreticalFramework, []) : [],
  };
}

/**
 * Met à jour UN projet déjà existant. Ne crée jamais de nouvelle
 * ligne (la création reste la responsabilité de syncResearchState,
 * déjà utilisée par le Research Wizard — on évite un second chemin
 * de création qui pourrait diverger). Retourne null si le projet
 * n'existe pas ou n'appartient pas à ownerId.
 */
export async function updateResearchProjectRecord(
  ownerId: string,
  id: string,
  patch: Partial<{ research: Research; project: ScientificProject }>
): Promise<SingleResearchProjectRecord | null> {
  const existing = await prisma.researchProject.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId) return null;

  const currentResearch = safeParse<Research | null>(existing.researchData, null);
  const mergedResearch: Research | null = patch.research ? { ...currentResearch, ...patch.research } : currentResearch;
  const mergedProject: ScientificProject | undefined = patch.project
    ? { ...safeParse<ScientificProject>(existing.payload, {} as ScientificProject), ...patch.project }
    : undefined;

  await prisma.researchProject.update({
    where: { id },
    data: {
      ...(mergedResearch
        ? {
            title: mergedResearch.title || "Recherche sans titre",
            researchType: mergedResearch.researchType,
            level: mergedResearch.level,
            status: mergedResearch.status ?? "draft",
            domain: mergedResearch.domain,
            university: mergedResearch.university,
            description: mergedResearch.description,
            researchData: JSON.stringify(mergedResearch),
          }
        : {}),
      ...(mergedProject ? { payload: JSON.stringify(mergedProject) } : {}),
    },
  });

  return getResearchProjectRecord(id);
}

/**
 * Applique une correction de mapping (Module 3) sur UNE colonne
 * d'un dataset déjà importé. Ne touche à aucune autre colonne, ni
 * aux lignes. Retourne null si le projet n'existe pas, n'appartient
 * pas à ownerId, n'a pas de dataset, ou si la colonne est introuvable.
 */
export async function updateDatasetColumnMapping(
  ownerId: string,
  id: string,
  columnId: string,
  patch: Partial<Pick<ScientificDataset["columns"][number], "variableId" | "dimensionId" | "indicatorId" | "sourceQuestionId" | "mappingStatus" | "mappingSource" | "mappingConfidence">>
): Promise<ScientificDataset | null> {
  const existing = await prisma.researchProject.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId || !existing.dataset) return null;

  const dataset = safeParse<ScientificDataset | null>(existing.dataset, null);
  if (!dataset) return null;

  const columnIndex = dataset.columns.findIndex((c) => c.id === columnId);
  if (columnIndex === -1) return null;

  dataset.columns[columnIndex] = { ...dataset.columns[columnIndex], ...patch };
  dataset.updatedAt = new Date().toISOString();

  await prisma.researchProject.update({ where: { id }, data: { dataset: JSON.stringify(dataset) } });
  return dataset;
}

/**
 * Enregistre un plan d'analyse (Module 4) généré pour ce projet —
 * remplace l'éventuel plan précédent (une seule version active à
 * la fois dans cet incrément ; le versioning complet est hors
 * scope). Ne touche à aucun autre champ de payload.
 */
export async function setAnalysisPlanRecord(ownerId: string, id: string, analysisPlan: NonNullable<ScientificProject["analysisPlan"]>): Promise<boolean> {
  const existing = await prisma.researchProject.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId) return false;

  const project = safeParse<ScientificProject>(existing.payload, {} as ScientificProject);
  project.analysisPlan = analysisPlan;

  await prisma.researchProject.update({ where: { id }, data: { payload: JSON.stringify(project) } });
  return true;
}

/**
 * Applique une décision du chercheur (accepter/modifier/refuser)
 * sur UN item du plan d'analyse. Ne touche à aucun autre item.
 * Retourne null si le projet/plan/item n'existe pas ou n'appartient
 * pas à ownerId.
 */
export async function updateAnalysisPlanItemRecord(
  ownerId: string,
  id: string,
  itemId: string,
  patch: Partial<Pick<NonNullable<ScientificProject["analysisPlan"]>["items"][number], "status" | "priority" | "userNote">>
): Promise<NonNullable<ScientificProject["analysisPlan"]> | null> {
  const existing = await prisma.researchProject.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId) return null;

  const project = safeParse<ScientificProject>(existing.payload, {} as ScientificProject);
  const plan = project.analysisPlan;
  if (!plan) return null;

  const itemIndex = plan.items.findIndex((i) => i.id === itemId);
  if (itemIndex === -1) return null;

  plan.items[itemIndex] = { ...plan.items[itemIndex], ...patch };
  plan.updatedAt = new Date().toISOString();
  project.analysisPlan = plan;

  await prisma.researchProject.update({ where: { id }, data: { payload: JSON.stringify(project) } });
  return plan;
}

/**
 * Ajoute un run d'exécution statistique (Mission 5) à l'historique
 * du projet — n'écrase jamais un run précédent (mission §21/§30 :
 * chaque exécution doit rester consultable, y compris pour comparer
 * une reproduction ultérieure au run d'origine).
 */
export async function appendStatisticalRunRecord(
  ownerId: string,
  id: string,
  run: NonNullable<ScientificProject["statisticalRuns"]>[number]
): Promise<boolean> {
  const existing = await prisma.researchProject.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId) return false;

  const project = safeParse<ScientificProject>(existing.payload, {} as ScientificProject);
  project.statisticalRuns = [...(project.statisticalRuns ?? []), run];

  await prisma.researchProject.update({ where: { id }, data: { payload: JSON.stringify(project) } });
  return true;
}

/**
 * Ajoute une interprétation scientifique (Mission 6) à l'historique
 * du projet — n'écrase jamais une interprétation précédente (même
 * discipline que appendStatisticalRunRecord : chaque génération
 * reste consultable et comparable à une régénération ultérieure).
 */
export async function appendScientificInterpretationRecord(
  ownerId: string,
  id: string,
  interpretation: NonNullable<ScientificProject["scientificInterpretations"]>[number]
): Promise<boolean> {
  const existing = await prisma.researchProject.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId) return false;

  const project = safeParse<ScientificProject>(existing.payload, {} as ScientificProject);
  project.scientificInterpretations = [...(project.scientificInterpretations ?? []), interpretation];

  await prisma.researchProject.update({ where: { id }, data: { payload: JSON.stringify(project) } });
  return true;
}

/**
 * Archive un projet (status="archived") plutôt qu'une suppression
 * réelle — cohérent avec la limite déjà assumée par ce service
 * ("ne supprime jamais une ligne", voir en-tête du fichier) et avec
 * l'alternative explicitement prévue par ResearchStatus.
 */
export async function archiveResearchProjectRecord(ownerId: string, id: string): Promise<boolean> {
  const existing = await prisma.researchProject.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== ownerId) return false;

  const currentResearch = safeParse<Research | null>(existing.researchData, null);
  await prisma.researchProject.update({
    where: { id },
    data: {
      status: "archived",
      researchData: currentResearch ? JSON.stringify({ ...currentResearch, status: "archived" }) : existing.researchData,
    },
  });
  return true;
}

/**
 * Remplace le Dataset (JSON) d'UN projet — utilisé par le Data
 * Import Engine (Module 2). N'écrase aucune autre colonne de la
 * ligne (research/payload/instrument/... inchangés). Retourne
 * false si le projet n'existe pas ou n'appartient pas à ownerId.
 */
export async function setResearchProjectDataset(ownerId: string, id: string, dataset: ScientificDataset): Promise<boolean> {
  const existing = await prisma.researchProject.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== ownerId) return false;

  await prisma.researchProject.update({
    where: { id },
    data: { dataset: JSON.stringify(dataset) },
  });
  return true;
}

/**
 * Synchronise (upsert uniquement, jamais de suppression — voir
 * en-tête) l'état complet reçu du client vers la base, pour CET
 * utilisateur authentifié uniquement.
 */
export async function syncResearchState(ownerId: string, bundle: ResearchStateBundle): Promise<{ synced: number }> {
  let synced = 0;

  for (const research of bundle.researches) {
    const id = research.id;
    if (!id) continue;

    // Sécurité : un id de recherche est généré côté client (non
    // garanti globalement unique) — si une ligne existe déjà sous
    // CET id mais appartient à un AUTRE utilisateur, on ne l'écrase
    // jamais (Partie 15/19 : jamais de confiance aveugle en un id
    // client). On l'ignore silencieusement plutôt que de planter
    // toute la synchronisation pour les autres recherches.
    const existing = await prisma.researchProject.findUnique({ where: { id }, select: { ownerId: true } });
    if (existing && existing.ownerId !== ownerId) continue;

    await prisma.researchProject.upsert({
      where: { id },
      create: {
        id,
        ownerId,
        title: research.title || "Recherche sans titre",
        researchType: research.researchType,
        level: research.level,
        status: research.status ?? "draft",
        domain: research.domain,
        university: research.university,
        description: research.description,
        researchData: JSON.stringify(research),
        payload: JSON.stringify(bundle.projects[id] ?? {}),
        instrument: bundle.instruments[id] ? JSON.stringify(bundle.instruments[id]) : null,
        dataset: bundle.datasets[id] ? JSON.stringify(bundle.datasets[id]) : null,
        annotations: bundle.annotations[id] ? JSON.stringify(bundle.annotations[id]) : null,
        bibliography: bundle.bibliography[id] ? JSON.stringify(bundle.bibliography[id]) : null,
        theoreticalFramework: bundle.theoreticalFramework[id] ? JSON.stringify(bundle.theoreticalFramework[id]) : null,
        exportHistory: bundle.exportHistory[id] ? JSON.stringify(bundle.exportHistory[id]) : null,
      },
      update: {
        title: research.title || "Recherche sans titre",
        researchType: research.researchType,
        level: research.level,
        status: research.status ?? "draft",
        domain: research.domain,
        university: research.university,
        description: research.description,
        researchData: JSON.stringify(research),
        payload: JSON.stringify(bundle.projects[id] ?? {}),
        instrument: bundle.instruments[id] ? JSON.stringify(bundle.instruments[id]) : null,
        dataset: bundle.datasets[id] ? JSON.stringify(bundle.datasets[id]) : null,
        annotations: bundle.annotations[id] ? JSON.stringify(bundle.annotations[id]) : null,
        bibliography: bundle.bibliography[id] ? JSON.stringify(bundle.bibliography[id]) : null,
        theoreticalFramework: bundle.theoreticalFramework[id] ? JSON.stringify(bundle.theoreticalFramework[id]) : null,
        exportHistory: bundle.exportHistory[id] ? JSON.stringify(bundle.exportHistory[id]) : null,
      },
    });
    synced += 1;

    if (!existing) {
      await logAudit({ actorId: ownerId, action: "RESEARCH_CREATED", entityType: "ResearchProject", entityId: id });
    }
  }

  return { synced };
}
