// src/lib/export/csv.ts
// Turning a report into comma separated text that a spreadsheet opens
// cleanly, including the total row an accountant expects at the bottom.

/** Characters that make a spreadsheet treat a cell as a formula. */
const FORMULA_PREFIXES = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Escapes one value so a spreadsheet reads it as text, never as a formula.
 *
 * @param value Cell value to escape.
 * @returns The quoted cell.
 */
export function toCsvCell(value: string | number | null): string {
  const text = value === null ? '' : String(value);
  const guarded =
    text.length > 0 && FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))
      ? `'${text}`
      : text;

  return `"${guarded.replace(/"/g, '""')}"`;
}

/**
 * Builds one comma separated line.
 *
 * @param cells Values of the line.
 * @returns The line, without a trailing break.
 */
export function toCsvLine(cells: readonly (string | number | null)[]): string {
  return cells.map((cell) => toCsvCell(cell)).join(',');
}

export interface CsvDocument {
  /** Column headings, in the order they are written. */
  headers: readonly string[];
  /** Body of the report. */
  rows: readonly (readonly (string | number | null)[])[];
  /** The closing line, written under a blank separator. */
  totalRow?: readonly (string | number | null)[];
  /** Lines written above the headings, such as the company and the period. */
  preamble?: readonly string[];
}

/**
 * Builds the complete comma separated document.
 *
 * @param document Headings, rows and the total line.
 * @returns The file content, ready to be downloaded.
 */
export function buildCsv(document: CsvDocument): string {
  const lines: string[] = [];

  for (const line of document.preamble ?? []) {
    lines.push(toCsvLine([line]));
  }

  if ((document.preamble ?? []).length > 0) {
    lines.push('');
  }

  lines.push(toCsvLine(document.headers));

  for (const row of document.rows) {
    lines.push(toCsvLine(row));
  }

  if (document.totalRow !== undefined) {
    lines.push(toCsvLine(document.totalRow));
  }

  // A byte order mark keeps accented characters readable in Excel.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}
