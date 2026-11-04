"use client";

import { useEffect, useRef, useState } from "react";
import { BadgeCheck, Loader2, MessageCircleQuestion, Mic, PenLine, RotateCcw, Sparkles, Square } from "lucide-react";

import { ACTIVITIES_MIN } from "@/lib/core/stages/catalog";
import { appendTranscript, JOURNAL_LIMITS, splitSections } from "@/lib/core/stages/journal";
import { formatDayTitle } from "@/lib/core/stages/workflow";

import type { AttendanceJson, DossierJson } from "./types";

/** Formats d'enregistrement, du plus léger au plus répandu (Android/Chrome : webm ; iPhone/Safari : mp4). */
const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
const clock = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms));

type PendingNote = { blob: Blob; seconds: number; question: string | null };

/** Enregistreur de note vocale (5 minutes au plus) : rien n'est conservé dans le navigateur après un envoi réussi. */
function useRecorder(onDone: (blob: Blob, seconds: number) => void) {
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<number | null>(null);
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);
  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const stop = () => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  };

  const start = async () => {
    setError(null);
    if (typeof window === "undefined" || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setError("Votre navigateur ne permet pas d'enregistrer : écrivez votre journée ci-dessous.");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Le micro n'est pas autorisé : autorisez-le dans les réglages de votre navigateur, puis réessayez.");
      return;
    }
    const mime = MIME_TYPES.find((m) => MediaRecorder.isTypeSupported(m));
    const rec = new MediaRecorder(stream.current, mime ? { mimeType: mime, audioBitsPerSecond: 32_000 } : { audioBitsPerSecond: 32_000 });
    const chunks: Blob[] = [];
    const startedAt = Date.now();
    rec.ondataavailable = (e) => {
      if (e.data.size) chunks.push(e.data);
    };
    rec.onstop = () => {
      if (timer.current) window.clearInterval(timer.current);
      stream.current?.getTracks().forEach((t) => t.stop());
      setRecording(false);
      const blob = new Blob(chunks, { type: rec.mimeType || mime || "audio/webm" });
      done.current(blob, Math.max(1, Math.round((Date.now() - startedAt) / 1000)));
    };
    recorder.current = rec;
    rec.start(1000);
    setSeconds(0);
    setRecording(true);
    timer.current = window.setInterval(() => {
      const s = Math.round((Date.now() - startedAt) / 1000);
      setSeconds(s);
      if (s >= JOURNAL_LIMITS.maxSeconds) stop();
    }, 250);
  };

  return { recording, seconds, error, start, stop };
}

async function request(url: string, init: RequestInit): Promise<Record<string, unknown>> {
  let res = await fetch(url, init);
  // Anti-rafale du serveur (deux actions rapprochées) : une seconde tentative.
  if (res.status === 429) {
    await wait(1100);
    res = await fetch(url, init);
  }
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : `Erreur ${res.status}`);
  return data;
}

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** Texte rédigé, avec ses sous-titres et les termes « à vérifier » surlignés. */
function Preview({ text, flagged }: { text: string; flagged: string[] }) {
  // Mots ou nombres entiers seulement : « 4 » ne doit pas colorer le début de « 40 ».
  const pattern = flagged.length ? new RegExp(`(?<![\\p{L}\\p{N}])(${flagged.map(escapeRegExp).join("|")})(?![\\p{L}\\p{N}])`, "gu") : null;
  const mark = (s: string) =>
    pattern
      ? s.split(pattern).map((part, i) =>
          flagged.includes(part) ? (
            <mark key={i} className="rounded bg-amber-200 px-0.5 text-amber-950" title="À vérifier : vous ne l'avez pas dit">
              {part}
            </mark>
          ) : (
            <span key={i}>{part}</span>
          ),
        )
      : s;
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-relaxed text-slate-800">
      {splitSections(text).map((s, i) => (
        <div key={i}>
          {s.title ? <p className="font-bold text-violet-900">{s.title}</p> : null}
          <p className="whitespace-pre-line">{mark(s.text)}</p>
        </div>
      ))}
    </div>
  );
}

