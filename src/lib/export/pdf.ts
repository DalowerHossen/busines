// src/lib/export/pdf.ts
// A small PDF writer for report downloads. It lays a table out on A4 pages
// with the built in Helvetica fonts, so no font files and no third party
// renderer are needed on the server.

/** Width of an A4 page in points. */
const PAGE_WIDTH = 595.28;
/** Height of an A4 page in points. */
const PAGE_HEIGHT = 841.89;
/** Margin kept on every side. */
const MARGIN = 40;
/** Height of one body row. */
const ROW_HEIGHT = 18;
/** Size of the body text. */
const BODY_SIZE = 9;
/** Size of the report title. */
const TITLE_SIZE = 16;

export interface PdfTableDocument {
  /** Title printed at the top of the first page. */
  title: string;
  /** Lines printed under the title, such as the company and the period. */
  subtitles: readonly string[];
  /** Column headings. */
  headers: readonly string[];
  /** Body of the report. */
  rows: readonly (readonly string[])[];
  /** The closing line, printed in bold with a rule above it. */
  totalRow?: readonly string[];
  /** Columns that are printed right aligned, by index. */
  numericColumns?: readonly number[];
  /** Line printed in small text at the bottom of every page. */
  footerNote?: string;
}

/**
 * Escapes the characters that would otherwise end a PDF string.
 *
 * @param value Text to escape.
 * @returns The escaped text.
 */
function escapePdfText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .split('')
    .map((character) => {
      const code = character.charCodeAt(0);
      return code > 126 || code < 32 ? ' ' : character;
    })
    .join('');
}

/**
 * Estimates how wide a piece of Helvetica text is.
 *
 * @param value Text being measured.
 * @param size Font size in points.
 * @returns The width in points.
 */
function measure(value: string, size: number): number {
  return value.length * size * 0.5;
}

/**
 * Shortens a value until it fits inside a column.
 *
 * @param value Text to fit.
 * @param width Width of the column in points.
 * @param size Font size in points.
 * @returns The text, shortened with an ellipsis when needed.
 */
function fit(value: string, width: number, size: number): string {
  if (measure(value, size) <= width) {
    return value;
  }

  const maximum = Math.max(1, Math.floor(width / (size * 0.5)) - 1);
  return `${value.slice(0, maximum)}…`.replace('…', '...');
}

interface Cursor {
  content: string[];
  y: number;
}

/**
 * Works out how wide each column should be.
 *
 * @param document Report being laid out.
 * @returns A width in points for every column.
 */
function columnWidths(document: PdfTableDocument): number[] {
  const available = PAGE_WIDTH - MARGIN * 2;
  const counts = document.headers.map((header, index) => {
    let longest = header.length;

    for (const row of document.rows) {
      longest = Math.max(longest, (row[index] ?? '').length);
    }

    if (document.totalRow !== undefined) {
      longest = Math.max(longest, (document.totalRow[index] ?? '').length);
    }

    return Math.min(longest, 40);
  });

  const total = counts.reduce((sum, count) => sum + count, 0) || 1;

  return counts.map((count) => (count / total) * available);
}

/**
 * Writes one line of cells at the current position.
 *
 * @param cursor Page being written to.
 * @param cells Values of the line.
 * @param widths Width of every column.
 * @param numericColumns Columns printed right aligned.
 * @param font Font resource name.
 * @param size Font size in points.
 * @returns Nothing.
 */
function writeRow(
  cursor: Cursor,
  cells: readonly string[],
  widths: readonly number[],
  numericColumns: readonly number[],
  font: string,
  size: number
): void {
  let x = MARGIN;

  widths.forEach((width, index) => {
    const raw = cells[index] ?? '';
    const text = fit(raw, width - 6, size);
    const offset = numericColumns.includes(index) ? width - 6 - measure(text, size) : 2;

    cursor.content.push(
      `BT /${font} ${size} Tf 1 0 0 1 ${(x + Math.max(offset, 2)).toFixed(2)} ${cursor.y.toFixed(
        2
      )} Tm (${escapePdfText(text)}) Tj ET`
    );

    x += width;
  });
}

/**
 * Draws a horizontal rule across the content area.
 *
 * @param cursor Page being written to.
 * @param y Height of the rule.
 * @returns Nothing.
 */
function writeRule(cursor: Cursor, y: number): void {
  cursor.content.push(
    `0.8 w 0.78 0.80 0.84 RG ${MARGIN} ${y.toFixed(2)} m ${(PAGE_WIDTH - MARGIN).toFixed(
      2
    )} ${y.toFixed(2)} l S`
  );
}

