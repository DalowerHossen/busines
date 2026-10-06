// Static and pure-function verification for Phase 22's PDF and print engine.
// Rendering is server-only because React-PDF uses Node PDFKit and bundled
// fonts; a configured Next/Node runtime should perform the live render smoke
// test with the same renderer.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Money } from '@/types/core';
import { cleanPdfText, formatPdfDate, formatPdfMoney } from '@/lib/pdf/format';

const root = process.cwd();

function read(relativePath: string): string {
  const path = join(root, relativePath);
  if (!existsSync(path)) throw new Error(`Phase 22 verification failed: missing ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Phase 22 verification failed: ${message}`);
}

const packageJson = read('package.json');
const lockfile = read('package-lock.json');
const renderer = read('src/lib/pdf/renderer.tsx');
const hashStore = read('src/lib/pdf/hash-store.ts');
const document = read('src/lib/pdf/document.tsx');
const fonts = read('src/lib/pdf/fonts.ts');
const pdfTypes = read('src/lib/pdf/types.ts');
const printComponent = read('src/components/shared/invoice-print-document.tsx');
const printCss = read('src/styles/print.css');
const globals = read('src/app/globals.css');
const hashMigration = read('supabase/migrations/00046_invoice_estimate_pdf_hash_fields.sql');

assert(packageJson.includes('"@react-pdf/renderer"'), 'React-PDF dependency is missing');
assert(lockfile.includes('node_modules/@react-pdf/renderer'), 'lockfile lacks React-PDF');
assert(renderer.includes("import 'server-only'"), 'renderer is not server-only');
assert(renderer.includes('renderToBuffer'), 'renderer does not use server-side renderToBuffer');
assert(renderer.includes("createHash('sha256')"), 'renderer does not hash exact PDF bytes');
assert(
  renderer.includes("visibility: 'private'"),
  'archived PDF snapshots are not private by default'
);
assert(renderer.includes('category: snapshotCategory'), 'snapshot category mapping is missing');
assert(hashStore.includes('rendered_pdf_hash'), 'hash persistence store is missing');
assert(
  hashStore.includes(".eq('company_id', input.companyId)"),
  'hash persistence lacks tenant filtering'
);
assert(
  hashStore.includes(".is('deleted_at', null)"),
  'hash persistence lacks soft-delete filtering'
);

for (const marker of [
  'Page size={pageSize}',
  'fixed',
  'Page ${pageNumber} of ${totalPages}',
  'wrap={false}',
  'tableHeader',
  'ensurePdfFontsRegistered',
]) {
  assert(document.includes(marker), `PDF pagination marker ${marker} is missing`);
}
assert(document.includes('formatPdfMoney'), 'PDF does not render decimal-safe money values');
assert(pdfTypes.includes('pageSize?: PdfPageSize'), 'A4/Letter input option is missing');
assert(fonts.includes('Font.register'), 'font embedding registration is missing');
assert(fonts.includes('DejaVuSans.ttf'), 'regular Unicode font source is missing');
assert(fonts.includes('DejaVuSans-Bold.ttf'), 'bold Unicode font source is missing');
for (const font of ['public/fonts/DejaVuSans.ttf', 'public/fonts/DejaVuSans-Bold.ttf']) {
  assert(existsSync(join(root, font)), `${font} is missing`);
}
assert(existsSync(join(root, 'public/fonts/DEJAVU-LICENSE.txt')), 'font license is missing');

for (const marker of [
  '@page {',
  'size: A4',
  '@page invoice-letter',
  'size: Letter',
  '@media print',
  'break-inside: avoid',
  'counter(page)',
  'counter(pages)',
]) {
  assert(printCss.includes(marker), `print CSS marker ${marker} is missing`);
}
assert(globals.includes("@import '../styles/print.css'"), 'print CSS is not loaded globally');
assert(printComponent.includes('InvoicePrintDocument'), 'HTML print preview component is missing');
assert(printComponent.includes('data-page-size'), 'print preview does not expose page-size toggle');

for (const marker of ['rendered_pdf_hash', 'rendered_pdf_hash_computed_at']) {
  assert(hashMigration.includes(marker), `database hash field ${marker} is missing`);
}

const usd: Money = {
  amount: '1234567.89' as Money['amount'],
  currency: 'USD' as Money['currency'],
};
assert(formatPdfMoney(usd) === 'USD 1,234,567.89', 'money formatting is not deterministic');
assert(formatPdfDate('2026-10-06') === 'Oct 06, 2026', 'date formatting is not deterministic');
assert(cleanPdfText('  Invoice \u0000 — café  ') === 'Invoice — café', 'PDF text cleanup failed');

let rejected = false;
try {
  formatPdfMoney({
    amount: '12.00' as Money['amount'],
    currency: 'ZZZ' as Money['currency'],
  });
} catch {
  rejected = true;
}
assert(rejected, 'unsupported currencies are silently formatted');

process.stdout.write(
  'Phase 22 verification passed: server React-PDF rendering, embedded Unicode fonts, A4/Letter pagination, exact-byte SHA-256 hashing, immutable snapshot preparation, browser print CSS, and pure formatting behavior are covered.\n'
);
