// Live Node smoke verification for Phase 22's server-only renderer.
// The smoke bundles the TypeScript entry as ESM so React-PDF's Node-only
// hyphenation/font packages are loaded through their official import exports.
import { mkdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import { build } from 'esbuild';

const root = process.cwd();
const temporaryDirectory = path.join(root, 'tmp', 'phase22-render-smoke');
const entryPath = path.join(temporaryDirectory, 'entry.ts');
const outputPath = path.join(temporaryDirectory, 'entry.mjs');
const serverOnlyStub = path.join(temporaryDirectory, 'server-only.mjs');

const entry = `
import { createHash } from 'node:crypto';
import { renderInvoicePdf } from '../../src/lib/pdf/renderer.tsx';

const currency = 'USD';
const lineItems = Array.from({ length: 100 }, (_, index) => ({
  description: 'Line item ' + (index + 1) + ' with a long description to exercise wrapping',
  quantity: '1',
  unitPrice: { amount: '10.00', currency },
  lineTotal: { amount: '10.00', currency },
}));
const input = {
  documentType: 'invoice',
  documentNumber: 'INV-PHASE22-SMOKE',
  company: { name: 'KD SOLUTION IT' },
  client: { name: 'Unicode Client — café' },
  issueDate: '2026-10-06',
  currency,
  lineItems,
  subtotal: { amount: '1000.00', currency },
  discountTotal: { amount: '0.00', currency },
  taxTotal: { amount: '0.00', currency },
  total: { amount: '1000.00', currency },
};

const result = await renderInvoicePdf(input, { pageSize: 'LETTER' });
const pageCount = (result.bytes.toString('latin1').match(/\\/Type \\/Page\\b/g) ?? []).length;
const expectedHash = createHash('sha256').update(result.bytes).digest('hex');
if (result.bytes.subarray(0, 5).toString() !== '%PDF-') throw new Error('PDF magic header is missing');
if (result.pageSize !== 'LETTER') throw new Error('Letter page size was not preserved');
if (pageCount < 2) throw new Error('multi-page table did not paginate');
if (result.sha256 !== expectedHash) throw new Error('PDF hash does not match exact bytes');
console.log('Phase 22 live render smoke passed: ' + pageCount + ' pages, ' + result.bytes.byteLength + ' bytes.');
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
    external: ['@react-pdf/renderer'],
    format: 'esm',
    jsx: 'automatic',
    outfile: outputPath,
    platform: 'node',
    target: 'node20',
  });
  await import(`${pathToFileURL(outputPath).href}?run=${Date.now()}`);
} finally {
  await rm(temporaryDirectory, { recursive: true, force: true });
}
