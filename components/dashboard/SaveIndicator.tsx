"use client";

// ============================================================
// ACADIA — INDICATEUR DE SAUVEGARDE (passe UX)
//
// Reflète exactement contexts/ResearchContext.tsx `saveStatus` —
// jamais "Enregistré" avant une confirmation HTTP réelle du PUT
// /api/research-state. Discret : pas de toast, pas d'animation
// intrusive, disparaît de lui-même après un enregistrement réussi.
// ============================================================

import { useEffect, useState } from "react";
import { Loader2, Check, AlertTriangle } from "lucide-react";
import { useResearch } from "@/contexts/ResearchContext";

export default function SaveIndicator() {
  const { saveStatus } = useResearch();
  const [hideSaved, setHideSaved] = useState(false);

  useEffect(() => {
    // Toujours différé (jamais un setState synchrone en tête d'effet) :
    // "saved" programme la disparition après un délai discret ; tout
    // autre statut réarme l'affichage pour le prochain cycle.
    const delay = saveStatus === "saved" ? 2500 : 0;
    const t = setTimeout(() => setHideSaved(saveStatus === "saved"), delay);
    return () => clearTimeout(t);
  }, [saveStatus]);

  if (saveStatus === "idle") return null;
  if (saveStatus === "saved" && hideSaved) return null;

  if (saveStatus === "saving") {
    return (
      <span className="hidden items-center gap-1.5 text-xs font-medium text-slate-400 sm:inline-flex">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Enregistrement...
      </span>
    );
  }

  if (saveStatus === "saved") {
    return (
      <span className="hidden items-center gap-1.5 text-xs font-medium text-emerald-600 sm:inline-flex">
        <Check className="h-3.5 w-3.5" /> Enregistré
      </span>
    );
  }

  return (
    <span className="hidden items-center gap-1.5 text-xs font-medium text-red-600 sm:inline-flex">
      <AlertTriangle className="h-3.5 w-3.5" /> Échec de l&apos;enregistrement
    </span>
  );
}
