"use client";

import { useEffect, useRef } from "react";
import { Palette } from "lucide-react";

import { PALETTE_PRESETS } from "@/lib/core/export/palette";
import { paletteOf, setPaletteChoice, usePaletteChoice } from "@/lib/ui/chartTheme";

/** Choix des couleurs des graphiques : palettes prêtes à l'emploi ou couleurs personnalisées. */
export function PalettePicker() {
  const choice = usePaletteChoice();
  const current = paletteOf(choice);
  const ref = useRef<HTMLDetailsElement>(null);
  // Fermeture par Échap ou par un clic en dehors du panneau.
  useEffect(() => {
    const close = (event: Event) => {
      const details = ref.current;
      if (!details?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !details.contains(event.target as Node)) details.open = false;
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  return (
    <details ref={ref} className="no-print group relative">
      <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-xl bg-white px-3 text-sm font-semibold text-slate-700 shadow-sm ring-1 ring-slate-200 transition hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
        <Palette size={16} aria-hidden className="text-indigo-600" />
        Couleurs des graphiques
        <span className="flex" aria-hidden>
          {current.slice(0, 5).map((c, i) => (
            <span key={`${c}-${i}`} className="-ml-1 h-4 w-4 rounded-full ring-2 ring-white first:ml-0" style={{ background: c }} />
          ))}
        </span>
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-[min(92vw,22rem)] rounded-2xl border border-slate-200 bg-white p-3 shadow-xl">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Palettes</p>
        <div className="space-y-1">
          {PALETTE_PRESETS.map((preset) => (
            <label key={preset.id} className={`flex cursor-pointer items-center gap-3 rounded-xl p-2 text-sm ${choice.preset === preset.id ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"}`}>
              <input type="radio" name="acadia-palette" className="h-4 w-4" checked={choice.preset === preset.id} onChange={() => setPaletteChoice({ ...choice, preset: preset.id })} />
              <span className="flex shrink-0" aria-hidden>
                {preset.colors.slice(0, 6).map((c) => (
                  <span key={c} className="h-5 w-4 first:rounded-l-md last:rounded-r-md" style={{ background: c }} />
                ))}
              </span>
              <span className="min-w-0 text-slate-700">{preset.label}</span>
            </label>
          ))}
          <label className={`flex cursor-pointer items-center gap-3 rounded-xl p-2 text-sm ${choice.preset === "custom" ? "bg-indigo-50 ring-1 ring-indigo-200" : "hover:bg-slate-50"}`}>
            <input type="radio" name="acadia-palette" className="h-4 w-4" checked={choice.preset === "custom"} onChange={() => setPaletteChoice({ ...choice, preset: "custom" })} />
            <span className="text-slate-700">Mes couleurs</span>
          </label>
        </div>
        {choice.preset === "custom" ? (
          <div className="mt-3 border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs text-slate-500">Cliquez sur une pastille pour choisir la couleur de chaque modalité (dans l&apos;ordre).</p>
            <div className="flex flex-wrap gap-2">
              {choice.custom.map((color, i) => (
                <label key={i} className="flex flex-col items-center gap-1 text-xs text-slate-500">
                  <input
                    type="color"
                    value={color}
                    aria-label={`Couleur ${i + 1}`}
                    className="h-9 w-9 cursor-pointer rounded-lg border border-slate-200 bg-white p-0.5"
                    onChange={(e) => setPaletteChoice({ preset: "custom", custom: choice.custom.map((c, k) => (k === i ? e.target.value : c)) })}
                  />
                  {i + 1}
                </label>
              ))}
            </div>
          </div>
        ) : null}
        <p className="mt-3 text-xs text-slate-500">Le choix s&apos;applique à l&apos;écran et aux fichiers Word, Excel et PDF ; il est mémorisé dans ce navigateur.</p>
      </div>
    </details>
  );
}