/**
 * Renders a report as a PDF file.
 *
 * @param document Title, headings, rows and the total line.
 * @returns The file content, ready to be downloaded.
 */
export function buildTablePdf(document: PdfTableDocument): Uint8Array {
  const widths = columnWidths(document);
  const numericColumns = document.numericColumns ?? [];
  const pages: string[][] = [];
  let cursor: Cursor = { content: [], y: PAGE_HEIGHT - MARGIN };
  let isFirstPage = true;

  /**
   * Starts a fresh page and prints the heading row on it.
   *
   * @returns Nothing.
   */
  function startPage(): void {
    cursor = { content: [], y: PAGE_HEIGHT - MARGIN };

    if (isFirstPage) {
      cursor.y -= TITLE_SIZE;
      cursor.content.push(
        `BT /F2 ${TITLE_SIZE} Tf 1 0 0 1 ${MARGIN} ${cursor.y.toFixed(2)} Tm (${escapePdfText(
          document.title
        )}) Tj ET`
      );

      for (const subtitle of document.subtitles) {
        cursor.y -= 14;
        cursor.content.push(
          `BT /F1 10 Tf 0.35 0.38 0.44 rg 1 0 0 1 ${MARGIN} ${cursor.y.toFixed(
            2
          )} Tm (${escapePdfText(subtitle)}) Tj ET 0 0 0 rg`
        );
      }

      cursor.y -= 22;
      isFirstPage = false;
    }

    writeRow(cursor, document.headers, widths, numericColumns, 'F2', BODY_SIZE);
    cursor.y -= 6;
    writeRule(cursor, cursor.y);
    cursor.y -= ROW_HEIGHT;
  }

  startPage();

  for (const row of document.rows) {
    if (cursor.y < MARGIN + ROW_HEIGHT * 3) {
      pages.push(cursor.content);
      startPage();
    }

    writeRow(cursor, row, widths, numericColumns, 'F1', BODY_SIZE);
    cursor.y -= ROW_HEIGHT;
  }

  if (document.totalRow !== undefined) {
    if (cursor.y < MARGIN + ROW_HEIGHT * 3) {
      pages.push(cursor.content);
      startPage();
    }

    writeRule(cursor, cursor.y + 12);
    writeRow(cursor, document.totalRow, widths, numericColumns, 'F2', BODY_SIZE);
    cursor.y -= ROW_HEIGHT;
  }

  pages.push(cursor.content);

  const footer = document.footerNote;

  const streams = pages.map((content, index) => {
    const lines = [...content];

    if (footer !== undefined) {
      lines.push(
        `BT /F1 8 Tf 0.45 0.48 0.54 rg 1 0 0 1 ${MARGIN} ${(MARGIN - 12).toFixed(
          2
        )} Tm (${escapePdfText(`${footer} — page ${index + 1} of ${pages.length}`)}) Tj ET`
      );
    }

    return lines.join('\n');
  });

  return assemblePdf(streams);
}

/**
 * Builds the object table of the file around the page streams.
 *
 * @param streams Content stream of every page.
 * @returns The complete file.
 */
function assemblePdf(streams: readonly string[]): Uint8Array {
  const objects: string[] = [];
  const pageCount = streams.length;
  const firstPageObject = 4;
  const pageIds = streams.map((_, index) => firstPageObject + index * 2);
  const kids = pageIds.map((id) => `${id} 0 R`).join(' ');

  objects.push('<< /Type /Catalog /Pages 2 0 R >>');
  objects.push(`<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>`);
  objects.push(
    '<< /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> /F2 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> >> >>'
  );

  streams.forEach((stream) => {
    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_WIDTH.toFixed(2)} ${PAGE_HEIGHT.toFixed(
        2
      )}] /Resources 3 0 R /Contents ${objects.length + 2} 0 R >>`
    );
    objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);
  });

  let file = '%PDF-1.4\n';
  const offsets: number[] = [];

  objects.forEach((body, index) => {
    offsets.push(file.length);
    file += `${index + 1} 0 obj\n${body}\nendobj\n`;
  });

  const startXref = file.length;
  file += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;

  for (const offset of offsets) {
    file += `${offset.toString().padStart(10, '0')} 00000 n \n`;
  }

  file += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${startXref}\n%%EOF\n`;

  const bytes = new Uint8Array(file.length);

  for (let index = 0; index < file.length; index += 1) {
    bytes[index] = file.charCodeAt(index) & 0xff;
  }

  return bytes;
}
