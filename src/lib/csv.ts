import type { CsvRow } from "./schema.ts";

/** Minimal RFC 4180-style CSV parser (handles quoted fields). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\r" && next === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

export function parseMinimalPairsCsv(text: string): CsvRow[] {
  const rows = parseCsv(text.trim());
  if (rows.length < 2) return [];

  const dataRows = rows.slice(1);
  return dataRows
    .filter((cols) => cols.length >= 6 && cols[2]?.trim())
    .map((cols) => ({
      phonemeGroup: cols[0].trim(),
      setId: Number.parseInt(cols[1].trim(), 10),
      word: cols[2].trim(),
      ipa: cols[3].trim(),
      meaningEnglish: cols[5].trim(),
    }))
    .filter((row) => Number.isFinite(row.setId));
}
