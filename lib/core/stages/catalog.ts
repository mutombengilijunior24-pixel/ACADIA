/**
 * MNJ Stage Connect : référentiel partagé (navigateur et serveur) — types de stage, facultés et filières,
 * niveaux, compétences suggérées, étapes du suivi, pack d'accompagnement et documents à fournir,
 * validation du dossier de candidature.
 */
import { z } from "zod";

import { INSTITUTION_BY_ID } from "./institutions";

export const STAGE_TYPES = ["academique", "professionnel"] as const;
export type StageType = (typeof STAGE_TYPES)[number];

export const STAGE_TYPE_LABELS: Record<StageType, string> = { academique: "Stage académique", professionnel: "Stage professionnel" };
export const STAGE_TYPE_PITCH: Record<StageType, string> = {
  academique: "Pendant vos études : le stage exigé par votre faculté, suivi et attesté jusqu'à la remise de vos cotes.",
  professionnel: "Après vos études ou en fin de cycle : une première expérience en entreprise pour lancer votre carrière.",
};

export const FACULTY_IDS = ["economie_gestion", "polytechnique", "droit", "sciences", "informatique", "medecine_sante", "agronomie", "sciences_sociales", "lettres", "psychologie_education", "autre"] as const;
export type FacultyId = (typeof FACULTY_IDS)[number];

export interface Faculty {
  id: FacultyId;
  label: string;
  /** Filières et départements proposés (saisie libre toujours possible). */
  departments: string[];
  /** Compétences suggérées pour orienter vers l'entreprise. */
  skills: string[];
}

export const FACULTIES: Faculty[] = [
  { id: "economie_gestion", label: "Sciences économiques et de gestion", departments: ["Économie générale", "Économie monétaire et bancaire", "Économie du développement", "Économie rurale", "Gestion financière", "Comptabilité et audit", "Marketing et gestion commerciale", "Gestion des ressources humaines", "Entrepreneuriat", "Informatique de gestion", "Douane et accises", "Fiscalité"], skills: ["Comptabilité SYSCOHADA", "Analyse financière", "Contrôle de gestion", "Fiscalité", "Audit", "Gestion de trésorerie", "Banque et crédit", "Marketing digital", "Vente et négociation", "Gestion des ressources humaines", "Paie", "Excel avancé", "Logiciels comptables", "Montage de projets", "Études de marché"] },
  { id: "polytechnique", label: "Polytechnique (sciences de l'ingénieur)", departments: ["Génie civil", "Génie électrique", "Électromécanique", "Génie mécanique", "Génie des mines", "Métallurgie", "Chimie industrielle", "Génie informatique", "Télécommunications", "Architecture"], skills: ["Lecture de plans", "Suivi de chantier", "AutoCAD", "Maintenance industrielle", "Électricité industrielle", "Automatismes", "Sécurité et hygiène (HSE)", "Exploitation minière", "Traitement des minerais", "Topographie", "Programmation", "Réseaux et télécoms", "Gestion de projet"] },
  { id: "droit", label: "Droit", departments: ["Droit privé et judiciaire", "Droit public", "Droit économique et social", "Droit international"], skills: ["Rédaction juridique", "Droit des affaires OHADA", "Droit du travail", "Contentieux", "Conformité", "Fiscalité", "Contrats"] },
  { id: "sciences", label: "Sciences", departments: ["Mathématiques", "Informatique", "Physique", "Chimie", "Biologie", "Géologie", "Géographie", "Environnement"], skills: ["Analyse de laboratoire", "Programmation", "Analyse de données", "Systèmes d'information géographique", "Contrôle qualité", "Environnement et études d'impact"] },
  { id: "informatique", label: "Informatique et sciences du numérique", departments: ["Génie logiciel", "Réseaux", "Systèmes d'information", "Science des données", "Cybersécurité"], skills: ["Développement web", "Développement mobile", "Bases de données", "Administration réseau", "Cybersécurité", "Analyse de données", "Support informatique"] },
  { id: "medecine_sante", label: "Médecine, pharmacie et santé publique", departments: ["Médecine", "Pharmacie", "Santé publique", "Sciences infirmières", "Biologie médicale"], skills: ["Soins et pratique clinique", "Gestion pharmaceutique", "Santé communautaire", "Épidémiologie", "Laboratoire", "Gestion hospitalière"] },
  { id: "agronomie", label: "Sciences agronomiques et vétérinaires", departments: ["Phytotechnie", "Zootechnie", "Économie agricole", "Eaux et forêts", "Médecine vétérinaire", "Agroalimentaire"], skills: ["Production agricole", "Élevage", "Agroalimentaire", "Gestion d'exploitation", "Vulgarisation agricole", "Contrôle qualité"] },
  { id: "sciences_sociales", label: "Sciences sociales, politiques et administratives", departments: ["Sociologie", "Anthropologie", "Sciences politiques", "Relations internationales", "Sciences administratives", "Communication"], skills: ["Enquêtes de terrain", "Gestion de projets sociaux", "Administration publique", "Communication institutionnelle", "Relations publiques", "Suivi-évaluation"] },
  { id: "lettres", label: "Lettres et sciences humaines", departments: ["Langues et littératures", "Histoire", "Philosophie", "Journalisme", "Sciences de l'information"], skills: ["Rédaction", "Traduction", "Journalisme", "Communication", "Documentation et archives", "Enseignement"] },
  { id: "psychologie_education", label: "Psychologie et sciences de l'éducation", departments: ["Psychologie", "Sciences de l'éducation", "Orientation scolaire"], skills: ["Accompagnement psychologique", "Recrutement et évaluation", "Formation", "Orientation", "Pédagogie"] },
  { id: "autre", label: "Autre faculté ou institut", departments: [], skills: ["Communication", "Bureautique", "Gestion de projet", "Service client", "Travail en équipe"] },
];

