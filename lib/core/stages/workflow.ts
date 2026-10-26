// MNJ Stage Connect — moteur du suivi (pur, testé).
//
// Le statut d'un dossier n'est jamais saisi à la main : il découle de faits enregistrés dans ACADIA.
//   1. En attente d'orientation : l'étudiant a envoyé son dossier.
//   2. Dossier complet          : le pack est réglé ET l'équipe MNJ a coché tous les documents obligatoires.
//   3. Orienté vers une entreprise : l'équipe a inscrit l'entreprise visée.
//   4. Placé en entreprise      : l'entreprise a accepté — maître de stage, date de début et date de fin inscrits.
//   5. En stage                 : la date de début est arrivée (les présences s'ouvrent).
//   6. Stage terminé            : la date de fin est passée (le registre est clos, le rapport et l'attestation de présence sont disponibles).
// Seule l'annulation est une décision (de l'étudiant avant paiement, ou de l'équipe).

import { ACADEMIC_STAGE_MONTHS, ACTIVITIES_MIN, ATTENDANCE_MIN_RATE, isPaid, REQUIRED_DOCUMENTS, STAGE_TIMEZONE, type StageStatus, type StageType } from "./catalog";

export interface WorkflowFacts {
  type: StageType;
  status: string;
  paymentStatus: string;
  documentsReceived: string[];
  assignedCompany: string | null;
  tutorName: string | null;
  startDate: string | null;
  endDate: string | null;
}

/** Comment chaque étape est atteinte (affiché à l'étudiant et à l'équipe). */
export const STEP_HOW: Record<StageStatus, string> = {
  en_attente: "Votre dossier est envoyé.",
  dossier_complet: "Pack réglé et documents reçus par MNJ.",
  oriente: "MNJ a choisi l'entreprise adaptée.",
  place: "L'entreprise a accepté : maître de stage et dates fixés.",
  en_stage: "Le stage a commencé : vous signez vos présences chaque jour.",
  termine: "Date de fin passée : registre clos, rapport prêt.",
  annule: "Dossier annulé.",
};

/** Jour civil « AAAA-MM-JJ » d'un instant dans le fuseau de référence. */
export function dayKey(instant: Date, timeZone = STAGE_TIMEZONE): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const isDay = (v: unknown): v is string => typeof v === "string" && DAY.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

function shiftDay(day: string, days: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Fin par défaut d'un stage académique : début + 1 mois − 1 jour (ex. 3 nov. → 2 déc.). */
export function defaultEndDate(startDate: string, months = ACADEMIC_STAGE_MONTHS): string {
  const d = new Date(`${startDate}T00:00:00Z`);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()));
  // 31 janvier + 1 mois : on s'arrête au dernier jour du mois suivant, pas au 3 mars.
  if (target.getUTCDate() !== d.getUTCDate()) target.setUTCDate(0);
  return shiftDay(target.toISOString().slice(0, 10), -1);
}

export function missingDocuments(type: StageType, received: string[]): string[] {
  return REQUIRED_DOCUMENTS[type].filter((d) => !d.optional && !received.includes(d.label)).map((d) => d.label);
}

/** Étape atteinte, d'après les faits, au jour `today`. */
export function computeStatus(f: WorkflowFacts, today: string): StageStatus {
  if (f.status === "annule") return "annule";
  if (!isPaid(f.paymentStatus) || missingDocuments(f.type, f.documentsReceived).length) return "en_attente";
  if (!f.assignedCompany?.trim()) return "dossier_complet";
  if (!f.tutorName?.trim() || !isDay(f.startDate) || !isDay(f.endDate)) return "oriente";
  if (today < f.startDate) return "place";
  if (today <= f.endDate) return "en_stage";
  return "termine";
}

export interface NextStep {
  /** Ce qui manque, formulé pour l'étudiant. */
  student: string[];
  /** Ce qui manque, formulé pour l'équipe MNJ. */
  team: string[];
}

