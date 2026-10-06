// src/features/kyc/actions/submit-verification.ts
// Handing a finished identity check to the platform team.

'use server';

import { revalidatePath } from 'next/cache';

import { submitVerificationSchema } from '@/features/kyc/validation/kyc';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface SubmitVerificationResult {
  /** The state the check is in afterwards. */
  status: string;
}

export const submitVerification = createAction(
  submitVerificationSchema,
  async (input): Promise<SubmitVerificationResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('submit_kyc_verification', {
      p_verification_id: input.verificationId,
    });

    if (error) {
      logger.error('An identity check could not be submitted', error, { companyId: company.id });

      throw new AppError(
        'validation_failed',
        'The check was not sent. Upload both sides of the identity document and the registration certificate first.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'kyc_verification',
      entityId: input.verificationId,
      companyId: company.id,
      description: 'Identity check sent for review.',
    });

    revalidatePath('/dashboard/settings/verification');

    return { status: typeof data === 'string' ? data : 'submitted' };
  },
  { name: 'submitVerification' }
);
