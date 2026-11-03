/**
 * Contrôle 3 — contexte : la phrase de l'étudiant est-elle fidèle au texte qu'il cite ? L'IA compare la
 * phrase au RÉSUMÉ RÉEL renvoyé par une base bibliographique et doit appuyer son avis sur un extrait de ce
 * résumé. Ce module vérifie, sans IA, que l'extrait existe vraiment dans le résumé : sinon, l'avis est
 * ramené à « impossible à juger ». Sans résumé, aucun avis n'est donné.
 */
import { fold } from "./text";

export type ContextVerdictId = "fidele" | "partiel" | "non_fidele" | "indeterminable";

export const CONTEXT_LABELS: Record<ContextVerdictId, string> = {
  fidele: "Fidèle au texte cité",
  partiel: "Partiellement fidèle",
  non_fidele: "Ne correspond pas au texte cité",
  indeterminable: "Impossible à juger",
};

export interface ContextAnswer {
  verdict: ContextVerdictId;
  explanation: string;
  /** Extrait du résumé qui fonde l'avis (copié mot pour mot). */
  evidence: string;
}

export interface ContextVerdict extends ContextAnswer {
  label: string;
  /** L'avis vient d'une comparaison avec un résumé réel (sinon : aucun avis). */
  basedOnAbstract: boolean;
}

const squash = (s: string) =>
  fold(s)
    .replace(/[’'`´"«»“”]/g, "'")
    .replace(/[^a-z0-9']+/g, " ")
    .trim();

export const NO_ABSTRACT: ContextVerdict = {
  verdict: "indeterminable",
  label: CONTEXT_LABELS.indeterminable,
  explanation: "La base bibliographique ne fournit pas de résumé de ce texte : ACADIA ne peut pas juger si votre phrase lui est fidèle. Relisez le passage cité dans l'ouvrage lui-même.",
  evidence: "",
  basedOnAbstract: false,
};

/** Garde-fou : un avis sans extrait réellement présent dans le résumé n'est pas retenu. */
export function validateContextAnswer(answer: ContextAnswer, abstract: string): ContextVerdict {
  if (answer.verdict === "indeterminable") return { ...answer, label: CONTEXT_LABELS.indeterminable, basedOnAbstract: true };
  const evidence = squash(answer.evidence);
  if (evidence.length < 12 || !squash(abstract).includes(evidence)) {
    return { verdict: "indeterminable", label: CONTEXT_LABELS.indeterminable, explanation: "L'avis de l'IA ne s'appuyait pas sur un extrait réel du résumé : il n'est pas retenu. Relisez le passage cité dans l'ouvrage.", evidence: "", basedOnAbstract: true };
  }
  return { ...answer, label: CONTEXT_LABELS[answer.verdict], basedOnAbstract: true };
}
