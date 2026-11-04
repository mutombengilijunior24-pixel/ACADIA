// ============================================================
// MNJ STAGE CONNECT — JOURNAL VOCAL : TRANSCRIPTION D'UNE NOTE
//
// Reçoit une note vocale (5 minutes, 4 Mo au plus), la fait transcrire
// en français et ajoute le texte aux paroles de la journée. L'audio
// n'est JAMAIS conservé : il n'existe que le temps de la transcription.
// La journée est vérifiée AVANT la transcription.
// ============================================================

import { transcribeAudio } from "@/lib/ai/openai/StageJournalAI";
import { JOURNAL_LIMITS } from "@/lib/core/stages/journal";
import { STAGE_TIMEZONE } from "@/lib/core/stages/catalog";
import { rateLimitKey, rateLimiter } from "@/lib/server/security/RateLimiter";
import { appendJournalTranscript, journalContext, stageErrorResponse } from "@/lib/server/stages/StageService";
import { getSessionUser, unauthorized } from "@/lib/supervision/apiAuth";

export const runtime = "nodejs";
export const maxDuration = 60;

type RouteContext = { params: Promise<{ id: string }> };

const AUDIO_TYPES = /^audio\/(webm|ogg|mp4|mpeg|mp3|wav|x-wav|wave|x-m4a|m4a|aac|3gpp|amr)(;.*)?$/i;

export async function POST(request: Request, context: RouteContext) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (Number(request.headers.get("content-length") ?? 0) > JOURNAL_LIMITS.maxBytes + 64 * 1024) return Response.json({ error: "Note vocale trop longue : 5 minutes au plus." }, { status: 413 });
  if (!rateLimiter.check(rateLimitKey("stage-journal-note", user.id), JOURNAL_LIMITS.notesPerDay * 2, 24 * 60 * 60 * 1000).allowed) return Response.json({ error: "Nombre de notes vocales atteint pour aujourd'hui." }, { status: 429 });
  const { id } = await context.params;

  const form = await request.formData().catch(() => null);
  const audio = form?.get("audio");
  const day = String(form?.get("day") ?? "");
  const kind = form?.get("kind") === "reponse" ? "reponse" : "note";
  const question = String(form?.get("question") ?? "").slice(0, 300) || undefined;
  const seconds = Math.min(JOURNAL_LIMITS.maxSeconds, Math.max(0, Number(form?.get("seconds") ?? 0) || 0));
  if (!(audio instanceof File) || !audio.size) return Response.json({ error: "Aucun enregistrement reçu." }, { status: 400 });
  if (audio.size > JOURNAL_LIMITS.maxBytes) return Response.json({ error: "Note vocale trop longue : 5 minutes au plus." }, { status: 413 });
  if (audio.type && !AUDIO_TYPES.test(audio.type)) return Response.json({ error: "Format audio non reconnu." }, { status: 415 });

  // 1. La journée d'abord : rien n'est transcrit (ni payé) pour une journée fermée.
  let vocabulary: string;
  try {
    const stage = await journalContext(user.id, id, day);
    vocabulary = [stage.company, stage.tutorName, stage.department, stage.faculty].filter(Boolean).join(", ");
  } catch (error) {
    return stageErrorResponse(error);
  }
  // 2. Transcription : une panne donne une erreur claire, jamais un texte simulé.
  let text: string;
  try {
    text = await transcribeAudio(audio, { kind, vocabulary, seconds, userId: user.id });
  } catch {
    return Response.json({ error: "La transcription est momentanément indisponible : réessayez dans un instant, ou écrivez votre journée." }, { status: 502 });
  }
  if (!text) return Response.json({ error: "Aucune parole n'a été reconnue : parlez près du micro et réessayez." }, { status: 422 });
  // 3. Le texte rejoint les paroles de la journée ; l'audio n'est conservé nulle part.
  try {
    const at = new Intl.DateTimeFormat("fr-FR", { timeZone: STAGE_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date());
    const application = await appendJournalTranscript(user.id, id, day, { kind, text, question, at });
    return Response.json({ text, application }, { status: 200 });
  } catch (error) {
    return stageErrorResponse(error);
  }
}
