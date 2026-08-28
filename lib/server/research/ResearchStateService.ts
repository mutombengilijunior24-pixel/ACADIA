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
import type { Research } from "@/types/Research";
import type { ResearchProject as ScientificProject } from "@/lib/core/research/ResearchTypes";
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
  }

  return { synced };
}
