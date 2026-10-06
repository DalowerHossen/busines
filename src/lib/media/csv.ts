// src/lib/media/csv.ts
// Formula-safe CSV serialization for report and import/export flows.
import 'server-only';

import { MediaProcessingError } from './errors';

function escapeCsvCell(value: string): string {
  const safeValue = /^[=+@]/u.test(value) || /^-[A-Za-z(]/u.test(value) ? `'${value}` : value;
  return /[",\r\n]/u.test(safeValue) ? `"${safeValue.replace(/"/gu, '""')}"` : safeValue;
}

export function serializeCsv(
  headers: readonly string[],
  rows: readonly Readonly<Record<string, string | number | null | undefined>>[]
): string {
  if (headers.length === 0 || headers.some((header) => !header.trim())) {
    throw new MediaProcessingError('invalid_file');
  }
  const normalizedHeaders = headers.map((header) => header.normalize('NFKC').trim());
  const normalizedSet = new Set(
    normalizedHeaders.map((header) => header.toLocaleLowerCase('en-US'))
  );
  if (normalizedSet.size !== normalizedHeaders.length)
    throw new MediaProcessingError('invalid_file');

  const lines = [normalizedHeaders.map(escapeCsvCell).join(',')];
  for (const row of rows) {
    lines.push(
      normalizedHeaders
        .map((header) => escapeCsvCell(String(row[header] ?? '').normalize('NFKC')))
        .join(',')
    );
  }
  return `${lines.join('\r\n')}\r\n`;
}
