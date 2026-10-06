// Static verification for Phase 20's Supabase boundary and security wiring.
// Provider and live Auth tests run against the configured Supabase project;
// this check prevents accidental boundary regressions in CI.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

function read(relativePath: string): string {
  const path = join(root, relativePath);
  if (!existsSync(path)) throw new Error(`Phase 20 verification failed: missing ${relativePath}`);
  return readFileSync(path, 'utf8');
}

function assert(condition: boolean, message: string): void {
  if (!condition) throw new Error(`Phase 20 verification failed: ${message}`);
}

const browser = read('src/lib/supabase/browser.ts');
const server = read('src/lib/supabase/server.ts');
const admin = read('src/lib/supabase/admin.ts');
const middlewareClient = read('src/lib/supabase/middleware.ts');
const realtime = read('src/lib/supabase/realtime.ts');
const middleware = read('src/middleware.ts');
const encryption = read('src/lib/security/encryption.ts');
const keyVault = read('src/lib/security/key-vault.ts');
const audit = read('src/lib/security/audit.ts');
const csrf = read('src/lib/security/csrf-request.ts');
const loginAbuse = read('src/lib/security/login-abuse-supabase.ts');
const docs = read('docs/planning/SUPABASE-CLIENTS-AND-SECURITY.md');

assert(browser.includes('createBrowserClient'), 'browser client factory is missing');
assert(browser.includes('NEXT_PUBLIC_SUPABASE_ANON_KEY'), 'browser client uses the wrong key');
assert(!browser.includes('SUPABASE_SERVICE_ROLE_KEY'), 'service-role key appears in browser code');
assert(server.includes('createServerClient'), 'server SSR client factory is missing');
assert(server.includes('getAll()'), 'server client does not read all Auth cookies');
assert(admin.includes("import 'server-only'"), 'admin client is not server-only');
assert(
  admin.includes('SUPABASE_SERVICE_ROLE_KEY'),
  'admin client does not use the service-role boundary'
);
assert(
  middlewareClient.includes('supabase.auth.getUser()'),
  'middleware does not validate the Auth user'
);
assert(
  middleware.includes('refreshSupabaseSession'),
  'application middleware does not refresh Supabase sessions'
);
assert(middleware.includes('isAuthenticatedPath'), 'authenticated route protection is missing');
assert(realtime.includes('company_id=eq.'), 'Realtime subscription is not tenant-filtered');
assert(realtime.includes('UUID_PATTERN'), 'Realtime company identifier validation is missing');

for (const marker of ["'aes-256-gcm'", 'randomBytes', 'getAuthTag', 'setAuthTag', 'keyVersion']) {
  assert(encryption.includes(marker), `encryption marker ${marker} is missing`);
}
assert(keyVault.includes('value_encrypted'), 'key-vault persistence is missing');
assert(keyVault.includes('value_plain: null'), 'key-vault does not clear plaintext settings');
assert(
  keyVault.includes("companyId === null ? 'platform' : 'company'"),
  'key-vault scope separation is missing'
);
assert(audit.includes('REDACTED_KEYS'), 'audit redaction list is missing');
assert(audit.includes("from('audit_logs')"), 'Supabase audit store is missing');
assert(csrf.includes('assertSameOrigin'), 'CSRF same-origin validation is missing');
assert(csrf.includes('verifyCsrfToken'), 'CSRF HMAC validation is missing');
assert(loginAbuse.includes('consume_security_rate_limit'), 'login abuse is not database-backed');
assert(docs.includes('RLS remains the'), 'security boundary documentation is missing');

process.stdout.write(
  'Phase 20 static verification passed: browser/server/admin/middleware/realtime clients, AES-256-GCM key vault, tenant guard, rate-limit store, CSRF guard, and audit logger are covered.\n'
);
