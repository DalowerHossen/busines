// src/features/recurring/actions/run-schedule-now.ts
// Produces the next invoice of a schedule straight away, for the times when a
// client asks for their bill early.

'use server';

import { revalidatePath } from 'next/cache';

import { scheduleIdSchema } from '@/features/recurring/validation/schedule';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface RunScheduleNowResult {
  /** The invoice that was produced, or null when the schedule had finished. */
  invoiceId: string | null;
}

export const runScheduleNow = createAction(
  scheduleIdSchema,
  async (input): Promise<RunScheduleNowResult> => {
    const { company } = await requirePermission('invoices', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('generate_recurring_invoice', {
      p_schedule_id: input.scheduleId,
    });

    if (error) {
      logger.error('Could not produce an invoice from a schedule', error, {
        companyId: company.id,
        scheduleId: input.scheduleId,
      });

      throw new AppError(
        'conflict',
        'No invoice was produced. Only a running schedule can be asked for one.'
      );
    }

    const invoiceId = typeof data === 'string' ? data : null;

    await recordAuditEntry({
      action: 'insert',
      entityType: 'recurring_invoice_schedule',
      entityId: input.scheduleId,
      companyId: company.id,
      description:
        invoiceId === null
          ? 'Schedule reached its last occurrence and produced nothing.'
          : 'Invoice produced from a recurring schedule.',
    });

    revalidatePath('/dashboard/subscriptions');
    revalidatePath(`/dashboard/subscriptions/${input.scheduleId}`);
    revalidatePath('/dashboard/invoices');

    return { invoiceId };
  },
  { name: 'runScheduleNow' }
);
