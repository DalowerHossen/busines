// src/features/admin/queries/get-tenant.ts
// Everything the platform console shows about one tenant: who owns it, what
// it is allowed to do, how much it has used and what it has been worth.

import { toTenantSummary } from '@/features/admin/queries/list-tenants';
import type {
  EntitlementOverride,
  TenantDetail,
  TenantOwner,
  TenantUsageLine,
} from '@/features/admin/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readNumber, readString } from '@/lib/records';
import { addMoney, toStoredAmount } from '@/lib/money';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

/**
 * Maps one exception granted to this tenant.
 *
 * @param row Row read from public.company_entitlement_overrides.
 * @returns The exception the console renders.
 */
function toOverride(row: DatabaseRow): EntitlementOverride {
  const raw = row['value'];

  return {
    id: readString(row, 'id') ?? '',
    entitlementKey: readString(row, 'entitlement_key') ?? '',
    value: typeof raw === 'string' ? raw : JSON.stringify(raw ?? null),
    reason: readString(row, 'reason') ?? '',
    expiresAt: readString(row, 'expires_at'),
    createdAt: readString(row, 'created_at') ?? '',
  };
}

/**
 * Maps one account attached to this tenant.
 *
 * @param row Row read from public.users.
 * @returns The account the console renders.
 */
function toOwner(row: DatabaseRow): TenantOwner {
  return {
    id: readString(row, 'id') ?? '',
    fullName: readString(row, 'full_name') ?? '',
    email: readString(row, 'email') ?? '',
    status: readString(row, 'status') ?? 'active',
    lastSignInAt: readString(row, 'last_login_at'),
  };
}

/**
 * Maps one metered allowance.
 *
 * @param row Row returned by public.company_usage_snapshot.
 * @returns The usage line the console renders.
 */
function toUsage(row: DatabaseRow): TenantUsageLine {
  return {
    metricKey: readString(row, 'metric_key') ?? '',
    used: readNumber(row, 'used') ?? 0,
    allowance: row['allowance'] === null ? null : (readNumber(row, 'allowance') ?? null),
  };
}

/**
 * Adds a money column across a set of rows.
 *
 * @param rows Rows carrying the column.
 * @param column Column being summed.
 * @returns The total as a decimal safe string.
 */
function sumColumn(rows: readonly DatabaseRow[], column: string): string {
  const amounts = rows.map((row) => {
    const value = row[column];

    return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : '0';
  });

  return toStoredAmount(addMoney(...amounts));
}

/**
 * Reads one tenant for the platform console.
 *
 * @param companyId Tenant being opened.
 * @returns The tenant detail, or null when there is no such tenant.
 */
export async function getTenant(companyId: string): Promise<TenantDetail | null> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('companies')
    .select(
      'id, display_name, legal_name, slug, status, kyc_status, country_code, base_currency, mor_enabled, suspension_reason, created_at, subscriptions(status, amount, subscription_plans(name))'
    )
    .eq('id', companyId)
    .is('deleted_at', null)
    .maybeSingle();

  const row = asRow(data);

  if (error) {
    logger.error('A tenant could not be read', error, { companyId });

    return null;
  }

  if (row === null) {
    return null;
  }

  const [ownerResult, overrideResult, usageResult, invoiceResult, paymentResult, countResult] =
    await Promise.all([
      supabase
        .from('users')
        .select('id, full_name, email, status, last_login_at, role')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .in('role', ['owner', 'staff', 'accountant'])
        .order('role', { ascending: true })
        .limit(20),
      supabase
        .from('company_entitlement_overrides')
        .select('id, entitlement_key, value, reason, expires_at, created_at')
        .eq('company_id', companyId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase.rpc('company_usage_snapshot', { p_company_id: companyId }),
      supabase
        .from('invoices')
        .select('total_amount')
        .eq('company_id', companyId)
        .is('deleted_at', null),
      supabase
        .from('payments')
        .select('amount, platform_fee_amount')
        .eq('company_id', companyId)
        .eq('status', 'succeeded')
        .is('deleted_at', null),
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .is('deleted_at', null),
    ]);

  const invoiceRows = asRows(invoiceResult.data);
  const paymentRows = asRows(paymentResult.data);
  const ownerRows = asRows(ownerResult.data);

  return {
    tenant: toTenantSummary(row),
    owners: ownerRows.map(toOwner),
    overrides: asRows(overrideResult.data).map(toOverride),
    usage: asRows(usageResult.data).map(toUsage),
    counts: {
      users: ownerRows.length,
      clients: countResult.count ?? 0,
      invoices: invoiceRows.length,
    },
    totals: {
      invoicedAllTime: sumColumn(invoiceRows, 'total_amount'),
      collectedAllTime: sumColumn(paymentRows, 'amount'),
      platformFeesAllTime: sumColumn(paymentRows, 'platform_fee_amount'),
    },
    isDegraded: Boolean(overrideResult.error) || Boolean(usageResult.error),
  };
}
