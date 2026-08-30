// ============================================================
// ACADIA — SURVEY : GÉNÉRATION PDF (Export P21 + Rapport P22)
//
// Réutilise @react-pdf/renderer, déjà en place pour l'export PDF
// Research (app/api/export/pdf/route.ts) — jamais une deuxième
// bibliothèque PDF. Ce module ne calcule RIEN : il met en page des
// données déjà produites par SurveyStatsService/SurveyExport/
// SurveyCrosstabService, et — si elle a été fournie par l'appelant —
// une interprétation ACADIA déjà générée (jamais recalculée ni
// inventée ici). Route Handler oblige un fichier .ts (pas .tsx) —
// ce module suit donc la même convention createElement que la route
// Research existante, et reste importable depuis un fichier .ts.
// ============================================================

import { createElement as h, type ReactElement } from "react";
import { Document, Page, View, Text, Image, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { Survey } from "@/lib/core/survey/SurveyTypes";
import type { SurveyStatsBundle } from "./SurveyStatsService";
import type { InterpretationResult } from "@/lib/ai/openai/SurveyInterpretationAI";
import type { CrosstabResult } from "./SurveyCrosstabService";

const BLUE = "#2554EB";
const NAVY = "#0B1E4B";
const GREY = "#666666";
const OPEN_TYPES = new Set(["short_text", "long_text"]);

const styles = StyleSheet.create({
  page: { fontFamily: "Helvetica", fontSize: 10, lineHeight: 1.4, paddingTop: 48, paddingBottom: 40, paddingHorizontal: 40 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  brand: { fontSize: 9, fontFamily: "Helvetica-Bold", color: BLUE, letterSpacing: 1 },
  logo: { width: 60, height: 30, objectFit: "contain" },
  title: { fontSize: 18, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 10, marginBottom: 4 },
  meta: { fontSize: 9, color: GREY, marginBottom: 2 },
  h1: { fontSize: 13, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 18, marginBottom: 8, borderBottomWidth: 1, borderBottomColor: "#E2E8F0", paddingBottom: 4 },
  h2: { fontSize: 11, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 10, marginBottom: 5 },
  paragraph: { fontSize: 10, color: "#334155", marginBottom: 5 },
  kpiRow: { flexDirection: "row", gap: 10, marginBottom: 4 },
  kpiBox: { flex: 1, borderWidth: 1, borderColor: "#E2E8F0", borderRadius: 4, padding: 8 },
  kpiLabel: { fontSize: 7, color: GREY, textTransform: "uppercase" },
  kpiValue: { fontSize: 14, fontFamily: "Helvetica-Bold", color: NAVY, marginTop: 2 },
  tableRow: { flexDirection: "row" },
  tableCellHeader: { flex: 1, borderWidth: 0.5, borderColor: "#CBD5E1", backgroundColor: "#EEF2FF", padding: 4, fontFamily: "Helvetica-Bold", fontSize: 8 },
  tableCell: { flex: 1, borderWidth: 0.5, borderColor: "#CBD5E1", padding: 4, fontSize: 8 },
  bulletRow: { flexDirection: "row", marginBottom: 3 },
  bulletMark: { width: 10, fontSize: 9, color: BLUE },
  bulletText: { flex: 1, fontSize: 9, color: "#334155" },
  note: { fontSize: 8, fontFamily: "Helvetica-Oblique", color: GREY, marginTop: 4, marginBottom: 8 },
  footer: { position: "absolute", bottom: 16, left: 0, right: 0, textAlign: "center", fontSize: 8, color: GREY },
});

function pageFooter() {
  return h(Text, {
    style: styles.footer,
    fixed: true,
    render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `ACADIA · ${pageNumber} / ${totalPages}`,
  });
}

function headerBlock(survey: Survey, bundle: SurveyStatsBundle, logoDataUri: string | undefined, filtersDescription: string) {
  const isFiltered = !filtersDescription.startsWith("Ensemble");
  return h(
    View,
    { key: "header" },
    h(
      View,
      { style: styles.headerRow },
      h(Text, { style: styles.brand }, "ACADIA"),
      logoDataUri ? h(Image, { src: logoDataUri, style: styles.logo }) : null
    ),
    h(Text, { style: styles.title }, survey.title),
    survey.institution ? h(Text, { style: styles.meta }, survey.institution) : null,
    h(Text, { style: styles.meta }, `Généré le ${new Date().toLocaleDateString("fr-FR")}`),
    h(Text, { style: styles.meta }, `Population analysée : ${bundle.stats.totalResponses} répondant${bundle.stats.totalResponses > 1 ? "s" : ""}`),
    h(Text, { style: styles.meta }, isFiltered ? `Filtres appliqués : ${filtersDescription}` : "Analyse basée sur l'ensemble des réponses.")
  );
}

function section(title: string, children: (ReactElement | null)[]) {
  return h(View, { key: title, wrap: true }, h(Text, { style: styles.h1 }, title), ...children);
}

function bulletList(items: string[]) {
  return items.map((item, i) => h(View, { key: i, style: styles.bulletRow }, h(Text, { style: styles.bulletMark }, "•"), h(Text, { style: styles.bulletText }, item)));
}

function synthese(bundle: SurveyStatsBundle) {
  const kpis = [
    { label: "Répondants", value: String(bundle.stats.totalResponses) },
    { label: "Taux de complétion", value: bundle.stats.completionRate !== undefined ? `${bundle.stats.completionRate}%` : "—" },
    { label: "Aujourd'hui", value: String(bundle.stats.todayResponses) },
  ];
  const topFindings = bundle.frequencies.filter((f) => !OPEN_TYPES.has(f.type) && f.distribution.length > 0).slice(0, 5);
  return section("Synthèse", [
    h(View, { key: "kpis", style: styles.kpiRow }, ...kpis.map((k) => h(View, { key: k.label, style: styles.kpiBox }, h(Text, { style: styles.kpiLabel }, k.label), h(Text, { style: styles.kpiValue }, k.value)))),
    h(Text, { key: "ind-title", style: styles.h2 }, "Principaux indicateurs"),
    ...topFindings.map((f) =>
      h(View, { key: f.questionId, style: styles.bulletRow }, h(Text, { style: styles.bulletMark }, "•"), h(Text, { style: styles.bulletText }, `${f.questionText} — ${f.distribution[0].label} (${f.distribution[0].percent}%)`))
    ),
  ]);
}

function profil(bundle: SurveyStatsBundle) {
  const groups: { label: string; items: { label: string; count: number; percent: number }[] }[] = [
    { label: "Institution", items: bundle.breakdowns.institution },
    { label: "Faculté / École", items: bundle.breakdowns.faculty },
    { label: "Niveau d'étude", items: bundle.breakdowns.level },
    { label: "Tranche d'âge", items: bundle.breakdowns.ageBucket },
    { label: "Catégorie", items: bundle.breakdowns.category },
  ].filter((g) => g.items.length > 0);
  if (groups.length === 0) return null;
  return section("Profil des répondants", groups.flatMap((g) => [h(Text, { key: `${g.label}-h`, style: styles.h2 }, g.label), ...bulletList(g.items.map((i) => `${i.label} — ${i.count} (${i.percent}%)`))]));
}

function resultats(bundle: SurveyStatsBundle, openSamples: { questionText: string; totalAnswers: number; samples: string[] }[]) {
  const closed = bundle.frequencies.filter((f) => !OPEN_TYPES.has(f.type) && f.respondentCount > 0);
  const children: (ReactElement | null)[] = [];
  for (const f of closed) {
    children.push(h(Text, { key: `${f.questionId}-h`, style: styles.h2 }, f.questionText));
    children.push(
      h(
        View,
        { key: `${f.questionId}-t`, wrap: false },
        h(View, { style: styles.tableRow }, h(Text, { style: styles.tableCellHeader }, "Modalité"), h(Text, { style: styles.tableCellHeader }, "Effectif"), h(Text, { style: styles.tableCellHeader }, "Pourcentage")),
        ...f.distribution.map((d, i) => h(View, { key: i, style: styles.tableRow }, h(Text, { style: styles.tableCell }, d.label), h(Text, { style: styles.tableCell }, String(d.count)), h(Text, { style: styles.tableCell }, `${d.percent}%`)))
      )
    );
    if (f.type === "multiple_choice") children.push(h(Text, { key: `${f.questionId}-note`, style: styles.note }, "Plusieurs réponses possibles — les pourcentages ne totalisent pas nécessairement 100 %."));
  }
  for (const oq of openSamples) {
    children.push(h(Text, { key: `${oq.questionText}-h`, style: styles.h2 }, `${oq.questionText} (question ouverte — ${oq.totalAnswers} réponse${oq.totalAnswers > 1 ? "s" : ""})`));
    children.push(...bulletList(oq.samples));
    if (oq.totalAnswers > oq.samples.length) children.push(h(Text, { key: `${oq.questionText}-more`, style: styles.note }, `${oq.totalAnswers - oq.samples.length} réponse(s) supplémentaire(s) consultable(s) sur la plateforme.`));
  }
  return section("Résultats", children);
}

function methodologie(survey: Survey) {
  const rows: { label: string; value: string }[] = [];
  if (survey.objective) rows.push({ label: "Objectif", value: survey.objective });
  if (survey.targetAudience) rows.push({ label: "Population cible", value: survey.targetAudience });
  const dimensions = [...new Set(survey.questions.map((q) => q.section).filter((s): s is string => Boolean(s)))];
  const variables = survey.questions.filter((q) => q.variable).map((q) => `${q.variable}${q.indicator ? ` (${q.indicator})` : ""}`);
  if (dimensions.length > 0) rows.push({ label: "Dimensions couvertes", value: dimensions.join(", ") });
  if (variables.length > 0) rows.push({ label: "Variables mesurées", value: variables.join(", ") });
  if (rows.length === 0) return null;
  return section("Présentation et méthodologie", rows.map((r) => h(View, { key: r.label }, h(Text, { style: styles.h2 }, r.label), h(Text, { style: styles.paragraph }, r.value))));
}

function crosstabSection(crosstab: (CrosstabResult & { compareByLabel: string }) | undefined) {
  if (!crosstab || crosstab.rowLabels.length === 0) return null;
  return section("Analyses croisées", [
    h(Text, { key: "title", style: styles.h2 }, `${crosstab.variable || crosstab.questionText} × ${crosstab.compareByLabel}`),
    h(
      View,
      { key: "table", wrap: false },
      h(
        View,
        { style: styles.tableRow },
        h(Text, { style: styles.tableCellHeader }, " "),
        ...crosstab.colLabels.map((c, i) => h(Text, { key: i, style: styles.tableCellHeader }, `${c} (n=${crosstab.colTotals[c] ?? 0})`))
      ),
      ...crosstab.rowLabels.map((r, ri) =>
        h(
          View,
          { key: ri, style: styles.tableRow },
          h(Text, { style: styles.tableCell }, r),
          ...crosstab.colLabels.map((c, ci) => h(Text, { key: ci, style: styles.tableCell }, `${crosstab.percents[ri][ci]}% (${crosstab.matrix[ri][ci]})`))
        )
      )
    ),
    crosstab.isMultiSelect ? h(Text, { key: "note-multi", style: styles.note }, "Plusieurs réponses possibles — les pourcentages d'une colonne ne totalisent pas nécessairement 100 %.") : null,
    crosstab.smallSampleColumns.length > 0 ? h(Text, { key: "note-small", style: styles.note }, `Échantillon faible pour : ${crosstab.smallSampleColumns.join(", ")} — à interpréter avec prudence.`) : null,
  ]);
}

function interpretationSections(interpretation: InterpretationResult | undefined, contextLabel: string | undefined) {
  if (!interpretation) {
    return section("Interprétation ACADIA", [h(Text, { key: "none", style: styles.paragraph }, "Aucune interprétation ACADIA n'a été générée pour cette analyse. Cette section ne présente donc que les données et statistiques ci-dessus, sans lecture interprétative.")]);
  }
  const blocks: [string, string[]][] = [
    ["Principaux constats", interpretation.findings],
    ["Tendances observées", interpretation.trends],
    ["Comparaisons", interpretation.comparisons],
    ["Points d'attention", interpretation.attentionPoints],
    ["Interprétation", interpretation.interpretation],
    ["Recommandations", interpretation.recommendations],
    ["Limites", interpretation.limitations],
  ];
  const children: (ReactElement | null)[] = [
    contextLabel ? h(Text, { key: "ctx", style: styles.note }, `Analyse interprétée : ${contextLabel}`) : null,
    h(Text, { key: "summary", style: styles.paragraph }, interpretation.summary),
  ];
  for (const [title, items] of blocks) {
    if (items.length === 0) continue;
    children.push(h(Text, { key: `${title}-h`, style: styles.h2 }, title));
    children.push(...bulletList(items));
  }
  return section("Interprétation ACADIA", children);
}

export interface SurveyReportInput {
  survey: Survey;
  bundle: SurveyStatsBundle;
  filtersDescription: string;
  mode: "export" | "report";
  logoDataUri?: string;
  interpretation?: InterpretationResult;
  interpretationContextLabel?: string;
  crosstab?: CrosstabResult & { compareByLabel: string };
  openQuestionSamples: { questionText: string; totalAnswers: number; samples: string[] }[];
}

function buildDocument(input: SurveyReportInput) {
  const pages: ReactElement[] = [];

  pages.push(
    h(
      Page,
      { size: "A4", style: styles.page, key: "p1" },
      headerBlock(input.survey, input.bundle, input.logoDataUri, input.filtersDescription),
      synthese(input.bundle),
      input.mode === "report" ? methodologie(input.survey) : null,
      pageFooter()
    )
  );

  pages.push(
    h(
      Page,
      { size: "A4", style: styles.page, key: "p2" },
      profil(input.bundle),
      resultats(input.bundle, input.openQuestionSamples),
      crosstabSection(input.crosstab),
      pageFooter()
    )
  );

  pages.push(
    h(
      Page,
      { size: "A4", style: styles.page, key: "p3" },
      interpretationSections(input.interpretation, input.interpretationContextLabel),
      input.mode === "report"
        ? h(
            View,
            { key: "conclusion" },
            h(Text, { style: styles.h1 }, "Conclusion"),
            h(
              Text,
              { style: styles.paragraph },
              input.interpretation
                ? "Cette conclusion s'appuie sur l'interprétation générée par ACADIA ci-dessus ; elle reste une lecture prudente des données collectées, à confronter au jugement du chercheur ou de l'institution."
                : `Ce rapport présente les données et statistiques réellement collectées (${input.bundle.stats.totalResponses} répondant${input.bundle.stats.totalResponses > 1 ? "s" : ""}) sans interprétation générée, celle-ci n'ayant pas été demandée pour cette analyse.`
            )
          )
        : null,
      pageFooter()
    )
  );

  return h(Document, {}, ...pages);
}

export async function renderSurveyReportPdfBuffer(input: SurveyReportInput): Promise<Buffer> {
  const buffer = await renderToBuffer(buildDocument(input));
  return Buffer.from(buffer);
}
