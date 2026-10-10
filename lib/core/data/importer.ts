import { displayRaw, interpretCell, isBlankKind } from "./cells";
import { detectDelimiter, delimiterLabel, parseCsv } from "./csv";
import { buildColumns } from "./headers";
import { DEFAULT_IMPORT_LIMITS, formatBytes, type ImportLimits } from "./limits";
import type { ImportIssue, ImportOptions, ImportResult, ImportedDataset, RawValue, SourceFormat } from "./types";
import { readXlsx } from "./xlsx";

/**
 * Point d'entrée de l'importation : fichier brut → jeu de données structuré.
 * Fonction pure (aucun accès réseau, aucune écriture), utilisable dans le navigateur et dans Node.
 */

const fail = (issues: ImportIssue[], sheets?: Array<{ name: string; rowCount: number }>): ImportResult => ({
  ok: false,
  issues,
  sheets,
});

const error = (code: string, message: string): ImportIssue => ({ code, severity: "error", message });

function extensionOf(fileName: string): string {
  const match = /\.([a-z0-9]+)$/i.exec(fileName.trim());
  return match ? match[1].toLowerCase() : "";
}

type Sniffed = "zip" | "ole" | "pdf" | "binary" | "text";

function sniff(bytes: Uint8Array): Sniffed {
  if (bytes.length >= 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04) return "zip";
  if (bytes.length >= 4 && bytes[0] === 0xd0 && bytes[1] === 0xcf && bytes[2] === 0x11 && bytes[3] === 0xe0) return "ole";
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "pdf";
  const sample = bytes.subarray(0, 8192);
  const utf16Bom = sample.length >= 2 && ((sample[0] === 0xff && sample[1] === 0xfe) || (sample[0] === 0xfe && sample[1] === 0xff));
  if (!utf16Bom && sample.includes(0)) return "binary";
  return "text";
}

function describeMismatch(sniffed: Sniffed, extension: string): string {
  switch (sniffed) {
    case "zip":
      return `Le fichier porte l'extension .${extension} mais son contenu est celui d'une archive (probablement un classeur Excel .xlsx renommé). Renommez-le en .xlsx ou exportez-le en CSV.`;
    case "ole":
      return "Le fichier est un classeur Excel ancien format (.xls 97-2003), non pris en charge. Enregistrez-le au format .xlsx ou CSV UTF-8.";
    case "pdf":
      return "Le fichier est un PDF : les données doivent être fournies en CSV ou XLSX.";
    case "binary":
      return `Le fichier .${extension} contient des données binaires et non du texte CSV.`;
    case "text":
      return "Le fichier porte l'extension .xlsx mais contient du texte : il s'agit probablement d'un CSV renommé.";
  }
}

export function detectFormat(fileName: string, bytes: Uint8Array): { ok: true; format: SourceFormat } | { ok: false; issue: ImportIssue } {
  const extension = extensionOf(fileName);
  const sniffed = sniff(bytes);
  if (["csv", "txt", "tsv"].includes(extension)) {
    if (sniffed !== "text") return { ok: false, issue: error("format_mismatch", describeMismatch(sniffed, extension)) };
    return { ok: true, format: "csv" };
  }
  if (extension === "xlsx") {
    if (sniffed !== "zip") return { ok: false, issue: error("format_mismatch", describeMismatch(sniffed, extension)) };
    return { ok: true, format: "xlsx" };
  }
  const supported = "Formats pris en charge : CSV (.csv) et Excel (.xlsx).";
  if (extension === "xls") return { ok: false, issue: error("unsupported_format", `Le format .xls (Excel 97-2003) n'est pas pris en charge. ${supported}`) };
  return {
    ok: false,
    issue: error("unsupported_format", `Le format ${extension ? `.${extension}` : "de ce fichier"} n'est pas pris en charge. ${supported}`),
  };
}

