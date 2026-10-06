// src/features/recurring/actions/update-schedule.ts
// Saves the rule of a recurring schedule. What has already been produced is
// untouched; only future runs follow the new rule.

'use server';

import { revalidatePath } from 'next/cache';

import { updateScheduleSchema } from '@/features/recurring/validation/schedule';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateScheduleResult {
  /** Identifier of the schedule that was saved. */
  scheduleId: string;
}

export const updateSchedule = createAction(
  updateScheduleSchema,
  async (input): Promise<UpdateScheduleResult> => {
    const { user, company } = await requirePermission('subscriptions', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const existing = await supabase
      .from('recurring_invoice_schedules')
      .select('id, status')
      .eq('company_id', company.id)
      .eq('id', input.scheduleId)
      .is('deleted_at', null)
      .maybeSingle();

    const current = asRow(existing.data);

    if (existing.error !== null || current === null) {
      throw new AppError('not_found', 'That schedule no longer exists.');
    }

    const status = readString(current, 'status');

    if (status === 'completed' || status === 'cancelled') {
      throw new AppError(
        'conflict',
        'This schedule has finished, so its rule can no longer be changed. Create a new one instead.'
      );
    }

    const { error } = await supabase
      .from('recurring_invoice_schedules')
      .update({
        name: input.name,
        template_invoice_id: input.templateInvoiceId,
        frequency: input.frequency,
        interval_count: input.intervalCount,
        custom_interval_days: input.customIntervalDays,
        start_date: input.startDate,
        end_date: input.endDate,
        max_occurrences: input.maxOccurrences,
        payment_terms_days: input.paymentTermsDays,
        days_before_to_create: input.daysBeforeToCreate,
        auto_issue: input.autoIssue,
        auto_send: input.autoSend,
        notes: input.notes,
        updated_by: user.id,
      })
      .eq('company_id', company.id)
      .eq('id', input.scheduleId);

    if (error) {
      logger.error('Could not save a recurring schedule', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The schedule could not be saved. Please try again in a moment.'
      );
    }

    revalidatePath('/dashboard/subscriptions');
    revalidatePath(`/dashboard/subscriptions/${input.scheduleId}`);

    return { scheduleId: input.scheduleId };
  },
  { name: 'updateSchedule' }
);
