/**
 * « L'état de l'entreprise » : verdict par dimension (liquidité, solvabilité, rentabilité, activité,
 * équilibre financier) et verdict global, avec leurs raisons chiffrées. Règles déterministes, affichées
 * à l'étudiant ; jamais un audit ni un avis d'expert-comptable.
 */
import { isDeterioration, type FinanceComputation, type IndicatorSeries, type Zone } from "./compute";
import { bandsText, formatValue } from "./format";
import { DIMENSION_LABELS, DIMENSION_ORDER, type DimensionId } from "./indicators/types";
import { SECTOR_LABELS, type FinanceDossier } from "./types";

export type Level = "saine" | "plutot_saine" | "fragile" | "difficulte" | "non_etabli";

export const LEVEL_LABELS: Record<Level, string> = {
  saine: "Saine",
  plutot_saine: "Plutôt saine",
  fragile: "Fragile",
  difficulte: "En difficulté",
  non_etabli: "Non établi (données insuffisantes)",
};

const RANKED: Exclude<Level, "non_etabli">[] = ["saine", "plutot_saine", "fragile", "difficulte"];
const rank = (level: Level) => RANKED.indexOf(level as Exclude<Level, "non_etabli">);
const levelOf = (score: number): Exclude<Level, "non_etabli"> => (score >= 0.5 ? "saine" : score >= 0 ? "plutot_saine" : score >= -0.5 ? "fragile" : "difficulte");
const atLeast = (level: Level, minimum: Exclude<Level, "non_etabli">): Level => (level === "non_etabli" ? level : RANKED[Math.max(rank(level), rank(minimum))]);

const ZONE_SCORE: Record<Zone, number> = { favorable: 1, vigilance: 0, defavorable: -1 };

export interface Contribution {
  id: string;
  label: string;
  value: number;
  zone: Zone;
  score: number;
  weight: number;
  deteriorating: boolean;
  sentence: string;
}

export interface DimensionVerdict {
  id: DimensionId;
  label: string;
  level: Level;
  score: number | null;
  /** Part du poids des indicateurs effectivement calculés. */
  coverage: number;
  contributions: Contribution[];
  /** Seuils rédhibitoires déclenchés. */
  caps: string[];
  reasons: string[];
}

export interface ExerciseDiagnosis {
  index: number;
  label: string;
  level: Level;
  score: number | null;
  dimensions: DimensionVerdict[];
}

export interface Diagnosis {
  byExercise: ExerciseDiagnosis[];
  latest: ExerciseDiagnosis;
  trajectory: "amelioration" | "degradation" | "stable" | null;
  headline: string;
  reasons: string[];
}

export const DIAGNOSIS_METHOD: string[] = [
  "Chaque indicateur clé est classé favorable (+1), à surveiller (0) ou défavorable (−1) selon un repère usuel, ajusté au secteur de l'entreprise.",
  "Un indicateur qui se dégrade deux exercices de suite perd un demi-point.",
  "Chaque dimension reçoit la moyenne pondérée de ses indicateurs : 0,5 et plus « saine », de 0 à 0,5 « plutôt saine », de −0,5 à 0 « fragile », en dessous « en difficulté ».",
  "Si moins de la moitié des indicateurs d'une dimension est calculable, la dimension est « non établie » : ACADIA ne conclut pas sans données.",
  "Seuils rédhibitoires : capitaux propres négatifs ou nuls, capitaux propres inférieurs à la moitié du capital, EBE négatif, pertes deux années de suite, fonds de roulement et trésorerie tous deux négatifs, liquidité générale inférieure à 0,7.",
  "Le verdict global est la moyenne des dimensions établies ; il ne peut pas être meilleur que la pire dimension de plus d'un niveau.",
];

function sentenceOf(series: IndicatorSeries, index: number, labels: string[], dossier: FinanceDossier): string {
  const def = series.def;
  const value = series.values[index].value!;
  const zone = series.values[index].zone!;
  const first = series.values.findIndex((v) => v.value !== null);
  const history = first >= 0 && first < index ? `, contre ${formatValue(series.values[first].value, def.unit, dossier.company)} en ${labels[first]}` : "";
  const repere = bandsText(def, series.bands);
  const repereText = repere ? ` (repère usuel${def.norms?.bySector?.[dossier.company.sector] ? ` pour ${SECTOR_LABELS[dossier.company.sector].split(" (")[0].toLowerCase()}` : ""} : ${repere})` : "";
  const reading = def.reading[zone];
  return `${def.label} : ${formatValue(value, def.unit, dossier.company)} en ${labels[index]}${history}${repereText}${reading ? ` — ${reading}` : ""}.`;
}

