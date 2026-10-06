// src/lib/imports/csv.ts
// Reading the spreadsheet a business arrives with.
//
// Exports from other tools are not clean. They carry a byte order mark, they
// quote some fields and not others, they use semicolons in places that use a
// comma for the decimal point, and they end lines in two different ways. All
// of that is handled here so the rest of the import can assume plain rows.

/** The most rows one file may carry, matching what the database accepts. */
export const MAXIMUM_ROWS = 2000;

export interface ParsedTable {
  /** The column names, lower cased and trimmed. */
  headers: readonly string[];
  /** Each row as a map of column name to value. */
  rows: readonly Readonly<Record<string, string>>[];
  /** Anything wrong with the file itself. */
  problem: string | null;
}

/**
 * Works out which character separates the fields.
 *
 * @param line The first line of the file.
 * @returns The separator that appears most often.
 */
function detectSeparator(line: string): string {
  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let bestCount = 0;

  for (const candidate of candidates) {
    const count = line.split(candidate).length - 1;

    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }

  return best;
}

/**
 * Splits one line, honouring quotes around fields that contain the separator.
 *
 * @param line The line being split.
 * @param separator The character between fields.
 * @returns The fields of that line.
 */
function splitLine(line: string, separator: string): string[] {
  const fields: string[] = [];
  let current = '';
  let isQuoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];

    if (character === '"') {
      if (isQuoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        isQuoted = !isQuoted;
      }

      continue;
    }

    if (character === separator && !isQuoted) {
      fields.push(current.trim());
      current = '';

      continue;
    }

    current += character ?? '';
  }

  fields.push(current.trim());

  return fields;
}

/**
 * Reads a spreadsheet export into rows.
 *
 * @param text The contents of the file.
 * @returns The headers, the rows, and anything wrong with the file.
 */
export function parseDelimitedText(text: string): ParsedTable {
  const cleaned = text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = cleaned.split('\n').filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    return { headers: [], rows: [], problem: 'That file is empty.' };
  }

  const first = lines[0] ?? '';
  const separator = detectSeparator(first);
  const headers = splitLine(first, separator).map((header) =>
    header.toLowerCase().replace(/\s+/g, '_')
  );

  if (headers.length < 2) {
    return {
      headers: [],
      rows: [],
      problem: 'The first line should name the columns, separated by commas.',
    };
  }

  const body = lines.slice(1, MAXIMUM_ROWS + 1);

  const rows = body.map((line) => {
    const fields = splitLine(line, separator);
    const row: Record<string, string> = {};

    headers.forEach((header, index) => {
      row[header] = fields[index] ?? '';
    });

    return row;
  });

  return {
    headers,
    rows,
    problem:
      lines.length - 1 > MAXIMUM_ROWS
        ? `Only the first ${String(MAXIMUM_ROWS)} rows were read. Split the file and bring the rest in afterwards.`
        : null,
  };
}
