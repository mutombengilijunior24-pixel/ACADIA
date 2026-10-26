/**
 * Interprétation financière enregistrée : instantané des DÉCISIONS et des CHIFFRES VALIDÉS par l'étudiant.
 * Le document d'origine (Excel, PDF, photo) n'est jamais enregistré ; les indicateurs et verdicts ne sont
 * pas stockés comme des faits : ils sont recalculés à la reprise par les mêmes moteurs.
 */
import { z } from "zod";

import { MAX_CORRECTIONS, MAX_EXERCISES } from "./types";

export const FINANCE_SNAPSHOT_VERSION = 1;

const amount = z.number().gt(-1e15).lt(1e15);
const code = z.string().regex(/^[A-Z]{2}$/);
const exerciseId = z.string().regex(/^[\w-]{1,40}$/);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const financeDossierSchema = z.object({
  company: z.object({
    name: z.string().max(200),
    sector: z.enum(["commerce", "industrie", "services", "btp", "agriculture", "autre"]),
    currency: z.enum(["CDF", "USD", "AUTRE"]),
    currencyOther: z.string().max(40),
    unit: z.union([z.literal(1), z.literal(1000), z.literal(1_000_000)]),
    city: z.string().max(120),
  }),
  exercises: z.array(z.object({ id: exerciseId, label: z.string().max(40), start: isoDate, end: isoDate })).min(1).max(MAX_EXERCISES),
  values: z.record(exerciseId, z.record(code, amount)),
  origins: z.record(exerciseId, z.record(code, z.enum(["saisie", "import", "ia", "demo"]))),
  corrections: z.array(z.object({ at: z.string().max(40), exerciseId, code, before: amount.nullable(), after: amount.nullable() })).max(MAX_CORRECTIONS),
});

export const financeSnapshotSchema = z.object({
  engine: z.literal("finance"),
  version: z.literal(FINANCE_SNAPSHOT_VERSION),
  field: z.object({ domain: z.string().max(40).nullable(), specialty: z.string().max(60).nullable(), secondary: z.array(z.string().max(60)).max(20) }),
  fieldConfirmed: z.boolean(),
  /** Comment l'étudiant a fourni ses états (démonstration, saisie, fichier). */
  source: z.enum(["demo", "manual", "file"]).nullable(),
  dossier: financeDossierSchema,
  provenance: z.object({ kind: z.enum(["officiels", "internes", "reconstitues", "pedagogiques", "fictifs"]), description: z.string().max(300) }).nullable(),
  /** L'étudiant atteste avoir vérifié les chiffres (et que les postes vides des états fournis valent zéro). */
  attested: z.boolean(),
  /** Écarts bloquants acceptés, avec la justification de l'étudiant (clé du contrôle → justification). */
  acceptedGaps: z.record(z.string().max(120), z.string().max(500)),
  /** Empreinte des chiffres validés (null tant que les états ne sont pas validés). */
  validatedKey: z.string().max(100).nullable(),
  /** Empreinte des chiffres au moment où l'étudiant a lu « L'état de l'entreprise ». */
  diagnosisSeenKey: z.string().max(100).nullable().optional(),
  research: z.record(z.string(), z.unknown()).nullable(),
  /** Chaîne question → objectif → hypothèse (décisions de l'étudiant) et sa validation. */
  chainDecisions: z.object({ rows: z.record(z.string(), z.unknown()), assignments: z.record(z.string(), z.unknown()) }).optional(),
  framingConfirmedKey: z.string().max(100).nullable().optional(),
  /** Indicateurs retenus par variable (« concept:<id> » → indicateurs). */
  indicatorChoices: z.record(z.string().max(80), z.array(z.string().max(60)).max(40)).optional(),
  indicatorsConfirmedKey: z.string().max(100).nullable().optional(),
  /** Critères de vérification : modifications de l'étudiant. */
  criteriaDecisions: z
    .record(z.string().max(160), z.object({ enabled: z.boolean().optional(), scope: z.enum(["dernier", "tous", "majorite"]).optional(), threshold: z.object({ op: z.enum([">=", "<="]), value: z.number().gt(-1e15).lt(1e15) }).nullable().optional() }))
    .optional(),
  criteriaConfirmedKey: z.string().max(100).nullable().optional(),
  reasoningSeenKey: z.string().max(100).nullable().optional(),
  /** Plan du chapitre : ordre et sections retirées. */
  chapterDecisions: z.object({ order: z.array(z.string().max(200)).max(80).optional(), removed: z.array(z.string().max(200)).max(80).optional() }).optional(),
  chapterKey: z.string().max(100).nullable().optional(),
  view: z.string().max(40).nullable(),
});

export type FinanceSnapshot = z.infer<typeof financeSnapshotSchema>;

/** Lecture sûre d'un instantané financier (null si illisible ou d'une version inconnue). */
export function parseFinanceSnapshot(raw: unknown): FinanceSnapshot | null {
  const parsed = financeSnapshotSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}