export function diagnose(computation: FinanceComputation, dossier: FinanceDossier): Diagnosis | null {
  const { exercises, series, values } = computation;
  if (!exercises.length) return null;
  const labels = exercises.map((e) => e.label);
  const byExercise: ExerciseDiagnosis[] = exercises.map((exercise, index) => {
    const v = values[index];
    const val = (code: string) => v[code]?.value ?? null;
    const dimensions: DimensionVerdict[] = DIMENSION_ORDER.map((dimension) => {
      const members = Object.values(series).filter((s) => s.def.dimension === dimension);
      const totalWeight = members.reduce((acc, s) => acc + (s.def.weight ?? 1), 0);
      const contributions: Contribution[] = [];
      for (const s of members) {
        const point = s.values[index];
        if (point.value === null || point.zone === null) continue;
        const deteriorating = index >= 2 && isDeterioration(s, index - 2, index - 1) && isDeterioration(s, index - 1, index);
        const score = Math.max(-1, ZONE_SCORE[point.zone] - (deteriorating ? 0.5 : 0));
        contributions.push({ id: s.def.id, label: s.def.label, value: point.value, zone: point.zone, score, weight: s.def.weight ?? 1, deteriorating, sentence: sentenceOf(s, index, labels, dossier) });
      }
      const computedWeight = contributions.reduce((acc, c) => acc + c.weight, 0);
      const coverage = totalWeight ? computedWeight / totalWeight : 0;
      const score = computedWeight ? contributions.reduce((acc, c) => acc + c.score * c.weight, 0) / computedWeight : null;
      let level: Level = coverage < 0.5 || score === null ? "non_etabli" : levelOf(score);
      const caps: string[] = [];
      const cp = val("CP");
      const capital = val("CA");
      if (dimension === "solvabilite" && cp !== null) {
        if (cp <= 0) {
          caps.push("capitaux propres négatifs ou nuls");
          level = level === "non_etabli" ? "difficulte" : atLeast(level, "difficulte");
        } else if (capital && capital > 0 && cp < capital / 2) {
          caps.push("capitaux propres inférieurs à la moitié du capital (alerte OHADA)");
          level = atLeast(level, "fragile");
        }
      }
      if (dimension === "rentabilite") {
        const ebe = val("XD");
        if (ebe !== null && ebe < 0) {
          caps.push("excédent brut d'exploitation négatif");
          level = level === "non_etabli" ? "difficulte" : atLeast(level, "difficulte");
        }
        const rn = val("XI");
        const previous = index > 0 ? (values[index - 1].XI?.value ?? null) : null;
        if (rn !== null && rn < 0 && previous !== null && previous < 0) {
          caps.push("pertes deux exercices de suite");
          level = atLeast(level, "fragile");
        }
      }
      if (dimension === "equilibre") {
        const fr = series.fr?.values[index].value ?? null;
        const tn = series.tn?.values[index].value ?? null;
        if (fr !== null && tn !== null && fr < 0 && tn < 0) {
          caps.push("fonds de roulement et trésorerie tous deux négatifs");
          level = atLeast(level, "fragile");
        }
      }
      if (dimension === "liquidite") {
        const lg = series.lg?.values[index].value ?? null;
        if (lg !== null && lg < 0.7) {
          caps.push("liquidité générale inférieure à 0,7");
          level = level === "non_etabli" ? "difficulte" : atLeast(level, "difficulte");
        }
      }
      // Raisons : d'abord ce qui explique le niveau (défavorable si le niveau est mauvais, favorable sinon).
      const adverse = level === "fragile" || level === "difficulte";
      const ordered = [...contributions].sort((a, b) => (adverse ? a.score - b.score : b.score - a.score) || b.weight - a.weight);
      const reasons = [...caps.map((c) => `Seuil rédhibitoire : ${c}.`), ...ordered.slice(0, 2).map((c) => c.sentence)];
      return { id: dimension, label: DIMENSION_LABELS[dimension], level, score, coverage, contributions, caps, reasons };
    });
    const established = dimensions.filter((d) => d.level !== "non_etabli");
    let level: Level = "non_etabli";
    let score: number | null = null;
    if (established.length >= 3) {
      score = established.reduce((acc, d) => acc + (d.score ?? -1), 0) / established.length;
      level = levelOf(score);
      const worst = Math.max(...established.map((d) => rank(d.level)));
      level = RANKED[Math.max(rank(level), worst - 1)];
      if (dimensions.find((d) => d.id === "solvabilite")?.level === "difficulte") level = atLeast(level, "fragile");
    }
    return { index, label: exercise.label, level, score, dimensions };
  });
  const latest = byExercise.at(-1)!;
  const first = byExercise[0];
  let trajectory: Diagnosis["trajectory"] = null;
  if (byExercise.length > 1 && latest.score !== null && first.score !== null) {
    const delta = latest.score - first.score;
    trajectory = delta < -0.25 ? "degradation" : delta > 0.25 ? "amelioration" : "stable";
  }
  const trajectoryText = trajectory === "degradation" ? ", en dégradation" : trajectory === "amelioration" ? ", en amélioration" : trajectory === "stable" ? ", situation stable" : "";
  const headline =
    latest.level === "non_etabli"
      ? `État de l'entreprise non établi en ${latest.label} : données insuffisantes`
      : `${LEVEL_LABELS[latest.level]} en ${latest.label}${byExercise.length > 1 && first.level !== "non_etabli" && first.level !== latest.level ? ` (${LEVEL_LABELS[first.level].toLowerCase()} en ${first.label})` : ""}${trajectoryText}`;
  const worstFirst = [...latest.dimensions].filter((d) => d.level !== "non_etabli").sort((a, b) => rank(b.level) - rank(a.level));
  const reasons = (latest.level === "saine" || latest.level === "plutot_saine" ? [...worstFirst].reverse() : worstFirst).flatMap((d) => d.reasons.slice(0, 1)).slice(0, 3);
  return { byExercise, latest, trajectory, headline, reasons };
}