export const FACULTY_BY_ID: Record<string, Faculty> = Object.fromEntries(FACULTIES.map((f) => [f.id, f]));

export const LEVELS = ["G1 / L1", "G2 / L2", "G3 / L3 (Bac + 3)", "Master 1", "Master 2", "Diplômé(e)"] as const;

/** Étapes du suivi d'un dossier (pipeline du CRM). */
export const STAGE_STATUSES = ["en_attente", "dossier_complet", "oriente", "place", "en_stage", "termine", "annule"] as const;
export type StageStatus = (typeof STAGE_STATUSES)[number];

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  en_attente: "En attente d'orientation",
  dossier_complet: "Dossier complet",
  oriente: "Orienté vers une entreprise",
  place: "Placé en entreprise",
  en_stage: "En stage",
  termine: "Stage terminé",
  annule: "Annulé",
};

export const PAYMENT_STATES = ["non_paye", "en_attente", "paye", "paye_bureau", "echoue"] as const;
export type StagePaymentState = (typeof PAYMENT_STATES)[number];

export const PAYMENT_STATE_LABELS: Record<StagePaymentState, string> = {
  non_paye: "Pack non réglé",
  en_attente: "Paiement en attente de confirmation",
  paye: "Pack réglé (paiement en ligne)",
  paye_bureau: "Pack réglé (au bureau)",
  echoue: "Paiement non abouti",
};

export const isPaid = (state: string) => state === "paye" || state === "paye_bureau";

/** Accompagnement MNJ Stage Connect : clé du paiement (moteur de paiement et webhook). */
export const STAGE_PACK = {
  key: "stage_connect_pack",
  title: "Accompagnement Stage Connect",
} as const;

/**
 * Options au choix (au moins une) : la recommandation est cochée d'office, l'assurance s'ajoute.
 * Les deux : 27 $. [À VÉRIFIER : garanties exactes du contrat Global Sûreté]
 */
export const STAGE_OPTIONS = [
  {
    id: "recommandation",
    title: "Recommandation de stage",
    priceUsd: 17,
    preselected: true,
    items: [
      { title: "Recommandation auprès de l'entreprise", detail: "MNJ vous présente et vous recommande à une entreprise adaptée à votre faculté et à vos objectifs." },
      { title: "Suivi personnalisé", detail: "Un conseiller suit votre dossier, de l'orientation jusqu'à la fin du stage." },
      { title: "Accompagnement jusqu'à l'installation", detail: "Nous vous accompagnons jusqu'à votre installation dans les bureaux de l'entreprise." },
      { title: "Suivi pendant le stage", detail: "Présences, horaires et évaluation : le suivi est organisé avec l'entreprise." },
      { title: "Transmission à la faculté", detail: "Ce n'est pas vous qui courez : MNJ transmet à votre faculté les documents et les cotes de stage." },
    ],
  },
  {
    id: "assurance",
    title: "Assurance stage",
    priceUsd: 10,
    preselected: false,
    items: [{ title: "Micro-assurance stage d'un mois", detail: "Avec notre partenaire Global Sûreté : maladie et accidents pendant votre stage, selon les conditions du contrat." }],
  },
] as const;

export type StageOptionId = (typeof STAGE_OPTIONS)[number]["id"];
export const STAGE_OPTION_IDS = STAGE_OPTIONS.map((o) => o.id) as StageOptionId[];
export const DEFAULT_STAGE_OPTIONS: StageOptionId[] = STAGE_OPTIONS.filter((o) => o.preselected).map((o) => o.id);
export const isStageOption = (v: unknown): v is StageOptionId => typeof v === "string" && (STAGE_OPTION_IDS as string[]).includes(v);

