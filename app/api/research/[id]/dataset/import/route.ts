// ============================================================
// ACADIA — IMPORT DE DATASET (Module 2, incrément 1 — CSV uniquement)
//
// Transforme un fichier CSV en Dataset (voir DatasetImportEngine)
// et le persiste dans le champ JSON déjà existant sur
// ResearchProject — s'affiche immédiatement dans DatasetTable/
// DatasetDictionary/DatasetQuality sans qu'aucun de ces composants
// n'ait besoin d'être modifié.
//
// ownerId toujours dérivé de la session ; jamais du corps de la
// requête (voir lib/supervision/apiAuth.ts).
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getResearchProjectRecord, setResearchProjectDataset } from "@/lib/server/research/ResearchStateService";
import { parseCsv } from "@/lib/server/dataset/CsvParser";
import { buildDatasetFromRows } from "@/lib/server/dataset/DatasetImportEngine";
import { checkDatasetQuality } from "@/lib/core/dataset/DatasetEngine";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { rateLimiter, rateLimitKey } from "@/lib/server/security/RateLimiter";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 Mo
const MAX_ROWS = 20000;

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;

  const limit = rateLimiter.check(rateLimitKey("dataset-import", user.id), 20, 60 * 60 * 1000);
  if (!limit.allowed) {
    return Response.json({ error: "Trop d'imports récents. Réessayez plus tard." }, { status: 429 });
  }

  const existing = await getResearchProjectRecord(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) {
    return forbidden("Ce projet ne vous appartient pas.", { actorId: user.id, entityType: "ResearchProject", entityId: id });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (!file.name.toLowerCase().endsWith(".csv")) {
    return Response.json({ error: "Seul le format CSV est pris en charge pour le moment." }, { status: 400 });
  }
  if (file.size === 0) {
    return Response.json({ error: "Le fichier est vide." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "Fichier trop volumineux (10 Mo maximum)." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  // Vérifie que c'est réellement du texte (pas un binaire renommé
  // en .csv) — un fichier texte valide ne contient jamais d'octet
  // nul ; on ne se fie jamais à la seule extension.
  if (buffer.includes(0)) {
    return Response.json({ error: "Ce fichier n'est pas un CSV texte valide." }, { status: 400 });
  }

  let text: string;
  try {
    text = buffer.toString("utf-8");
  } catch {
    return Response.json({ error: "Ce fichier n'est pas un CSV texte valide." }, { status: 400 });
  }

  const allRows = parseCsv(text);
  if (allRows.length === 0) {
    return Response.json({ error: "Aucune ligne exploitable dans ce fichier." }, { status: 400 });
  }

  const [headerRow, ...dataRows] = allRows;
  if (dataRows.length > MAX_ROWS) {
    return Response.json({ error: `Ce fichier dépasse la limite de ${MAX_ROWS} lignes pour le moment.` }, { status: 400 });
  }

  const result = buildDatasetFromRows(file.name, id, headerRow, dataRows);
  const structuralQuality = checkDatasetQuality(result.dataset);

  const saved = await setResearchProjectDataset(user.id, id, result.dataset);
  if (!saved) return notFound();

  await logAudit({
    actorId: user.id,
    action: "DATASET_IMPORTED",
    entityType: "ResearchProject",
    entityId: id,
    metadata: { rows: result.rowCount, columns: result.columnCount, fileName: file.name },
  });

  return Response.json(
    {
      dataset: result.dataset,
      quality: [...structuralQuality.items, ...result.quality],
    },
    { status: 201 }
  );
}
