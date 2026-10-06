// Static and contract verification for Phase 21's Google Drive adapter.
// Live Drive authentication and tenant/RLS integration require configured
// Google credentials and a Supabase project; this check covers the server
// boundary, official request shapes, and application-link cryptography.
import { createHmac } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { verifyGoogleDriveApplicationSignature } from '@/lib/storage/signed-links';

const root = process.cwd();

function read(relativePath: string): string {
  const path = join(root, relativePath);
  if (!existsSync(path)) throw new Error(`Phase 21 verification failed: missing ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Phase 21 verification failed: ${message}`);
}

const adapter = read('src/lib/storage/google-drive.ts');
const factory = read('src/lib/storage/factory.ts');
const folderStore = read('src/lib/storage/folder-store.ts');
const route = read('src/app/api/storage/files/[providerFileId]/route.ts');
const migration = read('supabase/migrations/00172_phase21_storage_provider_folders.sql');
const sqlTest = read('supabase/tests/phase21_storage_provider_folders.sql');
const envExample = read('.env.example');
const architecture = read('docs/planning/ARCHITECTURE-DECISIONS.md');

assert(adapter.includes("import 'server-only'"), 'Drive adapter is not server-only');
assert(
  adapter.includes("from 'googleapis'"),
  'adapter does not use the official Google Node client'
);
assert(
  adapter.includes('new google.auth.JWT'),
  'service-account authentication boundary is missing'
);
assert(adapter.includes('https://www.googleapis.com/auth/drive'), 'Drive scope is missing');
for (const method of [
  'files.list',
  'files.create',
  'files.get',
  'files.delete',
  'permissions.create',
]) {
  assert(adapter.includes(method), `official Drive method ${method} is missing`);
}
assert(adapter.includes('requestBody'), 'Drive metadata is not sent in requestBody');
assert(adapter.includes('media:'), 'Drive upload does not send media');
assert(adapter.includes('appProperties'), 'company/category metadata is not stored on Drive files');
assert(adapter.includes('supportsAllDrives: true'), 'shared-drive support is not explicit');
assert(adapter.includes("input.visibility === 'public'"), 'public visibility branch is missing');
assert(adapter.includes("type: 'anyone'"), 'public permission request is missing');
assert(adapter.includes('Private files'), 'private-file boundary comment is missing');
assert(
  adapter.includes('folderStore.claimCompanyFolder'),
  'company-folder persistence/race handling is missing'
);
assert(
  adapter.includes('tenant_scope_denied'),
  'destructive tenant ownership validation is missing'
);
assert(adapter.includes('getDriveFileUrl'), 'provider-returned Drive link is not required');
assert(
  adapter.includes('verifyGoogleDriveApplicationSignature'),
  'signed-link verifier is missing'
);
assert(
  !adapter.includes('SUPABASE_SERVICE_ROLE_KEY'),
  'provider adapter contains a Supabase secret'
);

assert(factory.includes('switch (providerId)'), 'storage provider factory is missing');
for (const provider of ['supabase', 'r2', 's3', 'b2', 'wasabi', 'local']) {
  assert(factory.includes(`case '${provider}'`), `future provider ${provider} is not explicit`);
}
assert(
  factory.includes('unsupported_provider'),
  'future providers are silently pretending to work'
);
assert(folderStore.includes("from('storage_provider_folders')"), 'folder mapping store is missing');
assert(
  folderStore.includes("onConflict: 'company_id,provider_id'"),
  'folder mapping is not race-safe'
);

assert(
  route.includes('verifyGoogleDriveApplicationSignature'),
  'download route skips signature validation'
);
assert(route.includes('downloadFile'), 'download route does not stream authorized content');
assert(route.includes("'Cache-Control': 'private, no-store'"), 'private response is cacheable');
assert(
  route.includes("'X-Content-Type-Options': 'nosniff'"),
  'download response lacks content sniffing protection'
);

for (const marker of [
  'enable row level security',
  'force row level security',
  'revoke all privileges on table public.storage_provider_folders',
  'storage_provider_folders_company_provider_key',
  'on delete cascade',
]) {
  assert(migration.includes(marker), `folder mapping migration is missing ${marker}`);
}
for (const variable of [
  'STORAGE_PROVIDER=google_drive',
  'GOOGLE_DRIVE_CLIENT_EMAIL',
  'GOOGLE_DRIVE_PRIVATE_KEY',
  'GOOGLE_DRIVE_ROOT_FOLDER_ID',
]) {
  assert(envExample.includes(variable), `.env.example is missing ${variable}`);
}
assert(
  architecture.includes('Google Drive'),
  'locked Google Drive architecture decision is missing'
);
assert(sqlTest.includes('insufficient_privilege'), 'browser-role RLS test is missing');
assert(sqlTest.includes('storage_provider_folders'), 'storage mapping RLS test is missing');

const signingSecret = 'phase21-test-signing-secret-which-is-long-enough';
const companyId = '123e4567-e89b-12d3-a456-426614174000';
const providerFileId = 'drive-file-123';
const expiresAt = 2_000_000_000;
const payload = `${companyId}.${providerFileId}.${expiresAt}`;
const signature = createHmac('sha256', signingSecret).update(payload).digest('base64url');
assert(
  verifyGoogleDriveApplicationSignature({
    signingSecret,
    companyId,
    providerFileId,
    expiresAt,
    signature,
    nowInSeconds: 1_900_000_000,
  }),
  'valid application signature was rejected'
);
assert(
  !verifyGoogleDriveApplicationSignature({
    signingSecret,
    companyId,
    providerFileId,
    expiresAt,
    signature: `${signature.slice(0, -1)}x`,
    nowInSeconds: 1_900_000_000,
  }),
  'tampered application signature was accepted'
);
assert(
  !verifyGoogleDriveApplicationSignature({
    signingSecret,
    companyId,
    providerFileId,
    expiresAt,
    signature,
    nowInSeconds: expiresAt,
  }),
  'expired application signature was accepted'
);

process.stdout.write(
  'Phase 21 verification passed: official Drive v3 client/auth/request shapes, tenant folder mapping, private-link boundary, explicit provider factory, and signature behavior are covered.\n'
);
