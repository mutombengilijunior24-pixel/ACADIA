"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Petite aide pédagogique (P8.47) — chaque notion économétrique doit
 * pouvoir être comprise sans quitter l'application. Reste volontairement
 * courte : un rappel, pas un cours.
 */
export default function EconometricInfoTip({ label, text }: { label: string; text: string }) {
  const [open, setOpen] = useState(false);

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="ml-1 inline-flex items-center text-slate-300 hover:text-acadia-blue"
        aria-label={`Que signifie ${label} ?`}
      >
        <HelpCircle className="h-3 w-3" />
      </button>
      {open && (
        <span className="absolute bottom-full left-1/2 z-10 mb-1.5 w-56 -translate-x-1/2 rounded-lg bg-acadia-navy px-3 py-2 text-2xs font-normal normal-case text-white shadow-lg">
          <strong>{label}</strong> — {text}
        </span>
      )}
    </span>
  );
}
