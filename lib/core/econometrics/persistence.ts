/**
 * Interprétation économétrique enregistrée : les séries validées par l'étudiant et ses DÉCISIONS. Les
 * agrégats, tests et verdicts ne sont jamais stockés comme des faits : ils sont recalculés à la reprise.
 */
import { z } from "zod";

import { ROLES } from "./roles";
import { MAX_PERIODS, MAX_SERIES, type MacroRole } from "./types";

export const ECON_SNAPSHOT_VERSION = 1;

const value = z.number().gt(-1e15).lt(1e15).nullable();
const ref = z.object({ kind: z.enum(["series", "aggregate"]), id: z.string().max(60) });
const roleIds = ROLES.map((r) => r.role) as [MacroRole, ...MacroRole[]];

export const econDatasetSchema = z.object({
  title: z.string().max(200),
  economy: z.string().max(200),
  frequency: z.enum(["annuelle", "trimestrielle", "mensuelle"]),
  periods: z.array(z.string().max(20)).max(MAX_PERIODS),
  series: z.array(z.object({ id: z.string().max(40), name: z.string().max(120), unit: z.string().max(60), role: z.enum(roleIds), values: z.array(value).max(MAX_PERIODS) })).max(MAX_SERIES),
  source: z.string().max(300),
  fictitious: z.boolean(),
});

export const econSnapshotSchema = z.object({
  engine: z.literal("econometrie"),
  version: z.literal(ECON_SNAPSHOT_VERSION),
  field: z.object({ domain: z.string().max(40).nullable(), specialty: z.string().max(60).nullable(), secondary: z.array(z.string().max(60)).max(20) }),
  fieldConfirmed: z.boolean(),
  source: z.enum(["demo", "manual", "file"]).nullable(),
  dataset: econDatasetSchema,
  /** Empreinte des séries validées (null tant qu'elles ne le sont pas). */
  datasetConfirmedKey: z.string().max(100).nullable(),
  presentationSeenKey: z.string().max(100).nullable(),
  research: z.record(z.string(), z.unknown()).nullable(),
  chainDecisions: z.object({ rows: z.record(z.string(), z.unknown()), assignments: z.record(z.string(), z.unknown()) }).optional(),
  framingConfirmedKey: z.string().max(100).nullable(),
  /** Hypothèse (ligne de la chaîne) → variables et signe attendu. */
  mappings: z.record(z.string().max(80), z.object({ dependent: ref.nullable(), independent: ref.nullable(), sign: z.union([z.literal(1), z.literal(-1)]).nullable() })),
  /** Modèle (variable expliquée) → transformation et variables de contrôle. */
  modelSettings: z.record(z.string().max(100), z.object({ transform: z.enum(["niveau", "log", "diff", "croissance"]), controls: z.array(ref).max(6) })),
  modelConfirmedKey: z.string().max(100).nullable(),
  reasoningSeenKey: z.string().max(100).nullable(),
  chapterKey: z.string().max(100).nullable(),
  view: z.string().max(40).nullable(),
});

export type EconSnapshot = z.infer<typeof econSnapshotSchema>;

export function parseEconSnapshot(raw: unknown): EconSnapshot | null {
  const parsed = econSnapshotSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
