/**
 * Couleurs des graphiques ACADIA — partagées par l'écran (Recharts), le rapport imprimable
 * et les graphiques natifs de Word et d'Excel. L'utilisateur choisit une palette ou compose la sienne.
 */

export interface PalettePreset {
  id: string;
  label: string;
  colors: string[];
}

export const PALETTE_PRESETS: PalettePreset[] = [
  { id: "acadia", label: "ACADIA (contrastée)", colors: ["#4f46e5", "#f59e0b", "#10b981", "#f43f5e", "#0ea5e9", "#8b5cf6", "#14b8a6", "#f97316", "#ec4899", "#64748b"] },
  { id: "arc-en-ciel", label: "Arc-en-ciel", colors: ["#e11d48", "#f97316", "#facc15", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#d946ef", "#a3e635", "#78716c"] },
  { id: "pastel", label: "Pastel", colors: ["#93c5fd", "#fca5a5", "#86efac", "#fcd34d", "#c4b5fd", "#f9a8d4", "#5eead4", "#fdba74", "#a5b4fc", "#cbd5e1"] },
  { id: "terre", label: "Terre et nature", colors: ["#7c2d12", "#b45309", "#65a30d", "#0f766e", "#a16207", "#57534e", "#9a3412", "#4d7c0f", "#155e75", "#a8a29e"] },
  { id: "ocean", label: "Océan", colors: ["#0c4a6e", "#0284c7", "#06b6d4", "#14b8a6", "#38bdf8", "#1e40af", "#5eead4", "#0369a1", "#67e8f9", "#94a3b8"] },
  { id: "daltonien", label: "Lisible pour tous (daltonisme)", colors: ["#0072b2", "#e69f00", "#009e73", "#d55e00", "#56b4e9", "#cc79a7", "#f0e442", "#000000", "#999999", "#882255"] },
  { id: "sobre", label: "Sobre (impression)", colors: ["#1e293b", "#64748b", "#94a3b8", "#475569", "#cbd5e1", "#334155", "#e2e8f0", "#0f172a", "#a1a1aa", "#52525b"] },
];

export const DEFAULT_PALETTE = PALETTE_PRESETS[0].colors;

/** Palette qualitative par défaut (compatibilité). */
export const PALETTE = DEFAULT_PALETTE;

const HEX = /^#[0-9a-f]{6}$/i;

/** Palette valide : couleurs hexadécimales, complétée par la palette par défaut si elle est courte. */
export function normalizePalette(colors: string[] | null | undefined): string[] {
  const valid = (colors ?? []).filter((c) => HEX.test(c)).map((c) => c.toLowerCase());
  return valid.length ? [...valid, ...DEFAULT_PALETTE.filter((c) => !valid.includes(c))].slice(0, 10) : DEFAULT_PALETTE;
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const toHex = (c: number[]) => `#${c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;

/** Échelle séquentielle (modalités ordonnées) : de la teinte claire à la teinte foncée de la 1re couleur. */
export function sequential(n: number, base: string = DEFAULT_PALETTE[0]): string[] {
  const rgb = hexToRgb(HEX.test(base) ? base : DEFAULT_PALETTE[0]);
  const light = rgb.map((v) => v + (255 - v) * 0.72);
  const dark = rgb.map((v) => v * 0.62);
  return Array.from({ length: n }, (_, i) => {
    const t = n === 1 ? 1 : i / (n - 1);
    return toHex(light.map((l, k) => l + (dark[k] - l) * t));
  });
}

/** Couleur i de la palette (cyclique). */
export const colorAt = (palette: string[], i: number) => palette[i % palette.length];
