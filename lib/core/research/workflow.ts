// ============================================================
// ACADIA — PARCOURS « NOUVELLE RECHERCHE » (règles pures)
//
// ACADIA se concentre sur deux besoins des étudiants en sciences
// économiques et de gestion : RÉCOLTER leurs données (questionnaire
// d'enquête créé avec ACADIA ou importé) et les INTERPRÉTER (moteurs
// d'interprétation). L'assistant ne demande donc que le strict
// nécessaire : sujet, domaine et spécialité, niveau et université,
// directeur — puis l'étudiant choisit l'un des deux chemins.
// ============================================================

import { DOMAINS, specialtyOf, type DomainId, type SpecialtyId } from "@/lib/core/orchestrator/taxonomy";
import type { ResearchData } from "@/types/Research";

// Dernière étape : le directeur, puis — dès qu'il est choisi — récolter ou interpréter.
export const WIZARD_STEPS = [
  { title: "Sujet de recherche", category: "Cadrage" },
  { title: "Domaine et spécialité", category: "Cadrage" },
  { title: "Niveau et université", category: "Cadrage" },
  { title: "Directeur, puis mes données", category: "Mes données" },
] as const;

export const WIZARD_TOTAL_STEPS = WIZARD_STEPS.length;

/** Domaines proposés : ACADIA est conçu pour les sciences économiques et de gestion. */
export const WIZARD_DOMAINS = DOMAINS.filter((d) => d.id === "economics" || d.id === "management");

export const STUDY_LEVELS = ["Licence", "Master", "Doctorat"] as const;

export const MIN_SUBJECT_LENGTH = 15;

export function isSubjectReady(title: string | undefined): boolean {
  return (title ?? "").replace(/\s+/g, " ").trim().length >= MIN_SUBJECT_LENGTH;
}

/** Spécialité valide et proposée (jamais une spécialité « prévue » ni hors économie / gestion). */
export function chosenSpecialty(research: Pick<ResearchData, "specialty">) {
  const s = specialtyOf(research.specialty as SpecialtyId | undefined);
  return s && s.status === "available" && (s.domain === "economics" || s.domain === "management") ? s : null;
}

/** Directeur choisi dans l'annuaire ou nom saisi (au moins 3 caractères) : les deux chemins peuvent apparaître. */
export function hasDirectorChoice(research: Pick<ResearchData, "directorId" | "directorName">): boolean {
  return Boolean(research.directorId) || (research.directorName ?? "").replace(/\s+/g, " ").trim().length >= 3;
}

/** Peut-on passer à l'étape suivante ? */
export function canContinue(step: number, research: ResearchData): boolean {
  switch (step) {
    case 0:
      return isSubjectReady(research.title);
    case 1:
      return chosenSpecialty(research) !== null;
    case 2:
      return Boolean(research.level?.trim()) && Boolean(research.university?.trim());
    default:
      return true;
  }
}

/** Ce qui manque encore pour continuer (affiché sous le bouton grisé). */
export function missingFor(step: number, research: ResearchData): string | null {
  if (canContinue(step, research)) return null;
  switch (step) {
    case 0:
      return `Écrivez votre sujet pour continuer (au moins ${MIN_SUBJECT_LENGTH} caractères).`;
    case 1:
      return "Choisissez votre domaine puis votre spécialité pour continuer.";
    case 2:
      return !research.level?.trim() ? "Choisissez votre niveau d'études pour continuer." : "Indiquez votre université pour continuer.";
    default:
      return null;
  }
}

/** « Économie · Économie monétaire et bancaire », ou le domaine seul pour un projet antérieur. */
export function fieldLabel(research: Pick<ResearchData, "domain" | "specialty">): string {
  const s = chosenSpecialty(research);
  return [research.domain?.trim(), s?.label].filter(Boolean).join(" · ");
}

/** Récolter mes données : moteurs du questionnaire d'enquête (créer avec ACADIA ou importer le sien). */
export function collectHref(research?: Pick<ResearchData, "title" | "university"> | null): string {
  const params = new URLSearchParams();
  if (research?.title?.trim()) params.set("sujet", research.title.trim().slice(0, 300));
  if (research?.university?.trim()) params.set("institution", research.university.trim().slice(0, 160));
  const query = params.toString();
  return `/dashboard/survey/new${query ? `?${query}` : ""}`;
}

/**
 * Interpréter mes données : moteur d'interprétation, domaine et spécialité déjà choisis.
 * La gestion financière a son moteur dédié ; pour les spécialités économiques, le
 * parcours propose lui-même le moteur économétrique quand les données sont des séries.
 */
export function interpretHref(research?: Pick<ResearchData, "specialty"> | null): string {
  const s = research ? chosenSpecialty(research) : null;
  if (!s) return "/dashboard/journey";
  if (s.engine === "finance") return "/dashboard/journey?moteur=finance";
  return `/dashboard/journey?domaine=${s.domain}&specialite=${s.id}`;
}

/** Lecture sûre des paramètres d'ouverture du parcours (jamais une valeur hors référentiel). */
export function journeySeed(domain: unknown, specialty: unknown): { domain: DomainId; specialty: SpecialtyId } | null {
  const s = chosenSpecialty({ specialty: typeof specialty === "string" ? specialty : undefined });
  if (!s || s.domain !== domain) return null;
  return { domain: s.domain, specialty: s.id };
}
