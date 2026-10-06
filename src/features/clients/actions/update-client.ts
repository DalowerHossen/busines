// src/features/clients/actions/update-client.ts
// Saves changes to an existing client. The company is taken from the session,
// never from the form, so a client of another tenant cannot be reached.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { updateClientSchema } from '@/features/clients/validation/client';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateClientResult {
  /** Identifier of the client that was saved. */
  clientId: string;
}

export const updateClient = createAction(
  updateClientSchema,
  async (input): Promise<UpdateClientResult> => {
    const { user, company } = await requirePermission('clients', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('clients')
      .update({
        display_name: input.displayName,
        client_type: input.clientType,
        status: input.status,
        legal_name: input.legalName,
        contact_person: input.contactPerson,
        email: input.email,
        phone: input.phone,
        mobile: input.mobile,
        website: input.website,
        billing_currency: input.billingCurrency ?? company.baseCurrency,
        default_payment_terms_days: input.defaultPaymentTermsDays ?? 14,
        credit_limit: input.creditLimit,
        late_fee_percentage: input.lateFeePercentage,
        tax_id: input.taxId,
        vat_number: input.vatNumber,
        registration_number: input.registrationNumber,
        country_code: input.countryCode ?? company.countryCode,
        is_tax_exempt: input.isTaxExempt,
        tax_exemption_reason: input.taxExemptionReason,
        applies_reverse_charge: input.appliesReverseCharge,
        preferred_contact_channel: input.preferredContactChannel,
        send_reminders: input.sendReminders,
        statement_delivery_enabled: input.statementDeliveryEnabled,
        portal_notes: input.portalNotes,
        internal_notes: input.internalNotes,
        updated_by: user.id,
      })
      .eq('company_id', company.id)
      .eq('id', input.clientId)
      .is('deleted_at', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not save a client', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The client could not be saved. Please try again in a moment.'
      );
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That client no longer exists.');
    }

    revalidatePath(ROUTES.clients);
    revalidatePath(`${ROUTES.clients}/${input.clientId}`);

    return { clientId: input.clientId };
  },
  { name: 'updateClient' }
);
