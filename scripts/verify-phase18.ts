// scripts/verify-phase18.ts
// Static coverage verification for Phase 18's complete second RLS boundary.
// Live database isolation assertions are stored in supabase/tests and are
// executed against a configured Supabase/Postgres test database.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const migrationsDirectory = join(process.cwd(), 'supabase/migrations');
const migrationPath = join(migrationsDirectory, '00170_phase18_rls_isolation.sql');
const migration = readFileSync(migrationPath, 'utf8');
const phase17Tables = new Set([
  'users',
  'companies',
  'company_memberships',
  'company_profiles',
  'company_profile_snapshots',
  'plans',
  'subscriptions',
  'system_settings',
  'user_sessions',
  'two_factor_backup_codes',
  'client_groups',
  'clients',
  'client_tags',
  'client_tag_assignments',
  'client_reminders',
  'client_notes',
  'client_attachments',
  'client_credit_balance_entries',
  'client_access_tokens',
  'client_access_otp_codes',
  'client_access_logs',
  'invoices',
  'invoice_line_items',
  'invoice_attachments',
  'invoice_comments',
  'invoice_installments',
  'invoice_templates',
  'estimates',
  'estimate_line_items',
  'recurring_invoice_templates',
  'recurring_invoice_template_line_items',
  'credit_notes',
  'credit_note_line_items',
  'debit_notes',
  'debit_note_line_items',
  'saved_payment_methods',
  'payments',
  'refunds',
  'chargebacks',
  'gateway_webhook_events',
  'payment_consent_records',
  'delivery_acceptance_records',
  'dispute_audit_events',
  'dispute_evidence_packs',
]);
const serverOnlyTables = new Set(['api_keys', 'security_rate_limit_buckets']);
const postPhase18Tables = new Set(['storage_provider_folders']);
const migrationFiles = readdirSync(migrationsDirectory).filter((file) =>
  /^\d{5}_.*\.sql$/.test(file)
);
const allTables = new Set<string>();
for (const file of migrationFiles) {
  const sql = readFileSync(join(migrationsDirectory, file), 'utf8');
  for (const match of sql.matchAll(/create table public\.([a-z0-9_]+)/gi)) {
    const table = match[1];
    if (table) {
      allTables.add(table);
    }
  }
}
const phase18Tables = [...allTables].filter(
  (table) => !phase17Tables.has(table) && !postPhase18Tables.has(table)
);

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Phase 18 verification failed: ${message}`);
  }
}

assert(phase18Tables.length === 114, `expected 114 Phase 18 tables, found ${phase18Tables.length}`);
assert(
  migration.includes('foreach table_name in array ARRAY['),
  'the migration must use an explicit RLS inventory loop'
);
assert(
  migration.includes("enable row level security', table_name"),
  'the migration must enable RLS for the inventory'
);
assert(
  migration.includes("force row level security', table_name"),
  'the migration must force RLS for the inventory'
);
assert(
  migration.includes('revoke all privileges on table public.%I from public, anon, authenticated'),
  'the migration must revoke browser-role privileges before adding policies'
);

for (const table of phase18Tables) {
  assert(migration.includes(`'${table}'`), `RLS inventory is missing public.${table}`);
  const policyCount = (
    migration.match(new RegExp(`create policy [\\w_]+\\s+on public\\.${table}\\b`, 'g')) ?? []
  ).length;
  if (!serverOnlyTables.has(table)) {
    assert(policyCount > 0, `public.${table} has no explicit browser-role policy`);
  }
}

for (const table of postPhase18Tables) {
  assert(allTables.has(table), `post-Phase 18 table ${table} is missing from migration inventory`);
}

for (const functionName of [
  'current_user_is_accountant_for_company',
  'current_user_can_read_domain',
  'current_user_can_write_domain',
]) {
  assert(
    migration.includes(`create function public.${functionName}(`),
    `missing Phase 18 authorization helper public.${functionName}`
  );
}

assert(
  migration.includes('create policy phase18_notification_preferences_select'),
  'user-scoped notification preference policy is missing'
);
assert(
  migration.includes('create policy phase18_affiliate_clicks_select'),
  'blind affiliate policy is missing'
);
assert(
  migration.includes('create policy phase18_reseller_sub_tenants_select'),
  'reseller sub-tenant boundary policy is missing'
);
assert(
  migration.includes('create policy phase18_tax_jurisdiction_rules_public_read'),
  'public tax jurisdiction read policy is missing'
);
assert(
  migration.includes('create policy phase18_status_updates_public_read'),
  'status incident child-row policy is missing'
);
assert(
  migration.includes('create policy phase18_cms_pages_public_read'),
  'public CMS policy is missing'
);
assert(
  migration.includes('create policy phase18_support_ticket_messages_select'),
  'support-ticket child-row policy is missing'
);
assert(
  !/using \([^;]*\);\s+with check/s.test(migration),
  'an update policy has a statement terminator between USING and WITH CHECK'
);
assert(
  readFileSync(join(process.cwd(), 'supabase/tests/phase18_rls_isolation.sql'), 'utf8').includes(
    'cross-tenant'
  ),
  'the live cross-tenant SQL isolation test is missing'
);

process.stdout.write(
  `Phase 18 static RLS coverage check passed for ${phase18Tables.length} tables and ${phase17Tables.size + phase18Tables.length} Phase 18 public tables; ${postPhase18Tables.size} later server-only tables are excluded from the Phase 18 inventory.\n`
);
