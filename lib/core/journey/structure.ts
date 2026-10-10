/**
 * Structure du fichier : regroupe les colonnes en « unités de question ».
 * - métadonnées techniques (identifiants de soumission, horodatage) ;
 * - question à choix unique exportée deux fois : une colonne texte + une colonne vrai/faux par option
 *   (« Lieu (Marché Mzee) ») → les colonnes d'option sont des modalités, pas des variables ;
 * - question à choix multiples sans colonne texte : un groupe de colonnes binaires ;
 * - grille (« Question [Élément] ») dont chaque élément est une sous-question.
 * Les colonnes ne sont jamais modifiées : il s'agit d'une lecture proposée, à confirmer.
 */
import { fold } from "@/lib/core/understanding/text";
import type { ColumnProfile, DatasetProfile, ImportedDataset, StatisticalType, VariableMetadata } from "@/lib/core/data/types";

import { splitGlued } from "./match";

export type ColumnKind = "technical" | "identifier" | "date" | "option_of" | "multi_choice_item" | "grid_item" | "question" | "empty";

export interface ColumnInfo {
  column: number;
  header: string;
  /** En-tête nettoyé pour l'affichage (titre de section collé séparé, espaces normalisés). */
  label: string;
  kind: ColumnKind;
  /** Unité de question à laquelle la colonne appartient. */
  unitId: string;
  /** Pour une colonne d'option : libellé de l'option. */
  option?: string;
  type: StatisticalType;
  constant: boolean;
  reason: string;
}

export type UnitKind = "single" | "single_with_options" | "multi_choice" | "grid_item" | "technical";

export interface QuestionUnit {
  id: string;
  text: string;
  kind: UnitKind;
  /** Colonne à analyser (colonne texte de la question), null pour un choix multiple. */
  primaryColumn: number | null;
  columns: number[];
  options: string[];
  type: StatisticalType;
  reason: string;
}

export interface FileStructure {
  columns: ColumnInfo[];
  units: QuestionUnit[];
}

