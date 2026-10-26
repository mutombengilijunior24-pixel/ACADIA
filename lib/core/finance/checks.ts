/**
 * Contrôles comptables des états saisis ou importés. Un écart est SIGNALÉ, jamais corrigé :
 * l'étudiant corrige le chiffre, ou accepte l'écart en le justifiant (il reste alors visible).
 */
import { formatAmount } from "./numbers";
import { exerciseMonths, providedStatements, resolveAll, sortedExercises, type ExerciseValues } from "./statements";
import { POSTE_BY_CODE, POSTES } from "./syscohada/chart";
import type { FinanceDossier } from "./types";

export type CheckStatus = "ok" | "gap";
export type CheckSeverity = "blocking" | "warning";

export interface CheckResult {
  /** Identifiant stable : « type:code:exercice ». */
  key: string;
  label: string;
  exerciseId: string | null;
  status: CheckStatus;
  severity: CheckSeverity;
  expected?: number;
  found?: number;
  gap?: number;
  explanation: string;
  hint?: string;
  codes: string[];
}

/** Tolérance d'arrondi : une demi-unité par montant additionné, ou 0,001 % du total. */
const tolerance = (terms: number, a: number, b: number) => Math.max(0.5 * Math.max(terms, 1), 1e-5 * Math.max(Math.abs(a), Math.abs(b)));

const label = (code: string) => `${POSTE_BY_CODE[code].label} (${code})`;

