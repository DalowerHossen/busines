// src/features/clients/actions/create-client.ts
// Adds a client to the signed in company. The client number is written by a
// database trigger, so it is never set here.

'use server';

import { revalidatePath } from 'next/cache';

import { ROUTES } from '@/config/app';
import { createClientSchema } from '@/features/clients/validation/client';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CreateClientResult {
  /** Identifier of the client that was added. */
  clientId: string;
}

export const createClient = createAction(
  createClientSchema,
  async (input): Promise<CreateClientResult> => {
    const { user, company } = await requirePermission('clients', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('clients')
      .insert({
        company_id: company.id,
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
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Could not add a client', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The client could not be saved. Please try again in a moment.'
      );
    }

    const clientId = readString(asRow(data) ?? {}, 'id');

    if (clientId === null) {
      throw new AppError('database_failure', 'The client was saved but could not be read back.');
    }

    if (input.addressLine1 !== null) {
      const { error: addressError } = await supabase.from('client_addresses').insert({
        company_id: company.id,
        client_id: clientId,
        address_type: 'billing',
        address_line1: input.addressLine1,
        address_line2: input.addressLine2,
        city: input.city,
        state_region: input.stateRegion,
        postal_code: input.postalCode,
        country_code: input.countryCode ?? company.countryCode,
        is_default: true,
        created_by: user.id,
        updated_by: user.id,
      });

      if (addressError) {
        logger.error('Could not save the billing address', addressError, { clientId });
      }
    }

    revalidatePath(ROUTES.clients);

    return { clientId };
  },
  { name: 'createClient' }
);
