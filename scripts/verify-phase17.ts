// scripts/verify-phase17.ts
// Static coverage verification for Phase 17's default-deny RLS migration.
// Phase 18 adds live cross-tenant database tests after the remaining domain
// tables receive their policies.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const migrationPath = join(
  process.cwd(),
  'supabase/migrations/00169_phase17_rls_core_crm_invoicing_payments.sql'
);
const sql = readFileSync(migrationPath, 'utf8');

const phase17Tables = [
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
] as const;

const intentionallyServerOnly = [
  'system_settings',
  'two_factor_backup_codes',
  'client_access_otp_codes',
  'client_access_logs',
  'saved_payment_methods',
] as const;

const requiredFunctions = [
  'is_super_admin',
  'current_user_owns_company',
  'current_user_can_manage_company',
  'current_user_has_company_access',
  'current_user_has_company_role',
  'current_user_has_company_permission',
  'current_user_can_edit_invoice',
  'current_user_can_edit_estimate',
  'current_user_can_edit_invoice_children',
  'current_user_can_edit_estimate_children',
] as const;

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(`Phase 17 verification failed: ${message}`);
  }
}

for (const table of phase17Tables) {
  assert(sql.includes(`'${table}'`), `RLS inventory is missing public.${table}`);
  assert(
    sql.includes(`alter table public.%I enable row level security`),
    'the migration must enable RLS through the explicit inventory loop'
  );
  assert(
    sql.includes(`alter table public.%I force row level security`),
    'the migration must force RLS through the explicit inventory loop'
  );
  assert(
    sql.includes(`revoke all privileges on table public.%I from public, anon, authenticated`),
    'the migration must revoke browser-role table privileges before policies'
  );
}

for (const functionName of requiredFunctions) {
  assert(
    sql.includes(`create function public.${functionName}(`) ||
      sql.includes(`create function public.${functionName}()`),
    `missing authorization helper public.${functionName}`
  );
}

for (const table of phase17Tables) {
  const policyCount = (
    sql.match(new RegExp(`create policy [\\w_]+\\s+\\n?\\s+on public\\.${table}\\b`, 'g')) ?? []
  ).length;
  if (!intentionallyServerOnly.includes(table as (typeof intentionallyServerOnly)[number])) {
    assert(policyCount > 0, `public.${table} has no explicit RLS policy`);
  }
}

for (const table of intentionallyServerOnly) {
  assert(
    !new RegExp(`grant [^;]+ on public\\.${table} to (?:anon|authenticated)`, 'i').test(sql),
    `server-only table public.${table} must not receive browser-role grants`
  );
}

assert(
  sql.includes('create policy plans_select_public_catalog_anon'),
  'public plan catalog policy is missing'
);
assert(
  sql.includes('create policy invoice_templates_select_anon'),
  'public built-in invoice-template policy is missing'
);
assert(
  sql.includes("p_status = 'draft'::invoice_status"),
  'staff invoice writes are not restricted to drafts'
);
assert(
  sql.includes("p_status = 'draft'::estimate_status"),
  'staff estimate writes are not restricted to drafts'
);
assert(
  sql.includes('grant execute on function public.is_super_admin() to authenticated, service_role'),
  'authorization helpers must not be executable by the public role'
);

process.stdout.write(
  `Phase 17 static RLS coverage check passed for ${phase17Tables.length} tables and ${requiredFunctions.length} authorization helpers.\n`
);
