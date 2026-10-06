// Live Node smoke verification for Phase 23's server-only media pipeline.
// The smoke bundles the TypeScript entry as ESM and runs real bounded parsing,
// hostile-content rejection, sanitization, image optimization, and PDF save.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { build } from 'esbuild';

const root = process.cwd();
const temporaryDirectory = path.join(root, 'tmp', 'phase23-live-smoke');
const entryPath = path.join(temporaryDirectory, 'entry.ts');
const outputPath = path.join(temporaryDirectory, 'entry.mjs');
const serverOnlyStub = path.join(temporaryDirectory, 'server-only.mjs');

const entry = `
import ExcelJS from 'exceljs';
import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import {
  compressPdf,
  optimizeImage,
  parseTabularFile,
  sanitizeRichText,
  sanitizeSvgMarkup,
  serializeCsv,
  validateUploadedFile,
} from '../../src/lib/media/index.ts';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function verifyFormulaSafety() {
  const csv = Buffer.from('name,amount\\nAlice,"=HYPERLINK(""https://evil.example"")"\\n');
  const parsed = await parseTabularFile({
    fileName: 'clients.csv',
    mimeType: 'text/csv',
    content: csv,
  });
  assert(parsed.rows[0].amount.startsWith("'=HYPERLINK"), 'CSV formula was not neutralized');

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Clients');
  worksheet.addRow(['name', 'amount']);
  worksheet.addRow(['Bob', 42]);
  const xlsx = Buffer.from(await workbook.xlsx.writeBuffer());
  const parsedXlsx = await parseTabularFile({
    fileName: 'clients.xlsx',
    mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    content: xlsx,
  });
  assert(parsedXlsx.kind === 'xlsx' && parsedXlsx.rows[0].name === 'Bob', 'XLSX parse failed');

  const exported = serializeCsv(['name', 'amount'], [{ name: 'Eve', amount: '=SUM(A1)' }]);
  assert(exported.includes("'=SUM(A1)"), 'CSV export formula was not neutralized');
}

async function verifyMagicByteMismatch() {
  let rejected = false;
  try {
    await validateUploadedFile({
      fileName: 'not-a-png.png',
      mimeType: 'image/png',
      content: Buffer.from('this is not a PNG'),
    });
  } catch {
    rejected = true;
  }
  assert(rejected, 'magic-byte mismatch was accepted');
}

async function verifyHtmlSanitization() {
  const richText = sanitizeRichText('<p>Safe</p><script>alert(1)</script><a href="javascript:alert(1)">bad</a>');
  assert(!richText.includes('<script') && !richText.includes('javascript:'), 'hostile HTML survived');
  const svg = sanitizeSvgMarkup('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><path d="M0 0" /></svg>');
  assert(!svg.includes('onload') && svg.includes('<svg'), 'unsafe SVG was not sanitized');
}

async function verifyImageOptimization() {
  const source = await sharp({
    create: { width: 64, height: 64, channels: 3, background: { b: 220, g: 120, r: 40 } },
  }).png().toBuffer();
  const optimized = await optimizeImage({
    category: 'company_logo',
    content: source,
    fileName: 'logo.png',
    mimeType: 'image/png',
  }, { maxHeight: 32, maxWidth: 32, quality: 75 });
  assert(optimized.mimeType === 'image/webp', 'image was not converted to WebP');
  assert(/^[a-f0-9]{64}$/.test(optimized.sha256), 'image hash is invalid');
  assert(optimized.sizeInBytes > 0, 'optimized image is empty');
}

async function verifyMultiPagePdfCompression() {
  const document = await PDFDocument.create();
  document.addPage();
  document.addPage();
  const source = Buffer.from(await document.save());
  const optimized = await compressPdf({
    category: 'invoice_pdf',
    content: source,
    fileName: 'invoice.pdf',
    mimeType: 'application/pdf',
  });
  assert(optimized.kind === 'pdf' && optimized.pageCount === 2, 'PDF page count changed');
  assert(optimized.mimeType === 'application/pdf', 'PDF MIME type changed');
  assert(/^[a-f0-9]{64}$/.test(optimized.sha256), 'PDF hash is invalid');
}

await verifyFormulaSafety();
await verifyMagicByteMismatch();
await verifyHtmlSanitization();
await verifyImageOptimization();
await verifyMultiPagePdfCompression();
console.log('Phase 23 live smoke passed: CSV/XLSX parsing, formula defenses, magic-byte rejection, HTML/SVG sanitization, WebP optimization, and two-page PDF compression.');
`;

try {
  await mkdir(temporaryDirectory, { recursive: true });
  await writeFile(entryPath, entry, 'utf8');
  await writeFile(serverOnlyStub, 'export {};\n', 'utf8');
  await build({
    absWorkingDir: root,
    alias: { 'server-only': serverOnlyStub },
    bundle: true,
    entryPoints: [entryPath],
    external: ['csv-parse', 'exceljs', 'jszip', 'pdf-lib', 'sanitize-html', 'sharp'],
    format: 'esm',
    outfile: outputPath,
    platform: 'node',
    target: 'node20',
  });
  await import(`${pathToFileURL(outputPath).href}?run=${Date.now()}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
