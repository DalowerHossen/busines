// Static verification for Phase 23's import, validation, sanitization, and
// media pipeline. The live smoke script exercises the server-only libraries
// with real CSV, XLSX, PNG, PDF, and hostile HTML inputs.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  const path = join(root, relativePath);
  if (!existsSync(path)) throw new Error(`Phase 23 verification failed: missing ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Phase 23 verification failed: ${message}`);
}

const packageJson = read('package.json');
const lockfile = read('package-lock.json');
const validator = read('src/lib/media/file-validator.ts');
const tabular = read('src/lib/media/tabular.ts');
const csv = read('src/lib/media/csv.ts');
const sanitizer = read('src/lib/media/html-sanitizer.ts');
const optimizer = read('src/lib/media/optimizer.ts');
const mediaIndex = read('src/lib/media/index.ts');
const liveSmoke = read('scripts/verify-phase23-live.mjs');

for (const dependency of ['csv-parse', 'exceljs', 'jszip', 'pdf-lib', 'sanitize-html', 'sharp']) {
  assert(packageJson.includes(`"${dependency}"`), `dependency ${dependency} is missing`);
  assert(lockfile.includes(`node_modules/${dependency}`), `lockfile lacks ${dependency}`);
}
assert(packageJson.includes('verify:phase23'), 'Phase 23 verification script is not registered');
assert(validator.includes("import 'server-only'"), 'file validator is not server-only');
for (const marker of [
  '0x89',
  'WEBP',
  '%PDF-',
  'inspectZip',
  'vbaproject.bin',
  'assertExtensionMatches',
  'MIME_KINDS',
  'FILE_SIZE_LIMITS',
]) {
  assert(validator.includes(marker), `file validation marker ${marker} is missing`);
}
assert(tabular.includes('workbook.xlsx.load'), 'XLSX parser is missing');
assert(tabular.includes('unsafe_file_content'), 'spreadsheet formula rejection is missing');
assert(tabular.includes('maxRows'), 'tabular row bounds are missing');
assert(tabular.includes('maxColumns'), 'tabular column bounds are missing');
assert(csv.includes('safeValue ='), 'CSV formula neutralization is missing');
assert(csv.includes('""'), 'CSV quote escaping is missing');

for (const marker of [
  'allowedTags',
  'allowedAttributes',
  'allowedSchemes',
  'disallowedTagsMode',
  'allowProtocolRelative: false',
  'sanitizeSvgMarkup',
]) {
  assert(sanitizer.includes(marker), `HTML/SVG sanitizer marker ${marker} is missing`);
}
assert(!sanitizer.includes("'script'"), 'script is present in the sanitizer allow-list');
assert(!sanitizer.includes("'style'"), 'style is present in the sanitizer allow-list');

for (const marker of [
  "from 'sharp'",
  "from 'pdf-lib'",
  '.rotate()',
  '.resize(',
  '.webp(',
  '.jpeg(',
  '.png(',
  'useObjectStreams: true',
  'sanitizeSvgMarkup',
  "createHash('sha256')",
]) {
  assert(optimizer.includes(marker), `media optimizer marker ${marker} is missing`);
}
assert(mediaIndex.includes('parseTabularFile'), 'media index does not export the parser');
assert(mediaIndex.includes('optimizeMedia'), 'media index does not export optimization');
assert(liveSmoke.includes('verifyFormulaSafety'), 'live smoke does not test formula safety');
assert(
  liveSmoke.includes('verifyMagicByteMismatch'),
  'live smoke does not test magic-byte mismatch'
);
assert(liveSmoke.includes('verifyHtmlSanitization'), 'live smoke does not test hostile HTML');
assert(
  liveSmoke.includes('verifyMultiPagePdfCompression'),
  'live smoke does not test PDF processing'
);

process.stdout.write(
  'Phase 23 static verification passed: bounded tabular parsing, magic-byte/extension validation, macro/formula defenses, HTML/SVG allow-lists, image/PDF optimization, and live-smoke hooks are present.\n'
);
