// src/lib/auth/company-context.ts
// Resolves which company a request is acting inside. An owner or staff member
// has exactly one; an accountant has the companies that invited them; a
// platform administrator may reach any of them.

import 'server-only';

import { cache } from 'react';

import { isWritableCompanyStatus, COMPANY_STATUSES, KYC_STATUSES } from '@/types/enums';
import { forbiddenError, notFoundError } from '@/lib/errors';
import { readBoolean, readEnum, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getSessionUser } from '@/lib/auth/session';
import type { CompanyContext } from '@/lib/auth/types';
import type { DatabaseRow } from '@/types/database';

const COMPANY_COLUMNS =
  'id, slug, display_name, legal_name, status, country_code, base_currency, time_zone, date_format, kyc_status, mor_enabled, storage_quota_bytes, storage_used_bytes, trial_ends_at';

/**
 * Turns a companies row into the context the application works with.
 *
 * @param row Row read from public.companies.
 * @returns The company context.
 */
function toCompanyContext(row: DatabaseRow): CompanyContext {
  const status = readEnum(row, 'status', COMPANY_STATUSES, 'onboarding');

  return {
    id: readString(row, 'id') ?? '',
    slug: readString(row, 'slug') ?? '',
    displayName: readString(row, 'display_name') ?? '',
    legalName: readString(row, 'legal_name') ?? '',
    status,
    countryCode: readString(row, 'country_code') ?? 'US',
    baseCurrency: readString(row, 'base_currency') ?? 'USD',
    timeZone: readString(row, 'time_zone') ?? 'UTC',
    dateFormat: readString(row, 'date_format') ?? 'MM/dd/yyyy',
    kycStatus: readEnum(row, 'kyc_status', KYC_STATUSES, 'not_started'),
    morEnabled: readBoolean(row, 'mor_enabled'),
    storageQuotaBytes: readNumber(row, 'storage_quota_bytes') ?? 0,
    storageUsedBytes: readNumber(row, 'storage_used_bytes') ?? 0,
    trialEndsAt: readString(row, 'trial_ends_at'),
    isReadOnly: !isWritableCompanyStatus(status),
  };
}

/**
 * Loads one company by identifier, subject to row level security.
 *
 * @param companyId Company to load.
 * @returns The company context, or null when it is not visible.
 */
export const loadCompany = cache(async (companyId: string): Promise<CompanyContext | null> => {
  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('companies')
    .select(COMPANY_COLUMNS)
    .eq('id', companyId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return toCompanyContext(data);
});

/**
 * Lists the companies an accountant currently has access to.
 *
 * @returns The companies, newest grant first.
 */
export async function listAccessibleCompanies(): Promise<CompanyContext[]> {
  const user = await getSessionUser();

  if (!user) {
    return [];
  }

  if (user.companyId) {
    const own = await loadCompany(user.companyId);
    return own ? [own] : [];
  }

  if (user.role !== 'accountant') {
    return [];
  }

  const supabase = createServerSupabaseClient();
  const { data, error } = await supabase
    .from('accountant_company_access')
    .select('company_id')
    .eq('accountant_user_id', user.id)
    .eq('status', 'active')
    .is('deleted_at', null);

  if (error || !data) {
    return [];
  }

  const companies: CompanyContext[] = [];

  for (const row of data) {
    const companyId = readString(row, 'company_id');

    if (!companyId) {
      continue;
    }

    const company = await loadCompany(companyId);

    if (company) {
      companies.push(company);
    }
  }

  return companies;
}

/**
 * Resolves the company a request is acting inside.
 *
 * @param requestedCompanyId Company asked for, used by accountants and
 * platform administrators who are not tied to one tenant.
 * @returns The company context.
 */
export async function resolveCompanyContext(
  requestedCompanyId?: string | null
): Promise<CompanyContext> {
  const user = await getSessionUser();

  if (!user) {
    throw forbiddenError('Please sign in to continue.');
  }

  if (user.companyId) {
    if (requestedCompanyId && requestedCompanyId !== user.companyId) {
      throw forbiddenError('That company is not yours.');
    }

    const company = await loadCompany(user.companyId);

    if (!company) {
      throw notFoundError('Company');
    }

    return company;
  }

  if (!requestedCompanyId) {
    throw forbiddenError('Choose a company to work in first.');
  }

  if (user.role === 'super_admin') {
    const company = await loadCompany(requestedCompanyId);

    if (!company) {
      throw notFoundError('Company');
    }

    return company;
  }

  if (user.role === 'accountant') {
    const accessible = await listAccessibleCompanies();
    const company = accessible.find((candidate) => candidate.id === requestedCompanyId);

    if (!company) {
      throw forbiddenError('You do not have access to that company.');
    }

    return company;
  }

  throw forbiddenError('Your account does not work inside a company.');
}
