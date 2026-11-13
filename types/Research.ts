export type ResearchStatus =
  | "draft"
  | "completed"
  | "archived";


// ======================================================
// DONNÉES DE RECHERCHE
// ======================================================

export interface ResearchData {
  title: string;

  domain: string;

  level: string;

  university: string;

  researchType: string;

  problem: string;

  objective: string;

  objectives: string[];

  population: string;

  populationSize: number;

  location: string;

  collectionMethod: string;

  // Spécialité choisie dans le référentiel du moteur d'interprétation
  // (SpecialtyId, lib/core/orchestrator/taxonomy.ts) ; `domain` en garde
  // le libellé du domaine (« Économie », « Gestion »). Facultative : les
  // projets antérieurs n'en ont pas.
  specialty?: string;

  // Directeur de mémoire (annuaire tenu par l'administration) : id de la
  // fiche choisie, et nom affiché — ou nom saisi librement quand le
  // directeur n'est pas dans l'annuaire. Facultatifs : les projets
  // antérieurs n'en ont pas.
  directorId?: string;

  directorName?: string;
}


// ======================================================
// PROJET DE RECHERCHE COMPLET
// ======================================================

export interface Research
  extends ResearchData {

  id: string;

  description?: string;

  status: ResearchStatus;

  progress: number;

  createdAt: Date;

  updatedAt: Date;
}


// ======================================================
// DONNÉES INITIALES
// ======================================================

export const initialResearchData: ResearchData = {

  title: "",

  domain: "",

  level: "",

  university: "",

  researchType: "",

  problem: "",

  objective: "",

  objectives: [],

  population: "",

  populationSize: 0,

  location: "",

  collectionMethod: "",
};