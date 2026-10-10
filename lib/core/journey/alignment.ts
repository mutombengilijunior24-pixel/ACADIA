/**
 * Diagnostic d'alignement entre la recherche (question, hypothèses, objectifs, concepts) et les
 * colonnes réellement retenues pour une analyse.
 *
 * Ce n'est PAS une compréhension sémantique : c'est un ensemble de signaux explicites, chacun motivé.
 * Le recouvrement lexical n'est qu'un signal parmi d'autres ; la décision combine :
 *  - la validité structurelle de la colonne (technique, identifiant, même colonne deux fois…) ;
 *  - le recouvrement lexical avec l'intitulé et la question rapprochée (synonymes connus inclus) ;
 *  - le recouvrement avec les MODALITÉS de réponse de la colonne ;
 *  - l'existence d'une autre question qui correspond nettement mieux ;
 *  - la nature de la colonne (question de profil des répondants vs variable de la question) ;
 *  - l'origine du rapprochement (proposé par ACADIA ou choisi par l'utilisateur) ;
 *  - la cohérence entre le sens annoncé par l'hypothèse et ce que la méthode peut tester.
 * Niveaux : « blocking » (analyse invalide en l'état), « warning » (plausible, à confirmer),
 * « info » (cohérent). Toute décision bloquante peut être levée par l'utilisateur, explicitement.
 */
import type { MethodId } from "@/lib/core/analysis/inferential";
import type { VariableMetadata } from "@/lib/core/data/types";
import { knowledgeFor } from "@/lib/core/understanding/concepts";
import { contentStems } from "@/lib/core/understanding/text";

import type { Cartography } from "./mapping";
import { coverage, tokensOf } from "./match";
import type { FileStructure } from "./structure";

export type AlignmentLevel = "info" | "warning" | "blocking";

export interface AlignmentSignal {
  code: string;
  level: AlignmentLevel;
  message: string;
}

export interface PlanAlignment {
  status: AlignmentLevel;
  /** Résumé : la raison principale du niveau retenu. */
  detail: string;
  signals: AlignmentSignal[];
}

export const ALIGNMENT_LABELS: Record<AlignmentLevel, string> = { info: "Cohérent", warning: "À confirmer", blocking: "Incompatible en l'état" };

export const ALIGNED: PlanAlignment = { status: "info", detail: "Aucune variable de recherche n'est engagée : contrôle d'alignement sans objet.", signals: [] };

