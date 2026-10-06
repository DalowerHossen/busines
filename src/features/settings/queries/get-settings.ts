// src/features/settings/queries/get-settings.ts
// Reading everything the settings pages show. A business that has never
// opened these pages still gets a complete, sensible set of values.

import type {
  CompanyProfileSettings,
  CompanySettings,
  SecurityPolicySettings,
} from '@/features/settings/types';
import { logger } from '@/lib/logger';
import { asRow, readAmount, readBoolean, readEnum, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { DatabaseRow } from '@/types/database';

const RESET_POLICIES = ['never', 'yearly', 'monthly'] as const;
const TEMPLATE_KEYS = ['classic', 'modern', 'minimal', 'compact'] as const;
const PAPER_SIZES = ['a4', 'letter'] as const;

/**
 * Builds the profile a business starts with before it saves anything.
 *
 * @param legalName Name the business signed up with.
 * @param countryCode Country the business trades from.
 * @returns The starting profile.
 */
export function defaultProfile(legalName: string, countryCode: string): CompanyProfileSettings {
  return {
    id: null,
    legalName,
    tradeName: null,
    email: null,
    phone: null,
    website: null,
    supportEmail: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    stateRegion: null,
    postalCode: null,
    countryCode,
    taxId: null,
    vatNumber: null,
    registrationNumber: null,
    taxRegistrationLabel: 'Tax ID',
    bankName: null,
    bankAccountName: null,
    bankAccountNumber: null,
    bankRoutingNumber: null,
    bankSwiftCode: null,
    bankIban: null,
    remitToInstructions: null,
    invoicePrefix: 'INV-',
    estimatePrefix: 'EST-',
    receiptPrefix: 'RCP-',
    numberPadding: 4,
    numberingResetPolicy: 'never',
    defaultPaymentTermsDays: 30,
    defaultNotes: null,
    defaultTerms: null,
    defaultFooterText: null,
    brandPrimaryColor: '#1D4ED8',
    brandAccentColor: '#0EA5E9',
    invoiceTemplateKey: 'classic',
    paperSize: 'letter',
    showPlatformBadge: true,
    logoUrl: null,
  };
}

/** The security rules a business is held to until it changes them. */
export const DEFAULT_SECURITY: SecurityPolicySettings = {
  requireTwoFactor: false,
  requireTwoFactorForOwner: true,
  sessionTimeoutMinutes: 480,
  passwordMinLength: 10,
  requireEmailOtpForLinks: false,
  documentLinkTtlDays: 30,
  requireApprovalForRefunds: false,
  staffSingleActionCap: null,
  staffDailyCap: null,
};

/**
 * Maps the stored profile row.
 *
 * @param row Row read from public.company_profiles.
 * @param fallback Values used for anything the row does not carry.
 * @returns The profile the forms render.
 */
function toProfile(row: DatabaseRow, fallback: CompanyProfileSettings): CompanyProfileSettings {
  return {
    id: readString(row, 'id'),
    legalName: readString(row, 'legal_name') ?? fallback.legalName,
    tradeName: readString(row, 'trade_name'),
    email: readString(row, 'email'),
    phone: readString(row, 'phone'),
    website: readString(row, 'website'),
    supportEmail: readString(row, 'support_email'),
    addressLine1: readString(row, 'address_line1'),
    addressLine2: readString(row, 'address_line2'),
    city: readString(row, 'city'),
    stateRegion: readString(row, 'state_region'),
    postalCode: readString(row, 'postal_code'),
    countryCode: readString(row, 'country_code') ?? fallback.countryCode,
    taxId: readString(row, 'tax_id'),
    vatNumber: readString(row, 'vat_number'),
    registrationNumber: readString(row, 'registration_number'),
    taxRegistrationLabel: readString(row, 'tax_registration_label') ?? 'Tax ID',
    bankName: readString(row, 'bank_name'),
    bankAccountName: readString(row, 'bank_account_name'),
    bankAccountNumber: readString(row, 'bank_account_number'),
    bankRoutingNumber: readString(row, 'bank_routing_number'),
    bankSwiftCode: readString(row, 'bank_swift_code'),
    bankIban: readString(row, 'bank_iban'),
    remitToInstructions: readString(row, 'remit_to_instructions'),
    invoicePrefix: readString(row, 'invoice_prefix') ?? 'INV-',
    estimatePrefix: readString(row, 'estimate_prefix') ?? 'EST-',
    receiptPrefix: readString(row, 'receipt_prefix') ?? 'RCP-',
    numberPadding: readNumber(row, 'number_padding') ?? 4,
    numberingResetPolicy: readEnum(row, 'numbering_reset_policy', RESET_POLICIES, 'never'),
    defaultPaymentTermsDays: readNumber(row, 'default_payment_terms_days') ?? 30,
    defaultNotes: readString(row, 'default_notes'),
    defaultTerms: readString(row, 'default_terms'),
    defaultFooterText: readString(row, 'default_footer_text'),
    brandPrimaryColor: readString(row, 'brand_primary_color') ?? '#1D4ED8',
    brandAccentColor: readString(row, 'brand_accent_color') ?? '#0EA5E9',
    invoiceTemplateKey: readEnum(row, 'invoice_template_key', TEMPLATE_KEYS, 'classic'),
    paperSize: readEnum(row, 'paper_size', PAPER_SIZES, 'letter'),
    showPlatformBadge: readBoolean(row, 'show_platform_badge'),
    logoUrl: readString(row, 'logo_url'),
  };
}

/**
 * Maps the stored security policy row.
 *
 * @param row Row read from public.tenant_security_policies.
 * @returns The rules the forms render.
 */
function toSecurity(row: DatabaseRow): SecurityPolicySettings {
  const singleCap = readAmount(row, 'staff_single_action_cap');
  const dailyCap = readAmount(row, 'staff_daily_cap');

  return {
    requireTwoFactor: readBoolean(row, 'require_two_factor'),
    requireTwoFactorForOwner: readBoolean(row, 'require_two_factor_for_owner'),
    sessionTimeoutMinutes: readNumber(row, 'session_timeout_minutes') ?? 480,
    passwordMinLength: readNumber(row, 'password_min_length') ?? 10,
    requireEmailOtpForLinks: readBoolean(row, 'require_email_otp_for_links'),
    documentLinkTtlDays: readNumber(row, 'document_link_ttl_days') ?? 30,
    requireApprovalForRefunds: readBoolean(row, 'require_approval_for_refunds'),
    staffSingleActionCap: row['staff_single_action_cap'] === null ? null : singleCap,
    staffDailyCap: row['staff_daily_cap'] === null ? null : dailyCap,
  };
}

/**
 * Reads the settings of one business.
 *
 * @param companyId Company whose settings are read.
 * @param legalName Name used until a profile is saved.
 * @param countryCode Country used until a profile is saved.
 * @returns Everything the settings pages render.
 */
export async function loadCompanySettings(
  companyId: string,
  legalName: string,
  countryCode: string
): Promise<CompanySettings> {
  const supabase = createServerSupabaseClient();
  const fallback = defaultProfile(legalName, countryCode);

  const [profileResult, securityResult] = await Promise.all([
    supabase
      .from('company_profiles')
      .select('*')
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase.from('tenant_security_policies').select('*').eq('company_id', companyId).maybeSingle(),
  ]);

  if (profileResult.error || securityResult.error) {
    logger.error(
      'Could not read the settings of this business',
      profileResult.error ?? securityResult.error,
      { companyId }
    );

    return { profile: fallback, security: DEFAULT_SECURITY, isDegraded: true };
  }

  const profileRow = asRow(profileResult.data);
  const securityRow = asRow(securityResult.data);

  return {
    profile: profileRow === null ? fallback : toProfile(profileRow, fallback),
    security: securityRow === null ? DEFAULT_SECURITY : toSecurity(securityRow),
    isDegraded: false,
  };
}
