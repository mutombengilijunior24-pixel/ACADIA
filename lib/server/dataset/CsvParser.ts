// ============================================================
// ACADIA — PARSEUR CSV (Module 2, Data Import Engine)
//
// Implémentation maison plutôt qu'une dépendance externe : gère
// les champs entre guillemets, les guillemets échappés (""), les
// virgules à l'intérieur d'un champ cité, et les fins de ligne
// \n / \r\n — suffisant pour de vrais exports Google Forms/Excel,
// sans ajouter de dépendance supplémentaire au projet.
// ============================================================

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const len = text.length;

  while (i < len) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += char;
      i++;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (char === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (char === "\r") {
      i++;
      continue;
    }
    if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += char;
    i++;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Ignore les lignes strictement vides (souvent une fin de fichier).
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ""));
}
