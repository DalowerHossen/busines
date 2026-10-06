// src/features/settings/actions/update-security-policy.ts
// Saves the rules the whole team is held to. Only the owner may loosen or
// tighten them, and every change is written to the audit trail.

'use server';

import { revalidatePath } from 'next/cache';

import { securityPolicySchema } from '@/features/settings/validation/settings';
import { createAction } from '@/lib/actions/create-action';
import { requireOwner, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateSecurityPolicyResult {
  /** Identifier of the business whose rules were saved. */
  companyId: string;
}

export const updateSecurityPolicy = createAction(
  securityPolicySchema,
  async (input): Promise<UpdateSecurityPolicyResult> => {
    const { user, company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('tenant_security_policies')
      .update({
        require_two_factor: input.requireTwoFactor,
        require_two_factor_for_owner: input.requireTwoFactorForOwner,
        session_timeout_minutes: input.sessionTimeoutMinutes,
        password_min_length: input.passwordMinLength,
        require_email_otp_for_links: input.requireEmailOtpForLinks,
        document_link_ttl_days: input.documentLinkTtlDays,
        require_approval_for_refunds: input.requireApprovalForRefunds,
        staff_single_action_cap: input.staffSingleActionCap,
        staff_daily_cap: input.staffDailyCap,
        updated_by: user.id,
      })
      .eq('company_id', company.id);

    if (error) {
      logger.error('Could not save the security rules', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The security rules could not be saved. Please try again.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'tenant_security_policy',
      entityId: company.id,
      companyId: company.id,
      description: 'Security rules updated.',
    });

    revalidatePath('/dashboard/settings/security');

    return { companyId: company.id };
  },
  { name: 'updateSecurityPolicy' }
);