export function runChecks(dossier: FinanceDossier): CheckResult[] {
  const results: CheckResult[] = [];
  const all = resolveAll(dossier);
  const exercises = sortedExercises(dossier.exercises);
  const compare = (key: string, title: string, exerciseId: string, expected: number, found: number, terms: number, severity: CheckSeverity, explanation: string, hint: string, codes: string[]) => {
    const gap = found - expected;
    results.push({ key, label: title, exerciseId, status: Math.abs(gap) <= tolerance(terms, expected, found) ? "ok" : "gap", severity, expected, found, gap, explanation, hint, codes });
  };

  for (const exercise of exercises) {
    const v: ExerciseValues = all[exercise.id];
    const provided = providedStatements(dossier, exercise.id);
    const ex = exercise.label;

    // 1. Chaque total saisi = somme de ses composantes saisies.
    for (const poste of POSTES) {
      if (poste.kind !== "total") continue;
      const r = v[poste.code];
      if (r.origin !== "saisi" || !r.fromDetail || r.computed === null) continue;
      compare(`total:${poste.code}:${exercise.id}`, `${ex} — ${poste.label}`, exercise.id, r.computed, r.value!, poste.sum!.length, "blocking", `Le total saisi (${formatAmount(r.value)}) ne correspond pas à la somme de ses composantes (${formatAmount(r.computed)}).`, `Vérifiez les postes ${poste.sum!.join(", ")} et le total ${poste.code} dans le document d'origine.`, [poste.code, ...poste.sum!]);
    }

    // 2. Équilibre du bilan.
    if (provided.has("bilan") && v.BZ.value !== null && v.DZ.value !== null)
      compare(`equilibre:BZ:${exercise.id}`, `${ex} — Équilibre du bilan (total actif = total passif)`, exercise.id, v.DZ.value, v.BZ.value, 30, "blocking", `Total actif ${formatAmount(v.BZ.value)} ; total passif ${formatAmount(v.DZ.value)}.`, "Un poste manque ou est mal recopié, d'un côté ou de l'autre du bilan.", ["BZ", "DZ"]);

    // 3. Résultat du bilan = résultat du compte de résultat.
    if (provided.has("bilan") && provided.has("cr") && v.CJ.value !== null && v.XI.value !== null)
      compare(`resultat:CJ:${exercise.id}`, `${ex} — Résultat au bilan (CJ) = résultat net du compte de résultat (XI)`, exercise.id, v.XI.value, v.CJ.value, 1, "blocking", `Résultat au bilan ${formatAmount(v.CJ.value)} ; résultat net du compte de résultat ${formatAmount(v.XI.value)}.`, "Le résultat de l'exercice doit être identique dans les deux états.", ["CJ", "XI"]);

    // 4. Trésorerie de clôture du TFT = trésorerie nette du bilan.
    if (provided.has("tft") && provided.has("bilan") && v.ZH.value !== null && v.BT.value !== null && v.DT.value !== null) {
      const tn = v.BT.value - v.DT.value;
      compare(`tft:ZH:${exercise.id}`, `${ex} — Trésorerie de clôture du TFT (ZH) = trésorerie nette du bilan (BT − DT)`, exercise.id, tn, v.ZH.value, 3, "blocking", `Trésorerie de clôture du TFT ${formatAmount(v.ZH.value)} ; trésorerie nette du bilan ${formatAmount(tn)}.`, "Vérifiez la trésorerie d'ouverture (ZA) et chaque flux du tableau.", ["ZH", "BT", "DT"]);
    }

    // 5. Valeurs négatives inhabituelles et capital.
    for (const [code, value] of Object.entries(dossier.values[exercise.id] ?? {})) {
      const poste = POSTE_BY_CODE[code];
      if (poste && poste.kind === "poste" && !poste.signed && value < 0)
        results.push({ key: `negatif:${code}:${exercise.id}`, label: `${ex} — ${label(code)} négatif`, exerciseId: exercise.id, status: "gap", severity: "warning", found: value, explanation: `Ce poste s'inscrit normalement sans signe (${formatAmount(value)} saisi).`, hint: "Saisissez le montant sans signe : ACADIA applique lui-même le sens (charge, décaissement…).", codes: [code] });
    }
    if (provided.has("bilan") && v.CA.value !== null && v.CA.value <= 0)
      results.push({ key: `capital:CA:${exercise.id}`, label: `${ex} — Capital nul ou absent`, exerciseId: exercise.id, status: "gap", severity: "warning", found: v.CA.value, explanation: "Le capital social (CA) n'est pas renseigné.", hint: "Le capital figure en tête des capitaux propres.", codes: ["CA"] });

    const months = exerciseMonths(exercise);
    if (months === null || months > 24)
      results.push({ key: `dates:${exercise.id}`, label: `${ex} — Dates de l'exercice`, exerciseId: exercise.id, status: "gap", severity: "blocking", explanation: months === null ? "Dates de début et de fin invalides." : `Exercice de ${months} mois : vérifiez les dates.`, codes: [] });
  }

  // 6. Entre exercices successifs.
  for (let i = 1; i < exercises.length; i += 1) {
    const previous = exercises[i - 1];
    const current = exercises[i];
    const pv = all[previous.id];
    const cv = all[current.id];
    // Trésorerie d'ouverture du TFT = trésorerie nette du bilan précédent.
    if (providedStatements(dossier, current.id).has("tft") && providedStatements(dossier, previous.id).has("bilan") && cv.ZA.value !== null && pv.BT.value !== null && pv.DT.value !== null) {
      const tn = pv.BT.value - pv.DT.value;
      compare(`tft:ZA:${current.id}`, `${current.label} — Trésorerie d'ouverture (ZA) = trésorerie nette du bilan ${previous.label}`, current.id, tn, cv.ZA.value, 3, "blocking", `Trésorerie d'ouverture ${formatAmount(cv.ZA.value)} ; trésorerie nette au bilan ${previous.label} : ${formatAmount(tn)}.`, "La trésorerie d'ouverture d'un exercice est la trésorerie de clôture du précédent.", ["ZA", "BT", "DT"]);
    }
    // Exercices contigus.
    const nextDay = new Date(Date.parse(previous.end) + 86_400_000).toISOString().slice(0, 10);
    if (Number.isFinite(Date.parse(previous.end)) && current.start !== nextDay)
      results.push({ key: `contigus:${current.id}`, label: `${previous.label} → ${current.label} — Exercices non contigus`, exerciseId: current.id, status: "gap", severity: "warning", explanation: `L'exercice ${current.label} commence le ${current.start}, l'exercice ${previous.label} se termine le ${previous.end}.`, hint: "Les comparaisons d'un exercice à l'autre supposent des exercices successifs.", codes: [] });
    // Changement d'ordre de grandeur (erreur d'unité probable).
    for (const code of ["BZ", "XB"]) {
      const a = pv[code].value;
      const b = cv[code].value;
      if (a && b && a > 0 && b > 0 && (b / a >= 100 || a / b >= 100))
        results.push({ key: `echelle:${code}:${current.id}`, label: `${previous.label} → ${current.label} — ${label(code)} multiplié ou divisé par ${Math.round(Math.max(b / a, a / b))}`, exerciseId: current.id, status: "gap", severity: "warning", found: b, expected: a, explanation: "Un tel écart vient le plus souvent d'une erreur d'unité (unités / milliers / millions) ou d'un chiffre mal recopié.", hint: "Vérifiez que tous les exercices sont dans la même unité.", codes: [code] });
    }
  }
  return results;
}

export const blockingGaps = (checks: CheckResult[]) => checks.filter((c) => c.status === "gap" && c.severity === "blocking");