/** Options valides, sans doublon, dans l'ordre du catalogue. */
export const normalizeOptions = (ids: readonly unknown[]): StageOptionId[] => STAGE_OPTION_IDS.filter((id) => ids.includes(id));

/** Montant en dollars des options choisies (17 $, 10 $, ou 27 $ pour les deux). */
export const optionsTotal = (ids: readonly unknown[]): number => STAGE_OPTIONS.filter((o) => ids.includes(o.id)).reduce((sum, o) => sum + o.priceUsd, 0);

export const optionsLabel = (ids: readonly unknown[]): string => STAGE_OPTIONS.filter((o) => ids.includes(o.id)).map((o) => o.title.toLowerCase()).join(" + ");

/** Options effectivement réglées (un dossier réglé avant l'arrivée des options compte pour les deux). */
export const paidOptions = (a: { paymentStatus: string; packOptions: readonly string[] }): StageOptionId[] => (isPaid(a.paymentStatus) ? (a.packOptions.length ? normalizeOptions(a.packOptions) : [...STAGE_OPTION_IDS]) : []);

/** Documents à fournir après l'inscription ; l'équipe MNJ coche ceux qu'elle a reçus. */
export interface StageDocument {
  label: string;
  optional?: boolean;
}
export const REQUIRED_DOCUMENTS: Record<StageType, StageDocument[]> = {
  academique: [{ label: "Carte d'étudiant ou attestation de fréquentation" }, { label: "Lettre ou fiche de recommandation de stage délivrée par la faculté" }, { label: "Pièce d'identité" }, { label: "CV (même court)" }],
  professionnel: [{ label: "Pièce d'identité" }, { label: "Diplôme ou attestation de réussite" }, { label: "CV" }, { label: "Lettre de motivation", optional: true }],
};

/** Fuseau de référence pour dater les présences (siège MNJ Stage Connect). */
export const STAGE_TIMEZONE = "Africa/Lubumbashi";
/** Durée par défaut d'un stage académique (mois). */
export const ACADEMIC_STAGE_MONTHS = 1;
/** Taux de présence minimal pour être « en ordre ». [À VALIDER avec les facultés] */
export const ATTENDANCE_MIN_RATE = 0.8;
/** Longueur minimale du compte rendu de la journée. */
export const ACTIVITIES_MIN = 20;

/** Moyens de paiement proposés (le fournisseur réel est choisi côté serveur). */
export const PAYMENT_METHODS = [
  { id: "mpesa", label: "M-Pesa" },
  { id: "orange_money", label: "Orange Money" },
  { id: "airtel_money", label: "Airtel Money" },
  { id: "carte", label: "Carte bancaire" },
] as const;

const text = (max: number) => z.string().trim().max(max);

export const stageApplicationSchema = z
  .object({
    type: z.enum(STAGE_TYPES),
    lastName: text(80).min(2, "Votre nom est requis."),
    postName: text(80),
    firstName: text(80).min(2, "Votre prénom est requis."),
    phone: text(30).regex(/^\+?[\d\s().-]{8,30}$/, "Numéro de téléphone invalide (ex. +243 81 234 5678)."),
    email: text(160).email("Adresse e-mail invalide."),
    university: text(160).min(2, "Votre université ou institut est requis."),
    institutionId: z.string().refine((v) => v === "" || !!INSTITUTION_BY_ID[v], "Établissement inconnu."),
    faculty: z.string().refine((v) => !!FACULTY_BY_ID[v], "Choisissez votre faculté."),
    facultyName: text(160),
    studentNumber: text(40),
    department: text(120).min(2, "Votre filière ou département est requis."),
    level: z.enum(LEVELS, { message: "Choisissez votre niveau." }),
    graduationYear: z.number().int().min(1980).max(2100).nullable(),
    skills: z.array(text(80).min(2)).min(1, "Choisissez au moins une compétence à acquérir.").max(12),
    objectives: text(1500).min(20, "Décrivez vos objectifs de stage (au moins une phrase)."),
    preferredCompany: text(160),
    preferredCity: text(80),
    startMonth: z.string().regex(/^(\d{4}-\d{2})?$/, "Mois invalide."),
    consent: z.literal(true, { message: "Votre accord est nécessaire pour traiter votre dossier." }),
  })
  .refine((v) => v.level !== "Diplômé(e)" || v.graduationYear !== null, { message: "Indiquez votre année de fin d'études.", path: ["graduationYear"] });

export type StageApplicationInput = z.infer<typeof stageApplicationSchema>;
