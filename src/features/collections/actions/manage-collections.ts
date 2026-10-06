// src/features/collections/actions/manage-collections.ts
// Deciding how an unpaid invoice is chased, and recording a promise to pay.

'use server';

import { revalidatePath } from 'next/cache';

import {
  recordPromiseSchema,
  ruleIdSchema,
  saveRuleSchema,
  saveSettingsSchema,
} from '@/features/collections/validation/collections';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Where the collections screen lives, for cache invalidation. */
const COLLECTIONS_PATH = '/dashboard/invoices/collections';

export interface RuleResult {
  /** Identifier of the reminder. */
  ruleId: string;
}

export const saveReminderRule = createAction(
  saveRuleSchema,
  async (input): Promise<RuleResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('save_reminder_rule', {
      p_company_id: company.id,
      p_name: input.name,
      p_offset_days: input.offsetDays,
      p_template_key: 'invoice_reminder',
      p_minimum_balance: input.minimumBalance,
      p_max_reminders: input.maxReminders,
      p_skip_if_promise_to_pay: input.skipIfPromiseToPay,
      p_is_active: input.isActive,
      p_rule_id: input.ruleId ?? null,
    });

    if (error) {
      logger.error('A reminder could not be saved', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That reminder could not be saved. There is a limit on how hard a client may be chased.'
      );
    }

    const ruleId = typeof data === 'string' ? data : null;

    if (ruleId === null) {
      throw new AppError('database_failure', 'It was saved but returned no reference.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'reminder_rule',
      entityId: ruleId,
      companyId: company.id,
      description: `Reminder ${input.name} saved.`,
    });

    revalidatePath(COLLECTIONS_PATH);

    return { ruleId };
  },
  { name: 'saveReminderRule' }
);

export const removeReminderRule = createAction(
  ruleIdSchema,
  async (input): Promise<{ isRemoved: boolean }> => {
    const { company } = await requireOwner();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('delete_reminder_rule', {
      p_rule_id: input.ruleId,
    });

    if (error) {
      logger.error('A reminder could not be retired', error, { companyId: company.id });

      throw new AppError('database_failure', 'That reminder could not be retired.');
    }

    revalidatePath(COLLECTIONS_PATH);

    return { isRemoved: data === true };
  },
  { name: 'removeReminderRule' }
);

export const saveCollectionsSettings = createAction(
  saveSettingsSchema,
  async (input): Promise<{ isSaved: boolean }> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('save_reminder_settings', {
      p_company_id: company.id,
      p_is_enabled: input.isEnabled,
      p_time_zone: input.timeZone,
      p_quiet_hours_start: `${input.quietHoursStart}:00`,
      p_quiet_hours_end: `${input.quietHoursEnd}:00`,
      p_sending_weekdays: input.sendingWeekdays,
      p_shift_due_dates_to_business_days: input.shiftDueDatesToBusinessDays,
      p_send_statements: input.sendStatements,
      p_statement_day_of_month: input.statementDayOfMonth ?? null,
    });

    if (error) {
      logger.error('The collections settings could not be saved', error, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'Those settings could not be saved.');
    }

    await recordAuditEntry({
      action: 'settings_change',
      entityType: 'reminder_settings',
      entityId: company.id,
      companyId: company.id,
      description: `Reminders are sent in ${input.timeZone}, outside quiet hours.`,
    });

    revalidatePath(COLLECTIONS_PATH);

    return { isSaved: true };
  },
  { name: 'saveCollectionsSettings' }
);

export const recordPaymentPromise = createAction(
  recordPromiseSchema,
  async (input): Promise<{ promiseId: string }> => {
    const { company } = await requirePermission('invoices', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('record_payment_promise', {
      p_invoice_id: input.invoiceId,
      p_promised_date: input.promisedDate,
      p_promised_amount: input.promisedAmount ?? null,
      p_note: input.note ?? null,
      p_source: 'staff',
    });

    if (error) {
      logger.error('A promise to pay could not be recorded', error, { companyId: company.id });

      throw new AppError('database_failure', 'That promise could not be recorded.');
    }

    const promiseId = typeof data === 'string' ? data : null;

    if (promiseId === null) {
      throw new AppError('database_failure', 'It was recorded but returned no reference.');
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'payment_promise',
      entityId: promiseId,
      companyId: company.id,
      description: `Client promised to pay on ${input.promisedDate}.`,
    });

    revalidatePath(COLLECTIONS_PATH);

    return { promiseId };
  },
  { name: 'recordPaymentPromise' }
);
