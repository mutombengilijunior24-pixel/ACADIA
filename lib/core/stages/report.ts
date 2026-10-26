// MNJ Stage Connect — rapport de stage (projet à compléter) et registre de présences, à partir du journal.
// Rien n'est rédigé à la place de l'étudiant : ses comptes rendus journaliers sont repris tels quels, et les
// parties qu'il doit écrire sont marquées « [À rédiger : …] ».

import type { ReportDocument } from "@/lib/core/export/document";
import type { Cell, Sheet } from "@/lib/core/export/xlsx";

import { ATTENDANCE_MIN_RATE, FACULTY_BY_ID, STAGE_TIMEZONE, STAGE_TYPE_LABELS, type StageType } from "./catalog";
import { formatDay, summarizeAttendance, type AttendanceRecord, type AttendanceSummary } from "./workflow";

export interface StageReportInput {
  type: StageType;
  lastName: string;
  postName: string;
  firstName: string;
  university: string;
  faculty: string;
  facultyName: string | null;
  department: string;
  level: string;
  studentNumber: string | null;
  skills: string[];
  objectives: string;
  assignedCompany: string | null;
  companyAddress: string | null;
  tutorName: string | null;
  tutorRole: string | null;
  startDate: string | null;
  endDate: string | null;
  attendance: AttendanceRecord[];
}

export const fullName = (s: { lastName: string; postName: string; firstName: string }) => [s.lastName, s.postName, s.firstName].filter(Boolean).join(" ");
export const facultyOf = (s: { faculty: string; facultyName: string | null }) => s.facultyName || FACULTY_BY_ID[s.faculty]?.label || s.faculty;

export function timeOf(value: string | Date | null): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", { timeZone: STAGE_TIMEZONE, hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export function duration(r: AttendanceRecord): string {
  if (!r.departureAt) return "—";
  const minutes = Math.max(0, Math.round((new Date(r.departureAt).getTime() - new Date(r.arrivalAt).getTime()) / 60000));
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, "0")}`;
}

export function summaryLine(s: AttendanceSummary): string {
  if (s.rate === null) return "Aucune journée de stage écoulée pour l'instant.";
  const pct = Math.round(s.rate * 100);
  return `${s.complete} journée(s) complète(s) ; présence ${pct} % des ${s.expected} jour(s) ouvré(s) écoulé(s) ; ${s.confirmed} journée(s) confirmée(s) par le maître de stage${s.absent.length ? ` ; ${s.absent.length} jour(s) sans signature` : ""}.`;
}

/** Semaines civiles (lundi → dimanche) du journal, dans l'ordre. */
function weeks(records: AttendanceRecord[]): AttendanceRecord[][] {
  const sorted = [...records].sort((a, b) => a.day.localeCompare(b.day));
  const groups = new Map<string, AttendanceRecord[]>();
  for (const r of sorted) {
    const d = new Date(`${r.day}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    const key = d.toISOString().slice(0, 10);
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  return [...groups.values()];
}

