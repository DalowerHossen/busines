// src/features/recurring/actions/set-schedule-status.ts
// Starts, pauses or stops a recurring schedule. The database trigger decides
// the next run date from the state, so nothing has to be set by hand here.

'use server';

import { revalidatePath } from 'next/cache';

import { setScheduleStatusSchema } from '@/features/recurring/validation/schedule';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import type { Json } from '@/types/json';

export interface SetScheduleStatusResult {
  /** Identifier of the schedule that changed. */
  scheduleId: string;
  /** The state it is now in. */
  status: string;
}

const DESCRIPTIONS: Record<string, string> = {
  draft: 'Recurring schedule returned to draft.',
  active: 'Recurring schedule started.',
  paused: 'Recurring schedule paused.',
  cancelled: 'Recurring schedule stopped.',
};

export const setScheduleStatus = createAction(
  setScheduleStatusSchema,
  async (input): Promise<SetScheduleStatusResult> => {
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

    const previous = readString(current, 'status');

    if (previous === 'completed' || previous === 'cancelled') {
      throw new AppError(
        'conflict',
        'This schedule has finished. Create a new one to bill this client again.'
      );
    }

    const now = new Date().toISOString();
    const changes: Record<string, Json> = {
      status: input.status,
      paused_at: input.status === 'paused' ? now : null,
      updated_by: user.id,
    };

    if (input.status === 'cancelled') {
      changes['cancelled_at'] = now;
    }

    const { error } = await supabase
      .from('recurring_invoice_schedules')
      .update(changes)
      .eq('company_id', company.id)
      .eq('id', input.scheduleId);

    if (error) {
      logger.error('Could not change the state of a recurring schedule', error, {
        companyId: company.id,
        scheduleId: input.scheduleId,
      });

      throw new AppError('database_failure', 'The schedule could not be changed just now.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'recurring_invoice_schedule',
      entityId: input.scheduleId,
      companyId: company.id,
      description: DESCRIPTIONS[input.status] ?? 'Recurring schedule changed.',
    });

    revalidatePath('/dashboard/subscriptions');
    revalidatePath(`/dashboard/subscriptions/${input.scheduleId}`);

    return { scheduleId: input.scheduleId, status: input.status };
  },
  { name: 'setScheduleStatus' }
);
