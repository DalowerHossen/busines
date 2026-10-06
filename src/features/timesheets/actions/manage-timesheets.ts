// src/features/timesheets/actions/manage-timesheets.ts
// Handing in a week of work, approving it, and running a retainer.
//
// The approval rule is the one that matters: the person who worked the
// hours hands them in, and somebody else signs them off. The database
// enforces that rather than the screen, so hiding a button is not what
// stands between an unapproved week and an invoice.

'use server';

import { revalidatePath } from 'next/cache';

import {
  buildTimesheetSchema,
  periodIdSchema,
  retainerIdSchema,
  reviewTimesheetSchema,
  saveRetainerSchema,
  timesheetIdSchema,
} from '@/features/timesheets/validation/timesheet';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requireOwner, requireTenant, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Where the timesheet screens live, for cache invalidation. */
const TIMESHEET_PATH = '/dashboard/projects/timesheets';

export interface BuildTimesheetResult {
  /** Identifier of the week that was gathered. */
  timesheetId: string;
}

export const buildMyTimesheet = createAction(
  buildTimesheetSchema,
  async (input): Promise<BuildTimesheetResult> => {
    const { user, company } = await requireTenant();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('build_timesheet', {
      p_user_id: user.id,
      p_period_start: input.periodStart,
    });

    if (error) {
      logger.error('A timesheet could not be gathered', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That week could not be gathered. Check the date is the start of the week.'
      );
    }

    const timesheetId = typeof data === 'string' ? data : null;

    if (timesheetId === null) {
      throw new AppError('database_failure', 'It was gathered but returned no reference.');
    }

    revalidatePath(TIMESHEET_PATH);

    return { timesheetId };
  },
  { name: 'buildMyTimesheet' }
);

export interface SubmitTimesheetResult {
  /** The state the week is now in. */
  status: string;
}

export const submitTimesheet = createAction(
  timesheetIdSchema,
  async (input): Promise<SubmitTimesheetResult> => {
    const { company } = await requireTenant();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('submit_timesheet', {
      p_timesheet_id: input.timesheetId,
    });

    if (error) {
      logger.error('A timesheet could not be handed in', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That week could not be handed in. It may already have been reviewed.'
      );
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'timesheet',
      entityId: input.timesheetId,
      companyId: company.id,
      description: 'Timesheet handed in for approval.',
    });

    revalidatePath(TIMESHEET_PATH);

    return { status: typeof data === 'string' ? data : 'pending' };
  },
  { name: 'submitTimesheet' }
);

export interface ReviewTimesheetResult {
  /** The decision that was recorded. */
  status: string;
}

export const reviewTimesheet = createAction(
  reviewTimesheetSchema,
  async (input): Promise<ReviewTimesheetResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('review_timesheet', {
      p_timesheet_id: input.timesheetId,
      p_approve: input.approve,
      p_reason: input.reason ?? null,
    });

    if (error) {
      logger.error('A timesheet could not be reviewed', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That decision could not be saved. The week may already have been reviewed.'
      );
    }

    await recordAuditEntry({
      action: input.approve ? 'approve' : 'reject',
      entityType: 'timesheet',
      entityId: input.timesheetId,
      companyId: company.id,
      description: input.approve
        ? 'Timesheet approved.'
        : `Timesheet sent back: ${input.reason ?? 'no reason given'}.`,
    });

    revalidatePath(TIMESHEET_PATH);

    return { status: typeof data === 'string' ? data : 'pending' };
  },
  { name: 'reviewTimesheet' }
);

export interface SaveRetainerResult {
  /** Identifier of the agreement. */
  agreementId: string;
}

export const saveRetainer = createAction(
  saveRetainerSchema,
  async (input): Promise<SaveRetainerResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const values = {
      company_id: company.id,
      client_id: input.clientId,
      project_id: input.projectId ?? null,
      name: input.name,
      amount: input.amount,
      included_hours: input.includedHours,
      overage_hourly_rate: input.overageHourlyRate ?? null,
      billing_period: input.billingPeriod,
      rollover_unused_hours: input.rolloverUnusedHours,
      currency: company.baseCurrency,
    };

    if (input.agreementId === undefined) {
      const { data, error } = await supabase
        .from('retainer_agreements')
        .insert(values)
        .select('id')
        .maybeSingle();

      if (error || data === null) {
        logger.error('A retainer could not be created', error, { companyId: company.id });

        throw new AppError('database_failure', 'That retainer could not be created.');
      }

      const agreementId = typeof data.id === 'string' ? data.id : '';

      await recordAuditEntry({
        action: 'insert',
        entityType: 'retainer_agreement',
        entityId: agreementId,
        companyId: company.id,
        description: `Retainer ${input.name} agreed.`,
      });

      revalidatePath(TIMESHEET_PATH);

      return { agreementId };
    }

    const { error } = await supabase
      .from('retainer_agreements')
      .update(values)
      .eq('id', input.agreementId)
      .eq('company_id', company.id)
      .is('deleted_at', null);

    if (error) {
      logger.error('A retainer could not be changed', error, { companyId: company.id });

      throw new AppError('database_failure', 'That retainer could not be changed.');
    }

    revalidatePath(TIMESHEET_PATH);

    return { agreementId: input.agreementId };
  },
  { name: 'saveRetainer' }
);

export interface OpenPeriodResult {
  /** Identifier of the period now running. */
  periodId: string;
}

export const openRetainerPeriod = createAction(
  retainerIdSchema,
  async (input): Promise<OpenPeriodResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('open_retainer_period', {
      p_agreement_id: input.agreementId,
      p_period_start: null,
    });

    if (error) {
      logger.error('A retainer period could not be opened', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That period could not be opened. One may already be running.'
      );
    }

    const periodId = typeof data === 'string' ? data : null;

    if (periodId === null) {
      throw new AppError('database_failure', 'It was opened but returned no reference.');
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'retainer_period',
      entityId: periodId,
      companyId: company.id,
      description: 'Retainer period opened.',
    });

    revalidatePath(TIMESHEET_PATH);

    return { periodId };
  },
  { name: 'openRetainerPeriod' }
);

export interface ClosePeriodResult {
  /** True when the period is closed and its hours are settled. */
  isClosed: boolean;
}

export const closeRetainerPeriod = createAction(
  periodIdSchema,
  async (input): Promise<ClosePeriodResult> => {
    const { company } = await requireOwner();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase.rpc('close_retainer_period', {
      p_period_id: input.periodId,
    });

    if (error) {
      logger.error('A retainer period could not be closed', error, { companyId: company.id });

      throw new AppError('database_failure', 'That period could not be closed.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'retainer_period',
      entityId: input.periodId,
      companyId: company.id,
      description: 'Retainer period closed.',
    });

    revalidatePath(TIMESHEET_PATH);

    return { isClosed: true };
  },
  { name: 'closeRetainerPeriod' }
);
