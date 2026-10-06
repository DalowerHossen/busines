// src/features/instalments/actions/save-offer.ts
// Deciding what terms the business is willing to be paid on. Lending money,
// even your own, is an owner decision, so staff cannot change these.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { saveOfferSchema } from '@/features/instalments/validation/instalments';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveOfferResult {
  /** Identifier of the terms that were saved. */
  offerId: string;
}

export const saveInstalmentOffer = createAction(
  saveOfferSchema,
  async (input): Promise<SaveOfferResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_instalment_offer', {
      p_company_id: company.id,
      p_name: input.name,
      p_instalment_count: input.instalmentCount,
      p_offer_id: input.offerId ?? null,
      p_provider: input.provider,
      p_description: input.description ?? null,
      p_interval_unit: input.intervalUnit,
      p_interval_count: input.intervalCount,
      p_down_payment_percentage: input.downPaymentPercentage,
      p_interest_rate_percentage: input.interestRatePercentage,
      p_partner_fee_percentage: input.partnerFeePercentage,
      p_late_fee_amount: input.lateFeeAmount,
      p_grace_period_days: input.gracePeriodDays,
      p_minimum_invoice_amount: input.minimumInvoiceAmount,
      p_maximum_invoice_amount: input.maximumInvoiceAmount ?? null,
      p_currency: input.currency,
      p_requires_approval: input.requiresApproval,
    });

    if (error || typeof data !== 'string') {
      logger.error('Instalment terms could not be saved', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        error?.message ?? 'Those terms could not be saved. Try again.'
      );
    }

    await recordAuditEntry({
      action: input.offerId === undefined ? 'insert' : 'update',
      entityType: 'instalment_offer',
      entityId: data,
      companyId: company.id,
      description:
        input.offerId === undefined ? 'Added instalment terms' : 'Changed instalment terms',
    });

    revalidatePath(`${ROUTES.payments}/instalments/terms`);

    return { offerId: data };
  },
  { name: 'saveInstalmentOffer' }
);
