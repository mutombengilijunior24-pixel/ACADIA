// MNJ Stage Connect — établissements et ce qu'ils organisent réellement.
//
// Règle : uniquement ce qui est publié par l'établissement lui-même (site officiel), avec la source et la
// date de consultation. Rien n'est inventé : quand un établissement ne publie pas ses filières, l'étudiant
// choisit parmi les facultés générales et écrit sa filière. À tenir à jour (les offres changent chaque année).

import type { FacultyId } from "./catalog";

export interface InstitutionUnit {
  /** Nom tel que publié par l'établissement (faculté, ou filière pour un institut supérieur). */
  name: string;
  /** Rattachement à une faculté générale, pour classer les candidats dans le CRM. */
  facultyId: FacultyId;
  /** Départements, options ou masters publiés ; absent = non publié par l'établissement. */
  programs?: string[];
}

export interface Institution {
  id: string;
  acronym: string;
  /** Nom complet, seulement quand il est publié ou documenté. */
  name?: string;
  city: string;
  /** « Faculté » pour une université, « Filière » pour un institut supérieur. */
  unitLabel: "Faculté" | "Filière";
  /** « Département », « Option »… */
  programLabel: string;
  units?: InstitutionUnit[];
  source?: { url: string; checkedOn: string; note?: string };
  /** programmes : facultés et filières publiées ; facultes : seules les facultés le sont ; aucune : rien de vérifié. */
  coverage: "programmes" | "facultes" | "aucune";
}

const CHECKED = "2026-10-26";

