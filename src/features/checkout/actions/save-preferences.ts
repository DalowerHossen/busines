// src/features/checkout/actions/save-preferences.ts
// Setting how a business is willing to be paid.
//
// The card switch is the consequential one. A card payment is the only kind
// a payer can reverse on their own months later, so a seller who would
// rather take bank transfer is allowed to say so and have every card option
// disappear at once.

'use server';

import { revalidatePath } from 'next/cache';

import { checkoutPreferencesSchema } from '@/features/checkout/validation/preferences';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SavePreferencesResult {
  /** True when the preferences were stored. */
  isSaved: boolean;
}

export const saveCheckoutPreferences = createAction(
  checkoutPreferencesSchema,
  async (input): Promise<SavePreferencesResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('save_checkout_preferences', {
      p_company_id: company.id,
      p_accept_card_payments: input.acceptCardPayments,
      p_accept_bank_transfer: input.acceptBankTransfer,
      p_accept_local_methods: input.acceptLocalMethods,
      p_require_terms_acceptance: input.requireTermsAcceptance,
      p_require_delivery_confirmation: input.requireDeliveryConfirmation,
      p_require_billing_address: input.requireBillingAddress,
      p_block_mismatched_country: input.blockMismatchedCountry,
      p_card_minimum_amount: input.cardMinimumAmount,
      p_card_maximum_amount: input.cardMaximumAmount ?? null,
      p_consent_statement: input.consentStatement,
      p_refund_window_days: input.refundWindowDays,
    });

    if (error) {
      logger.error('The payment preferences could not be saved', error, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'Those settings could not be saved. Try again.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'checkout_preferences',
      entityId: company.id,
      companyId: company.id,
      description: input.acceptCardPayments
        ? 'Card payments are accepted on invoices.'
        : 'Card payments were switched off for this business.',
      metadata: {
        accept_card_payments: input.acceptCardPayments,
        card_minimum_amount: input.cardMinimumAmount,
        card_maximum_amount: input.cardMaximumAmount ?? null,
      },
    });

    revalidatePath('/dashboard/settings/payments');

    return { isSaved: true };
  },
  { name: 'saveCheckoutPreferences' }
);
