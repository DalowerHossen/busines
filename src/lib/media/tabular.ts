// src/lib/media/tabular.ts
// Bounded, formula-safe CSV/XLSX parsing for import flows. The parser returns
// strings only; business validators decide the meaning and required columns.
import 'server-only';

import { parse as parseCsv } from 'csv-parse/sync';
import ExcelJS from 'exceljs';

import { MediaProcessingError } from './errors';
import { validateUploadedFile, type FileValidationInput } from './file-validator';

export interface TabularParseOptions {
  readonly maxRows?: number;
  readonly maxColumns?: number;
  readonly maxCellCharacters?: number;
}

export interface ParsedTabularFile {
  readonly fileName: string;
  readonly kind: 'csv' | 'xlsx';
  readonly headers: readonly string[];
  readonly rows: readonly Readonly<Record<string, string>>[];
}

const DEFAULT_MAX_ROWS = 10_000;
const DEFAULT_MAX_COLUMNS = 100;
const DEFAULT_MAX_CELL_CHARACTERS = 100_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeHeader(value: string): string {
  const header = value.normalize('NFKC').trim();
  if (!header || header.length > 128 || /^[=+@]/u.test(header)) {
    throw new MediaProcessingError('invalid_file');
  }
  return header;
}

function neutralizeFormula(value: string): string {
  if (/^[=+@]/u.test(value) || /^-[A-Za-z(]/u.test(value)) return `'${value}`;
  return value;
}

function normalizeCell(value: string, maxCellCharacters: number): string {
  const normalized = value
    .normalize('NFKC')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')
    .trim();
  if (normalized.length > maxCellCharacters) throw new MediaProcessingError('file_too_large');
  return neutralizeFormula(normalized);
}

function buildRows(
  matrix: readonly (readonly string[])[],
  options: Required<TabularParseOptions>
): {
  readonly headers: readonly string[];
  readonly rows: readonly Readonly<Record<string, string>>[];
} {
  if (matrix.length === 0 || matrix[0] === undefined)
    throw new MediaProcessingError('invalid_file');
  const rawHeaders = matrix[0];
  if (rawHeaders.length === 0 || rawHeaders.length > options.maxColumns) {
    throw new MediaProcessingError('file_too_large');
  }

  const headers = rawHeaders.map(normalizeHeader);
  const normalizedHeaders = new Set(headers.map((header) => header.toLocaleLowerCase('en-US')));
  if (normalizedHeaders.size !== headers.length) throw new MediaProcessingError('invalid_file');

  const rows: Readonly<Record<string, string>>[] = [];
  for (const rawRow of matrix.slice(1)) {
    if (rawRow.length !== headers.length) throw new MediaProcessingError('invalid_file');
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = normalizeCell(rawRow[index] ?? '', options.maxCellCharacters);
    });
    rows.push(row);
    if (rows.length > options.maxRows) throw new MediaProcessingError('file_too_large');
  }

  return { headers, rows };
}

function parseCsvContent(
  content: Buffer,
  options: Required<TabularParseOptions>
): {
  readonly headers: readonly string[];
  readonly rows: readonly Readonly<Record<string, string>>[];
} {
  let records: unknown;
  try {
    records = parseCsv(content.toString('utf8'), {
      bom: true,
      columns: false,
      delimiter: [',', '\t'],
      max_record_size: options.maxCellCharacters * options.maxColumns,
      relax_column_count: false,
      skip_empty_lines: true,
      skip_records_with_empty_values: false,
      trim: false,
    });
  } catch {
    throw new MediaProcessingError('invalid_file');
  }
  if (!Array.isArray(records) || records.some((record) => !Array.isArray(record))) {
    throw new MediaProcessingError('invalid_file');
  }
  const matrix = records.map((record) =>
    (record as unknown[]).map((cell) => (typeof cell === 'string' ? cell : String(cell ?? '')))
  );
  return buildRows(matrix, options);
}

function excelCellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (isRecord(value)) {
    if ('formula' in value || 'sharedFormula' in value) {
      throw new MediaProcessingError('unsafe_file_content');
    }
    if (Array.isArray(value.richText)) {
      return value.richText
        .map((part) => (isRecord(part) && typeof part.text === 'string' ? part.text : ''))
        .join('');
    }
    if (typeof value.result === 'string' || typeof value.result === 'number') {
      return String(value.result);
    }
  }
  throw new MediaProcessingError('invalid_file');
}

async function parseXlsxContent(
  content: Buffer,
  options: Required<TabularParseOptions>
): Promise<{
  readonly headers: readonly string[];
  readonly rows: readonly Readonly<Record<string, string>>[];
}> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(content);
  } catch {
    throw new MediaProcessingError('invalid_file');
  }

  const worksheet = workbook.worksheets.find((sheet) => sheet.state !== 'hidden');
  if (
    !worksheet ||
    worksheet.actualRowCount > options.maxRows + 1 ||
    worksheet.actualColumnCount > options.maxColumns
  ) {
    throw new MediaProcessingError('file_too_large');
  }

  const matrix: string[][] = [];
  for (let rowNumber = 1; rowNumber <= worksheet.actualRowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const values: string[] = [];
    for (let columnNumber = 1; columnNumber <= worksheet.actualColumnCount; columnNumber += 1) {
      values.push(excelCellToString(row.getCell(columnNumber).value));
    }
    matrix.push(values);
  }
  return buildRows(matrix, options);
}

export async function parseTabularFile(
  input: FileValidationInput,
  options: TabularParseOptions = {}
): Promise<ParsedTabularFile> {
  const limits: Required<TabularParseOptions> = {
    maxRows: options.maxRows ?? DEFAULT_MAX_ROWS,
    maxColumns: options.maxColumns ?? DEFAULT_MAX_COLUMNS,
    maxCellCharacters: options.maxCellCharacters ?? DEFAULT_MAX_CELL_CHARACTERS,
  };
  if (
    !Number.isSafeInteger(limits.maxRows) ||
    limits.maxRows <= 0 ||
    !Number.isSafeInteger(limits.maxColumns) ||
    limits.maxColumns <= 0 ||
    !Number.isSafeInteger(limits.maxCellCharacters) ||
    limits.maxCellCharacters <= 0
  ) {
    throw new MediaProcessingError('invalid_file');
  }

  const validated = await validateUploadedFile({ ...input, category: 'import_export_file' });
  if (validated.kind !== 'csv' && validated.kind !== 'xlsx') {
    throw new MediaProcessingError('unsupported_file_type');
  }
  const parsed =
    validated.kind === 'csv'
      ? parseCsvContent(validated.content, limits)
      : await parseXlsxContent(validated.content, limits);

  return {
    fileName: validated.fileName,
    kind: validated.kind,
    headers: parsed.headers,
    rows: parsed.rows,
  };
}