function decodeText(
  bytes: Uint8Array,
  forced?: "utf-8" | "windows-1252",
): { ok: true; text: string; encoding: "utf-8" | "windows-1252"; hadBom: boolean; detected: boolean } | { ok: false; issue: ImportIssue } {
  if (bytes.length >= 2 && ((bytes[0] === 0xff && bytes[1] === 0xfe) || (bytes[0] === 0xfe && bytes[1] === 0xff))) {
    return {
      ok: false,
      issue: error("unsupported_encoding", "Le fichier est encodé en UTF-16 (« texte Unicode »). Enregistrez-le en « CSV UTF-8 » puis réessayez."),
    };
  }
  const hadBom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = hadBom ? bytes.subarray(3) : bytes;
  if (forced === "windows-1252") {
    return { ok: true, text: new TextDecoder("windows-1252").decode(body), encoding: "windows-1252", hadBom, detected: false };
  }
  try {
    return { ok: true, text: new TextDecoder("utf-8", { fatal: true }).decode(body), encoding: "utf-8", hadBom, detected: !forced };
  } catch {
    if (forced === "utf-8") {
      return { ok: false, issue: error("invalid_utf8", "Le fichier n'est pas de l'UTF-8 valide. Choisissez l'encodage Windows-1252 ou enregistrez le fichier en « CSV UTF-8 ».") };
    }
    // Exports Excel « CSV (séparateur : point-virgule) » sous Windows : Windows-1252.
    return { ok: true, text: new TextDecoder("windows-1252").decode(body), encoding: "windows-1252", hadBom, detected: true };
  }
}

function isBlankRow(row: RawValue[]): boolean {
  return row.every((value) => isBlankKind(interpretCell(value).kind));
}

/**
 * Construction du jeu de données à partir d'une matrice de cellules :
 * choix de l'en-tête, alignement des lignes, contrôles de structure et de limites.
 */