const PROFILE = /\b(age|ages|tranche d.age|sexe|genre|niveau d.etudes?|etudes|instruction|etat civil|statut matrimonial|profession|commune|quartier|ville|province|marche|lieu|localisation|residence|religion|nationalit)\b/;
const fold = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[’']/g, ".");

/** Recouvrement lexical, synonymes connus du concept inclus (base de connaissances du moteur de compréhension). */
function lexical(concept: string, target: string): number {
  const targets = tokensOf(target);
  const known = knowledgeFor(contentStems(concept));
  const phrases = [concept, ...(known ? known.concept.aliases : [])];
  return Math.max(...phrases.map((p) => coverage(tokensOf(p), targets).score));
}

export interface AlignmentInput {
  concepts: Array<{ name: string; conceptKey: string; unitId: string | null; role: string }>;
  cartography: Cartography;
  structure: FileStructure;
  variables: VariableMetadata[];
  method?: MethodId;
  hypotheses: string[];
  /** Textes de cadrage (question principale, objectifs) dans lesquels les concepts doivent apparaître. */
  framing: string[];
}

export function assessAlignment(input: AlignmentInput): PlanAlignment {
  const { concepts, cartography, structure, variables, method, hypotheses, framing } = input;
  const signals: AlignmentSignal[] = [];
  const unitOf = (id: string | null) => (id ? structure.units.find((u) => u.id === id) : undefined);

  // 1. Validité structurelle.
  const used = concepts.map((c) => c.unitId).filter((id): id is string => !!id);
  if (new Set(used).size < used.length) signals.push({ code: "same-column", level: "blocking", message: "La même question est utilisée pour deux variables différentes : une relation d'une variable avec elle-même n'a pas de sens." });

  for (const concept of concepts) {
    const unit = unitOf(concept.unitId);
    if (!unit) continue;
    const mapping = cartography.concepts.find((c) => c.conceptKey === concept.conceptKey);
    const unitRole = cartography.units.find((u) => u.unit.id === unit.id);
    const meta = unit.primaryColumn !== null ? variables.find((v) => v.column === unit.primaryColumn) : undefined;
    if (unit.kind === "technical" || meta?.effectiveType === "identifier" || meta?.effectiveType === "temporal") {
      signals.push({ code: `technical-${concept.conceptKey}`, level: "blocking", message: `« ${unit.text} » est une colonne technique, un identifiant ou une date : elle ne peut pas mesurer « ${concept.name} ».` });
      continue;
    }

    // 2. Signaux de correspondance.
    const questionText = unitRole?.question?.text ?? "";
    const lex = lexical(concept.name, `${unit.text} ${questionText}`);
    const modalities = unit.options.length ? coverage(tokensOf(concept.name), tokensOf(unit.options.join(" "))).score : 0;
    const best = mapping?.candidates.find((c) => c.unitId !== unit.id);
    const betterAlternative = best && best.score >= 0.6 && best.score - lex >= 0.35 ? best : undefined;
    const profileQuestion = PROFILE.test(fold(unit.text)) && lex < 0.3;
    const chosenByUser = mapping?.origin === "user";
    const pct = (v: number) => `${Math.round(v * 100)} %`;

    if (lex >= 0.5) {
      signals.push({ code: `lexical-${concept.conceptKey}`, level: "info", message: `« ${unit.text} » reprend les termes de « ${concept.name} » (${pct(lex)} de correspondance, synonymes connus inclus).` });
    } else if (modalities >= 0.5) {
      signals.push({ code: `modalities-${concept.conceptKey}`, level: "info", message: `L'intitulé de « ${unit.text} » diffère de « ${concept.name} », mais ses modalités (${unit.options.slice(0, 4).join(" / ")}) en reprennent les termes.` });
    } else if (betterAlternative || profileQuestion) {
      const reasons = [
        betterAlternative ? `une autre question correspond nettement mieux : « ${unitOf(betterAlternative.unitId)?.text} » (${pct(betterAlternative.score)} contre ${pct(lex)})` : "",
        profileQuestion ? `« ${unit.text} » décrit le profil des répondants, alors que « ${concept.name} » est une variable de la question de recherche (${concept.role.toLowerCase()})` : "",
      ].filter(Boolean);
      signals.push({ code: `mismatch-${concept.conceptKey}`, level: "blocking", message: `La question porte sur « ${concept.name} », mais la colonne retenue est « ${unit.text} » : ${reasons.join(" ; ")}. Ni l'intitulé ni les modalités ne correspondent.` });
    } else if (chosenByUser) {
      signals.push({ code: `user-choice-${concept.conceptKey}`, level: "warning", message: `Vous avez relié « ${concept.name} » à « ${unit.text} » : les mots diffèrent (${pct(lex)}), ce qui peut être méthodologiquement valide (indicateur choisi par vous). Vérifiez que cette question mesure bien ce concept.` });
    } else {
      signals.push({ code: `weak-${concept.conceptKey}`, level: "warning", message: `Correspondance faible entre « ${concept.name} » et « ${unit.text} » (${pct(lex)}) : à confirmer.` });
    }

    // 3. Présence du concept dans le cadrage de la recherche.
    if (framing.length && !framing.some((t) => lexical(concept.name, t) >= 0.5)) {
      signals.push({ code: `framing-${concept.conceptKey}`, level: "warning", message: `« ${concept.name} » n'apparaît ni dans la question principale ni dans les objectifs : l'analyse risque de ne pas répondre à la question posée.` });
    }
  }

  // 4. Sens annoncé par l'hypothèse vs méthode.
  const directional = hypotheses.find((h) => /positiv|n[ée]gativ|augment|diminu|plus [ée]lev|moins [ée]lev/i.test(h));
  if (directional && method === "chi_square") {
    const many = concepts.some((c) => (unitOf(c.unitId)?.options.length ?? 0) > 2);
    signals.push({
      code: "direction",
      level: many ? "warning" : "info",
      message: many
        ? `L'hypothèse annonce un sens (« ${directional} »), mais le Chi² sur des modalités non ordonnées teste seulement l'existence d'une association, pas son sens.`
        : "L'hypothèse annonce un sens : il se lira dans la comparaison des proportions du tableau 2 × 2 (catégories de référence à choisir).",
    });
  }

  const rank: Record<AlignmentLevel, number> = { info: 0, warning: 1, blocking: 2 };
  const worst = signals.reduce<AlignmentSignal | null>((a, b) => (!a || rank[b.level] > rank[a.level] ? b : a), null);
  if (!worst) return { status: "info", detail: "Les colonnes retenues correspondent aux concepts de la question.", signals };
  const status = worst.level;
  return { status, detail: status === "info" ? "Les colonnes retenues correspondent aux concepts de la question." : worst.message, signals };
}
