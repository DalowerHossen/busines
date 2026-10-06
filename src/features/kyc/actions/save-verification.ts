// src/features/kyc/actions/save-verification.ts
// Keeping what a business has told us about itself while it works through
// the identity check. Saving is separate from submitting, so nobody loses a
// half finished form.

'use server';

import { revalidatePath } from 'next/cache';

import { saveVerificationSchema } from '@/features/kyc/validation/kyc';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SaveVerificationResult {
  /** Identifier of the check that was written. */
  verificationId: string;
}

export const saveVerification = createAction(
  saveVerificationSchema,
  async (input): Promise<SaveVerificationResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const payload = {
      company_id: company.id,
      legal_entity_type: input.legalEntityType,
      legal_name: input.legalName,
      registration_number: input.registrationNumber,
      tax_identification_number: input.taxIdentificationNumber,
      incorporation_country: input.incorporationCountry,
      incorporation_date: input.incorporationDate ?? null,
      representative_name: input.representativeName,
      representative_role: input.representativeRole,
      representative_email: input.representativeEmail,
      representative_phone: input.representativePhone,
      representative_date_of_birth: input.representativeDateOfBirth ?? null,
      registered_address_line1: input.registeredAddressLine1,
      registered_address_line2: input.registeredAddressLine2,
      registered_city: input.registeredCity,
      registered_region: input.registeredRegion,
      registered_postal_code: input.registeredPostalCode,
      registered_country: input.registeredCountry,
      business_description: input.businessDescription,
      expected_monthly_volume: input.expectedMonthlyVolume ?? null,
      website: input.website,
    };

    if (input.verificationId) {
      const { error } = await supabase
        .from('kyc_verifications')
        .update(payload)
        .eq('id', input.verificationId)
        .eq('company_id', company.id);

      if (error) {
        logger.error('An identity check could not be saved', error, { companyId: company.id });

        throw new AppError(
          'database_failure',
          'Your answers were not saved. A check already sent to us cannot be edited.'
        );
      }

      revalidatePath('/dashboard/settings/verification');

      return { verificationId: input.verificationId };
    }

    const { data, error } = await supabase
      .from('kyc_verifications')
      .insert(payload)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('An identity check could not be started', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The check could not be started. You may already have one open.'
      );
    }

    const created = asRow(data);
    const verificationId = created === null ? '' : (readString(created, 'id') ?? '');

    await recordAuditEntry({
      action: 'insert',
      entityType: 'kyc_verification',
      entityId: verificationId,
      companyId: company.id,
      description: 'Identity check started.',
    });

    revalidatePath('/dashboard/settings/verification');

    return { verificationId };
  },
  { name: 'saveVerification' }
);
