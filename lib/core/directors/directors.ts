// ============================================================
// ACADIA — ANNUAIRE DES DIRECTEURS DE MÉMOIRE : règles pures
//
// Aucune base, aucun réseau : utilisable côté serveur comme côté client.
// Un directeur de l'annuaire n'a pas besoin de compte ACADIA ; sa logique
// métier (canevas, exigences) est recueillie peu à peu. Tant qu'elle
// n'est pas intégrée, ACADIA applique sa logique générale.
// ============================================================

import { INSTITUTIONS } from "@/lib/core/stages/institutions";

export const DIRECTOR_LOGIC_STATUSES = ["a_recueillir", "en_cours", "integre"] as const;
export type DirectorLogicStatus = (typeof DIRECTOR_LOGIC_STATUSES)[number];

export const LOGIC_STATUS_LABELS: Record<DirectorLogicStatus, string> = {
  a_recueillir: "Canevas à recueillir",
  en_cours: "Canevas en cours d'intégration",
  integre: "Canevas intégré",
};

/** Ce que voit un étudiant : jamais les notes internes de l'administration. */
export interface DirectorPublic {
  id: string;
  fullName: string;
  academicTitle: string | null;
  institution: string | null;
  faculty: string | null;
  department: string | null;
  specialties: string | null;
  logicStatus: DirectorLogicStatus;
}

export interface DirectorAdmin extends DirectorPublic {
  notes: string | null;
  isActive: boolean;
  projects: number;
  createdAt: string;
  updatedAt: string;
}

/** Nom saisi librement par des étudiants dont le directeur n'est pas dans l'annuaire. */
export interface UnlistedDirectorName {
  name: string;
  projects: number;
}

export interface DirectorInput {
  fullName: string;
  academicTitle?: string;
  institution?: string;
  faculty?: string;
  department?: string;
  specialties?: string;
}

export const DIRECTOR_LINE_FORMAT = "Nom complet ; Titre ; Université ; Faculté ; Département ; Spécialités";
export const MAX_IMPORT_LINES = 300;

const clean = (value: string | undefined | null) => (value ?? "").replace(/\s+/g, " ").trim();

/** Clé de comparaison : sans accents, sans casse, espaces réduits. */
export function nameKey(value: string): string {
  return clean(value)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

/** « Professeur Jean Kabamba », ou le nom seul quand le titre n'est pas connu. */
export function directorLabel(d: Pick<DirectorPublic, "fullName" | "academicTitle">): string {
  const title = clean(d.academicTitle);
  return title ? `${title} ${clean(d.fullName)}` : clean(d.fullName);
}

/**
 * Lit une liste collée : une ligne par directeur, champs séparés par « ; »
 * (ou par des tabulations, pour un copier-coller depuis Excel). Seul le nom
 * est obligatoire. Les lignes vides et les noms déjà vus sont ignorés.
 */
export function parseDirectorLines(text: string): { directors: DirectorInput[]; skipped: number } {
  const directors: DirectorInput[] = [];
  const seen = new Set<string>();
  let skipped = 0;

  for (const raw of text.split(/\r?\n/)) {
    if (!raw.trim()) continue;
    const parts = raw.split(raw.includes(";") ? ";" : "\t").map((p) => clean(p));
    const [fullName, academicTitle, institution, faculty, department, specialties] = parts;
    const key = nameKey(fullName ?? "");
    if (!key || key.length < 3 || seen.has(key)) {
      skipped += 1;
      continue;
    }
    seen.add(key);
    const entry: DirectorInput = { fullName: fullName.slice(0, 160) };
    if (academicTitle) entry.academicTitle = academicTitle.slice(0, 80);
    if (institution) entry.institution = institution.slice(0, 160);
    if (faculty) entry.faculty = faculty.slice(0, 160);
    if (department) entry.department = department.slice(0, 160);
    if (specialties) entry.specialties = specialties.slice(0, 400);
    directors.push(entry);
  }

  return { directors, skipped };
}

/**
 * Le directeur appartient-il à l'université saisie par l'étudiant ? Le
 * wizard enregistre l'université en texte libre (« Université de
 * Lubumbashi (UNILU) ») ; l'annuaire, un acronyme (« UNILU ») ou un nom.
 * On compare sur l'acronyme (mot entier) et sur le nom complet connu.
 */
export function matchesInstitution(directorInstitution: string | null | undefined, universityText: string | null | undefined): boolean {
  const inst = nameKey(directorInstitution ?? "");
  const text = nameKey(universityText ?? "");
  if (!inst || !text) return false;
  // Nom complet saisi dans l'annuaire (« Université de Lubumbashi ») présent tel quel dans le texte.
  if (text === inst || (inst.length > 6 && text.includes(inst))) return true;

  const known = INSTITUTIONS.find((i) => nameKey(i.acronym) === inst || (i.name && nameKey(i.name) === inst));
  const acronyms = new Set([inst, ...(known ? [nameKey(known.acronym)] : [])]);
  const words = new Set(text.split(/[^a-z0-9-]+/).filter(Boolean));
  for (const a of acronyms) if (words.has(a)) return true;
  if (known?.name && text.includes(nameKey(known.name))) return true;
  return false;
}

/** Les directeurs de l'université saisie d'abord, puis les autres ; ordre alphabétique dans chaque groupe. */
export function sortForUniversity<T extends Pick<DirectorPublic, "fullName" | "institution">>(
  directors: T[],
  universityText: string | null | undefined
): { matching: T[]; others: T[] } {
  const byName = (a: T, b: T) => nameKey(a.fullName).localeCompare(nameKey(b.fullName));
  const matching = directors.filter((d) => matchesInstitution(d.institution, universityText)).sort(byName);
  const others = directors.filter((d) => !matchesInstitution(d.institution, universityText)).sort(byName);
  return { matching, others };
}

export function isLogicStatus(value: unknown): value is DirectorLogicStatus {
  return typeof value === "string" && (DIRECTOR_LOGIC_STATUSES as readonly string[]).includes(value);
}
