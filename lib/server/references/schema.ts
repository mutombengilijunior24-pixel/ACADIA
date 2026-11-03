/**
 * Référence reçue du navigateur (déjà découpée) : bornes strictes sur chaque champ. Seules des
 * métadonnées bibliographiques circulent, jamais le texte du mémoire.
 */
import { z } from "zod";

import { REFERENCE_KIND_LABELS, type ParsedReference, type ReferenceKind } from "@/lib/core/references";

const text = (max: number) => z.string().max(max).nullable();
const kinds = Object.keys(REFERENCE_KIND_LABELS) as [ReferenceKind, ...ReferenceKind[]];

export const referenceSchema = z.object({
  id: z.string().min(1).max(20),
  raw: z.string().max(1500),
  authors: z.array(z.object({ family: z.string().max(200), given: z.string().max(100), corporate: z.boolean() })).max(40),
  year: z.number().int().min(1000).max(2100).nullable(),
  yearSuffix: z.string().max(2),
  noDate: z.boolean(),
  title: text(600),
  container: text(400),
  publisher: text(300),
  place: text(120),
  edition: text(20),
  volume: text(40),
  issue: text(40),
  pages: text(40),
  doi: text(200),
  url: text(1000),
  isbn: text(20),
  kind: z.enum(kinds),
  uncertain: z.boolean(),
});

export type ReferencePayload = z.infer<typeof referenceSchema>;

export const toParsedReference = (r: ReferencePayload, index = 0): ParsedReference => ({ ...r, index, runs: [], layout: "apa", section: null });
