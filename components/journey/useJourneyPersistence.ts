"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { gzipSync } from "fflate";

import type { JourneySnapshot, SessionSummary } from "@/lib/core/journey/persistence";
import { hashKey } from "@/lib/core/understanding/text";

/** État de la sauvegarde, affiché en permanence dans l'en-tête du parcours. */
export type SaveStatus = "local" | "saving" | "saved" | "error" | "conflict" | "unavailable";

export const SAVE_LABELS: Record<SaveStatus, string> = {
  local: "Pas encore enregistrée",
  saving: "Enregistrement…",
  saved: "Enregistrée dans votre compte",
  error: "Non enregistrée (nouvel essai à la prochaine modification)",
  conflict: "Modifiée dans un autre onglet",
  unavailable: "Sauvegarde indisponible : données perdues au rechargement",
};

export interface PersistenceInput {
  sessionId: string | null;
  revision: number;
  snapshot: JourneySnapshot;
  title: string;
  stage: string;
  summary: SessionSummary | null;
  /** Rien n'est créé tant que le chercheur n'a pas commencé (domaine confirmé ou recherche analysée). */
  enabled: boolean;
  /** Pendant la reprise du fichier, la sauvegarde attend (pour ne pas écraser l'état enregistré). */
  paused: boolean;
}

export function useJourneyPersistence(input: PersistenceInput) {
  const sessionId = useRef<string | null>(input.sessionId);
  const revision = useRef(input.revision);
  const creating = useRef(false);
  const [status, setStatus] = useState<SaveStatus>(input.sessionId ? "saved" : "local");
  const [message, setMessage] = useState<string | null>(null);
  const [currentId, setCurrentId] = useState<string | null>(input.sessionId);
  const fingerprint = hashKey([input.snapshot, input.title, input.stage, input.summary]);
  // Empreinte de l'état enregistré : à la reprise, l'état chargé est déjà enregistré.
  const [savedFingerprint, setSavedFingerprint] = useState<string | null>(() => (input.sessionId ? fingerprint : null));

  const save = useCallback(async () => {
    const body = { title: input.title, stage: input.stage, payload: input.snapshot };
    try {
      if (!sessionId.current) {
        if (creating.current) return;
        creating.current = true;
        const id = crypto.randomUUID();
        const res = await fetch("/api/journey/sessions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, ...body }) });
        creating.current = false;
        if (res.status === 201) {
          sessionId.current = id;
          revision.current = 0;
          setCurrentId(id);
          // Même page, URL partageable pour reprendre plus tard (sans recharger ni remonter le composant).
          window.history.replaceState(null, "", `${window.location.pathname}?s=${id}`);
          // L'état complet (avec le résumé) est envoyé juste après.
          const put = await fetch(`/api/journey/sessions/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, revision: 0, summary: input.summary }) });
          if (put.ok) revision.current = (await put.json()).revision;
          setSavedFingerprint(fingerprint);
          setStatus("saved");
          return;
        }
        return handleFailure(res);
      }
      const res = await fetch(`/api/journey/sessions/${sessionId.current}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, revision: revision.current, summary: input.summary }) });
      if (res.ok) {
        revision.current = (await res.json()).revision;
        setSavedFingerprint(fingerprint);
        setStatus("saved");
        setMessage(null);
        return;
      }
      return handleFailure(res);
    } catch {
      creating.current = false;
      setStatus("error");
      setMessage("Connexion au serveur impossible.");
    }
    async function handleFailure(res: Response) {
      const data = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
      setMessage(data.error ?? null);
      if (res.status === 503 || res.status === 401) setStatus("unavailable");
      else if (res.status === 409 && data.code === "conflict") setStatus("conflict");
      else setStatus("error");
    }
  }, [input.title, input.stage, input.snapshot, input.summary, fingerprint]);

  useEffect(() => {
    if (!input.enabled || input.paused || status === "unavailable" || status === "conflict") return;
    if (fingerprint === savedFingerprint) return;
    const timer = window.setTimeout(() => {
      setStatus("saving");
      void save();
    }, 1500);
    return () => window.clearTimeout(timer);
  }, [fingerprint, savedFingerprint, input.enabled, input.paused, status, save]);

  /** Copie privée du fichier de données (avec consentement), pour reprendre sans réimporter. */
  const uploadFile = useCallback(async (bytes: Uint8Array, name: string, format: "csv" | "xlsx", sha256: string): Promise<{ ok: boolean; message?: string }> => {
    if (!sessionId.current) return { ok: false, message: "Interprétation pas encore enregistrée." };
    const payload = format === "csv" ? gzipSync(bytes) : bytes;
    const form = new FormData();
    form.append("file", new Blob([payload as BlobPart]), name);
    form.append("sha256", sha256);
    form.append("format", format === "csv" ? "csv-gzip" : "xlsx");
    form.append("name", name);
    try {
      const res = await fetch(`/api/journey/sessions/${sessionId.current}/file`, { method: "PUT", body: form });
      if (res.ok) return { ok: true };
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      return { ok: false, message: data.error ?? "Fichier non conservé." };
    } catch {
      return { ok: false, message: "Connexion au serveur impossible : fichier non conservé." };
    }
  }, []);

  return { status, message, sessionId: currentId, uploadFile, sessionIdRef: sessionId };
}
