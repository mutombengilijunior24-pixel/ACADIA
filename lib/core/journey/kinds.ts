/**
 * Moteurs d'interprétation enregistrables : le parcours général (enquêtes), le moteur « Gestion financière »
 * et le moteur « Économétrie et macroéconomie ». Le moteur d'une interprétation est fixé à sa création et ne
 * change jamais.
 */
import type { z } from "zod";

import { econSnapshotSchema } from "@/lib/core/econometrics/persistence";
import { financeSnapshotSchema } from "@/lib/core/finance/persistence";

import { journeySnapshotSchema } from "./persistence";

export const JOURNEY_KINDS = ["survey", "finance", "econometrie"] as const;
export type JourneyKind = (typeof JOURNEY_KINDS)[number];

export const JOURNEY_KIND_LABELS: Record<JourneyKind, string> = { survey: "Parcours général", finance: "Gestion financière", econometrie: "Économétrie et macroéconomie" };

/** Moteurs dédiés, ouverts depuis le parcours général ou par « ?moteur=… ». */
export type DedicatedEngine = Exclude<JourneyKind, "survey">;
export const isDedicatedEngine = (value: unknown): value is DedicatedEngine => value === "finance" || value === "econometrie";

export const isJourneyKind = (value: unknown): value is JourneyKind => typeof value === "string" && (JOURNEY_KINDS as readonly string[]).includes(value);

/** Schéma de l'instantané propre à chaque moteur. */
export const payloadSchemaFor = (kind: JourneyKind): z.ZodType => (kind === "finance" ? financeSnapshotSchema : kind === "econometrie" ? econSnapshotSchema : journeySnapshotSchema);

/** Ce qu'un moteur transmet au moteur dédié qu'il ouvre (nouvelle interprétation). */
export interface EngineHandoff {
  engine: DedicatedEngine;
  field: { domain: string | null; specialty: string | null; secondary: string[] };
  research: Record<string, unknown> | null;
}
