// src/features/recurring/actions/delete-schedule.ts
// Removes a schedule from the lists. Everything it has already produced stays
// exactly where it is.

'use server';

import { revalidatePath } from 'next/cache';

import { scheduleIdSchema } from '@/features/recurring/validation/schedule';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface DeleteScheduleResult {
  /** Identifier of the schedule that was removed. */
  scheduleId: string;
}

export const deleteSchedule = createAction(
  scheduleIdSchema,
  async (input): Promise<DeleteScheduleResult> => {
    const { user, company } = await requirePermission('subscriptions', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('recurring_invoice_schedules')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        deleted_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('company_id', company.id)
      .eq('id', input.scheduleId)
      .is('deleted_at', null);

    if (error) {
      logger.error('Could not delete a recurring schedule', error, { companyId: company.id });

      throw new AppError('database_failure', 'The schedule could not be removed just now.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'recurring_invoice_schedule',
      entityId: input.scheduleId,
      companyId: company.id,
      description: 'Recurring schedule deleted.',
    });

    revalidatePath('/dashboard/subscriptions');

    return { scheduleId: input.scheduleId };
  },
  { name: 'deleteSchedule' }
);
