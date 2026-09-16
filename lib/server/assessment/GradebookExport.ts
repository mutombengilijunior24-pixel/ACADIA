// ============================================================
// ACADIA — EXPORT GRADEBOOK (mission Teacher Workspace + Gradebook)
//
// Même patron que lib/server/survey/SurveyExport.ts + SurveyExcel.ts :
// une seule fonction de mise en forme des lignes (exportRows), jamais
// une deuxième requête ré-écrite par format. Ne recalcule RIEN —
// GradebookService.getGradebook() reste l'unique source de vérité.
// ============================================================

import ExcelJS from "exceljs";
import type { GradebookResult } from "./GradebookService";

const ACADIA_BLUE = "FF2554EB";

export interface GradebookExportRow {
  studentName: string;
  studentEmail: string;
  finalScore: string;
  maxScore: string;
  percentage: string;
  status: string;
  date: string;
}

const STATUS_LABEL: Record<string, string> = {
  submitted: "Soumis",
  under_review: "En revue",
  graded: "Corrigé",
  returned: "Retourné",
};

export function exportGradebookRows(result: GradebookResult): GradebookExportRow[] {
  return result.rows.map((r) => ({
    studentName: r.studentName,
    studentEmail: r.studentEmail,
    finalScore: r.finalScore !== null ? String(r.finalScore) : "",
    maxScore: r.maxScore !== null ? String(r.maxScore) : "",
    percentage: r.percentage !== null ? `${r.percentage.toFixed(1)}%` : "",
    status: STATUS_LABEL[r.status] ?? r.status,
    date: r.submittedAt ? new Date(r.submittedAt).toLocaleString("fr-FR") : "",
  }));
}

export function exportGradebookHeaders(): string[] {
  return ["Étudiant", "Email", "Note", "Barème", "Pourcentage", "Statut", "Date de soumission"];
}

function csvEscape(value: string): string {
  if (/[";\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Délimiteur point-virgule + BOM UTF-8 : même convention que SurveyExport.buildCsv (Excel en environnement francophone). */
export function buildGradebookCsv(result: GradebookResult): string {
  const rows = exportGradebookRows(result);
  const lines = [exportGradebookHeaders().map(csvEscape).join(";")];
  for (const row of rows) {
    lines.push([row.studentName, row.studentEmail, row.finalScore, row.maxScore, row.percentage, row.status, row.date].map(csvEscape).join(";"));
  }
  return "﻿" + lines.join("\r\n");
}

export function gradebookExportFileBaseName(assignmentTitle: string): string {
  const slug = assignmentTitle
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || "tp";
}

export async function buildGradebookExcelBuffer(result: GradebookResult): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ACADIA";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("Gradebook");
  sheet.columns = [
    { header: "Étudiant", key: "studentName", width: 28 },
    { header: "Email", key: "studentEmail", width: 30 },
    { header: "Note", key: "finalScore", width: 10 },
    { header: "Barème", key: "maxScore", width: 10 },
    { header: "Pourcentage", key: "percentage", width: 14 },
    { header: "Statut", key: "status", width: 14 },
    { header: "Date de soumission", key: "date", width: 20 },
  ];

  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACADIA_BLUE } };
    cell.alignment = { vertical: "middle" };
  });

  for (const row of exportGradebookRows(result)) {
    sheet.addRow(row);
  }

  if (result.summary.averagePercentage !== null) {
    sheet.addRow([]);
    const summaryRow = sheet.addRow([
      "Moyenne (%)",
      `${result.summary.averagePercentage.toFixed(1)}%`,
      `sur ${result.summary.gradedForAverageCount} copie(s) corrigée(s) sur ${result.summary.studentCount}`,
    ]);
    summaryRow.font = { bold: true, color: { argb: ACADIA_BLUE } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
