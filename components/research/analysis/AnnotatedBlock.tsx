"use client";

import { useState } from "react";
import { CheckCircle2, Pencil, RotateCcw } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";
import type { ValidationStatus } from "@/lib/core/analysis/EconomicInterpretationTypes";

const STATUS_LABELS: Record<ValidationStatus, string> = {
  generated: "Généré par ACADIA",
  needs_review: "À revoir",
  accepted: "Accepté par le chercheur",
  edited: "Modifié par le chercheur",
};

const STATUS_STYLES: Record<ValidationStatus, string> = {
  generated: "bg-slate-100 text-slate-500",
  needs_review: "bg-amber-50 text-amber-700",
  accepted: "bg-emerald-50 text-emerald-700",
  edited: "bg-acadia-blue-50 text-acadia-blue",
};

/**
 * Bloc de texte interprétatif éditable/validable — l'unité de base
 * réutilisée par P9 (interprétation économique) et P10 (discussion
 * scientifique). Le texte généré vient de `statements` (jamais
 * perdu) ; une édition humaine persistée (via ResearchContext.
 * annotations) prend le pas sur l'affichage, mais n'écrase jamais
 * `statements` lui-même — un nouveau calcul de P9/P10 régénère
 * toujours le même texte de base, seule la couche d'annotation
 * décide de ce qui est réellement affiché.
 */
export default function AnnotatedBlock({
  researchId,
  blockId,
  title,
  statements,
  validateLabel = "Valider cette interprétation",
  compact = false,
}: {
  researchId: string;
  blockId: string;
  title: string;
  statements: string[];
  validateLabel?: string;
  compact?: boolean;
}) {
  const { annotations, setAnnotation } = useResearch();
  const record = annotations[researchId]?.[blockId];
  const status: ValidationStatus = record?.status ?? "generated";

  const [editing, setEditing] = useState(false);
  const generatedText = statements.join("\n\n");
  const [draft, setDraft] = useState(record?.editedContent ?? generatedText);

  const displayText = record?.editedContent ?? generatedText;

  function startEditing() {
    setDraft(record?.editedContent ?? generatedText);
    setEditing(true);
  }

  function saveEdit() {
    setAnnotation(researchId, blockId, {
      status: "edited",
      editedContent: draft,
    });
    setEditing(false);
  }

  function accept() {
    // Capture le texte affiché au moment de l'acceptation (édité ou généré) —
    // rend l'enregistrement autonome, indispensable pour qu'un futur bloc
    // (ex. P11, compilation du document scientifique) puisse relire ce qui a
    // été validé sans avoir à recalculer P7/P8/P9/P10 à l'identique.
    setAnnotation(researchId, blockId, { status: "accepted", editedContent: displayText });
  }

  function reject() {
    setAnnotation(researchId, blockId, { status: "needs_review" });
  }

  return (
    <div className={compact ? "rounded-xl bg-white p-3 ring-1 ring-slate-200" : "rounded-2xl border border-slate-200/90 bg-white p-4"}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className={compact ? "text-xs font-semibold text-acadia-navy" : "text-sm font-bold text-acadia-navy"}>{title}</p>
        <span className={`rounded-full px-2.5 py-0.5 text-2xs font-semibold ${STATUS_STYLES[status]}`}>{STATUS_LABELS[status]}</span>
      </div>

      {editing ? (
        <div className="mt-2 space-y-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.max(3, statements.length + 1)}
            className="w-full rounded-xl border border-slate-300 p-2.5 text-sm text-slate-800 focus:border-acadia-blue focus:outline-none"
          />
          <div className="flex gap-2">
            <button type="button" onClick={saveEdit} className="rounded-lg bg-acadia-blue px-3 py-1.5 text-xs font-semibold text-white hover:brightness-110">
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600"
            >
              Annuler
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-2 space-y-1.5">
          {displayText.split("\n\n").map((paragraph, i) => (
            <p key={i} className="text-sm text-slate-700">
              {paragraph}
            </p>
          ))}
        </div>
      )}

      {!editing && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={startEditing}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-2xs font-semibold text-slate-600 hover:border-acadia-blue hover:text-acadia-blue"
          >
            <Pencil className="h-3 w-3" /> Modifier
          </button>
          {status !== "accepted" && (
            <button
              type="button"
              onClick={accept}
              className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1 text-2xs font-semibold text-emerald-700 hover:bg-emerald-100"
            >
              <CheckCircle2 className="h-3 w-3" /> {validateLabel}
            </button>
          )}
          {status !== "needs_review" && (
            <button
              type="button"
              onClick={reject}
              className="inline-flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1 text-2xs font-semibold text-amber-700 hover:bg-amber-100"
            >
              <RotateCcw className="h-3 w-3" /> Rejeter
            </button>
          )}
        </div>
      )}

      {status === "accepted" && (
        <p className="mt-2 text-2xs text-slate-400">
          Validé signifie que le chercheur accepte cette formulation — pas qu&apos;ACADIA a démontré sa vérité
          scientifique.
        </p>
      )}
    </div>
  );
}
