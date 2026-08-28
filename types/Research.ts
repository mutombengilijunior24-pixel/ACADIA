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