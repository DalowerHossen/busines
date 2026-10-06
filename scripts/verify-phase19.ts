// Static coverage verification for Phase 19 database hardening, seed data,
// and scheduled Edge functions. Live SQL execution belongs to the configured
// Supabase/Postgres environment and is covered by supabase/tests/phase19_functions.sql.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const migrationPath = join(root, 'supabase/migrations/00171_phase19_functions_triggers.sql');
const seedPath = join(root, 'supabase/seed.sql');
const migration = readFileSync(migrationPath, 'utf8');
const seed = readFileSync(seedPath, 'utf8');

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Phase 19 verification failed: ${message}`);
  }
}

const requiredMigrationFunctions = [
  'generate_next_invoice_number',
  'assign_invoice_number',
  'apply_stock_movement',
  'calculate_client_credit_balance',
  'apply_invoice_late_fee',
  'mark_overdue_invoices',
  'create_audit_log',
  'touch_updated_at',
  'process_recurring_schedules',
  'release_due_payment_holds',
  'cleanup_expired_sessions',
  'expire_estimates',
  'run_scheduled_maintenance',
  'run_data_retention_jobs',
  'queue_backup_job',
  'process_gdpr_request_queue',
];

assert(existsSync(migrationPath), 'Phase 19 migration is missing');
assert(existsSync(seedPath), 'seed.sql is missing');
assert(migration.includes('late_fee_amount'), 'invoice late-fee storage is missing');
assert(migration.includes('for update'), 'row-locking SQL is missing');
assert(
  migration.includes('for update skip locked'),
  'scheduled work does not use skip-locked claims'
);
assert(migration.includes('pg_advisory_xact_lock'), 'invoice numbering lock is missing');
assert(
  migration.includes('scheduled_job_runs'),
  'scheduled-job failure/idempotency storage is missing'
);
assert(
  migration.includes('revoke all privileges on table public.scheduled_job_runs'),
  'job state is not server-only'
);
assert(
  migration.includes('grant execute on function public.run_scheduled_maintenance'),
  'maintenance RPC is not service-role granted'
);
assert(
  migration.includes('grant execute on function public.run_recurring_billing'),
  'recurring billing RPC is not service-role granted'
);

for (const functionName of requiredMigrationFunctions) {
  assert(
    migration.includes(`function public.${functionName}`),
    `missing database function public.${functionName}`
  );
}

assert(
  migration.includes('create trigger invoices_assign_number'),
  'invoice-number trigger is missing'
);
assert(
  migration.includes('create trigger stock_movements_apply_after_insert'),
  'stock trigger is missing'
);
assert(
  migration.includes('create trigger stock_movements_are_append_only'),
  'stock immutability trigger is missing'
);
assert(migration.includes("column_name = 'updated_at'"), 'updated_at inventory loop is missing');
assert(migration.includes("column_name = 'id'"), 'audit trigger inventory loop is missing');
assert(
  migration.includes("not in ('audit_logs', 'scheduled_job_runs')"),
  'audit recursion exclusions are missing'
);

const publicTablesWithUpdatedAt = new Set<string>();
for (const file of readdirSync(join(root, 'supabase/migrations'))) {
  if (!/^\d{5}_.*\.sql$/.test(file)) {
    continue;
  }
  const sql = readFileSync(join(root, 'supabase/migrations', file), 'utf8');
  for (const match of sql.matchAll(/create table public\.([a-z0-9_]+)\s*\(([^;]*?)\);/gis)) {
    if (match[2]?.includes('updated_at')) {
      publicTablesWithUpdatedAt.add(match[1] ?? '');
    }
  }
}
assert(
  publicTablesWithUpdatedAt.size > 100,
  'the schema inventory unexpectedly found too few updated_at tables'
);
assert(
  migration.includes('create trigger %I before update on public.%I'),
  'the updated_at trigger is not installed dynamically for the full inventory'
);

const seedMarkers = [
  'admin@kdsolutionit.local',
  "'free'",
  "'professional'",
  "'invoice_overdue'",
  "'invoice_late_fee_policy'",
  "'home'",
  "'Texas sales tax'",
  "'Software'",
  "'1000'",
  "'Demo Business'",
  'on conflict (id) do nothing',
];
for (const marker of seedMarkers) {
  assert(seed.includes(marker), `seed is missing ${marker}`);
}
assert(!seed.includes('intentionally has no statements'), 'placeholder seed text remains');
assert(!seed.match(/\b(todo|tbd|placeholder|not implemented)\b/i), 'placeholder seed text remains');

for (const functionName of ['scheduled-maintenance', 'recurring-billing', 'data-retention']) {
  const path = join(root, 'supabase/functions', functionName, 'index.ts');
  assert(existsSync(path), `Edge function ${functionName} is missing`);
  const source = readFileSync(path, 'utf8');
  assert(
    source.includes('isAuthorizedCronRequest'),
    `${functionName} does not use cron authorization`
  );
  assert(source.includes('createAdminClient'), `${functionName} does not use the server client`);
  assert(source.includes('idempotencyKey'), `${functionName} does not pass an idempotency key`);
}

const sharedAuth = readFileSync(join(root, 'supabase/functions/_shared/auth.ts'), 'utf8');
assert(sharedAuth.includes('CRON_SECRET'), 'shared Edge authorization does not use CRON_SECRET');
assert(sharedAuth.includes('constantTimeEqual'), 'cron secret comparison is not constant-time');

const config = readFileSync(join(root, 'supabase/config.toml'), 'utf8');
for (const functionName of ['scheduled-maintenance', 'recurring-billing', 'data-retention']) {
  assert(
    config.includes(`[functions.${functionName}]`),
    `config does not register ${functionName}`
  );
}

process.stdout.write(
  `Phase 19 static verification passed: ${publicTablesWithUpdatedAt.size} updated_at tables inventoried, database functions/triggers, seed catalog, and three authorized Edge workers covered.\n`
);
