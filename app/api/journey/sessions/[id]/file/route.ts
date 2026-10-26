// ============================================================
// ACADIA — FICHIER DE DONNÉES D'UNE INTERPRÉTATION ENREGISTRÉE
//
// Facultatif (consentement explicite du chercheur) : permet de
// reprendre l'interprétation sans réimporter le fichier.
// - CSV : envoyé compressé (gzip) ; décompression bornée, octets
//   nuls refusés ; XLSX : vérifié comme archive ZIP.
// - L'empreinte SHA-256 est recalculée et comparée.
// - Stockage privé (document storage) ; la propriété est portée
//   par JourneySession.fileDocumentId, jamais par le client.
// ============================================================

import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";

import { PERSISTENCE_LIMITS } from "@/lib/core/journey/persistence";
import { logAudit } from "@/lib/server/audit/AuditLog";
import { documentStorageProvider } from "@/lib/server/documents/DocumentStorageProvider";
import { isZipArchive } from "@/lib/server/files/detectFileType";
import { clearSessionFile, getSession, journeyErrorResponse, ownerOf, setSessionFile } from "@/lib/server/journey/JourneySessionService";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { forbidden, getSessionUser, notFound, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

const isGzip = (buf: Buffer) => buf.length > 2 && buf[0] === 0x1f && buf[1] === 0x8b;

async function ownership(id: string, userId: string): Promise<Response | null> {
  const owner = await ownerOf(id);
  if (!owner) return notFound("Interprétation introuvable.");
  if (owner !== userId) return forbidden("Cette interprétation ne vous appartient pas.", { actorId: userId, entityType: "JourneySession", entityId: id });
  return null;
}

export async function PUT(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  if (!rateLimiter.check(rateLimitKey("journey-file", user.id), 30, 60 * 60 * 1000).allowed) return Response.json({ error: "Trop d'envois de fichiers : réessayez plus tard." }, { status: 429 });
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return Response.json({ error: "Envoi invalide." }, { status: 400 });
  }
  const file = form.get("file");
  const sha256 = String(form.get("sha256") ?? "");
  const format = String(form.get("format") ?? "");
  const name = String(form.get("name") ?? "donnees").slice(0, 200);
  if (!(file instanceof Blob) || !/^[0-9a-f]{64}$/.test(sha256) || (format !== "csv-gzip" && format !== "xlsx")) return Response.json({ error: "Envoi invalide." }, { status: 400 });
  if (file.size > PERSISTENCE_LIMITS.fileBytes) return Response.json({ error: "Fichier trop volumineux pour être conservé (4 Mo compressés au maximum) : vous pourrez le réimporter à la reprise." }, { status: 413 });
  const stored = Buffer.from(await file.arrayBuffer());
  // Contenu réel vérifié (jamais l'extension ni le type déclaré).
  let original: Buffer;
  if (format === "csv-gzip") {
    if (!isGzip(stored)) return Response.json({ error: "Format de fichier invalide." }, { status: 400 });
    try {
      original = gunzipSync(stored, { maxOutputLength: PERSISTENCE_LIMITS.fileUncompressedBytes });
    } catch {
      return Response.json({ error: "Fichier compressé illisible ou trop volumineux." }, { status: 400 });
    }
    if (original.includes(0)) return Response.json({ error: "Le fichier contient des octets nuls : ce n'est pas un CSV." }, { status: 400 });
  } else {
    if (!isZipArchive(stored)) return Response.json({ error: "Format de fichier invalide." }, { status: 400 });
    original = stored;
  }
  if (createHash("sha256").update(original).digest("hex") !== sha256) return Response.json({ error: "Empreinte du fichier incorrecte." }, { status: 400 });
  try {
    const denied = await ownership(id, user.id);
    if (denied) return denied;
    let documentId: string;
    try {
      const meta = await documentStorageProvider.upload({ fileName: `${id}.${format === "csv-gzip" ? "csv.gz" : "xlsx"}`, contentType: format === "csv-gzip" ? "application/gzip" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", data: stored });
      documentId = meta.id;
    } catch {
      return Response.json({ error: "Le stockage de fichiers n'est pas disponible : vous pourrez réimporter votre fichier à la reprise.", code: "storage_unavailable" }, { status: 503 });
    }
    const { previous } = await setSessionFile(user.id, id, { documentId, name: `${name}`, size: original.length, sha256 });
    if (previous && previous !== documentId) await documentStorageProvider.delete(previous).catch(() => false);
    await logAudit({ actorId: user.id, action: "JOURNEY_FILE_STORED", entityType: "JourneySession", entityId: id, metadata: { format, sizeBytes: stored.length } });
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return journeyErrorResponse(error);
  }
}

export async function GET(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  try {
    const record = await getSession(user.id, id);
    if (!record) return notFound("Interprétation introuvable.");
    if (record === "forbidden") return forbidden("Cette interprétation ne vous appartient pas.", { actorId: user.id, entityType: "JourneySession", entityId: id });
    if (!record.fileDocumentId) return notFound("Aucun fichier conservé pour cette interprétation.");
    const data = await documentStorageProvider.download(record.fileDocumentId).catch(() => null);
    if (!data) return Response.json({ error: "Fichier indisponible : réimportez-le.", code: "storage_unavailable" }, { status: 503 });
    const gz = isGzip(data);
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": gz ? "application/gzip" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment",
        "Cache-Control": "private, no-store",
        "X-Acadia-Format": gz ? "csv-gzip" : "xlsx",
      },
    });
  } catch (error) {
    return journeyErrorResponse(error);
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  const { id } = await context.params;
  try {
    const denied = await ownership(id, user.id);
    if (denied) return denied;
    const { previous } = await clearSessionFile(user.id, id);
    if (previous) await documentStorageProvider.delete(previous).catch(() => false);
    await logAudit({ actorId: user.id, action: "JOURNEY_FILE_DELETED", entityType: "JourneySession", entityId: id });
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    return journeyErrorResponse(error);
  }
}
