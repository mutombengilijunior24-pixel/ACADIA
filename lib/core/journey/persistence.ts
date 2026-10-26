/**
 * Interprétation enregistrée : instantané des DÉCISIONS du chercheur (pas des résultats, recalculés
 * à la reprise par les mêmes moteurs). Partagé par le navigateur (sauvegarde) et le serveur (validation).
 * Le fichier de données n'est pas dans l'instantané : il est stocké à part (avec consentement) ou réimporté,
 * puis vérifié par son empreinte SHA-256 avant de rejouer les décisions de préparation.
 */
import { z } from "zod";

import type { ImportedDataset, PreparationOperation, PreparationState } from "@/lib/core/data/types";

export const SNAPSHOT_VERSION = 1;

export const PERSISTENCE_LIMITS = {
  /** Taille maximale de l'instantané JSON. */
  payloadBytes: 1_000_000,
  /** Fichier de données compressé (limite d'une requête sur l'hébergeur : 4,5 Mo). */
  fileBytes: 4_000_000,
  /** Taille décompressée maximale acceptée pour un CSV. */
  fileUncompressedBytes: 25_000_000,
  titleLength: 200,
  activeSessions: 30,
};

const fileMeta = z.object({ name: z.string().max(260), size: z.number().int().nonnegative(), lastModified: z.number() });

/** Opérations de préparation (miroir de PreparationOperation), bornées. */
const operation = z.union([
  z.object({ id: z.string().max(80), at: z.string().max(40), type: z.literal("declare_missing_codes"), column: z.number().int().min(0).max(5000), values: z.array(z.string().max(200)).max(200) }),
  z.object({ id: z.string().max(80), at: z.string().max(40), type: z.literal("exclude_rows"), rows: z.array(z.number().int().min(0).max(200_000)).max(200_000), reason: z.string().max(500) }),
  z.object({ id: z.string().max(80), at: z.string().max(40), type: z.literal("set_statistical_type"), column: z.number().int().min(0).max(5000), statisticalType: z.string().max(40) }),
  z.object({ id: z.string().max(80), at: z.string().max(40), type: z.literal("set_role"), column: z.number().int().min(0).max(5000), role: z.string().max(40).nullable() }),
  z.object({ id: z.string().max(80), at: z.string().max(40), type: z.literal("set_mapping"), column: z.number().int().min(0).max(5000), mapping: z.unknown() }),
  z.object({ id: z.string().max(80), at: z.string().max(40), type: z.literal("confirm_structure"), family: z.string().max(80).nullable() }),
]);

export const journeySnapshotSchema = z.object({
  version: z.literal(SNAPSHOT_VERSION),
  field: z.object({ domain: z.string().max(40).nullable(), specialty: z.string().max(60).nullable(), secondary: z.array(z.string().max(60)).max(20) }),
  fieldConfirmed: z.boolean(),
  overrides: z.record(z.string(), z.unknown()),
  research: z.record(z.string(), z.unknown()).nullable(),
  chainDecisions: z.object({ rows: z.record(z.string(), z.unknown()), assignments: z.record(z.string(), z.unknown()) }),
  framingConfirmedKey: z.string().max(100).nullable(),
  instrument: z.object({ kind: z.string().max(40).nullable(), mode: z.enum(["text", "acadia", "headers"]), text: z.string().max(200_000), acadia: z.unknown().nullable() }),
  instrumentConfirmed: z.boolean(),
  data: z
    .object({
      file: fileMeta,
      importOptions: z.record(z.string(), z.unknown()),
      sha256: z.string().regex(/^[0-9a-f]{64}$/),
      columnCount: z.number().int().nonnegative(),
      rowCount: z.number().int().nonnegative(),
      operations: z.array(operation).max(2000),
    })
    .nullable(),
  provenance: z.object({ kind: z.string().max(40), description: z.string().max(300) }).nullable(),
  qualityConfirmed: z.boolean(),
  skipDecisions: z.record(z.string(), z.enum(["confirmed", "rejected"])),
  skipValues: z.record(z.string(), z.array(z.string().max(300)).max(200)),
  structuralChoice: z.record(z.string(), z.boolean()),
  mappingDecisions: z.object({ concepts: z.record(z.string(), z.unknown()), unitRoles: z.record(z.string(), z.unknown()) }),
  mappingConfirmedKey: z.string().max(100).nullable(),
  planDecisions: z.record(z.string(), z.unknown()),
  alpha: z.number().min(0.001).max(0.2),
  independence: z.boolean(),
  planValidatedKey: z.string().max(100).nullable(),
  /** Des résultats avaient été calculés : ils sont recalculés à la reprise. */
  hadResults: z.boolean(),
  view: z.string().max(40).nullable(),
});

export type JourneySnapshot = z.infer<typeof journeySnapshotSchema>;

/** Résumé affiché dans « Mes interprétations ». */
export const sessionSummarySchema = z.object({
  stageLabel: z.string().max(80),
  progress: z.number().int().min(0).max(6),
  verdicts: z.array(z.object({ label: z.string().max(80), verdict: z.string().max(80) })).max(20),
  /** Nom du fichier de données importé (même s'il n'a pas été conservé dans le compte). */
  dataFile: z.string().max(260).nullable().optional(),
  /** Précision affichée sous le titre (ex. entreprise et exercices analysés). */
  detail: z.string().max(200).nullable().optional(),
});
export type SessionSummary = z.infer<typeof sessionSummarySchema>;

/** Lecture sûre d'un instantané enregistré (null si illisible ou d'une version inconnue). */
export function parseSnapshot(raw: unknown): JourneySnapshot | null {
  const parsed = journeySnapshotSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Empreinte SHA-256 (hexadécimal) d'un fichier, calculée dans le navigateur ou sur le serveur. */
export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as unknown as ArrayBuffer);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Rejoue les décisions de préparation sur un jeu de données réimporté (nouvel identifiant d'import).
 * Les opérations qui visent une colonne ou une ligne absente sont écartées et signalées.
 */
export function replayOperations(operations: PreparationOperation[], dataset: ImportedDataset): { preparation: PreparationState; dropped: number } {
  const valid = operations.filter((op) => {
    if ("column" in op && (op.column < 0 || op.column >= dataset.columnCount)) return false;
    if (op.type === "exclude_rows" && op.rows.some((r) => r < 0 || r >= dataset.rowCount)) return false;
    return true;
  });
  return { preparation: { datasetId: dataset.importId, operations: valid }, dropped: operations.length - valid.length };
}
