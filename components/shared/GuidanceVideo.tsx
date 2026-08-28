"use client";

// ============================================================
// P13.14 — Guidage vidéo réutilisable dans le produit. Jamais
// obligatoire : toujours un complément optionnel ("Besoin d'aide ?"),
// jamais un blocage. Aucune vidéo fictive tant que `videoUrl`
// n'est pas fourni.
// ============================================================

import { useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { VideoContentPlayer } from "./VideoContent";

export interface GuidanceVideoProps {
  title: string;
  description?: string;
  videoUrl?: string;
  poster?: string;
  duration?: string;
  /** Texte du déclencheur — par défaut "Voir comment faire". */
  triggerLabel?: string;
}

export default function GuidanceVideo({ title, description, videoUrl, poster, duration, triggerLabel = "Voir comment faire" }: GuidanceVideoProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className="inline-block">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full bg-acadia-blue-50 px-3 py-1.5 text-xs font-semibold text-acadia-blue transition hover:bg-acadia-blue-100"
      >
        <HelpCircle className="h-3.5 w-3.5" /> {triggerLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-acadia-navy/60 p-4" onClick={() => setOpen(false)}>
          <div className="w-full max-w-lg rounded-3xl bg-white p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-acadia-navy">Besoin d&apos;aide ?</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Fermer" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mt-3">
              <VideoContentPlayer title={title} description={description} videoUrl={videoUrl} poster={poster} duration={duration} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
