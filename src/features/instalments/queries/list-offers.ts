// src/features/instalments/queries/list-offers.ts
// Reading the instalment terms a business offers, and what a particular
// invoice would qualify for.

import type { InstalmentOfferRecord, InvoiceOfferQuote } from '@/features/instalments/types';
import { logger } from '@/lib/logger';
import { asRows, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Reads the instalment terms of one business.
 *
 * @param companyId Business whose terms are being read.
 * @returns The terms, platform ones last.
 */
export async function loadInstalmentOffers(
  companyId: string
): Promise<readonly InstalmentOfferRecord[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('company_instalment_offers', {
    p_company_id: companyId,
  });

  if (error) {
    logger.error('The instalment terms could not be read', error, { companyId });

    return [];
  }

  return asRows(data).map((row) => ({
    offerId: readString(row, 'offer_id') ?? '',
    name: readString(row, 'name') ?? '',
    provider: readString(row, 'provider') ?? 'self_financed',
    description: readString(row, 'description'),
    instalmentCount: readNumber(row, 'instalment_count') ?? 0,
    intervalUnit: readString(row, 'interval_unit') ?? 'month',
    intervalCount: readNumber(row, 'interval_count') ?? 1,
    downPaymentPercentage: readString(row, 'down_payment_percentage') ?? '0',
    interestRatePercentage: readString(row, 'interest_rate_percentage') ?? '0',
    partnerFeePercentage: readString(row, 'partner_fee_percentage') ?? '0',
    lateFeeAmount: readString(row, 'late_fee_amount') ?? '0',
    gracePeriodDays: readNumber(row, 'grace_period_days') ?? 0,
    minimumInvoiceAmount: readString(row, 'minimum_invoice_amount') ?? '0',
    maximumInvoiceAmount: readString(row, 'maximum_invoice_amount'),
    currency: readString(row, 'currency') ?? 'USD',
    requiresApproval: readBoolean(row, 'requires_approval'),
    isActive: readBoolean(row, 'is_active'),
    isPlatform: readBoolean(row, 'is_platform'),
    plansRunning: readNumber(row, 'plans_running') ?? 0,
  }));
}

/**
 * Reads the terms one invoice qualifies for, already priced out.
 *
 * @param invoiceId Invoice being quoted.
 * @returns The terms on offer, shortest first.
 */
export async function loadOffersForInvoice(
  invoiceId: string
): Promise<readonly InvoiceOfferQuote[]> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('offers_for_invoice', { p_invoice_id: invoiceId });

  if (error) {
    logger.error('The terms for one invoice could not be read', error, { invoiceId });

    return [];
  }

  return asRows(data).map((row) => ({
    offerId: readString(row, 'offer_id') ?? '',
    name: readString(row, 'name') ?? '',
    provider: readString(row, 'provider') ?? 'self_financed',
    instalmentCount: readNumber(row, 'instalment_count') ?? 0,
    intervalUnit: readString(row, 'interval_unit') ?? 'month',
    intervalCount: readNumber(row, 'interval_count') ?? 1,
    downPaymentAmount: readString(row, 'down_payment_amount') ?? '0',
    instalmentAmount: readString(row, 'instalment_amount') ?? '0',
    totalPayable: readString(row, 'total_payable') ?? '0',
    requiresApproval: readBoolean(row, 'requires_approval'),
  }));
}
