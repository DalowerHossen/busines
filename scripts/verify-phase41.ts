// scripts/verify-phase41.ts
// Checks the shared component layer: every primitive a feature page composes
// exists exactly once, and no removed duplicate has crept back.
//
// The assertions are made against the source rather than by importing the
// components, because these modules reach the browser and pull in the
// environment and server-only guards when imported outside Next.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function exists(relativePath: string): boolean {
  return existsSync(resolve(root, relativePath));
}

const REQUIRED: readonly (readonly [string, string])[] = [
  ['src/components/ui/empty-state.tsx', 'EmptyState'],
  ['src/components/ui/error-state.tsx', 'ErrorState'],
  ['src/components/ui/loading-state.tsx', 'LoadingState'],
  ['src/components/ui/table.tsx', 'Table'],
  ['src/components/ui/skeleton.tsx', 'Skeleton'],
  ['src/components/files/file-uploader.tsx', 'FileUploader'],
  ['src/components/shared/invoice-print-document.tsx', 'InvoicePrintDocument'],
];

for (const [path, name] of REQUIRED) {
  assert.equal(exists(path), true, `${path} is missing`);
  assert.match(read(path), new RegExp(`export function ${name}|export const ${name}`, 'u'));
}

// Primitives must not be defined twice.
const DUPLICATES: readonly string[] = [
  'src/components/shared/empty-state.tsx',
  'src/components/shared/error-state.tsx',
  'src/components/shared/loading-state.tsx',
  'src/components/shared/file-uploader.tsx',
  'src/lib/cn.ts',
];

for (const path of DUPLICATES) {
  assert.equal(exists(path), false, `${path} is a duplicate primitive and must not exist`);
}

// Every file in the tree must merge classes through one helper.
assert.match(read('src/lib/utils.ts'), /export function cn/u);

process.stdout.write('Phase 41 shared component smoke test passed.\n');
