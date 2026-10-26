/**
 * Moteurs d'interprétation enregistrables : le parcours général (enquêtes) et le moteur
 * « Gestion financière ». Le moteur d'une interprétation est fixé à sa création et ne change jamais.
 */
import type { z } from "zod";

import { financeSnapshotSchema } from "@/lib/core/finance/persistence";

import { journeySnapshotSchema } from "./persistence";

export const JOURNEY_KINDS = ["survey", "finance"] as const;
export type JourneyKind = (typeof JOURNEY_KINDS)[number];

export const JOURNEY_KIND_LABELS: Record<JourneyKind, string> = { survey: "Parcours général", finance: "Gestion financière" };

export const isJourneyKind = (value: unknown): value is JourneyKind => typeof value === "string" && (JOURNEY_KINDS as readonly string[]).includes(value);

/** Schéma de l'instantané propre à chaque moteur. */
export const payloadSchemaFor = (kind: JourneyKind): z.ZodType => (kind === "finance" ? financeSnapshotSchema : journeySnapshotSchema);

/** Ce qu'un moteur transmet au moteur dédié qu'il ouvre (nouvelle interprétation). */
export interface EngineHandoff {
  field: { domain: string | null; specialty: string | null; secondary: string[] };
  research: Record<string, unknown> | null;
}
