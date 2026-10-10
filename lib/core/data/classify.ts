import type { ColumnMapping, ColumnProfile, DetectedClassification } from "./types";

/**
 * Classification statistique déterministe d'une colonne.
 *
 * Le type informatique (stockage) ne suffit jamais : un code de répondant numérique est un
 * identifiant, une échelle 1–5 est ordinale, un 0/1 est une catégorie binaire. Chaque règle
 * expose sa justification ; toute classification non certaine est « à confirmer ».
 * Aucune règle n'utilise l'IA ni le nom du fichier.
 */

const ID_NAME = /(^|_)(id|ident|identifiant|code|matricule|numero|ref|reference|telephone|tel|phone|email|mail|uuid)(_|$|\d)/;
const YES_NO = new Set(["oui", "non", "yes", "no", "vrai", "faux", "true", "false", "o", "n"]);
const LIKERT_LABELS = [
  ["pas du tout d'accord", "pas d'accord", "neutre", "d'accord", "tout à fait d'accord", "plutôt d'accord", "plutôt pas d'accord", "ni d'accord ni pas d'accord", "sans avis"],
  ["jamais", "rarement", "parfois", "souvent", "toujours", "très souvent"],
  ["très faible", "faible", "moyen", "moyenne", "élevé", "élevée", "très élevé", "très élevée"],
  ["pas du tout important", "peu important", "important", "très important", "assez important"],
  ["très insatisfait", "insatisfait", "satisfait", "très satisfait", "moyennement satisfait"],
];

const normalize = (text: string) => text.trim().toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, " ");

function questionnaireClassification(profile: ColumnProfile, mapping: ColumnMapping): DetectedClassification | null {
  const type = mapping.questionType;
  if (!type) return null;
  const base = { storageType: profile.storageType, rule: `questionnaire:${type}` };
  const reason = `Colonne associée à la question ${mapping.questionNumber ?? ""} du questionnaire ACADIA (type « ${type} »)${mapping.confirmed ? "" : " — correspondance non confirmée"}.`;
  const confidence = mapping.confirmed ? "high" : "medium";
  const values = (mapping.expectedValues ?? []).map((v) => Number(v.value)).filter(Number.isFinite);
  switch (type) {
    case "likert":
    case "frequency":
    case "importance":
      return {
        ...base,
        statisticalType: "ordinal",
        confidence,
        binary: false,
        reasons: [reason, "Les échelles de type Likert sont ordinales : l'écart entre deux modalités n'est pas une quantité mesurée."],
        scale: values.length ? { min: Math.min(...values), max: Math.max(...values), labels: mapping.expectedValues?.map((v) => v.label) } : undefined,
      };
    case "yes_no":
      return { ...base, statisticalType: "nominal", confidence, binary: true, reasons: [reason, "Question fermée Oui/Non : variable binaire."] };
    case "single_choice":
      return { ...base, statisticalType: "nominal", confidence, binary: profile.distinct === 2, reasons: [reason, "Question à choix unique : modalités non ordonnées, sauf indication contraire."] };
    case "multiple_choice":
      return { ...base, statisticalType: "to_confirm", confidence: "low", binary: false, reasons: [reason, "Question à choix multiples : le codage des réponses (une colonne par modalité ou liste) doit être précisé."] };
    case "number":
      return { ...base, statisticalType: profile.storageType === "decimal" ? "quantitative_continuous" : "quantitative_discrete", confidence: "medium", binary: false, reasons: [reason] };
    case "text":
    case "long_text":
      return { ...base, statisticalType: "free_text", confidence, binary: false, reasons: [reason, "Question ouverte : texte libre à analyser qualitativement."] };
    default:
      return null;
  }
}

