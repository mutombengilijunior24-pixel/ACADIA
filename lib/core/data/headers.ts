import type { ImportIssue, ImportedColumn } from "./types";

/**
 * Construction des colonnes : l'en-tête d'origine est conservé tel quel ;
 * un nom technique unique est créé séparément.
 */

export function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 60);
  if (!slug) return "";
  return /^\d/.test(slug) ? `c_${slug}` : slug;
}

export function buildColumns(
  headers: string[],
  options: { generated: boolean; headerRow: number | null; extraFrom?: number },
): { columns: ImportedColumn[]; issues: ImportIssue[] } {
  const issues: ImportIssue[] = [];
  const used = new Set<string>();
  const counts = new Map<string, number>();
  for (const header of headers) {
    const key = header.trim();
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const columns = headers.map((header, index): ImportedColumn => {
    const flags: ImportedColumn["headerFlags"] = [];
    const isExtra = options.extraFrom !== undefined && index >= options.extraFrom;
    if (options.generated) flags.push("generated");
    if (isExtra) flags.push("extra");
    const trimmed = header.trim();
    if (!trimmed && !options.generated) flags.push("empty");
    if (trimmed && (counts.get(trimmed) ?? 0) > 1) flags.push("duplicate");

    const base = slugify(trimmed) || `colonne_${index + 1}`;
    let name = base;
    let suffix = 2;
    while (used.has(name)) name = `${base}_${suffix++}`;
    used.add(name);

    return { index, originalHeader: header, technicalName: name, headerFlags: flags };
  });

  const empty = columns.filter((column) => column.headerFlags.includes("empty") && !column.headerFlags.includes("extra"));
  if (empty.length > 0) {
    issues.push({
      code: "empty_header",
      severity: "warning",
      message: `${empty.length} colonne(s) sans en-tête (n° ${empty.map((c) => c.index + 1).join(", ")}) : un nom technique leur a été attribué.`,
    });
  }
  const duplicates = [...counts.entries()].filter(([, n]) => n > 1);
  for (const [key, n] of duplicates) {
    const indexes = columns.filter((c) => c.originalHeader.trim() === key).map((c) => c.index + 1);
    issues.push({
      code: "duplicate_header",
      severity: "warning",
      message: `L'en-tête « ${columns[indexes[0] - 1].originalHeader.trim()} » apparaît ${n} fois (colonnes ${indexes.join(", ")}). Les colonnes sont conservées séparément ; vérifiez qu'il ne s'agit pas d'une erreur.`,
      column: indexes[0] - 1,
    });
  }
  return { columns, issues };
}

/**
 * En-tête lisible pour l'affichage et les rapports : sépare un titre de section collé à la question
 * (« RATIONNEMENT DU CREDITQuel a été… » → « … CREDIT Quel a été… ») et normalise les espaces.
 * L'en-tête d'origine reste inchangé dans les données.
 */
export function displayHeader(header: string): string {
  return header.replace(/([A-ZÀ-Ý]{2,})([A-ZÀ-Ý][a-zà-ÿ])/g, "$1 $2").replace(/\s+/g, " ").trim();
}