/** Ce qu'il reste à faire pour passer à l'étape suivante. */
export function nextStep(f: WorkflowFacts, today: string): NextStep {
  const status = computeStatus(f, today);
  if (status === "en_attente") {
    const docs = missingDocuments(f.type, f.documentsReceived);
    const student = [...(isPaid(f.paymentStatus) ? [] : ["Régler votre pack d'accompagnement."]), ...(docs.length ? [`Remettre à MNJ : ${docs.join(", ")}.`] : [])];
    const team = [...(isPaid(f.paymentStatus) ? [] : ["Pack non réglé."]), ...(docs.length ? [`Documents à recevoir : ${docs.join(", ")}.`] : [])];
    return { student, team };
  }
  if (status === "dossier_complet") return { student: ["MNJ recherche l'entreprise adaptée à votre profil."], team: ["Inscrire l'entreprise visée (orientation)."] };
  if (status === "oriente") {
    const missing = [!f.tutorName?.trim() ? "le maître de stage" : null, !isDay(f.startDate) ? "la date de début" : null, !isDay(f.endDate) ? "la date de fin" : null].filter(Boolean);
    return { student: ["MNJ attend l'accord de l'entreprise et la date de début."], team: [`Inscrire l'accord de l'entreprise : ${missing.join(", ")}.`] };
  }
  if (status === "place") return { student: [`Votre stage commence le ${formatDay(f.startDate!)} : vos présences s'ouvriront ce jour-là.`], team: [`Début du stage le ${formatDay(f.startDate!)}.`] };
  if (status === "en_stage") return { student: ["Chaque jour : signez votre arrivée, puis clôturez la journée en décrivant vos activités."], team: [`Stage en cours jusqu'au ${formatDay(f.endDate!)}.`] };
  if (status === "termine") return { student: ["Votre registre est clos : générez votre rapport de stage."], team: ["Transmettre le registre de présences et les cotes à la faculté."] };
  return { student: [], team: [] };
}

/** Jour en début de phrase : « Lundi 26 octobre 2026 ». */
export const formatDayTitle = (day: string) => {
  const s = formatDay(day);
  return s.charAt(0).toUpperCase() + s.slice(1);
};

export function formatDay(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/* ------------------------------------ Présences ------------------------------------ */

export interface AttendanceRecord {
  day: string;
  arrivalAt: string | Date;
  departureAt: string | Date | null;
  activities: string | null;
  tutorConfirmedAt: string | Date | null;
}

/** Jours ouvrés attendus (lundi à vendredi) entre deux dates incluses. [À VALIDER : samedis selon les entreprises] */
export function expectedDays(startDate: string, endDate: string): string[] {
  const days: string[] = [];
  for (let d = startDate; d <= endDate; d = shiftDay(d, 1)) {
    const weekday = new Date(`${d}T12:00:00Z`).getUTCDay();
    if (weekday !== 0 && weekday !== 6) days.push(d);
    if (days.length > 400) break;
  }
  return days;
}

export interface AttendanceSummary {
  /** Jours ouvrés attendus jusqu'à aujourd'hui (ou jusqu'à la fin si le stage est terminé). */
  expected: number;
  /** Jours complets : arrivée et départ signés, journée décrite. */
  complete: number;
  /** Arrivée signée sans départ. */
  incomplete: number;
  /** Jours confirmés par le maître de stage. */
  confirmed: number;
  /** Jours ouvrés attendus sans aucune signature. */
  absent: string[];
  rate: number | null;
  /** Stage terminé et taux de présence ≥ seuil. */
  inOrder: boolean;
  totalPlanned: number;
}

export function summarizeAttendance(records: AttendanceRecord[], startDate: string | null, endDate: string | null, today: string): AttendanceSummary {
  if (!isDay(startDate) || !isDay(endDate)) return { expected: 0, complete: 0, incomplete: 0, confirmed: 0, absent: [], rate: null, inOrder: false, totalPlanned: 0 };
  const planned = expectedDays(startDate, endDate);
  // Aujourd'hui n'est compté absent qu'une fois la journée passée.
  const due = planned.filter((d) => d < today);
  const byDay = new Map(records.map((r) => [r.day, r]));
  const complete = records.filter((r) => r.departureAt && (r.activities ?? "").trim().length >= ACTIVITIES_MIN).length;
  const incomplete = records.filter((r) => !r.departureAt && r.day < today).length;
  const confirmed = records.filter((r) => r.tutorConfirmedAt).length;
  const absent = due.filter((d) => !byDay.has(d));
  const presentDue = due.filter((d) => byDay.get(d)?.departureAt).length;
  const rate = due.length ? presentDue / due.length : null;
  const finished = today > endDate;
  return { expected: due.length, complete, incomplete, confirmed, absent, rate, inOrder: finished && rate !== null && rate >= ATTENDANCE_MIN_RATE, totalPlanned: planned.length };
}

export type AttendanceAction = { action: "arrivee" } | { action: "depart"; activities: string };

/** Règles d'une signature ; renvoie un message d'erreur ou null si elle est permise. */
export function attendanceError(status: StageStatus, today: string, startDate: string | null, endDate: string | null, existing: AttendanceRecord | null, input: AttendanceAction): string | null {
  if (status !== "en_stage" || !isDay(startDate) || !isDay(endDate) || today < startDate || today > endDate) return "Les présences ne sont ouvertes que pendant la période du stage.";
  if (input.action === "arrivee") return existing ? "Votre arrivée est déjà signée pour aujourd'hui." : null;
  if (!existing) return "Signez d'abord votre arrivée.";
  if (existing.departureAt) return "Votre journée est déjà clôturée.";
  if (input.activities.trim().length < ACTIVITIES_MIN) return `Décrivez vos activités de la journée (au moins ${ACTIVITIES_MIN} caractères).`;
  return null;
}
