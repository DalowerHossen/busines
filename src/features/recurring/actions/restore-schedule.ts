// src/features/recurring/actions/restore-schedule.ts
// Brings a deleted schedule back, on hold rather than running, so nobody is
// billed by surprise.

'use server';

import { revalidatePath } from 'next/cache';

import { scheduleIdSchema } from '@/features/recurring/validation/schedule';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RestoreScheduleResult {
  /** Identifier of the schedule that was brought back. */
  scheduleId: string;
}

export const restoreSchedule = createAction(
  scheduleIdSchema,
  async (input): Promise<RestoreScheduleResult> => {
    const { user, company } = await requirePermission('subscriptions', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('recurring_invoice_schedules')
      .update({
        deleted_at: null,
        status: 'paused',
        cancelled_at: null,
        paused_at: new Date().toISOString(),
        updated_by: user.id,
      })
      .eq('company_id', company.id)
      .eq('id', input.scheduleId)
      .not('deleted_at', 'is', null)
      .select('id')
      .maybeSingle();

    if (error) {
      logger.error('Could not restore a recurring schedule', error, { companyId: company.id });

      throw new AppError('database_failure', 'The schedule could not be restored just now.');
    }

    if (asRow(data) === null) {
      throw new AppError('not_found', 'That schedule is not in the deleted list.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'recurring_invoice_schedule',
      entityId: input.scheduleId,
      companyId: company.id,
      description: 'Deleted recurring schedule restored, on hold.',
    });

    revalidatePath('/dashboard/subscriptions');

    return { scheduleId: input.scheduleId };
  },
  { name: 'restoreSchedule' }
);