/** Journal vocal d'une journée : dicter, relire la transcription, répondre aux questions, rédiger, valider. */
export function VoiceJournal({ dossier, record, onChange }: { dossier: DossierJson; record: AttendanceJson; onChange: (d: DossierJson) => void }) {
  const day = record.day;
  const base = `/api/stages/${dossier.id}/journal`;
  const [busy, setBusy] = useState<null | "transcription" | "questions" | "redaction" | "enregistrement">(null);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState(record.transcript ?? "");
  const [questions, setQuestions] = useState<string[] | null>(null);
  const [answering, setAnswering] = useState<string | null>(null);
  const [typed, setTyped] = useState<Record<string, string>>({});
  const [draft, setDraft] = useState<{ text: string; unverified: string[] } | null>(null);
  const [editing, setEditing] = useState(false);
  const [lastSaved, setLastSaved] = useState(record.transcript ?? "");
  // Note dont l'envoi a échoué (réseau, service de transcription) : gardée dans la page seulement, pour la renvoyer sans tout redire.
  const [pending, setPending] = useState<PendingNote | null>(null);

  // La transcription enregistrée fait foi (nouvelle note, autre onglet) : mise à jour pendant le rendu.
  const saved = record.transcript ?? "";
  if (saved !== lastSaved) {
    setLastSaved(saved);
    setTranscript(saved);
  }

  const run = async (kind: NonNullable<typeof busy>, task: () => Promise<void>) => {
    setBusy(kind);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Une erreur est survenue : réessayez.");
    } finally {
      setBusy(null);
    }
  };

  const upload = (note: PendingNote) =>
    void run("transcription", async () => {
      if (note.blob.size > JOURNAL_LIMITS.maxBytes) throw new Error("Note vocale trop longue : 5 minutes au plus.");
      setPending(note);
      const type = note.blob.type.split(";")[0] || "audio/webm";
      const ext = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
      const form = new FormData();
      form.append("audio", new File([note.blob], `note.${ext}`, { type }));
      form.append("day", day);
      form.append("kind", note.question ? "reponse" : "note");
      if (note.question) form.append("question", note.question);
      form.append("seconds", String(note.seconds));
      const data = await request(`${base}/transcribe`, { method: "POST", body: form });
      setPending(null);
      onChange(data.application as DossierJson);
      if (note.question) setQuestions((q) => q?.filter((x) => x !== note.question) ?? null);
      setAnswering(null);
    });
  const recorder = useRecorder((blob, seconds) => upload({ blob, seconds, question: answering }));

  const saveTranscript = (next: string) =>
    run("enregistrement", async () => {
      const data = await request(base, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day, transcript: next }) });
      onChange(data.application as DossierJson);
    });

  const answerInWriting = (question: string) => {
    const text = (typed[question] ?? "").trim();
    if (!text) return;
    const at = new Intl.DateTimeFormat("fr-FR", { timeZone: "Africa/Lubumbashi", hour: "2-digit", minute: "2-digit" }).format(new Date());
    void saveTranscript(appendTranscript(transcript, { kind: "reponse", question, text, at })).then(() => setQuestions((q) => q?.filter((x) => x !== question) ?? null));
  };

  const askQuestions = () =>
    run("questions", async () => {
      const data = await request(`${base}/followups`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day }) });
      setQuestions((data.questions as string[]) ?? []);
    });

  const write = () =>
    run("redaction", async () => {
      if (transcript !== lastSaved) await request(base, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day, transcript }) });
      const data = await request(`${base}/write`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day }) });
      setDraft({ text: String(data.text ?? ""), unverified: (data.unverified as string[]) ?? [] });
      setEditing(false);
    });

  const validate = () =>
    run("enregistrement", async () => {
      if (!draft) return;
      const data = await request(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ day, activities: draft.text }) });
      onChange(data.application as DossierJson);
      setDraft(null);
      setQuestions(null);
    });

  const recordButton = (label: string) => (
    <button
      type="button"
      disabled={!!busy}
      onClick={() => (recorder.recording ? recorder.stop() : void recorder.start())}
      className={`inline-flex min-h-12 items-center gap-2 rounded-2xl px-5 text-sm font-black text-white shadow-lg transition disabled:opacity-60 ${recorder.recording ? "animate-pulse bg-rose-600 shadow-rose-500/30" : "bg-gradient-to-r from-violet-600 via-fuchsia-600 to-pink-500 shadow-fuchsia-500/30"}`}
    >
      {recorder.recording ? <Square size={18} aria-hidden /> : <Mic size={18} aria-hidden />}
      {recorder.recording ? `Arrêter (${clock(recorder.seconds)} / ${clock(JOURNAL_LIMITS.maxSeconds)})` : label}
    </button>
  );

  const validated = !!record.writtenAt && !draft;
  const hasWords = transcript.trim().length > 0;

  return (
    <div className="space-y-4 rounded-2xl border border-fuchsia-200 bg-gradient-to-br from-white to-fuchsia-50/60 p-4 sm:p-5" aria-label={`Journal vocal du ${formatDayTitle(day)}`}>
      <div>
        <p className="flex items-center gap-2 text-sm font-black text-fuchsia-900">
          <Mic size={16} aria-hidden /> Ma journée en note vocale — {formatDayTitle(day)}
        </p>
        <p className="mt-1 text-xs text-slate-600">En 2 à 5 minutes, dites : ce que vous avez fait, avec qui, avec quels outils, ce qui a été difficile, ce que vous avez appris. Le texte s&apos;affiche aussitôt ; l&apos;audio n&apos;est pas conservé.</p>
      </div>

      {validated ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-emerald-50 p-3">
          <p className="inline-flex items-center gap-2 text-sm font-bold text-emerald-900">
            <BadgeCheck size={18} aria-hidden /> Journée rédigée et validée : elle figure dans votre journal et votre rapport.
          </p>
          <button type="button" className="inline-flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-emerald-900 hover:bg-emerald-100" onClick={() => setDraft({ text: record.activities ?? "", unverified: [] })}>
            <RotateCcw size={15} aria-hidden /> Reprendre la rédaction
          </button>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {/* Pendant une réponse à une question, seul le bouton de cette question pilote l'enregistrement. */}
        {answering ? null : recordButton(hasWords ? "Ajouter une note vocale" : "Dicter ma journée")}
        {busy === "transcription" ? (
          <span className="inline-flex items-center gap-2 text-sm font-semibold text-violet-800" role="status">
            <Loader2 size={16} className="animate-spin" aria-hidden /> Transcription en cours…
          </span>
        ) : null}
      </div>
      {recorder.error ? (
        <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900" role="alert">
          {recorder.error}
        </p>
      ) : null}

      {hasWords ? (
        <label className="block text-sm">
          <span className="mb-1 block font-semibold text-slate-800">Ce que vous avez dit (vous pouvez corriger la transcription)</span>
          <textarea className="block min-h-32 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:text-sm" value={transcript} onChange={(e) => setTranscript(e.target.value)} aria-label="Transcription de vos notes vocales" />
          {transcript !== lastSaved ? (
            <button type="button" disabled={!!busy} onClick={() => void saveTranscript(transcript)} className="mt-2 inline-flex min-h-10 items-center gap-2 rounded-xl bg-slate-900 px-3 text-sm font-bold text-white disabled:opacity-60">
              Enregistrer mes corrections
            </button>
          ) : null}
        </label>
      ) : null}

      {hasWords && !draft ? (
        <div className="space-y-3">
          {questions === null ? (
            <button type="button" disabled={!!busy || recorder.recording} onClick={() => void askQuestions()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-violet-300 bg-white px-4 text-sm font-bold text-violet-900 hover:bg-violet-50 disabled:opacity-60">
              {busy === "questions" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <MessageCircleQuestion size={16} aria-hidden />} Compléter avec les questions d&apos;ACADIA
            </button>
          ) : questions.length ? (
            <ul className="space-y-2" aria-label="Questions d'ACADIA">
              {questions.map((q) => (
                <li key={q} className="rounded-2xl border border-violet-200 bg-white p-3 text-sm">
                  <p className="font-semibold text-violet-950">{q}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {answering === q ? (
                      recordButton("Répondre à la voix")
                    ) : (
                      <button
                        type="button"
                        disabled={!!busy || recorder.recording}
                        onClick={() => {
                          setAnswering(q);
                          void recorder.start();
                        }}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-violet-600 px-3 text-sm font-bold text-white disabled:opacity-60"
                      >
                        <Mic size={15} aria-hidden /> Répondre à la voix
                      </button>
                    )}
                    <input className="min-h-10 min-w-48 flex-1 rounded-xl border border-slate-200 px-3 text-sm" placeholder="… ou écrivez votre réponse" value={typed[q] ?? ""} onChange={(e) => setTyped((t) => ({ ...t, [q]: e.target.value }))} aria-label={`Réponse écrite : ${q}`} />
                    <button type="button" disabled={!!busy || !(typed[q] ?? "").trim()} onClick={() => answerInWriting(q)} className="inline-flex min-h-10 items-center rounded-xl px-3 text-sm font-semibold text-violet-900 hover:bg-violet-50 disabled:opacity-40">
                      Ajouter
                    </button>
                    <button type="button" onClick={() => setQuestions((list) => list?.filter((x) => x !== q) ?? null)} className="inline-flex min-h-10 items-center rounded-xl px-3 text-xs text-slate-500 hover:bg-slate-100">
                      Passer
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Questions traitées : vous pouvez rédiger votre journée.</p>
          )}
          <button type="button" disabled={!!busy || recorder.recording} onClick={() => void write()} className="inline-flex min-h-12 items-center gap-2 rounded-2xl bg-gradient-to-r from-indigo-600 to-sky-600 px-5 text-sm font-black text-white shadow-lg shadow-indigo-500/30 disabled:opacity-60">
            {busy === "redaction" ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <Sparkles size={18} aria-hidden />} Rédiger ma journée (1 à 2 pages)
          </button>
        </div>
      ) : null}

      {draft ? (
        <div className="space-y-3">
          <p className="text-sm font-bold text-slate-900">Votre journée rédigée — relisez-la, modifiez-la si besoin, puis validez</p>
          {draft.unverified.length ? (
            <p className="rounded-xl bg-amber-50 p-3 text-xs text-amber-900">
              <span className="font-bold">À vérifier</span> (vous ne l&apos;avez pas dit) : {draft.unverified.join(", ")}. Supprimez ou corrigez ce qui est inexact.
            </p>
          ) : null}
          {editing ? (
            <textarea className="block min-h-72 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-900 shadow-sm outline-none focus:border-violet-400 focus:ring-4 focus:ring-violet-100 sm:text-sm" value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} aria-label="Journée rédigée" />
          ) : (
            <Preview text={draft.text} flagged={draft.unverified} />
          )}
          <p className="text-xs text-slate-500">
            {draft.text.trim().split(/\s+/).filter(Boolean).length} mots — environ {Math.max(1, Math.round(draft.text.trim().split(/\s+/).length / 450))} page(s).
          </p>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEditing((e) => !e)} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 hover:bg-slate-50">
              <PenLine size={16} aria-hidden /> {editing ? "Voir l'aperçu" : "Modifier le texte"}
            </button>
            <button type="button" disabled={!!busy || draft.text.trim().length < ACTIVITIES_MIN} onClick={() => void validate()} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-lg shadow-emerald-500/30 disabled:opacity-60">
              {busy === "enregistrement" ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <BadgeCheck size={16} aria-hidden />} Valider ma journée
            </button>
            <button type="button" disabled={!!busy} onClick={() => setDraft(null)} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-100">
              Annuler
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-xl bg-rose-50 p-3 text-sm text-rose-900" role="alert">
          {error}
        </p>
      ) : null}
      {pending && !busy && !recorder.recording ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => upload(pending)} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-violet-600 px-4 text-sm font-bold text-white">
            <RotateCcw size={16} aria-hidden /> Renvoyer ma note ({clock(pending.seconds)})
          </button>
          <button type="button" onClick={() => setPending(null)} className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm text-slate-600 hover:bg-slate-100">
            Effacer cet enregistrement
          </button>
        </div>
      ) : null}
    </div>
  );
}