export const INSTITUTIONS: Institution[] = [
  {
    id: "isc-lubumbashi",
    acronym: "ISC",
    name: "Institut Supérieur de Commerce de Lubumbashi",
    city: "Lubumbashi",
    unitLabel: "Filière",
    programLabel: "Option",
    coverage: "programmes",
    source: { url: "https://isclubumbashi.org/filieres", checkedOn: CHECKED },
    units: [
      {
        name: "Sciences Commerciales et Financières",
        facultyId: "economie_gestion",
        programs: ["Comptabilité et Finance", "Entrepreneuriat et Gestion des PME", "Logistique et Transport", "Marketing", "Master : Comptabilité – Contrôle – Audit", "Master : Entrepreneuriat, Gestion et Évaluation des Projets", "Master : Marketing", "Master : Intelligence des Affaires"],
      },
      { name: "Informatique de Gestion", facultyId: "informatique", programs: ["Conception des Systèmes Informatiques", "Réseaux informatiques", "Master : Réseaux informatiques"] },
      { name: "Gestion des Ressources Humaines", facultyId: "economie_gestion", programs: ["Licence (sans option)", "Master : Gestion des Ressources Humaines"] },
      { name: "Banque, Microfinance et Assurances", facultyId: "economie_gestion", programs: ["Licence (sans option)", "Master : Banque et Microfinance", "Master : Assurances"] },
      { name: "Fiscalité, Douane et Accises", facultyId: "economie_gestion", programs: ["Licence (sans option)", "Master : Fiscalité", "Master : Douane et Commerce international"] },
      { name: "Secrétariat de Direction", facultyId: "autre", programs: ["Comptable et Commercial", "Diplomatique", "Juridique", "Médical"] },
    ],
  },
  {
    id: "unilu",
    acronym: "UNILU",
    name: "Université de Lubumbashi",
    city: "Lubumbashi",
    unitLabel: "Faculté",
    programLabel: "Département ou filière",
    coverage: "facultes",
    source: { url: "https://www.unilu.ac.cd/", checkedOn: CHECKED, note: "Le site publie les facultés et écoles, pas leurs départements." },
    units: [
      { name: "Agronomie", facultyId: "agronomie" },
      { name: "Architecture", facultyId: "polytechnique" },
      { name: "Criminologie", facultyId: "sciences_sociales" },
      { name: "Droit", facultyId: "droit" },
      { name: "Économie", facultyId: "economie_gestion" },
      { name: "ESI", facultyId: "polytechnique" },
      { name: "Lettres", facultyId: "lettres" },
      { name: "Médecine", facultyId: "medecine_sante" },
      { name: "Médecine vétérinaire", facultyId: "agronomie" },
      { name: "Pêche et aquaculture", facultyId: "agronomie" },
      { name: "Pharmacie", facultyId: "medecine_sante" },
      { name: "Polytechnique", facultyId: "polytechnique" },
      { name: "Psychologie", facultyId: "psychologie_education" },
      { name: "Santé publique", facultyId: "medecine_sante" },
      { name: "Sciences", facultyId: "sciences" },
      { name: "Sciences sociales", facultyId: "sciences_sociales" },
    ],
  },
  {
    id: "unh",
    acronym: "UNH",
    name: "Université Nouveaux Horizons",
    city: "Lubumbashi",
    unitLabel: "Faculté",
    programLabel: "Filière",
    coverage: "facultes",
    source: { url: "https://www.unhorizons.org/decouvrir-nos-formations/", checkedOn: CHECKED, note: "Liste des facultés relevée sur la page « Découvrir nos formations » ; filières à compléter." },
    units: [
      { name: "Médecine", facultyId: "medecine_sante" },
      { name: "SIC / Multimédia", facultyId: "sciences_sociales" },
      { name: "Sciences Technologiques", facultyId: "polytechnique" },
      { name: "Sciences des Aliments et de l'Environnement", facultyId: "agronomie" },
      { name: "Droit", facultyId: "droit" },
      { name: "Sciences Informatiques", facultyId: "informatique" },
      { name: "Sciences de Gestion", facultyId: "economie_gestion" },
      { name: "École Supérieure d'Architecture et d'Urbanisme", facultyId: "polytechnique" },
    ],
  },
  {
    id: "upl",
    acronym: "UPL",
    name: "Université Protestante de Lubumbashi",
    city: "Lubumbashi",
    unitLabel: "Faculté",
    programLabel: "Filière",
    coverage: "facultes",
    source: { url: "https://upl-univ.ac/pages/programmes.html", checkedOn: CHECKED, note: "Le site publie les facultés ; seule la faculté de Droit précise sa filière (licence unique)." },
    units: [
      { name: "Sciences Informatiques", facultyId: "informatique" },
      { name: "Polytechnique", facultyId: "polytechnique" },
      { name: "Architecture", facultyId: "polytechnique" },
      { name: "Sciences de l'Information et Communication", facultyId: "sciences_sociales" },
      { name: "Langues et Informatiques Appliquées aux affaires et aux Commerces", facultyId: "lettres" },
      { name: "Théologie", facultyId: "autre" },
      { name: "Droit", facultyId: "droit", programs: ["Licence en droit (licence unique)"] },
      { name: "Économie", facultyId: "economie_gestion" },
    ],
  },
  {
    id: "ecopo",
    acronym: "ECOPO",
    name: "École Supérieure de la Gouvernance Économique et Politique de Lubumbashi",
    city: "Lubumbashi",
    unitLabel: "Filière",
    programLabel: "Programme",
    coverage: "programmes",
    source: { url: "https://www.ecopo-edu.org/", checkedOn: CHECKED, note: "Site officiel inaccessible lors de la vérification : programmes relevés dans son index, à confirmer auprès de l'école." },
    units: [
      { name: "Gestion des entreprises et des organisations", facultyId: "economie_gestion", programs: ["Licence", "Master : Gestion des entreprises et ingénierie financière"] },
      { name: "Management commercial et marketing", facultyId: "economie_gestion", programs: ["Licence", "Master : Management commercial et marketing"] },
      { name: "Gestion des affaires publiques", facultyId: "sciences_sociales", programs: ["Master : Gestion des affaires publiques"] },
      { name: "Diversification et développement agroalimentaire et industriel", facultyId: "agronomie", programs: ["Master : Diversification et développement agroalimentaire et industriel"] },
    ],
  },
  {
    id: "unikin",
    acronym: "UNIKIN",
    name: "Université de Kinshasa",
    city: "Kinshasa",
    unitLabel: "Faculté",
    programLabel: "Département ou master",
    coverage: "facultes",
    source: { url: "https://www.unikin.ac.cd/facultes-et-entites", checkedOn: CHECKED, note: "Départements et masters publiés pour la faculté des sciences économiques et de gestion ; à compléter pour les autres facultés." },
    units: [
      {
        name: "Sciences économiques et de gestion",
        facultyId: "economie_gestion",
        programs: [
          "Département des Sciences Économiques",
          "Département des Sciences de Gestion",
          "Département d'IGAF et GAF",
          "Master en Économie Monétaire et Financière (MEMF)",
          "Master en Économie Industrielle (MEI)",
          "Master en Économie Quantitative (MEQ)",
          "Master en Économie Régionale et Internationale (MERI)",
          "Master en Économie Rurale (MER)",
          "Master en Économie Publique (MEP)",
          "Master en Économie de Développement (MED)",
          "Master en Comptabilité et Audit (MCA)",
          "Master en Gestion Financière (MGF)",
          "Master en Gestion Marketing (MGM)",
          "Master en Management des Organisations (MMO)",
          "Master en Gestion des Ressources Humaines (MGRH)",
          "Master en Gestion des Systèmes d'Information (MGSI)",
          "Master en Gestion Bancaire, Microfinance et Assurances (MGBMA)",
          "Master Entrepreneuriat (ME)",
          "Master en Gestion de la Production (MGP)",
          "Master en Gestion du Commerce International (MGCI)",
          "Master en Fiscalité (MF)",
          "Master en Gestion des Projets (MGPro)",
        ],
      },
      { name: "Droit", facultyId: "droit" },
      { name: "Lettres et Sciences Humaines", facultyId: "lettres" },
      { name: "Médecine", facultyId: "medecine_sante" },
      { name: "Médecine dentaire", facultyId: "medecine_sante" },
      { name: "Médecine vétérinaire", facultyId: "agronomie" },
      { name: "Pétrole, Gaz et Énergies Nouvelles", facultyId: "polytechnique" },
      { name: "Polytechnique", facultyId: "polytechnique" },
      { name: "Psychologie et Sciences de l'Éducation", facultyId: "psychologie_education" },
      { name: "Sciences et Technologies", facultyId: "sciences" },
      { name: "Sciences agronomiques", facultyId: "agronomie" },
      { name: "Sciences pharmaceutiques", facultyId: "medecine_sante" },
      { name: "Sciences Sociales, Administratives et Politiques", facultyId: "sciences_sociales" },
      { name: "École de Santé Publique de Kinshasa", facultyId: "medecine_sante" },
      { name: "École de Criminologie", facultyId: "sciences_sociales" },
    ],
  },
  {
    id: "upc",
    acronym: "UPC",
    name: "Université Protestante au Congo",
    city: "Kinshasa",
    unitLabel: "Faculté",
    programLabel: "Département",
    coverage: "programmes",
    source: { url: "https://www.upc.ac.cd/", checkedOn: CHECKED },
    units: [
      { name: "Administration, Affaires et Sciences Économiques (FASE)", facultyId: "economie_gestion", programs: ["Administration des Affaires", "Sciences Économiques"] },
      { name: "Sciences Informatiques (FASI)", facultyId: "informatique", programs: ["Génie Informatique", "Systèmes Informatiques", "Intelligence Artificielle"] },
      { name: "Droit", facultyId: "droit", programs: ["Droit Économique et Social", "Droit Privé et Judiciaire", "Droit Public"] },
      { name: "Médecine", facultyId: "medecine_sante", programs: ["Formation Médicale", "Sciences de la Santé", "Encadrement Clinique"] },
      { name: "Théologie", facultyId: "autre", programs: ["Théologie Systématique", "Théologie Pratique", "Ancien Testament", "Nouveau Testament", "Histoire", "Missiologie"] },
    ],
  },
  {
    id: "upn",
    acronym: "UPN",
    name: "Université Pédagogique Nationale",
    city: "Kinshasa",
    unitLabel: "Faculté",
    programLabel: "Département ou filière",
    coverage: "facultes",
    source: { url: "https://www.upn.ac.cd/", checkedOn: CHECKED, note: "Le site publie les facultés, pas leurs départements." },
    units: [
      { name: "Pédagogie et Didactique des Disciplines", facultyId: "psychologie_education" },
      { name: "Sciences et Technologies", facultyId: "sciences" },
      { name: "Sciences de la Santé", facultyId: "medecine_sante" },
      { name: "Lettres et Sciences Humaines", facultyId: "lettres" },
      { name: "Psychologie et Sciences de l'Éducation", facultyId: "psychologie_education" },
      { name: "Sciences Économiques et de Gestion", facultyId: "economie_gestion" },
      { name: "Sciences Agronomiques", facultyId: "agronomie" },
      { name: "Médecine Vétérinaire", facultyId: "agronomie" },
      { name: "Sciences Sociales, Administratives et Politiques", facultyId: "sciences_sociales" },
      { name: "Sciences Juridiques", facultyId: "droit" },
      { name: "École de Télécommunication et Télédétection Spatiale", facultyId: "informatique" },
    ],
  },
  // Établissements dont l'offre n'a pas pu être vérifiée sur un site officiel : facultés générales + filière libre.
  { id: "hec-kinshasa", acronym: "HEC-Kin", name: "Haute École de Commerce de Kinshasa (ex-ISC Kinshasa)", city: "Kinshasa", unitLabel: "Faculté", programLabel: "Filière", coverage: "aucune" },
  { id: "ucc", acronym: "UCC", name: "Université Catholique du Congo", city: "Kinshasa", unitLabel: "Faculté", programLabel: "Filière", coverage: "aucune" },
  { id: "unikis", acronym: "UNIKIS", name: "Université de Kisangani", city: "Kisangani", unitLabel: "Faculté", programLabel: "Filière", coverage: "aucune" },
  { id: "uob", acronym: "UOB", name: "Université Officielle de Bukavu", city: "Bukavu", unitLabel: "Faculté", programLabel: "Filière", coverage: "aucune" },
  { id: "ucb", acronym: "UCB", name: "Université Catholique de Bukavu", city: "Bukavu", unitLabel: "Faculté", programLabel: "Filière", coverage: "aucune" },
  { id: "ulpgl", acronym: "ULPGL", name: "Université Libre des Pays des Grands Lacs", city: "Goma", unitLabel: "Faculté", programLabel: "Filière", coverage: "aucune" },
  { id: "unigom", acronym: "UNIGOM", name: "Université de Goma", city: "Goma", unitLabel: "Faculté", programLabel: "Filière", coverage: "aucune" },
];

export const INSTITUTION_BY_ID: Record<string, Institution> = Object.fromEntries(INSTITUTIONS.map((i) => [i.id, i]));

export const institutionLabel = (i: Institution) => (i.name ? `${i.acronym} — ${i.name}` : i.acronym);

/** Phrase de provenance affichée sous la liste des facultés et filières. */
export function sourceNote(i: Institution): string | null {
  if (!i.source) return null;
  const date = new Date(`${i.source.checkedOn}T12:00:00Z`).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  return `Selon le site officiel de l'établissement (consulté le ${date}).${i.source.note ? ` ${i.source.note}` : ""}`;
}
