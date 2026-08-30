// ============================================================
// ACADIA — MODULE SURVEY : CONTRÔLE QUALITÉ DU QUESTIONNAIRE
//
// Contrôle logique appliqué avant d'enregistrer un questionnaire
// (génération initiale ou modification via l'éditeur) : doublons,
// quasi-doublons, questions à choix sans options, déséquilibre
// ouvert/fermé. Corrige automatiquement lorsque sûr (suppression
// d'une question invalide) ; sinon se contente de signaler — ne
// réécrit jamais le texte d'une question sans le retirer entièrement.
// ============================================================

const OPTION_REQUIRED_TYPES = new Set(["single_choice", "multiple_choice", "scale", "category"]);
const OPEN_TYPES = new Set(["short_text", "long_text"]);

// Mots-clés indiquant une échelle d'accord/fréquence/satisfaction cohérente.
const SCALE_KEYWORDS = [
  "satisf", "insatisf", "faible", "élevé", "eleve", "moyen", "neutre", "probable",
  "accord", "désaccord", "desaccord", "jamais", "toujours", "rarement", "souvent",
  "parfois", "difficile", "facile", "lent", "rapide", "fiable", "excellent", "mauvais", "bon",
];
// Mots-clés d'unité de durée/date — jamais des modalités valides pour une échelle
// (ex. bug source : options "Moins de 6 mois / 6 mois à 1 an / ..." sur une question
// de satisfaction, une confusion entre ancienneté et intensité).
const DURATION_KEYWORDS = ["mois", " an ", " ans", "semaine", "jour", "heure", "année", "annee"];

interface QualityCheckable {
  text: string;
  type: string;
  options?: { label: string }[];
}

export interface QualityControlResult<T> {
  questions: T[];
  warnings: string[];
}

/**
 * Vérifie qu'une question de type "scale" a des options réellement
 * cohérentes avec une échelle (nombre raisonnable, vocabulaire
 * d'intensité/accord/fréquence, jamais des unités de durée ou de date).
 * Ne corrige jamais silencieusement les modalités — une échelle
 * incohérente est retirée, jamais réécrite sans contrôle humain.
 */
function isCoherentScale(options: { label: string }[]): boolean {
  if (options.length < 4 || options.length > 7) return false;
  const labels = options.map((o) => o.label.toLowerCase());
  if (labels.some((l) => DURATION_KEYWORDS.some((k) => l.includes(k)))) return false;
  const looksNumeric = labels.every((l) => /^\d+$/.test(l.trim()));
  const hasScaleWord = labels.some((l) => SCALE_KEYWORDS.some((k) => l.includes(k)));
  return looksNumeric || hasScaleWord;
}

export function controlQuestionnaireQuality<T extends QualityCheckable>(
  questions: T[],
  context: { objective?: string; problem?: string } = {}
): QualityControlResult<T> {
  const warnings: string[] = [];
  const kept: T[] = [];
  const seenTexts = new Set<string>();
  const objectiveWords = normalize(context.objective ?? "");
  const problemWords = normalize(context.problem ?? "");

  for (const q of questions) {
    const normalized = normalize(q.text);
    if (!normalized) {
      warnings.push("Une question sans intitulé a été ignorée.");
      continue;
    }
    if (seenTexts.has(normalized)) {
      warnings.push(`Question en double ignorée : « ${q.text} ».`);
      continue;
    }
    const nearDuplicate = kept.find((k) => similarity(normalize(k.text), normalized) > 0.75);
    if (nearDuplicate) {
      warnings.push(`Question très similaire à « ${nearDuplicate.text} » ignorée : « ${q.text} ».`);
      continue;
    }
    if (OPTION_REQUIRED_TYPES.has(q.type) && (!q.options || q.options.length < 2)) {
      warnings.push(`Question ignorée faute d'options suffisantes : « ${q.text} ».`);
      continue;
    }
    if (q.type === "scale" && q.options && !isCoherentScale(q.options)) {
      warnings.push(`Échelle incohérente ignorée (options non cohérentes avec une échelle) : « ${q.text} ».`);
      continue;
    }
    // Règle absolue : l'objectif/problème est un contexte, jamais une
    // question — une question dont le texte recopie une large part de
    // l'objectif ou du problème fourni est rejetée.
    if (objectiveWords && similarity(objectiveWords, normalized) > 0.5) {
      warnings.push(`Question rejetée : reprend l'objectif fourni au lieu de le transformer en question : « ${q.text} ».`);
      continue;
    }
    if (problemWords && similarity(problemWords, normalized) > 0.5) {
      warnings.push(`Question rejetée : reprend le problème fourni au lieu de le transformer en question : « ${q.text} ».`);
      continue;
    }
    seenTexts.add(normalized);
    kept.push(q);
  }

  const total = kept.length;
  const openCount = kept.filter((q) => OPEN_TYPES.has(q.type)).length;
  if (total > 0 && openCount / total > 0.4) {
    warnings.push("Proportion de questions ouvertes élevée — envisagez de structurer davantage le questionnaire.");
  }
  if (total > 0 && total < 8) {
    warnings.push("Questionnaire court — envisagez de couvrir davantage de dimensions.");
  }
  if (total > 30) {
    warnings.push("Questionnaire long — un nombre élevé de questions peut réduire le taux de complétion.");
  }

  return { questions: kept, warnings };
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

/** Similarité de Jaccard sur les mots significatifs (≥ 3 lettres) — heuristique simple, déterministe. */
function similarity(a: string, b: string): number {
  const setA = new Set(a.split(" ").filter((w) => w.length > 2));
  const setB = new Set(b.split(" ").filter((w) => w.length > 2));
  if (setA.size === 0 || setB.size === 0) return 0;
  let intersection = 0;
  for (const w of setA) if (setB.has(w)) intersection++;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 0 : intersection / union;
}
