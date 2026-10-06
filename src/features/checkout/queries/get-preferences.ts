// src/features/checkout/queries/get-preferences.ts
// Reading how one seller is willing to be paid.

import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

export interface CheckoutPreferences {
  acceptCardPayments: boolean;
  acceptBankTransfer: boolean;
  acceptLocalMethods: boolean;
  requireTermsAcceptance: boolean;
  requireDeliveryConfirmation: boolean;
  requireBillingAddress: boolean;
  blockMismatchedCountry: boolean;
  cardMinimumAmount: string;
  cardMaximumAmount: string | null;
  consentStatement: string;
  refundWindowDays: number;
  isDefault: boolean;
  /** True when the read failed. */
  isDegraded: boolean;
}

const DEFAULTS: CheckoutPreferences = {
  acceptCardPayments: true,
  acceptBankTransfer: true,
  acceptLocalMethods: true,
  requireTermsAcceptance: true,
  requireDeliveryConfirmation: false,
  requireBillingAddress: true,
  blockMismatchedCountry: false,
  cardMinimumAmount: '0',
  cardMaximumAmount: null,
  consentStatement:
    'I confirm I ordered this work, that it has been delivered to my satisfaction, and I authorise this payment.',
  refundWindowDays: 14,
  isDefault: true,
  isDegraded: false,
};

/**
 * Reads the payment preferences of one business.
 *
 * @param companyId Business being read.
 * @returns How they are willing to be paid.
 */
export async function loadCheckoutPreferences(companyId: string): Promise<CheckoutPreferences> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('company_checkout_preferences', {
    p_company_id: companyId,
  });

  if (error || !isJsonObject(data)) {
    logger.error('The payment preferences could not be read', error, { companyId });

    return { ...DEFAULTS, isDegraded: true };
  }

  /**
   * Reads an amount as a string so no precision is lost.
   *
   * @param key Field being read.
   * @returns The amount, or null.
   */
  function amount(key: string): string | null {
    const value = isJsonObject(data) ? data[key] : null;

    if (typeof value === 'string') {
      return value;
    }

    return typeof value === 'number' ? String(value) : null;
  }

  return {
    acceptCardPayments: data['accept_card_payments'] !== false,
    acceptBankTransfer: data['accept_bank_transfer'] !== false,
    acceptLocalMethods: data['accept_local_methods'] !== false,
    requireTermsAcceptance: data['require_terms_acceptance'] !== false,
    requireDeliveryConfirmation: data['require_delivery_confirmation'] === true,
    requireBillingAddress: data['require_billing_address'] !== false,
    blockMismatchedCountry: data['block_mismatched_country'] === true,
    cardMinimumAmount: amount('card_minimum_amount') ?? '0',
    cardMaximumAmount: amount('card_maximum_amount'),
    consentStatement:
      typeof data['consent_statement'] === 'string'
        ? data['consent_statement']
        : DEFAULTS.consentStatement,
    refundWindowDays:
      typeof data['refund_window_days'] === 'number' ? data['refund_window_days'] : 14,
    isDefault: data['is_default'] === true,
    isDegraded: false,
  };
}