export function stageReportDocument(s: StageReportInput, today: string): ReportDocument {
  const summary = summarizeAttendance(s.attendance, s.startDate, s.endDate, today);
  const period = s.startDate && s.endDate ? `du ${formatDay(s.startDate)} au ${formatDay(s.endDate)}` : "(dates à préciser)";
  const blocks: ReportDocument["blocks"] = [
    { type: "title", text: `Rapport de ${STAGE_TYPE_LABELS[s.type].toLowerCase()}` },
    { type: "meta", text: `Présenté par ${fullName(s)}${s.studentNumber ? ` (matricule ${s.studentNumber})` : ""}` },
    { type: "meta", text: `${s.university} — ${facultyOf(s)} — ${s.department} — ${s.level}` },
    { type: "meta", text: `Stage effectué chez ${s.assignedCompany ?? "[entreprise]"} ${period}` },
    { type: "meta", text: `Maître de stage : ${s.tutorName ?? "[à préciser]"}${s.tutorRole ? `, ${s.tutorRole}` : ""}` },
    { type: "warn", text: "Projet de rapport préparé par ACADIA à partir de votre journal de stage. Vos comptes rendus sont repris tels que vous les avez écrits ; les parties entre crochets sont à rédiger par vous. Relisez, complétez et faites valider par votre encadreur avant le dépôt." },
    { type: "h1", text: "Introduction" },
    { type: "p", text: "[À rédiger : le contexte de votre stage, son intérêt pour votre formation, et le plan du rapport.]" },
    { type: "p", text: "Objectifs fixés à l'inscription :", bold: true },
    { type: "p", text: s.objectives },
    ...(s.skills.length ? [{ type: "p" as const, text: "Compétences visées :", bold: true }, { type: "bullets" as const, items: s.skills }] : []),
    { type: "h1", text: "Chapitre 1 — Présentation de l'entreprise" },
    { type: "p", text: `${s.assignedCompany ?? "[Entreprise]"}${s.companyAddress ? `, ${s.companyAddress}` : ""}.` },
    { type: "p", text: "[À rédiger : historique, activités, organisation (organigramme) et service qui vous a accueilli.]" },
    { type: "h1", text: "Chapitre 2 — Déroulement du stage" },
    { type: "p", text: "Activités réalisées, jour par jour, d'après le journal de stage tenu dans ACADIA." },
  ];
  weeks(s.attendance).forEach((week, i) => {
    blocks.push({ type: "h2", text: `Semaine ${i + 1} (du ${formatDay(week[0].day)} au ${formatDay(week[week.length - 1].day)})` });
    for (const r of week) {
      blocks.push({ type: "p", text: formatDay(r.day), bold: true });
      blocks.push({ type: "p", text: r.activities?.trim() || "[Journée non décrite dans le journal.]" });
    }
  });
  if (!s.attendance.length) blocks.push({ type: "p", text: "[Aucune journée enregistrée dans le journal pour l'instant.]" });
  blocks.push(
    { type: "h1", text: "Chapitre 3 — Bilan du stage" },
    { type: "p", text: "[À rédiger : ce que vous avez appris au regard des compétences visées, les difficultés rencontrées et la façon dont vous les avez surmontées, l'apport du stage pour votre formation.]" },
    { type: "h1", text: "Conclusion" },
    { type: "p", text: "[À rédiger : synthèse du stage, recommandations éventuelles à l'entreprise, perspectives.]" },
    { type: "h1", text: "Annexe — Registre de présences" },
    { type: "p", text: summaryLine(summary) },
    { type: "table", head: ["Jour", "Arrivée", "Départ", "Durée", "Confirmé par l'entreprise"], rows: [...s.attendance].sort((a, b) => a.day.localeCompare(b.day)).map((r) => [formatDay(r.day), timeOf(r.arrivalAt), timeOf(r.departureAt), duration(r), r.tutorConfirmedAt ? "Oui" : "Non"]) },
    { type: "meta", text: `Heures de ${STAGE_TIMEZONE.replace("Africa/", "")} (fuseau de référence de MNJ Stage Connect), horodatées par le serveur au moment de la signature.` },
  );
  return { title: `Rapport de stage — ${fullName(s)}`, blocks };
}

/* -------------------------------- Registre pour la faculté -------------------------------- */

export interface RegisterStudent {
  name: string;
  studentNumber: string | null;
  department: string;
  level: string;
  company: string | null;
  startDate: string | null;
  endDate: string | null;
  attendance: AttendanceRecord[];
}

export function registerSheets(students: RegisterStudent[], title: string, today: string): Sheet[] {
  const synth: Cell[][] = [
    [title],
    ["Étudiant", "Matricule", "Filière", "Niveau", "Entreprise", "Début", "Fin", "Jours ouvrés écoulés", "Journées complètes", "Confirmées par l'entreprise", "Jours sans signature", "Taux de présence", "En ordre"],
  ];
  const register: Cell[][] = [[title], ["Étudiant", "Jour", "Arrivée", "Départ", "Durée", "Confirmé par l'entreprise", "Activités de la journée"]];
  for (const s of students) {
    const sum = summarizeAttendance(s.attendance, s.startDate, s.endDate, today);
    synth.push([s.name, s.studentNumber, s.department, s.level, s.company, s.startDate, s.endDate, sum.expected, sum.complete, sum.confirmed, sum.absent.length, sum.rate === null ? "—" : `${Math.round(sum.rate * 100)} %`, sum.inOrder ? "Oui" : today > (s.endDate ?? "9999") ? "Non" : "Stage en cours"]);
    for (const r of [...s.attendance].sort((a, b) => a.day.localeCompare(b.day))) register.push([s.name, r.day, timeOf(r.arrivalAt), timeOf(r.departureAt), duration(r), r.tutorConfirmedAt ? "Oui" : "Non", r.activities]);
  }
  synth.push([], [`« En ordre » : stage terminé et présence d'au moins ${Math.round(ATTENDANCE_MIN_RATE * 100)} % des jours ouvrés (lundi à vendredi).`]);
  return [
    { name: "Synthèse", rows: synth, titles: [0], bold: [1], widths: [30, 14, 26, 16, 26, 12, 12, 12, 12, 14, 12, 12, 14] },
    { name: "Registre de présences", rows: register, titles: [0], bold: [1], widths: [30, 12, 9, 9, 9, 14, 80] },
  ];
}
