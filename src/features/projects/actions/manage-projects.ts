// src/features/projects/actions/manage-projects.ts
// Creating work, starting a clock on it and writing time against it.
//
// The timer matters more than it looks. A freelancer who has to remember to
// log an hour will forget it, and an hour nobody logged is an hour nobody
// gets paid for. So starting is one press, stopping is one press, and the
// rate is worked out by the database from the project rather than typed in.

'use server';

import { revalidatePath } from 'next/cache';

import {
  logTimeSchema,
  projectIdSchema,
  saveProjectSchema,
  startTimerSchema,
  stopTimerSchema,
} from '@/features/projects/validation/project';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireTenant, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Where the project screens live, for cache invalidation. */
const PROJECT_PATH = '/dashboard/projects';

export interface SaveProjectResult {
  /** Identifier of the project. */
  projectId: string;
}

export const saveProject = createAction(
  saveProjectSchema,
  async (input): Promise<SaveProjectResult> => {
    const { company } = await requirePermission('clients', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const values = {
      company_id: company.id,
      client_id: input.clientId ?? null,
      name: input.name,
      status: input.status,
      billing_type: input.billingType,
      currency: company.baseCurrency,
      hourly_rate: input.hourlyRate ?? null,
      fixed_price_amount: input.fixedPriceAmount ?? null,
      budget_hours: input.budgetHours ?? null,
      start_date: input.startDate === '' ? null : (input.startDate ?? null),
      end_date: input.endDate === '' ? null : (input.endDate ?? null),
      notes: input.notes ?? null,
    };

    if (input.projectId === undefined) {
      const { data, error } = await supabase
        .from('projects')
        .insert(values)
        .select('id')
        .maybeSingle();

      if (error || data === null) {
        logger.error('A project could not be created', error, { companyId: company.id });

        throw new AppError('database_failure', 'That project could not be created.');
      }

      const projectId = typeof data.id === 'string' ? data.id : '';

      await recordAuditEntry({
        action: 'insert',
        entityType: 'project',
        entityId: projectId,
        companyId: company.id,
        description: `Project ${input.name} created.`,
      });

      revalidatePath(PROJECT_PATH);

      return { projectId };
    }

    const { error } = await supabase
      .from('projects')
      .update(values)
      .eq('id', input.projectId)
      .eq('company_id', company.id)
      .is('deleted_at', null);

    if (error) {
      logger.error('A project could not be changed', error, { companyId: company.id });

      throw new AppError('database_failure', 'That project could not be changed.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'project',
      entityId: input.projectId,
      companyId: company.id,
      description: `Project ${input.name} changed.`,
    });

    revalidatePath(PROJECT_PATH);
    revalidatePath(`${PROJECT_PATH}/${input.projectId}`);

    return { projectId: input.projectId };
  },
  { name: 'saveProject' }
);

export interface StartTimerResult {
  /** Identifier of the entry now running. */
  entryId: string;
}

export const startTimer = createAction(
  startTimerSchema,
  async (input): Promise<StartTimerResult> => {
    const { company } = await requireTenant();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('start_time_entry', {
      p_project_id: input.projectId,
      p_description: input.description,
      p_task_id: null,
      p_is_billable: input.isBillable,
    });

    if (error) {
      logger.error('A timer could not be started', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That timer could not be started. You may already have one running.'
      );
    }

    const entryId = typeof data === 'string' ? data : null;

    if (entryId === null) {
      throw new AppError('database_failure', 'The timer started but returned no reference.');
    }

    revalidatePath(PROJECT_PATH);
    revalidatePath(`${PROJECT_PATH}/${input.projectId}`);

    return { entryId };
  },
  { name: 'startTimer' }
);

export interface StopTimerResult {
  /** How many minutes the timer ran for. */
  minutes: number;
}

export const stopTimer = createAction(
  stopTimerSchema,
  async (input): Promise<StopTimerResult> => {
    const { company } = await requireTenant();

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('stop_time_entry', {
      p_entry_id: input.entryId,
    });

    if (error) {
      logger.error('A timer could not be stopped', error, { companyId: company.id });

      throw new AppError('database_failure', 'That timer could not be stopped.');
    }

    revalidatePath(PROJECT_PATH);

    return { minutes: typeof data === 'number' ? data : 0 };
  },
  { name: 'stopTimer' }
);

export interface LogTimeResult {
  /** Identifier of the entry that was written. */
  entryId: string;
}

export const logTime = createAction(
  logTimeSchema,
  async (input): Promise<LogTimeResult> => {
    const { company } = await requireTenant();
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('log_time_entry', {
      p_project_id: input.projectId,
      p_minutes: input.minutes,
      p_description: input.description,
      p_entry_date: input.entryDate ?? null,
      p_task_id: null,
      p_is_billable: input.isBillable,
    });

    if (error) {
      logger.error('Time could not be logged', error, { companyId: company.id });

      throw new AppError('database_failure', 'That time could not be logged.');
    }

    const entryId = typeof data === 'string' ? data : null;

    if (entryId === null) {
      throw new AppError('database_failure', 'It was logged but returned no reference.');
    }

    revalidatePath(`${PROJECT_PATH}/${input.projectId}`);

    return { entryId };
  },
  { name: 'logTime' }
);

export interface InvoiceWorkResult {
  /** Identifier of the invoice the work was put on. */
  invoiceId: string;
}

export const invoiceProjectWork = createAction(
  projectIdSchema,
  async (input): Promise<InvoiceWorkResult> => {
    const { company } = await requirePermission('invoices', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('invoice_project_work', {
      p_project_id: input.projectId,
      p_issue_date: null,
      p_up_to: null,
    });

    if (error) {
      logger.error('Project work could not be invoiced', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'That work could not be invoiced. There may be nothing uninvoiced on it yet.'
      );
    }

    const invoiceId = typeof data === 'string' ? data : null;

    if (invoiceId === null) {
      throw new AppError(
        'conflict',
        'There is nothing to invoice on this project yet. Log some billable time first.'
      );
    }

    await recordAuditEntry({
      action: 'insert',
      entityType: 'invoice',
      entityId: invoiceId,
      companyId: company.id,
      description: 'Draft invoice raised from project work.',
    });

    revalidatePath(`${PROJECT_PATH}/${input.projectId}`);
    revalidatePath('/dashboard/invoices');

    return { invoiceId };
  },
  { name: 'invoiceProjectWork' }
);