export function classifyColumn(profile: ColumnProfile, mapping?: ColumnMapping): DetectedClassification {
  const storageType = profile.storageType;
  const make = (partial: Omit<DetectedClassification, "storageType">): DetectedClassification => ({ storageType, ...partial });

  if (profile.present === 0) {
    return make({ statisticalType: "unclassified", confidence: "low", rule: "empty", binary: false, reasons: ["Colonne sans valeur renseignée."] });
  }

  if (mapping) {
    const fromQuestionnaire = questionnaireClassification(profile, mapping);
    if (fromQuestionnaire) return fromQuestionnaire;
  }

  const name = profile.technicalName;
  const allDistinct = profile.distinct === profile.present;
  const labels = profile.categories?.top.map((c) => normalize(c.value)) ?? [];
  const examples = profile.examples.map(normalize);

  if (storageType === "date") {
    const ambiguous = profile.dates?.ambiguousFormat;
    return make({
      statisticalType: "temporal",
      confidence: ambiguous ? "medium" : "high",
      rule: "dates",
      binary: false,
      reasons: ["Toutes les valeurs renseignées sont des dates.", ...(ambiguous ? ["Format JJ/MM ou MM/JJ ambigu : à confirmer."] : [])],
    });
  }

  if (ID_NAME.test(name) && allDistinct && profile.present >= 2) {
    return make({
      statisticalType: "identifier",
      confidence: "high",
      rule: "identifier_name_unique",
      binary: false,
      reasons: [`Le nom « ${profile.originalHeader.trim() || name} » évoque un identifiant et toutes les valeurs sont distinctes.`, "Un identifiant n'est pas une quantité, même s'il contient des chiffres."],
    });
  }

  // Nom d'identifiant mais quelques valeurs répétées : c'est un signal de doublon, pas d'échelle.
  // Tolérance : au plus max(1, 10 % des valeurs) répétitions (un seul doublon suffit sur un petit échantillon).
  const repeated = profile.present - profile.distinct;
  if (ID_NAME.test(name) && profile.present >= 3 && repeated > 0 && repeated <= Math.max(1, Math.floor(profile.present * 0.1))) {
    return make({
      statisticalType: "identifier",
      confidence: "medium",
      rule: "identifier_name_mostly_unique",
      binary: false,
      reasons: [
        `Le nom « ${profile.originalHeader.trim() || name} » évoque un identifiant, mais ${profile.present - profile.distinct} valeur(s) se répètent : doublons de répondants possibles, à vérifier.`,
      ],
    });
  }

  const numericLike = storageType === "integer" || storageType === "decimal";
  if (numericLike && profile.warnings.some((w) => w.includes("zéros en tête"))) {
    return make({
      statisticalType: "identifier",
      confidence: "medium",
      rule: "leading_zero_codes",
      binary: false,
      reasons: ["Des valeurs commencent par 0 (« 007 ») : ce sont probablement des codes ou des numéros, pas des quantités."],
    });
  }
  if (numericLike && profile.numeric && profile.numeric.min >= 1e8 && allDistinct) {
    return make({
      statisticalType: "identifier",
      confidence: "medium",
      rule: "long_unique_numbers",
      binary: false,
      reasons: ["Nombres longs et tous distincts (numéros de téléphone, matricules…) : identifiant probable."],
    });
  }

  if (storageType === "boolean" || profile.distinct === 2) {
    const yesNo = labels.length === 2 && labels.every((label) => YES_NO.has(label));
    const zeroOne = numericLike && profile.numeric?.min === 0 && profile.numeric?.max === 1;
    return make({
      statisticalType: "nominal",
      confidence: yesNo || storageType === "boolean" ? "high" : "medium",
      rule: "binary",
      binary: true,
      reasons: [
        `Deux modalités observées (${labels.slice(0, 2).map((l) => `« ${l} »`).join(" / ") || "deux valeurs"}) : variable binaire.`,
        ...(zeroOne ? ["Codage 0/1 : à confirmer (catégorie binaire et non quantité)."] : []),
      ],
    });
  }

  if (storageType === "integer" && profile.numeric) {
    const { min, max } = profile.numeric;
    // Échelle courte : entiers de 0 ou 1 jusqu'à 3–7, au moins 3 modalités observées.
    if (min >= 0 && min <= 1 && max >= 3 && max <= 7 && profile.distinct >= 3) {
      return make({
        statisticalType: "ordinal",
        confidence: "medium",
        rule: "likert_like_integers",
        binary: false,
        reasons: [`Entiers de ${min} à ${max} (${profile.distinct} modalités) : échelle ordinale de type Likert probable, à confirmer.`, "Une moyenne sur un item ordinal doit être interprétée avec prudence."],
        scale: { min, max },
      });
    }
    if (profile.distinct <= 10) {
      return make({
        statisticalType: "to_confirm",
        confidence: "low",
        rule: "few_integers",
        binary: false,
        reasons: [`Peu de valeurs entières distinctes (${profile.distinct}) : il peut s'agir de codes de catégories ou d'un dénombrement.`],
      });
    }
    return make({
      statisticalType: "quantitative_discrete",
      confidence: "medium",
      rule: "many_integers",
      binary: false,
      reasons: [`Valeurs entières variées (${profile.distinct} valeurs distinctes, de ${min} à ${max}) : quantité discrète probable.`],
    });
  }

  if (storageType === "decimal") {
    return make({
      statisticalType: "quantitative_continuous",
      confidence: profile.distinct > 10 ? "high" : "medium",
      rule: "decimals",
      binary: false,
      reasons: ["Valeurs décimales : quantité continue."],
    });
  }

  if (storageType === "ambiguous") {
    return make({
      statisticalType: "to_confirm",
      confidence: "low",
      rule: "ambiguous_storage",
      binary: false,
      reasons: ["Valeurs de natures mélangées (nombres et texte) : la colonne ne peut pas être classée sans décision."],
    });
  }

  // Texte.
  const likertSet = LIKERT_LABELS.find((set) => labels.length >= 2 && labels.every((label) => set.includes(label)));
  if (likertSet) {
    return make({
      statisticalType: "ordinal",
      confidence: "medium",
      rule: "likert_labels",
      binary: false,
      reasons: ["Les modalités correspondent à une échelle ordonnée (accord, fréquence, intensité) : variable ordinale probable, ordre à confirmer."],
      scale: { min: 1, max: labels.length, labels: profile.categories?.top.map((c) => c.value) },
    });
  }

  const averageLength = examples.reduce((total, e) => total + e.length, 0) / Math.max(1, examples.length);
  const averageWords = examples.reduce((total, e) => total + e.split(" ").length, 0) / Math.max(1, examples.length);
  const distinctRatio = profile.distinct / profile.present;

  if (allDistinct && profile.present >= 5 && averageWords === 1 && averageLength <= 20) {
    return make({
      statisticalType: "identifier",
      confidence: "medium",
      rule: "unique_short_codes",
      binary: false,
      reasons: ["Codes courts tous distincts : identifiant probable."],
    });
  }
  if (averageLength >= 30 || (distinctRatio >= 0.6 && averageWords >= 3)) {
    return make({
      statisticalType: "free_text",
      confidence: "medium",
      rule: "long_text",
      binary: false,
      reasons: ["Réponses longues et variées : texte libre (question ouverte probable)."],
    });
  }
  if (profile.distinct <= Math.max(12, Math.ceil(profile.present * 0.2))) {
    return make({
      statisticalType: "nominal",
      confidence: profile.distinct <= 8 ? "medium" : "low",
      rule: "few_categories",
      binary: false,
      reasons: [`${profile.distinct} modalités textuelles répétées : variable qualitative nominale probable (un ordre éventuel est à préciser).`],
    });
  }
  return make({
    statisticalType: "to_confirm",
    confidence: "low",
    rule: "unclear_text",
    binary: false,
    reasons: ["Texte trop varié pour une catégorie et trop court pour un texte libre : à préciser."],
  });
}
