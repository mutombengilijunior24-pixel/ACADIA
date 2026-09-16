// ============================================================
// ACADIA — IMPORT BIBTEX / RIS (mission Bibliography & Reference
// Intelligence §11/§12)
//
// Parseurs DÉTERMINISTES écrits à la main (aucune bibliothèque BibTeX/
// RIS n'existait dans le projet, confirmé par audit — formats texte
// suffisamment simples pour ne pas justifier une dépendance externe,
// mission §11 : "ne pas faire dépendre toute l'application d'un
// parseur fragile"). Un champ absent reste absent — JAMAIS deviné
// (mission §6). Une entrée mal formée produit une erreur EXPLICITE
// dans `errors[]`, jamais une perte silencieuse (mission §11/§12).
// ============================================================

import type { ReferenceInput, ReferenceSourceType } from "@/lib/core/research/reference/ReferenceTypes";

export interface ImportResult {
  references: ReferenceInput[];
  errors: string[];
}

const BIBTEX_TYPE_TO_SOURCE_TYPE: Record<string, ReferenceSourceType> = {
  article: "JOURNAL_ARTICLE",
  book: "BOOK",
  inbook: "BOOK_CHAPTER",
  incollection: "BOOK_CHAPTER",
  phdthesis: "DISSERTATION",
  mastersthesis: "THESIS",
  techreport: "REPORT",
  inproceedings: "CONFERENCE_PAPER",
  conference: "CONFERENCE_PAPER",
  online: "WEBSITE",
  electronic: "WEBSITE",
  misc: "OTHER",
  unpublished: "WORKING_PAPER",
};