const TECHNICAL = /^(?:_?(?:submission|respondent|response|record|instance|device)[ _-]?id|_?id|_uuid|_index|_parent_index|_submission_time|_submitted_by|_status|_validation_status|_version_?|__version__|_tags|_notes|_xform_id_string|meta\/.*|submitted at|submission (?:time|date)|horodat\w*|timestamp|date (?:de|d')\s?(?:soumission|envoi)|start|end|today|deviceid|subscriberid|simserial|phonenumber|username|network type|ip address|adresse ip|user agent|referrer)$/i;

const OPTION_PATTERN = /^(.*\S)\s*(?:\(([^()]+)\)|\[([^[\]]+)\])\s*$/;
const KOBO_PATTERN = /^(.+)\/([^/]+)$/;

const BINARY = new Set(["true", "false", "vrai", "faux", "0", "1", "oui", "non", "yes", "no", "x", "checked", "unchecked", "coche"]);

function looksBinary(profile: ColumnProfile | undefined, option?: string): boolean {
  const values = (profile?.categories?.top ?? []).map((c) => fold(c.value));
  if (!values.length) return false;
  if (profile?.categories && profile.categories.distinct > 2) return false;
  return values.every((v) => BINARY.has(v) || (option !== undefined && v === fold(option)));
}

export function cleanHeader(header: string): string {
  return splitGlued(header).replace(/\s+/g, " ").trim();
}

export function analyzeStructure(dataset: ImportedDataset, profile: DatasetProfile, variables: VariableMetadata[]): FileStructure {
  const typeOf = (column: number) => variables.find((v) => v.column === column)?.effectiveType ?? "unclassified";
  const profileOf = (column: number) => profile.columns.find((c) => c.index === column);
  const columns: ColumnInfo[] = dataset.columns.map((c) => {
    const p = profileOf(c.index);
    return {
      column: c.index,
      header: c.originalHeader,
      label: cleanHeader(c.originalHeader) || c.technicalName,
      kind: "question",
      unitId: `col:${c.index}`,
      type: typeOf(c.index),
      constant: !!p && p.present > 0 && p.distinct <= 1,
      reason: "Question ou mesure à part entière.",
    };
  });

  // 1. Métadonnées techniques, identifiants, dates, colonnes vides.
  for (const info of columns) {
    const p = profileOf(info.column);
    if (TECHNICAL.test(info.header.trim())) {
      info.kind = "technical";
      info.reason = "Métadonnée technique de la collecte (identifiant de soumission, horodatage…) : pas une variable de recherche.";
    } else if (info.type === "identifier") {
      info.kind = "identifier";
      info.reason = "Identifiant : distingue les lignes, ne mesure rien.";
    } else if (info.type === "temporal") {
      info.kind = "date";
      info.reason = "Date : utilisable pour décrire la collecte, pas comme variable des tests disponibles.";
    } else if (p && p.present === 0) {
      info.kind = "empty";
      info.reason = "Colonne vide.";
    }
  }

  // 2. Colonnes d'option : « Base (Option) », « Base [Option] », « base/option » (Kobo).
  const candidates = columns.filter((c) => c.kind === "question");
  const groups = new Map<string, Array<{ info: ColumnInfo; base: string; option: string }>>();
  for (const info of candidates) {
    const m = OPTION_PATTERN.exec(info.header.trim()) ?? KOBO_PATTERN.exec(info.header.trim());
    if (!m) continue;
    const base = m[1].trim();
    const option = (m[2] ?? m[3] ?? "").trim();
    if (!option || !base) continue;
    const key = fold(base);
    groups.set(key, [...(groups.get(key) ?? []), { info, base, option }]);
  }
  const units: QuestionUnit[] = [];
  for (const [key, members] of groups) {
    const parent = candidates.find((c) => fold(c.header.trim()) === key);
    if (members.length < 2 && !parent) continue;
    const binary = members.every((m) => looksBinary(profileOf(m.info.column), m.option));
    if (parent && binary) {
      const unitId = `col:${parent.column}`;
      for (const m of members) {
        m.info.kind = "option_of";
        m.info.unitId = unitId;
        m.info.option = m.option;
        m.info.reason = `Modalité « ${m.option} » de la question « ${parent.label} » (colonne vrai/faux) : déjà représentée par la colonne de la question.`;
      }
      parent.reason = `Question à choix unique ; ${members.length} colonne(s) vrai/faux répètent ses modalités.`;
      units.push({
        id: unitId,
        text: parent.label,
        kind: "single_with_options",
        primaryColumn: parent.column,
        columns: [parent.column, ...members.map((m) => m.info.column)],
        options: members.map((m) => m.option),
        type: parent.type,
        reason: parent.reason,
      });
    } else if (binary && members.length >= 2) {
      const unitId = `group:${key}`;
      for (const m of members) {
        m.info.kind = "multi_choice_item";
        m.info.unitId = unitId;
        m.info.option = m.option;
        m.info.reason = `Option « ${m.option} » d'une question à choix multiples (« ${cleanHeader(m.base)} »).`;
      }
      units.push({
        id: unitId,
        text: cleanHeader(members[0].base),
        kind: "multi_choice",
        primaryColumn: null,
        columns: members.map((m) => m.info.column),
        options: members.map((m) => m.option),
        type: "nominal",
        reason: `Question à choix multiples : ${members.length} colonnes binaires, une par option. Chaque option peut être décrite (fréquence), mais elles ne forment pas ${members.length} variables de recherche distinctes.`,
      });
    } else if (members.length >= 2) {
      for (const m of members) {
        m.info.kind = "grid_item";
        m.info.option = m.option;
        m.info.reason = `Élément « ${m.option} » d'une grille de questions (« ${cleanHeader(m.base)} ») : chaque élément est une sous-question.`;
      }
    }
  }

  // 3. Unités restantes : une colonne = une question.
  for (const info of columns) {
    if (info.kind === "option_of" || info.kind === "multi_choice_item") continue;
    if (units.some((u) => u.id === info.unitId)) continue;
    const technical = info.kind === "technical" || info.kind === "identifier" || info.kind === "date" || info.kind === "empty";
    units.push({
      id: info.unitId,
      text: info.label,
      kind: technical ? "technical" : info.kind === "grid_item" ? "grid_item" : "single",
      primaryColumn: info.column,
      columns: [info.column],
      options: (profileOf(info.column)?.categories?.top ?? []).map((c) => c.value),
      type: info.type,
      reason: info.reason,
    });
  }
  units.sort((a, b) => Math.min(...a.columns) - Math.min(...b.columns));
  return { columns, units };
}

export function isAnalyzableUnit(unit: QuestionUnit): boolean {
  return unit.kind !== "technical" && unit.primaryColumn !== null;
}
