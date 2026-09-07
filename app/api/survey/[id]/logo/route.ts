// ============================================================
// ACADIA — SURVEY : LOGO DE L'INSTITUTION (propriétaire uniquement)
//
// Upload/suppression du logo affiché sur la page publique de
// l'enquête. Réutilise le stockage de documents existant
// (documentStorageProvider) — aucun deuxième système de fichiers.
// Type MIME et taille strictement contrôlés côté serveur ; jamais un
// fichier arbitraire stocké sans vérification.
// ============================================================

import { getSessionUser, unauthorized, forbidden, notFound } from "@/lib/supervision/apiAuth";
import { getSurveyById, updateSurveyMeta } from "@/lib/server/survey/SurveyStore";
import { documentStorageProvider } from "@/lib/server/documents/DocumentStorageProvider";
import { isPng, isJpeg, isWebp } from "@/lib/server/files/detectFileType";

export const runtime = "nodejs";

const MAX_SIZE_BYTES = 2 * 1024 * 1024; // 2 Mo

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const existing = await getSurveyById(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: "Corps de requête invalide." }, { status: 400 });
  }

  const file = formData.get("logo");
  if (!(file instanceof File)) {
    return Response.json({ error: "Aucun fichier reçu." }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return Response.json({ error: "Fichier trop volumineux (2 Mo maximum)." }, { status: 400 });
  }

  const data = Buffer.from(await file.arrayBuffer());

  // Le type déclaré par le client (file.type) n'est jamais fiable —
  // seule la signature réelle des octets du fichier fait foi.
  const realContentType = isPng(data) ? "image/png" : isJpeg(data) ? "image/jpeg" : isWebp(data) ? "image/webp" : null;
  if (!realContentType) {
    return Response.json({ error: "Format non pris en charge. Utilisez PNG, JPG ou WEBP." }, { status: 400 });
  }

  const doc = await documentStorageProvider.upload({ fileName: file.name || "logo", contentType: realContentType, data });

  const previousLogoId = existing.institutionLogoUrl?.split("/").pop();

  const survey = await updateSurveyMeta(id, { institutionLogoDocumentId: doc.id });

  if (previousLogoId && previousLogoId !== doc.id) {
    await documentStorageProvider.delete(previousLogoId).catch(() => undefined);
  }

  return Response.json({ survey }, { status: 200 });
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getSessionUser();
  if (!user) return unauthorized();

  const { id } = await context.params;
  const existing = await getSurveyById(id);
  if (!existing) return notFound();
  if (existing.ownerId !== user.id) return forbidden("Cette enquête ne vous appartient pas.", { actorId: user.id, entityType: "Survey", entityId: id });

  const previousLogoId = existing.institutionLogoUrl?.split("/").pop();
  const survey = await updateSurveyMeta(id, { institutionLogoDocumentId: null });

  if (previousLogoId) {
    await documentStorageProvider.delete(previousLogoId).catch(() => undefined);
  }

  return Response.json({ survey }, { status: 200 });
}
