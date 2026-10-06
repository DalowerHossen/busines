// src/features/settings/actions/update-company-profile.ts
// Saves the business identity that appears on documents. Invoices already
// issued keep the details they were issued with.

'use server';

import { revalidatePath } from 'next/cache';

import { companyProfileSchema } from '@/features/settings/validation/settings';
import { createAction } from '@/lib/actions/create-action';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateCompanyProfileResult {
  /** Identifier of the business whose profile was saved. */
  companyId: string;
}

export const updateCompanyProfile = createAction(
  companyProfileSchema,
  async (input): Promise<UpdateCompanyProfileResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.from('company_profiles').upsert(
      {
        company_id: company.id,
        legal_name: input.legalName,
        trade_name: input.tradeName,
        email: input.email,
        phone: input.phone,
        website: input.website,
        support_email: input.supportEmail,
        address_line1: input.addressLine1,
        address_line2: input.addressLine2,
        city: input.city,
        state_region: input.stateRegion,
        postal_code: input.postalCode,
        country_code: input.countryCode,
        tax_id: input.taxId,
        vat_number: input.vatNumber,
        registration_number: input.registrationNumber,
        tax_registration_label: input.taxRegistrationLabel,
        bank_name: input.bankName,
        bank_account_name: input.bankAccountName,
        bank_account_number: input.bankAccountNumber,
        bank_routing_number: input.bankRoutingNumber,
        bank_swift_code: input.bankSwiftCode,
        bank_iban: input.bankIban,
        remit_to_instructions: input.remitToInstructions,
        updated_by: user.id,
      },
      { onConflict: 'company_id' }
    );

    if (error) {
      logger.error('Could not save the business profile', error, { companyId: company.id });

      throw new AppError('database_failure', 'The profile could not be saved. Please try again.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'company_profile',
      entityId: company.id,
      companyId: company.id,
      description: 'Business profile updated.',
    });

    revalidatePath('/dashboard/settings');

    return { companyId: company.id };
  },
  { name: 'updateCompanyProfile' }
);