/** Sépare un bloc BibTeX en entrées `@type{key, ...}` — gère les accolades imbriquées dans les valeurs. */
function splitBibtexEntries(text: string): string[] {
  const entries: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === "@" && depth === 0) {
      start = i;
    } else if (char === "{") {
      depth++;
    } else if (char === "}") {
      depth--;
      if (depth === 0 && start !== -1) {
        entries.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return entries;
}

function parseBibtexFields(body: string): Record<string, string> {
  const fields: Record<string, string> = {};
  // Découpe sur les virgules de NIVEAU 0 (hors accolades) — un champ peut contenir des virgules entre accolades.
  let depth = 0;
  let current = "";
  const parts: string[] = [];
  for (const char of body) {
    if (char === "{") depth++;
    if (char === "}") depth--;
    if (char === "," && depth === 0) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  if (current.trim()) parts.push(current);

  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim().toLowerCase();
    let value = part.slice(eq + 1).trim();
    value = value.replace(/^\{|\}$/g, "").replace(/^"|"$/g, "").trim();
    if (key) fields[key] = value;
  }
  return fields;
}

export function parseBibTeX(text: string): ImportResult {
  const references: ReferenceInput[] = [];
  const errors: string[] = [];
  const rawEntries = splitBibtexEntries(text);

  if (rawEntries.length === 0) {
    errors.push("Aucune entrée BibTeX reconnue (format attendu : @type{clé, champ = {valeur}, ...}).");
    return { references, errors };
  }

  for (const raw of rawEntries) {
    const headerMatch = raw.match(/^@(\w+)\s*\{\s*([^,]*),?/);
    if (!headerMatch) {
      errors.push(`Entrée BibTeX illisible (type/clé introuvable) : "${raw.slice(0, 60)}..."`);
      continue;
    }
    const bibtexType = headerMatch[1].toLowerCase();
    const body = raw.slice(raw.indexOf(",") + 1, raw.lastIndexOf("}"));
    const fields = parseBibtexFields(body);

    if (!fields.title) {
      errors.push(`Entrée BibTeX sans champ "title" ignorée (type "${bibtexType}") — le titre est obligatoire.`);
      continue;
    }

    const authors = fields.author ? fields.author.split(/\s+and\s+/i).map((a) => a.trim()).filter(Boolean) : [];
    const sourceType = BIBTEX_TYPE_TO_SOURCE_TYPE[bibtexType] ?? "OTHER";

    references.push({
      title: fields.title,
      authors,
      year: fields.year ? Number(fields.year) : null,
      sourceType,
      journal: fields.journal ?? null,
      publisher: fields.publisher ?? null,
      volume: fields.volume ?? null,
      issue: fields.number ?? null,
      pages: fields.pages ?? null,
      doi: fields.doi ?? null,
      isbn: fields.isbn ?? null,
      url: fields.url ?? null,
      language: fields.language ?? null,
      provenance: "BIBTEX_IMPORT",
      rawImportData: raw,
    });
  }

  return { references, errors };
}

const RIS_TYPE_TO_SOURCE_TYPE: Record<string, ReferenceSourceType> = {
  JOUR: "JOURNAL_ARTICLE",
  BOOK: "BOOK",
  CHAP: "BOOK_CHAPTER",
  THES: "THESIS",
  RPRT: "REPORT",
  CONF: "CONFERENCE_PAPER",
  CPAPER: "CONFERENCE_PAPER",
  ELEC: "WEBSITE",
  WEB: "WEBSITE",
  DATA: "DATASET",
  GOVDOC: "GOVERNMENT_DOCUMENT",
  STAT: "LAW_OR_REGULATION",
  UNPD: "WORKING_PAPER",
};

/** Support minimal (mission §12) : TY/AU/TI/PY/JO/DO/UR/ER — tout autre tag reconnu (T2/VL/IS/SP/PB/SN/LA) est également capté quand présent. */
export function parseRIS(text: string): ImportResult {
  const references: ReferenceInput[] = [];
  const errors: string[] = [];

  const lines = text.split(/\r?\n/);
  let current: Record<string, string[]> | null = null;
  let entryCount = 0;

  for (const line of lines) {
    const match = line.match(/^([A-Z][A-Z0-9])\s{0,2}-\s?(.*)$/);
    if (!match) {
      if (line.trim() && current) {
        // Ligne de continuation d'un champ précédent (RIS multi-lignes) — jamais perdue.
        const lastKey = Object.keys(current).pop();
        if (lastKey) current[lastKey][current[lastKey].length - 1] += " " + line.trim();
      }
      continue;
    }
    const [, tag, rawValue] = match;
    const value = rawValue.trim();

    if (tag === "TY") {
      current = { TY: [value] };
      continue;
    }
    if (tag === "ER") {
      if (!current) {
        errors.push("Balise ER rencontrée sans entrée RIS ouverte (TY manquant) — entrée ignorée.");
        continue;
      }
      entryCount++;
      const ti = current.TI?.[0] || current.T1?.[0];
      if (!ti) {
        errors.push(`Entrée RIS #${entryCount} sans champ TI (titre) — ignorée, le titre est obligatoire.`);
        current = null;
        continue;
      }
      const sourceType = RIS_TYPE_TO_SOURCE_TYPE[current.TY?.[0] ?? ""] ?? "OTHER";
      const yearRaw = current.PY?.[0] || current.Y1?.[0];
      const year = yearRaw ? parseInt(yearRaw.slice(0, 4), 10) : null;
      references.push({
        title: ti,
        authors: current.AU ?? [],
        year: Number.isFinite(year) ? year : null,
        sourceType,
        journal: current.JO?.[0] || current.T2?.[0] || null,
        publisher: current.PB?.[0] ?? null,
        volume: current.VL?.[0] ?? null,
        issue: current.IS?.[0] ?? null,
        pages: current.SP?.[0] ? `${current.SP[0]}${current.EP?.[0] ? `-${current.EP[0]}` : ""}` : null,
        doi: current.DO?.[0] ?? null,
        isbn: current.SN?.[0] ?? null,
        url: current.UR?.[0] ?? null,
        language: current.LA?.[0] ?? null,
        provenance: "RIS_IMPORT",
        rawImportData: Object.entries(current)
          .flatMap(([k, vs]) => vs.map((v) => `${k}  - ${v}`))
          .join("\n"),
      });
      current = null;
      continue;
    }

    if (!current) {
      errors.push(`Balise "${tag}" rencontrée avant tout TY (début d'entrée) — ignorée.`);
      continue;
    }
    if (!current[tag]) current[tag] = [];
    current[tag].push(value);
  }

  if (current) {
    errors.push("Entrée RIS jamais fermée par ER — fichier probablement tronqué, entrée ignorée.");
  }

  if (entryCount === 0 && errors.length === 0) {
    errors.push("Aucune entrée RIS reconnue (format attendu : TY  - JOUR ... ER  -).");
  }

  return { references, errors };
}
