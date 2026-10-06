// src/features/resellers/queries/get-reseller.ts
// Reading the white label workspace of one account: the partner record, the
// period statement, the accounts held and the payments made.

import type {
  ResellerAccount,
  ResellerPayoutRecord,
  ResellerProfile,
  ResellerStatement,
  ResellerWorkspace,
} from '@/features/resellers/types';
import { logger } from '@/lib/logger';
import {
  asRow,
  asRows,
  readAmount,
  readBoolean,
  readEnum,
  readNumber,
  readString,
} from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';
import { RESELLER_STATUSES } from '@/types/enums';

const PROFILE_COLUMNS =
  'id, user_id, partner_name, slug, status, contact_email, contact_phone, country_code, brand_name, brand_logo_url, brand_primary_color, brand_accent_color, custom_domain, custom_domain_verified_at, hide_platform_branding, revenue_share_percentage, margin_percentage, billing_currency, max_sub_tenants, sub_tenant_count, rejection_reason, approved_at, created_at';

/** How far back the opening statement looks. */
const STATEMENT_DAYS = 365;

/**
 * Maps the partner record.
 *
 * @param row Row read from public.resellers.
 * @returns The profile the portal renders.
 */
function toProfile(row: DatabaseRow): ResellerProfile {
  return {
    id: readString(row, 'id') ?? '',
    userId: readString(row, 'user_id') ?? '',
    partnerName: readString(row, 'partner_name') ?? '',
    slug: readString(row, 'slug') ?? '',
    status: readEnum(row, 'status', RESELLER_STATUSES, 'pending_review'),
    contactEmail: readString(row, 'contact_email') ?? '',
    contactPhone: readString(row, 'contact_phone'),
    countryCode: readString(row, 'country_code') ?? 'US',
    brandName: readString(row, 'brand_name'),
    brandLogoUrl: readString(row, 'brand_logo_url'),
    brandPrimaryColor: readString(row, 'brand_primary_color'),
    brandAccentColor: readString(row, 'brand_accent_color'),
    customDomain: readString(row, 'custom_domain'),
    customDomainVerifiedAt: readString(row, 'custom_domain_verified_at'),
    hidePlatformBranding: readBoolean(row, 'hide_platform_branding') ?? false,
    revenueSharePercentage: readAmount(row, 'revenue_share_percentage'),
    marginPercentage: readAmount(row, 'margin_percentage'),
    billingCurrency: readString(row, 'billing_currency') ?? 'USD',
    maxSubTenants: readNumber(row, 'max_sub_tenants'),
    subTenantCount: readNumber(row, 'sub_tenant_count') ?? 0,
    rejectionReason: readString(row, 'rejection_reason'),
    approvedAt: readString(row, 'approved_at'),
    createdAt: readString(row, 'created_at') ?? '',
  };
}

/**
 * Maps the period statement.
 *
 * @param row Row returned by public.reseller_statement.
 * @returns The statement the portal renders.
 */
function toStatement(row: DatabaseRow): ResellerStatement {
  return {
    activeAccounts: readNumber(row, 'active_accounts') ?? 0,
    suspendedAccounts: readNumber(row, 'suspended_accounts') ?? 0,
    retailTotal: readAmount(row, 'retail_total'),
    wholesaleTotal: readAmount(row, 'wholesale_total'),
    commissionEarned: readAmount(row, 'commission_earned'),
    commissionPending: readAmount(row, 'commission_pending'),
    commissionPaid: readAmount(row, 'commission_paid'),
    currency: readString(row, 'currency') ?? 'USD',
  };
}

/**
 * Maps one managed account.
 *
 * @param row Row returned by public.reseller_accounts.
 * @returns The account the portal renders.
 */
function toAccount(row: DatabaseRow): ResellerAccount {
  return {
    companyId: readString(row, 'company_id') ?? '',
    displayName: readString(row, 'display_name') ?? '',
    accountReference: readString(row, 'account_reference'),
    status: readString(row, 'status') ?? 'active',
    provisionedAt: readString(row, 'provisioned_at') ?? '',
    lifetimeRetailAmount: readAmount(row, 'lifetime_retail_amount'),
    lifetimeCommissionAmount: readAmount(row, 'lifetime_commission_amount'),
  };
}

/**
 * Maps one commission payment.
 *
 * @param row Row read from public.reseller_payouts.
 * @returns The payment the portal renders.
 */
function toPayout(row: DatabaseRow): ResellerPayoutRecord {
  return {
    id: readString(row, 'id') ?? '',
    payoutReference: readString(row, 'payout_reference') ?? '',
    periodStart: readString(row, 'period_start') ?? '',
    periodEnd: readString(row, 'period_end') ?? '',
    amount: readAmount(row, 'net_amount'),
    currency: readString(row, 'currency') ?? 'USD',
    status: readString(row, 'status') ?? 'draft',
    paidAt: readString(row, 'paid_at'),
  };
}

/**
 * Reads the whole white label workspace for one account.
 *
 * @param userId Account signed in.
 * @returns The partner record and its figures, or an empty workspace.
 */
export async function loadResellerWorkspace(userId: string): Promise<ResellerWorkspace> {
  const supabase = createServerSupabaseClient();
  const empty: ResellerWorkspace = {
    profile: null,
    statement: null,
    accounts: [],
    payouts: [],
    isDegraded: false,
  };

  const { data, error } = await supabase
    .from('resellers')
    .select(PROFILE_COLUMNS)
    .eq('user_id', userId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error) {
    logger.error('The partner record could not be read', error, { userId });

    return { ...empty, isDegraded: true };
  }

  const row = asRow(data);

  if (row === null) {
    return empty;
  }

  const profile = toProfile(row);
  const to = new Date();
  const from = new Date(to.getTime() - STATEMENT_DAYS * 24 * 60 * 60 * 1000);

  const [statementResult, accountResult, payoutResult] = await Promise.all([
    supabase.rpc('reseller_statement', {
      p_reseller_id: profile.id,
      p_from: from.toISOString().slice(0, 10),
      p_to: to.toISOString().slice(0, 10),
    }),
    supabase.rpc('reseller_accounts', { p_reseller_id: profile.id }),
    supabase
      .from('reseller_payouts')
      .select(
        'id, payout_reference, period_start, period_end, net_amount, currency, status, paid_at'
      )
      .eq('reseller_id', profile.id)
      .order('period_end', { ascending: false })
      .limit(20),
  ]);

  const statementRow = asRows(statementResult.data)[0];

  return {
    profile,
    statement: statementRow === undefined ? null : toStatement(statementRow),
    accounts: asRows(accountResult.data).map(toAccount),
    payouts: asRows(payoutResult.data).map(toPayout),
    isDegraded: statementResult.error !== null || accountResult.error !== null,
  };
}
