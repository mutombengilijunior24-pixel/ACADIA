// ============================================================
// ACADIA — DOCUMENT VALIDATION ENGINE (P12.24)
//
// "Document exportable" (structure suffisante pour produire un
// fichier DOCX/PDF propre) est distinct de "travail scientifiquement
// prêt" (P11 — ScientificWorkReadiness). Un document peut être
// techniquement exportable même si le travail reste incomplet —
// les deux ne doivent jamais être confondus dans l'interface.
// ============================================================

import type { DocumentModel, ExportCheckItem, ExportReadinessResult, CoverPageInfo } from "./DocumentTypes";
import { COVER_TO_COMPLETE } from "./DocumentTypes";

function item(id: string, label: string, status: ExportCheckItem["status"], detail: string): ExportCheckItem {
  return { id, label, status, detail };
}

function isMissing(value: string): boolean {
  return !value || value === COVER_TO_COMPLETE;
}

export function validateDocumentForExport(model: DocumentModel): ExportReadinessResult {
  const items: ExportCheckItem[] = [];
  const cover: CoverPageInfo = model.coverPage;

  items.push(
    cover.title
      ? item("titre", "Titre", "READY", "Le titre du travail est renseigné.")
      : item("titre", "Titre", "BLOCKED", "Aucun titre — export impossible.")
  );

  items.push(
    isMissing(cover.author)
      ? item("auteur", "Auteur", "WARNING", "L'auteur n'est pas renseigné sur la page de garde — export possible mais incomplet.")
      : item("auteur", "Auteur", "READY", "L'auteur est renseigné.")
  );

  items.push(
    isMissing(cover.institution)
      ? item("institution", "Institution", "WARNING", "L'institution n'est pas renseignée sur la page de garde.")
      : item("institution", "Institution", "READY", "L'institution est renseignée.")
  );

  const hasStructure = model.chapters.length > 0 && model.tableOfContents.length > 0;
  items.push(
    hasStructure
      ? item("structure", "Structure du document", "READY", `${model.chapters.length} chapitre(s), ${model.tableOfContents.length} entrée(s) de table des matières.`)
      : item("structure", "Structure du document", "BLOCKED", "Aucune structure de document disponible.")
  );

  const methodChapter = model.chapters.find((c) => c.id === "chapter-methodology");
  const methodHasContent = Boolean(methodChapter && methodChapter.sections.some((s) => !s.hasPlaceholder));
  items.push(
    methodHasContent
      ? item("methodologie", "Méthodologie", "READY", "La méthodologie contient du contenu renseigné.")
      : item("methodologie", "Méthodologie", "WARNING", "La méthodologie reste largement à préciser.")
  );

  const resultsChapter = model.chapters.find((c) => c.id === "chapter-results");
  const hasResults = Boolean(resultsChapter && resultsChapter.sections.length > 1);
  items.push(
    hasResults
      ? item("resultats", "Résultats", "READY", "Des résultats sont disponibles dans le document.")
      : item("resultats", "Résultats", "WARNING", "Aucun résultat au-delà de la présentation du terrain.")
  );

  const discussionChapter = model.chapters.find((c) => c.id === "chapter-discussion");
  const hasDiscussion = Boolean(discussionChapter && discussionChapter.sections.length > 0);
  items.push(
    hasDiscussion
      ? item("discussion", "Discussion", "READY", "Une discussion est disponible dans le document.")
      : item("discussion", "Discussion", "WARNING", "Aucune discussion disponible.")
  );

  const conclusionChapter = model.chapters.find((c) => c.id === "chapter-conclusion");
  const conclusionHasContent = Boolean(conclusionChapter && conclusionChapter.sections.some((s) => !s.hasPlaceholder));
  items.push(
    conclusionHasContent
      ? item("conclusion", "Conclusion", "READY", "La conclusion reprend du contenu réel.")
      : item("conclusion", "Conclusion", "WARNING", "La conclusion reste largement à préciser.")
  );

  items.push(
    model.bibliography.length > 0
      ? item("bibliographie", "Bibliographie", "READY", `${model.bibliography.length} référence(s) enregistrée(s).`)
      : item("bibliographie", "Bibliographie", "WARNING", "Aucune référence bibliographique enregistrée.")
  );

  items.push(
    model.annexes.length > 0
      ? item("annexes", "Annexes", "READY", `${model.annexes.length} annexe(s) disponible(s).`)
      : item("annexes", "Annexes", "WARNING", "Aucune annexe disponible pour ce projet.")
  );

  const blocked = items.filter((i) => i.status === "BLOCKED");
  const warnings = items.filter((i) => i.status === "WARNING");

  const overallStatus: ExportCheckItem["status"] = blocked.length > 0 ? "BLOCKED" : warnings.length > 0 ? "WARNING" : "READY";

  return { items, overallStatus, documentExportable: blocked.length === 0 };
}

// ------------------------------------------------------------
// NON-RÉGRESSION (P12.29) — empreinte des données scientifiques
// source, à comparer avant/après export : aucune valeur ne doit
// changer entre ce qui a été construit par P6-P11 et ce qui a été
// mis en page par P12.
// ------------------------------------------------------------

export function hashScientificContent(value: unknown): string {
  const json = JSON.stringify(value);
  let hash = 0;
  for (let i = 0; i < json.length; i++) {
    hash = (hash * 31 + json.charCodeAt(i)) | 0;
  }
  return `${json.length}:${(hash >>> 0).toString(16)}`;
}
