// src/features/onboarding/actions/activate-company.ts
// Crossing the line from setting up to trading.
//
// There is no button that lets a seller claim to be ready. The database
// checks the same five facts it uses to draw the list, and moves the account
// only when all five are true.

'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireTenant } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** The action takes nothing; the business comes from the session. */
const activateSchema = z.object({});

export interface ActivateCompanyResult {
  /** True when the account is now trading. */
  isActive: boolean;
}

export const activateCompany = createAction(
  activateSchema,
  async (): Promise<ActivateCompanyResult> => {
    const { company } = await requireTenant();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('activate_ready_company', {
      p_company_id: company.id,
    });

    if (error) {
      logger.error('An account could not be activated', error, { companyId: company.id });

      throw new AppError('database_failure', 'That could not be completed. Try again.');
    }

    if (data === true) {
      await recordAuditEntry({
        action: 'settings_change',
        entityType: 'company',
        entityId: company.id,
        companyId: company.id,
        description: 'Finished setting up and started trading.',
      });
    }

    revalidatePath('/dashboard');
    revalidatePath('/dashboard/setup');

    return { isActive: data === true };
  },
  { name: 'activateCompany' }
);
