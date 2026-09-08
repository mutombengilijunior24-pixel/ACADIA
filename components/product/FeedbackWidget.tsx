"use client";

// ============================================================
// ACADIA — WIDGET FEEDBACK CONTEXTUEL (Bloc 2, 08/09/2026)
//
// Bouton flottant "Un problème ? Donner un retour" disponible sur
// tout le dashboard (monté depuis MainLayout). Capture automatiquement
// le contexte (page, step déduit de l'URL) — l'utilisateur ne
// retape jamais ce qu'ACADIA sait déjà (voir mission §7).
// ============================================================

import { useState } from "react";
import { usePathname, useParams } from "next/navigation";
import { MessageCircleQuestion, X } from "lucide-react";

type FeedbackType = "problem" | "suggestion" | "question" | "satisfaction";
type BlockingLevel = "can_continue" | "hinders" | "blocks";

const TYPE_OPTIONS: { value: FeedbackType; label: string }[] = [
  { value: "problem", label: "Problème" },
  { value: "suggestion", label: "Suggestion" },
  { value: "question", label: "Question" },
  { value: "satisfaction", label: "Satisfaction" },
];

const BLOCKING_OPTIONS: { value: BlockingLevel; label: string }[] = [
  { value: "can_continue", label: "Je peux continuer" },
  { value: "hinders", label: "Cela me gêne" },
  { value: "blocks", label: "Cela me bloque complètement" },
];

function deriveStep(pathname: string): string | undefined {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length > 0 ? segments[segments.length - 1] : undefined;
}

export default function FeedbackWidget() {
  const pathname = usePathname() || "";
  const params = useParams();
  const projectId = typeof params?.id === "string" ? params.id : undefined;

  const [open, setOpen] = useState(false);
  const [type, setType] = useState<FeedbackType>("problem");
  const [message, setMessage] = useState("");
  const [blockingLevel, setBlockingLevel] = useState<BlockingLevel | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setType("problem");
    setMessage("");
    setBlockingLevel(undefined);
    setSent(false);
    setError(null);
  }

  function handleClose() {
    setOpen(false);
    setTimeout(reset, 200);
  }

  async function handleSubmit() {
    if (!message.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/product/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          message: message.trim(),
          blockingLevel: type === "problem" ? blockingLevel : undefined,
          page: pathname,
          projectId,
          step: deriveStep(pathname),
        }),
      });
      if (!res.ok) throw new Error("failed");
      setSent(true);
    } catch {
      setError("Envoi impossible. Réessayez dans un instant.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-blue-600 px-4 py-3 text-sm font-medium text-white shadow-lg transition hover:bg-blue-700 sm:bottom-6 sm:right-6"
        aria-label="Un problème ? Donner un retour"
      >
        <MessageCircleQuestion className="h-4 w-4" />
        <span className="hidden sm:inline">Un problème ?</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-6">
          <div className="w-full max-w-md rounded-t-3xl bg-white shadow-2xl sm:rounded-3xl">
            <div className="flex items-center justify-between border-b p-5">
              <h2 className="text-lg font-bold">Donner un retour</h2>
              <button onClick={handleClose} aria-label="Fermer">
                <X className="h-5 w-5" />
              </button>
            </div>

            {sent ? (
              <div className="p-6 text-center">
                <p className="text-base font-medium text-slate-800">
                  Merci. Votre retour a bien été enregistré.
                </p>
                <button
                  onClick={handleClose}
                  className="mt-5 rounded-xl bg-blue-600 px-5 py-3 text-sm text-white"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <div className="space-y-4 p-5">
                <div className="grid grid-cols-2 gap-2">
                  {TYPE_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setType(opt.value)}
                      className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                        type === opt.value
                          ? "border-blue-600 bg-blue-50 text-blue-700"
                          : "border-slate-200 text-slate-600"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Que souhaitez-vous nous signaler ?
                  </label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    rows={4}
                    className="w-full rounded-xl border border-slate-200 p-3 text-sm"
                    placeholder="Décrivez votre retour..."
                  />
                </div>

                {type === "problem" && (
                  <div>
                    <label className="mb-1 block text-sm font-medium text-slate-700">
                      À quel point cela vous bloque-t-il ?
                    </label>
                    <div className="space-y-1">
                      {BLOCKING_OPTIONS.map((opt) => (
                        <label key={opt.value} className="flex items-center gap-2 text-sm text-slate-600">
                          <input
                            type="radio"
                            name="blockingLevel"
                            checked={blockingLevel === opt.value}
                            onChange={() => setBlockingLevel(opt.value)}
                          />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}

                <div className="flex justify-end gap-3 pt-1">
                  <button
                    onClick={handleClose}
                    className="rounded-xl border px-4 py-2 text-sm"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={submitting || !message.trim()}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-50"
                  >
                    {submitting ? "Envoi..." : "Envoyer"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