export function buildDataset(
  matrix: RawValue[][],
  sourceLineOf: (index: number) => number,
  base: Pick<ImportedDataset, "importId" | "fileName" | "format" | "fileSize" | "importedAt" | "csv" | "xlsx">,
  options: ImportOptions,
  limits: ImportLimits,
  initialIssues: ImportIssue[] = [],
): ImportResult {
  const issues = [...initialIssues];

  const firstNonBlank = matrix.findIndex((row) => !isBlankRow(row));
  if (firstNonBlank < 0) {
    return fail([error("empty_file", base.xlsx ? `La feuille « ${base.xlsx.sheetName} » est vide.` : "Le fichier est vide : aucune donnée à importer.")]);
  }

  let headerIndex: number | null;
  if (options.noHeader) {
    headerIndex = null;
  } else if (options.headerRow !== undefined) {
    headerIndex = matrix.findIndex((_, index) => sourceLineOf(index) === options.headerRow);
    if (headerIndex < 0 || isBlankRow(matrix[headerIndex])) {
      return fail([error("header_not_found", `La ligne ${options.headerRow} ne contient pas d'en-têtes exploitables.`)]);
    }
  } else {
    headerIndex = firstNonBlank;
  }

  const dataStart = headerIndex === null ? firstNonBlank : headerIndex + 1;
  // Lignes non vides situées avant l'en-tête (titres, notes de tableur…).
  const skippedAbove = matrix.slice(0, headerIndex ?? firstNonBlank).filter((row) => !isBlankRow(row)).length;
  if (skippedAbove > 0) {
    issues.push({
      code: "rows_above_header",
      severity: "info",
      message: `${skippedAbove} ligne(s) non vide(s) situées au-dessus de l'en-tête (ligne ${sourceLineOf(headerIndex ?? firstNonBlank)}) ne sont pas importées.`,
    });
  }

  let dataRows = matrix.slice(dataStart);
  let dataLines = dataRows.map((_, i) => sourceLineOf(dataStart + i));
  // Lignes vides finales (fin de fichier ou de plage Excel) : retirées et signalées.
  let trailing = 0;
  while (dataRows.length > 0 && isBlankRow(dataRows[dataRows.length - 1])) {
    dataRows = dataRows.slice(0, -1);
    dataLines = dataLines.slice(0, -1);
    trailing += 1;
  }
  if (trailing > 0 && base.format === "csv") {
    issues.push({ code: "trailing_blank_lines", severity: "info", message: `${trailing} ligne(s) vide(s) en fin de fichier ignorée(s).` });
  }

  const headerCells = headerIndex === null ? [] : matrix[headerIndex].map((value) => displayRaw(value));
  const maxRowLength = dataRows.reduce((max, row) => Math.max(max, row.length), 0);

  // Colonnes finales vides (ni en-tête, ni donnée) : artefacts de tableur, non créées.
  let width = Math.max(headerCells.length, maxRowLength);
  let droppedEmpty = 0;
  while (width > 0) {
    const col = width - 1;
    const headerBlank = (headerCells[col] ?? "").trim() === "";
    const dataBlank = dataRows.every((row) => isBlankKind(interpretCell(row[col] ?? null).kind));
    if (!headerBlank || !dataBlank) break;
    width -= 1;
    droppedEmpty += 1;
  }
  if (droppedEmpty > 0 && base.format === "xlsx") {
    issues.push({ code: "trailing_empty_columns", severity: "info", message: `${droppedEmpty} colonne(s) entièrement vide(s) (sans en-tête ni donnée) à droite de la plage n'ont pas été créées.` });
  }
  if (width === 0) {
    return fail([error("no_columns", "Aucune colonne exploitable n'a été trouvée.")]);
  }

  if (width > limits.maxColumns) {
    return fail([error("too_many_columns", `Le fichier contient ${width} colonnes (limite : ${limits.maxColumns}). Réduisez le nombre de colonnes ou divisez le fichier.`)]);
  }
  if (dataRows.length > limits.maxRows) {
    return fail([error("too_many_rows", `Le fichier contient ${dataRows.length} lignes de données (limite : ${limits.maxRows}). Divisez le fichier : aucune ligne n'a été ignorée.`)]);
  }
  if (dataRows.length * width > limits.maxCells) {
    return fail([error("too_many_cells", `Le fichier contient ${dataRows.length * width} cellules (limite : ${limits.maxCells}).`)]);
  }

  const headerLength = headerIndex === null ? 0 : Math.min(headerCells.length, width);
  const headerTexts = Array.from({ length: width }, (_, i) =>
    headerIndex === null ? `Colonne ${i + 1}` : i < headerLength ? headerCells[i] : "",
  );
  const { columns, issues: headerIssues } = buildColumns(headerTexts, {
    generated: headerIndex === null,
    headerRow: headerIndex === null ? null : sourceLineOf(headerIndex),
    extraFrom: headerIndex === null ? undefined : headerLength,
  });
  issues.push(...headerIssues);

  if (headerIndex !== null) {
    const headerKinds = matrix[headerIndex]
      .slice(0, width)
      .map((value) => interpretCell(value).kind)
      .filter((kind) => !isBlankKind(kind));
    if (headerKinds.length > 0 && headerKinds.every((kind) => kind === "number" || kind === "numeric_text" || kind === "date")) {
      issues.push({
        code: "header_looks_like_data",
        severity: "warning",
        message: "La ligne d'en-tête ne contient que des nombres ou des dates : il s'agit peut-être d'une ligne de données. Choisissez une autre ligne d'en-tête ou l'option « pas d'en-tête ».",
      });
    }
  }

  // Alignement non destructif : lignes courtes complétées par des cellules absentes (null),
  // lignes longues conservées entièrement (colonnes supplémentaires).
  const shortRows: number[] = [];
  const longRows: number[] = [];
  const rows = dataRows.map((row, i) => {
    if (headerIndex !== null && base.format === "csv" && !isBlankRow(row)) {
      if (row.length < headerLength) shortRows.push(dataLines[i]);
      if (row.length > headerLength) longRows.push(dataLines[i]);
    }
    return Array.from({ length: width }, (_, col) => (col < row.length ? row[col] : null));
  });

  const sample = (lines: number[]) => lines.slice(0, 5).join(", ") + (lines.length > 5 ? "…" : "");
  if (shortRows.length > 0) {
    issues.push({
      code: "short_rows",
      severity: "warning",
      message: `${shortRows.length} ligne(s) ont moins de champs que l'en-tête (lignes ${sample(shortRows)}) : les cellules absentes sont traitées comme manquantes.`,
      sourceRow: shortRows[0],
    });
  }
  if (longRows.length > 0) {
    issues.push({
      code: "long_rows",
      severity: "warning",
      message: `${longRows.length} ligne(s) ont plus de champs que l'en-tête (lignes ${sample(longRows)}) : les valeurs en trop sont conservées dans des colonnes supplémentaires sans en-tête. Vérifiez le séparateur et les guillemets.`,
      sourceRow: longRows[0],
    });
  }

  if (rows.length === 0) {
    issues.push({ code: "no_observations", severity: "warning", message: "Le fichier ne contient que la ligne d'en-tête : aucune observation à analyser." });
  }

  const dataset: ImportedDataset = {
    ...base,
    headerRow: headerIndex === null ? null : sourceLineOf(headerIndex),
    columns,
    rows,
    sourceRows: dataLines,
    rowCount: rows.length,
    columnCount: width,
    issues,
    status: issues.some((issue) => issue.severity === "warning") ? "ok_with_warnings" : "ok",
  };
  return { ok: true, dataset };
}

