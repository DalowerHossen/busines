// src/features/auth/services/provision-account.ts
// Everything a brand new account needs behind the login: the business it
// owns, the profile row that carries its role, and a subscription on the free
// plan. Used by the sign up form and by the first sign in through a provider.

import 'server-only';

import { findCountry } from '@/config/countries';
import { attributeSignup } from '@/features/affiliates/services/attribution';
import { buildUniqueCompanySlug } from '@/features/auth/services/company-slug';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { getRequestContext } from '@/lib/security/request-context';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

/** Version of the terms a new account accepts. */
export const TERMS_VERSION = '2026-01-01';

export interface ProvisionAccountInput {
  /** Identifier issued by the authentication provider. */
  authUserId: string;
  email: string;
  fullName: string;
  companyName: string;
  countryCode?: string;
  marketingOptIn?: boolean;
  /** True when the address is already known to be confirmed. */
  isEmailVerified?: boolean;
}

export interface ProvisionAccountResult {
  companyId: string;
  /** False when the account already existed and nothing was created. */
  wasCreated: boolean;
}

/**
 * Creates the business and the profile behind a new login, if they are not
 * already there.
 *
 * @param input Who signed up and what they called their business.
 * @returns The business the account owns.
 */
export async function provisionAccount(
  input: ProvisionAccountInput
): Promise<ProvisionAccountResult> {
  const supabase = getServiceSupabaseClient();

  const { data: existing, error: lookupError } = await supabase
    .from('users')
    .select('company_id')
    .eq('id', input.authUserId)
    .maybeSingle();

  if (lookupError) {
    logger.error('An account could not be looked up during provisioning', lookupError, {
      action: 'provisionAccount',
    });

    throw new AppError('database_failure', 'The account could not be prepared. Please try again.');
  }

  if (existing && typeof existing.company_id === 'string') {
    return { companyId: existing.company_id, wasCreated: false };
  }

  const country = findCountry(input.countryCode ?? 'US');
  const slug = await buildUniqueCompanySlug(supabase, input.companyName);

  const { data: company, error: companyError } = await supabase
    .from('companies')
    .insert({
      slug,
      legal_name: input.companyName,
      display_name: input.companyName,
      status: 'onboarding',
      country_code: country?.code ?? 'US',
      base_currency: country?.currency ?? 'USD',
      created_by: input.authUserId,
      updated_by: input.authUserId,
    })
    .select('id')
    .single();

  if (companyError || !company || typeof company.id !== 'string') {
    logger.error('A business could not be created for a new account', companyError, {
      action: 'provisionAccount',
    });

    throw new AppError(
      'database_failure',
      'Your login was created but the business was not. Please sign in and try again.'
    );
  }

  const companyId = company.id;
  const nowIso = new Date().toISOString();

  const { error: profileError } = await supabase.from('users').insert({
    id: input.authUserId,
    company_id: companyId,
    role: 'owner',
    status: input.isEmailVerified ? 'active' : 'pending_verification',
    email: input.email,
    full_name: input.fullName,
    email_verified_at: input.isEmailVerified ? nowIso : null,
    accepted_terms_version: TERMS_VERSION,
    accepted_terms_at: nowIso,
    marketing_opt_in: input.marketingOptIn ?? false,
    created_by: input.authUserId,
    updated_by: input.authUserId,
  });

  if (profileError) {
    logger.error('A profile could not be created for a new account', profileError, {
      action: 'provisionAccount',
    });

    throw new AppError(
      'database_failure',
      'Your login was created but the profile was not. Please sign in and try again.'
    );
  }

  const { error: subscriptionError } = await supabase.rpc('start_default_subscription', {
    p_company_id: companyId,
  });

  if (subscriptionError) {
    logger.error('The free plan could not be started for a new business', subscriptionError, {
      action: 'provisionAccount',
      companyId,
    });
  }

  // A business that arrived through a partner link is credited here, once,
  // at the moment it is created. Attribution never blocks the signup.
  await attributeSignup(companyId, getRequestContext().ipHash);

  return { companyId, wasCreated: true };
}
