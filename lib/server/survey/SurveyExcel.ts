// ============================================================
// ACADIA — SURVEY : EXPORT EXCEL PROFESSIONNEL (P21)
//
// Reçoit des données DÉJÀ calculées (SurveyStatsService, SurveyExport,
// SurveyCrosstabService) — ne recalcule jamais rien ici, se contente
// de la mise en page. Une seule bibliothèque de génération (exceljs),
// aucun second moteur de calcul.
// ============================================================

import ExcelJS from "exceljs";
import type { Survey } from "@/lib/core/survey/SurveyTypes";
import type { SurveyStatsBundle } from "./SurveyStatsService";
import { exportColumnHeaders, exportRowCells, type SurveyExportRow } from "./SurveyExport";
import type { CrosstabResult } from "./SurveyCrosstabService";

const OPEN_TYPES = new Set(["short_text", "long_text"]);
const ACADIA_BLUE = "FF2554EB";
const HEADER_FILL: ExcelJS.Fill = { type: "pattern", pattern: "solid", fgColor: { argb: ACADIA_BLUE } };

function styleHeaderRow(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = HEADER_FILL;
    cell.alignment = { vertical: "middle" };
  });
}

export interface SurveyExcelInput {
  survey: Survey;
  bundle: SurveyStatsBundle;
  rows: SurveyExportRow[];
  filtersDescription: string;
  crosstab?: CrosstabResult & { compareByLabel: string };
}

export async function buildSurveyExcelBuffer(input: SurveyExcelInput): Promise<Buffer> {
  const { survey, bundle, rows, filtersDescription, crosstab } = input;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ACADIA";
  workbook.created = new Date();

  // ---- Feuille 1 : Résumé ----
  const summary = workbook.addWorksheet("Résumé");
  summary.columns = [{ width: 32 }, { width: 60 }];
  summary.addRow(["ACADIA — Résumé de l'enquête"]).font = { bold: true, size: 14, color: { argb: ACADIA_BLUE } };
  summary.addRow([]);
  summary.addRow(["Titre de l'enquête", survey.title]);
  summary.addRow(["Institution", survey.institution || "—"]);
  summary.addRow(["Date de génération", new Date().toLocaleString("fr-FR")]);
  summary.addRow(["Filtres actifs", filtersDescription]);
  summary.addRow(["Nombre de répondants", bundle.stats.totalResponses]);
  summary.addRow(["Taux de complétion", bundle.stats.completionRate !== undefined ? `${bundle.stats.completionRate}%` : "Non calculable"]);
  summary.addRow([]);
  summary.addRow(["Principaux indicateurs"]).font = { bold: true, color: { argb: ACADIA_BLUE } };
  const indicatorHeaderRow = summary.addRow(["Question", "Réponse la plus fréquente", "Part"]);
  styleHeaderRow(indicatorHeaderRow);
  for (const f of bundle.frequencies) {
    if (OPEN_TYPES.has(f.type) || f.distribution.length === 0) continue;
    const top = f.distribution[0];
    summary.addRow([f.questionText, top.label, `${top.percent}%`]);
  }

  // ---- Feuille 2 : Réponses ----
  const responsesSheet = workbook.addWorksheet("Réponses");
  const headers = exportColumnHeaders(survey);
  responsesSheet.columns = headers.map((h) => ({ header: h, width: Math.min(40, Math.max(14, h.length + 2)) }));
  styleHeaderRow(responsesSheet.getRow(1));
  for (const row of rows) {
    responsesSheet.addRow(exportRowCells(survey, row));
  }

  // ---- Feuille 3 : Statistiques ----
  const statsSheet = workbook.addWorksheet("Statistiques");
  statsSheet.columns = [{ width: 45 }, { width: 30 }, { width: 12 }, { width: 12 }];
  const statsHeaderRow = statsSheet.addRow(["Question", "Modalité", "Effectif", "Pourcentage"]);
  styleHeaderRow(statsHeaderRow);
  for (const f of bundle.frequencies) {
    if (f.respondentCount === 0) continue;
    if (OPEN_TYPES.has(f.type)) {
      statsSheet.addRow([f.questionText, "Question ouverte — voir feuille Réponses", f.respondentCount, ""]);
      continue;
    }
    for (const d of f.distribution) {
      statsSheet.addRow([f.questionText, d.label, d.count, `${d.percent}%`]);
    }
    if (f.average !== undefined) statsSheet.addRow([f.questionText, "Moyenne", "", f.average]);
    if (f.median !== undefined) statsSheet.addRow([f.questionText, "Médiane", "", f.median]);
  }

  // ---- Feuille 4 : Croisements (si pertinent — un croisement a été fourni) ----
  if (crosstab && crosstab.rowLabels.length > 0) {
    const crossSheet = workbook.addWorksheet("Croisements");
    crossSheet.addRow([`${crosstab.variable || crosstab.questionText} × ${crosstab.compareByLabel}`]).font = { bold: true, color: { argb: ACADIA_BLUE } };
    if (crosstab.isMultiSelect) {
      crossSheet.addRow(["Plusieurs réponses possibles — les pourcentages d'une colonne ne totalisent pas nécessairement 100 %."]);
    }
    crossSheet.addRow([]);
    const headerRow = crossSheet.addRow(["", ...crosstab.colLabels]);
    styleHeaderRow(headerRow);
    crosstab.rowLabels.forEach((label, ri) => {
      crossSheet.addRow([label, ...crosstab.colLabels.map((_, ci) => `${crosstab.percents[ri][ci]}% (${crosstab.matrix[ri][ci]})`)]);
    });
    crossSheet.addRow(["Effectif (n)", ...crosstab.colLabels.map((c) => crosstab.colTotals[c] ?? 0)]);
    crossSheet.columns.forEach((col) => (col.width = 22));
    if (crosstab.smallSampleColumns.length > 0) {
      crossSheet.addRow([]);
      crossSheet.addRow([`Échantillon faible pour : ${crosstab.smallSampleColumns.join(", ")} — à interpréter avec prudence.`]);
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
