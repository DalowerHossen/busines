// src/features/recurring/actions/create-schedule.ts
// Creates a recurring schedule from a draft invoice. The schedule starts as a
// draft itself, so nothing is produced until somebody starts it.

'use server';

import { revalidatePath } from 'next/cache';

import { createScheduleSchema } from '@/features/recurring/validation/schedule';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CreateScheduleResult {
  /** Identifier of the schedule that was created. */
  scheduleId: string;
}

export const createSchedule = createAction(
  createScheduleSchema,
  async (input): Promise<CreateScheduleResult> => {
    const { user, company } = await requirePermission('subscriptions', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const template = await supabase
      .from('invoices')
      .select('id, client_id, status')
      .eq('company_id', company.id)
      .eq('id', input.templateInvoiceId)
      .is('deleted_at', null)
      .maybeSingle();

    const templateRow = asRow(template.data);

    if (template.error !== null || templateRow === null) {
      throw new AppError('not_found', 'That template invoice no longer exists.');
    }

    if (readString(templateRow, 'status') !== 'draft') {
      throw new AppError(
        'conflict',
        'A template has to stay a draft, because it is copied rather than sent. Choose a draft invoice.'
      );
    }

    const clientId = readString(templateRow, 'client_id');

    if (clientId === null) {
      throw new AppError('conflict', 'The template invoice has no client on it.');
    }

    const { data, error } = await supabase
      .from('recurring_invoice_schedules')
      .insert({
        company_id: company.id,
        client_id: clientId,
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
        time_zone: company.timeZone,
        notes: input.notes,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Could not create a recurring schedule', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The schedule could not be saved. Check that this draft is not already used by another schedule.'
      );
    }

    const scheduleId = readString(asRow(data) ?? {}, 'id');

    if (scheduleId === null) {
      throw new AppError('database_failure', 'The schedule was saved but could not be read back.');
    }

    revalidatePath('/dashboard/subscriptions');

    return { scheduleId };
  },
  { name: 'createSchedule' }
);
