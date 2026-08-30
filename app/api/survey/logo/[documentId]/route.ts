// ============================================================
// ACADIA — SURVEY : SERVIR LE LOGO D'INSTITUTION (public)
//
// Route publique volontairement — le logo doit être visible sur la
// page publique de l'enquête et l'écran de confirmation, sans
// authentification. Ne sert JAMAIS un document arbitraire : l'id doit
// être réellement référencé comme logo d'une enquête existante (le
// stockage de documents est partagé avec d'autres usages ACADIA, ex.
// exports Research) et le contenu doit réellement être une image.
// ============================================================

import { isDocumentUsedAsSurveyLogo } from "@/lib/server/survey/SurveyStore";
import { documentStorageProvider } from "@/lib/server/documents/DocumentStorageProvider";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ documentId: string }> }) {
  const { documentId } = await context.params;

  const isLogo = await isDocumentUsedAsSurveyLogo(documentId);
  if (!isLogo) return new Response(null, { status: 404 });

  const meta = await documentStorageProvider.getMetadata(documentId);
  if (!meta || !meta.contentType.startsWith("image/")) return new Response(null, { status: 404 });

  const data = await documentStorageProvider.download(documentId);
  if (!data) return new Response(null, { status: 404 });

  return new Response(new Uint8Array(data), {
    status: 200,
    headers: {
      "Content-Type": meta.contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