function newImportId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `import-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Importe un fichier CSV ou XLSX à partir de ses octets. Aucune donnée ne quitte l'appelant. */
export async function importFile(
  fileName: string,
  bytes: Uint8Array,
  options: ImportOptions = {},
  limits: ImportLimits = DEFAULT_IMPORT_LIMITS,
): Promise<ImportResult> {
  if (bytes.length === 0) return fail([error("empty_file", "Le fichier est vide : aucune donnée à importer.")]);
  if (bytes.length > limits.maxFileBytes) {
    return fail([
      error("file_too_large", `Le fichier pèse ${formatBytes(bytes.length)} (limite : ${formatBytes(limits.maxFileBytes)}). Divisez le fichier ou retirez les colonnes inutiles.`),
    ]);
  }

  const detected = detectFormat(fileName, bytes);
  if (!detected.ok) return fail([detected.issue]);

  const base = {
    importId: newImportId(),
    fileName,
    format: detected.format,
    fileSize: bytes.length,
    importedAt: new Date().toISOString(),
  };

  if (detected.format === "csv") {
    const decoded = decodeText(bytes, options.encoding);
    if (!decoded.ok) return fail([decoded.issue]);
    const initial: ImportIssue[] = [];
    if (decoded.encoding === "windows-1252" && decoded.detected) {
      initial.push({
        code: "encoding_fallback",
        severity: "warning",
        message: "Le fichier n'est pas en UTF-8 : il a été lu en Windows-1252 (export Excel courant). Vérifiez les accents dans l'aperçu.",
      });
    }
    if (decoded.text.trim() === "") return fail([error("empty_file", "Le fichier est vide : aucune donnée à importer.")]);

    let delimiter = options.delimiter;
    let delimiterSource: "detected" | "user" = "user";
    if (!delimiter) {
      delimiterSource = "detected";
      const guess = detectDelimiter(decoded.text);
      // Aucun séparateur détecté : lecture réellement en une seule colonne (séparateur vide).
      // Un séparateur par défaut couperait des valeurs comme « 11,5 » (décimale française).
      delimiter = guess?.delimiter ?? "";
      if (!guess) {
        initial.push({ code: "single_column", severity: "info", message: "Aucun séparateur détecté : le fichier est lu comme une seule colonne. Choisissez le séparateur si ce n'est pas le cas." });
      } else if (!guess.confident) {
        initial.push({ code: "delimiter_uncertain", severity: "warning", message: `Séparateur détecté avec incertitude : ${delimiterLabel(guess.delimiter)}. Vérifiez l'aperçu.` });
      }
    }

    const parsed = parseCsv(decoded.text, delimiter);
    if (!parsed.ok) {
      return fail([{ code: "csv_unterminated_quote", severity: "error", message: `${parsed.error.message} Le fichier est mal formé.`, sourceRow: parsed.error.line }]);
    }
    const matrix: RawValue[][] = parsed.records.map((record) => record.fields);
    return buildDataset(
      matrix,
      (index) => parsed.records[index].line,
      {
        ...base,
        csv: {
          delimiter,
          delimiterSource,
          encoding: decoded.encoding,
          encodingSource: options.encoding ? "user" : "detected",
          hadBom: decoded.hadBom,
        },
      },
      options,
      limits,
      initial,
    );
  }

  const workbook = await readXlsx(bytes, limits);
  if (!workbook.ok) return fail([workbook.issue]);
  const sheets = workbook.sheets.map((sheet) => ({
    name: sheet.name,
    rowCount: sheet.rows.filter((row) => !isBlankRow(row)).length,
  }));
  let sheetIndex: number;
  if (options.sheet !== undefined) {
    sheetIndex = workbook.sheets.findIndex((sheet) => sheet.name === options.sheet);
    if (sheetIndex < 0) return fail([error("sheet_not_found", `La feuille « ${options.sheet} » n'existe pas dans ce classeur.`)], sheets);
  } else {
    sheetIndex = sheets.findIndex((sheet) => sheet.rowCount > 0);
    if (sheetIndex < 0) return fail([error("empty_workbook", "Toutes les feuilles du classeur sont vides.")], sheets);
  }
  const sheet = workbook.sheets[sheetIndex];
  const result = buildDataset(
    sheet.rows,
    (index) => index + 1,
    { ...base, xlsx: { sheetName: sheet.name, sheetIndex, availableSheets: sheets } },
    options,
    limits,
  );
  return result.ok ? result : { ...result, sheets };
}
