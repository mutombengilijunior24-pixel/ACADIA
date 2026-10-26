// MNJ Stage Connect — classeur Excel du suivi des candidats (pur, sans accès réseau).

import type { Cell, Sheet } from "@/lib/core/export/xlsx";

import { FACULTY_BY_ID, PAYMENT_STATE_LABELS, STAGE_STATUS_LABELS, STAGE_TYPE_LABELS, type StagePaymentState, type StageStatus, type StageType } from "./catalog";

export interface StageExportRow {
  type: StageType;
  status: StageStatus;
  lastName: string;
  postName: string;
  firstName: string;
  phone: string;
  email: string;
  university: string;
  faculty: string;
  facultyName?: string | null;
  studentNumber?: string | null;
  department: string;
  level: string;
  graduationYear: number | null;
  skills: string[];
  objectives: string;
  preferredCompany: string | null;
  preferredCity: string | null;
  startMonth: string | null;
  paymentStatus: StagePaymentState;
  assignedCompany: string | null;
  tutorName?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  adminNotes: string | null;
  createdAt: string;
}

export const facultyLabel = (id: string) => FACULTY_BY_ID[id]?.label ?? id;
const facultyOfRow = (r: StageExportRow) => r.facultyName || facultyLabel(r.faculty);

export const STAGE_EXPORT_HEADER = ["Date", "Heure", "Type de stage", "Nom", "Post-nom", "Prénom", "Matricule", "Téléphone", "E-mail", "Université", "Faculté", "Filière", "Niveau", "Année de fin", "Compétences visées", "Objectifs", "Entreprise souhaitée", "Ville", "Début souhaité", "Étape", "Paiement du pack", "Entreprise retenue", "Maître de stage", "Début du stage", "Fin du stage", "Notes"];
const WIDTHS = [11, 7, 18, 16, 16, 16, 14, 16, 26, 30, 34, 28, 16, 10, 40, 60, 24, 14, 12, 24, 30, 24, 24, 12, 12, 30];

function table(rows: StageExportRow[]): Cell[][] {
  return [
    STAGE_EXPORT_HEADER,
    ...rows.map((r) => {
      const d = new Date(r.createdAt);
      return [d.toLocaleDateString("fr-FR"), d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), STAGE_TYPE_LABELS[r.type], r.lastName, r.postName, r.firstName, r.studentNumber, r.phone, r.email, r.university, facultyOfRow(r), r.department, r.level, r.graduationYear, r.skills.join(", "), r.objectives, r.preferredCompany, r.preferredCity, r.startMonth, STAGE_STATUS_LABELS[r.status], PAYMENT_STATE_LABELS[r.paymentStatus], r.assignedCompany, r.tutorName, r.startDate, r.endDate, r.adminNotes];
    }),
  ];
}

/** Feuilles : tous les candidats, synthèse faculté × filière × niveau, puis une feuille par faculté. */
export function stageWorkbookSheets(rows: StageExportRow[], title: string): Sheet[] {
  const counts = new Map<string, { faculty: string; department: string; level: string; n: number }>();
  for (const r of rows) {
    const key = `${facultyOfRow(r)}\u0000${r.department}\u0000${r.level}`;
    const entry = counts.get(key) ?? { faculty: facultyOfRow(r), department: r.department, level: r.level, n: 0 };
    entry.n += 1;
    counts.set(key, entry);
  }
  const segments = [...counts.values()].sort((a, b) => a.faculty.localeCompare(b.faculty, "fr") || a.department.localeCompare(b.department, "fr") || a.level.localeCompare(b.level, "fr"));
  const faculties = [...new Set(rows.map((r) => r.faculty))].sort((a, b) => facultyLabel(a).localeCompare(facultyLabel(b), "fr"));
  return [
    { name: "Candidats", rows: [[title], ...table(rows)], titles: [0], bold: [1], widths: WIDTHS },
    { name: "Par faculté et filière", rows: [[title], ["Faculté", "Filière", "Niveau", "Candidats"], ...segments.map((s) => [s.faculty, s.department, s.level, s.n])], titles: [0], bold: [1], widths: [36, 30, 18, 12] },
    // sheetName() (dans buildWorkbook) tronque à 31 caractères et rend les noms uniques.
    ...faculties.map((f) => ({ name: facultyLabel(f), rows: [[`${facultyLabel(f)} — ${title}`], ...table(rows.filter((r) => r.faculty === f))], titles: [0], bold: [1], widths: WIDTHS })),
  ];
}
