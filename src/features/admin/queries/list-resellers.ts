// src/features/admin/queries/list-resellers.ts
// The white label partners on the platform: who is waiting for a decision,
// and how much business the approved ones carry.

import { logger } from '@/lib/logger';
import { asRows, readAmount, readBoolean, readEnum, readNumber, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import type { DatabaseRow } from '@/types/database';
import { RESELLER_STATUSES, type ResellerStatus } from '@/types/enums';

export interface ResellerRecord {
  id: string;
  partnerName: string;
  slug: string;
  status: ResellerStatus;
  contactEmail: string;
  countryCode: string;
  brandName: string | null;
  customDomain: string | null;
  hidePlatformBranding: boolean;
  revenueSharePercentage: string;
  billingCurrency: string;
  maxSubTenants: number | null;
  subTenantCount: number;
  createdAt: string;
}

export interface ResellerDirectory {
  /** Applications waiting for a decision. */
  pending: readonly ResellerRecord[];
  /** Partners already in the programme. */
  active: readonly ResellerRecord[];
  /** True when the directory could not be read. */
  isDegraded: boolean;
}

const COLUMNS =
  'id, partner_name, slug, status, contact_email, country_code, brand_name, custom_domain, hide_platform_branding, revenue_share_percentage, billing_currency, max_sub_tenants, sub_tenant_count, created_at';

/**
 * Maps one partner.
 *
 * @param row Row read from public.resellers.
 * @returns The record the console renders.
 */
function toRecord(row: DatabaseRow): ResellerRecord {
  return {
    id: readString(row, 'id') ?? '',
    partnerName: readString(row, 'partner_name') ?? '',
    slug: readString(row, 'slug') ?? '',
    status: readEnum(row, 'status', RESELLER_STATUSES, 'pending_review'),
    contactEmail: readString(row, 'contact_email') ?? '',
    countryCode: readString(row, 'country_code') ?? 'US',
    brandName: readString(row, 'brand_name'),
    customDomain: readString(row, 'custom_domain'),
    hidePlatformBranding: readBoolean(row, 'hide_platform_branding') ?? false,
    revenueSharePercentage: readAmount(row, 'revenue_share_percentage'),
    billingCurrency: readString(row, 'billing_currency') ?? 'USD',
    maxSubTenants: readNumber(row, 'max_sub_tenants'),
    subTenantCount: readNumber(row, 'sub_tenant_count') ?? 0,
    createdAt: readString(row, 'created_at') ?? '',
  };
}

/**
 * Reads every white label partner, split by whether a decision is due.
 *
 * @returns The directory of partners.
 */
export async function loadResellerDirectory(): Promise<ResellerDirectory> {
  const supabase = getServiceSupabaseClient();

  const { data, error } = await supabase
    .from('resellers')
    .select(COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    logger.error('The partner directory could not be read', error, {});

    return { pending: [], active: [], isDegraded: true };
  }

  const records = asRows(data).map(toRecord);

  return {
    pending: records.filter((record) => record.status === 'pending_review'),
    active: records.filter((record) => record.status !== 'pending_review'),
    isDegraded: false,
  };
}
