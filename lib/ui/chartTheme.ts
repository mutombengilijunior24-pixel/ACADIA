"use client";

/**
 * Palette de graphiques choisie par l'utilisateur, mémorisée dans ce navigateur (préférence personnelle).
 * Petit magasin partagé : tous les graphiques et exports de la page se mettent à jour ensemble.
 */
import { useSyncExternalStore } from "react";

import { DEFAULT_PALETTE, normalizePalette, PALETTE_PRESETS } from "@/lib/core/export/palette";

const KEY = "acadia-chart-palette-v1";

export interface PaletteChoice {
  preset: string;
  custom: string[];
}

const DEFAULT_CHOICE: PaletteChoice = { preset: "acadia", custom: DEFAULT_PALETTE.slice(0, 6) };
const listeners = new Set<() => void>();
let cachedRaw: string | null | undefined;
let cachedChoice: PaletteChoice = DEFAULT_CHOICE;

function read(): PaletteChoice {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) return cachedChoice;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<PaletteChoice>) : null;
    cachedChoice = parsed && typeof parsed.preset === "string" ? { preset: parsed.preset, custom: normalizePalette(parsed.custom).slice(0, 6) } : DEFAULT_CHOICE;
  } catch {
    cachedChoice = DEFAULT_CHOICE;
  }
  return cachedChoice;
}

export function setPaletteChoice(choice: PaletteChoice) {
  try {
    localStorage.setItem(KEY, JSON.stringify(choice));
  } catch {
    // Stockage indisponible : le choix vaut pour cette page seulement.
    cachedRaw = JSON.stringify(choice);
    cachedChoice = choice;
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function usePaletteChoice(): PaletteChoice {
  return useSyncExternalStore(subscribe, read, () => DEFAULT_CHOICE);
}

export function paletteOf(choice: PaletteChoice): string[] {
  if (choice.preset === "custom") return normalizePalette(choice.custom);
  return PALETTE_PRESETS.find((p) => p.id === choice.preset)?.colors ?? DEFAULT_PALETTE;
}

/** Couleurs en vigueur pour les graphiques. */
export function useChartPalette(): string[] {
  return paletteOf(usePaletteChoice());
}
