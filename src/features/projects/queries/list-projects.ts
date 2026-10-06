// src/features/projects/queries/list-projects.ts
// Reading the work a business has on, and the time behind it.

import type {
  MilestoneRow,
  ProjectProfit,
  ProjectSummary,
  TimeEntryRow,
} from '@/features/projects/types';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readBoolean, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

const PROJECT_COLUMNS =
  'id, project_code, name, status, billing_type, currency, hourly_rate, budget_hours, logged_hours, billable_hours, billed_amount, uninvoiced_amount, start_date, end_date, clients(display_name)';

export interface ProjectBoard {
  projects: readonly ProjectSummary[];
  /** The timer running for this person right now, if there is one. */
  runningEntry: TimeEntryRow | null;
  /** True when the read failed. */
  isDegraded: boolean;
}

/**
 * Turns one project row into the shape the screen shows.
 *
 * @param row Row read from the projects table.
 * @returns The project summary.
 */
function toProject(row: Parameters<typeof readString>[0]): ProjectSummary {
  const client = asRow(row['clients']);

  return {
    projectId: readString(row, 'id') ?? '',
    projectCode: readString(row, 'project_code') ?? '',
    name: readString(row, 'name') ?? '',
    clientName: client === null ? null : readString(client, 'display_name'),
    status: readString(row, 'status') ?? 'planning',
    billingType: readString(row, 'billing_type') ?? 'time_and_materials',
    currency: readString(row, 'currency') ?? 'USD',
    hourlyRate: row['hourly_rate'] === null ? null : readAmount(row, 'hourly_rate'),
    budgetHours: row['budget_hours'] === null ? null : readAmount(row, 'budget_hours'),
    loggedHours: readAmount(row, 'logged_hours'),
    billableHours: readAmount(row, 'billable_hours'),
    billedAmount: readAmount(row, 'billed_amount'),
    uninvoicedAmount: readAmount(row, 'uninvoiced_amount'),
    startDate: readString(row, 'start_date'),
    endDate: readString(row, 'end_date'),
  };
}

/**
 * Reads the projects of a business and any timer already running.
 *
 * @param companyId Business being read.
 * @param userId The person looking, whose timer is the one that matters.
 * @returns The projects, the running timer and whether the read failed.
 */
export async function loadProjectBoard(companyId: string, userId: string): Promise<ProjectBoard> {
  const supabase = createServerSupabaseClient();

  const [projects, running] = await Promise.all([
    supabase
      .from('projects')
      .select(PROJECT_COLUMNS)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .order('status', { ascending: true })
      .order('name', { ascending: true }),
    supabase
      .from('time_entries')
      .select('id, entry_date, description, duration_minutes, is_billable, status, started_at')
      .eq('company_id', companyId)
      .eq('user_id', userId)
      .is('ended_at', null)
      .not('started_at', 'is', null)
      .is('deleted_at', null)
      .maybeSingle(),
  ]);

  if (projects.error) {
    logger.error('The projects could not be read', projects.error, { companyId });

    return { projects: [], runningEntry: null, isDegraded: true };
  }

  const entry = asRow(running.data);

  return {
    projects: asRows(projects.data).map(toProject),
    runningEntry:
      entry === null
        ? null
        : {
            entryId: readString(entry, 'id') ?? '',
            entryDate: readString(entry, 'entry_date') ?? '',
            description: readString(entry, 'description') ?? '',
            minutes: readNumber(entry, 'duration_minutes') ?? 0,
            isBillable: readBoolean(entry, 'is_billable'),
            status: readString(entry, 'status') ?? 'pending',
            billableAmount: '0',
            personName: null,
            isRunning: true,
          },
    isDegraded: false,
  };
}

export interface ProjectDetail {
  project: ProjectSummary | null;
  entries: readonly TimeEntryRow[];
  milestones: readonly MilestoneRow[];
  profit: ProjectProfit | null;
  /** True when the read failed. */
  isDegraded: boolean;
}

/**
 * Reads one project with its time, its milestones and what it earned.
 *
 * @param companyId Business the project belongs to.
 * @param projectId Project being read.
 * @returns The project and everything behind it.
 */
export async function loadProjectDetail(
  companyId: string,
  projectId: string
): Promise<ProjectDetail> {
  const supabase = createServerSupabaseClient();

  const [project, entries, milestones, profit] = await Promise.all([
    supabase
      .from('projects')
      .select(PROJECT_COLUMNS)
      .eq('id', projectId)
      .eq('company_id', companyId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('time_entries')
      .select(
        'id, entry_date, description, duration_minutes, is_billable, status, billable_amount, ended_at, users(full_name)'
      )
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('entry_date', { ascending: false })
      .limit(100),
    supabase
      .from('project_milestones')
      .select('id, name, due_date, amount, status, completed_at')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .order('due_date', { ascending: true }),
    supabase.rpc('project_profitability', { p_project_id: projectId }),
  ]);

  const row = asRow(project.data);

  if (project.error || row === null) {
    logger.error('A project could not be read', project.error, { projectId });

    return { project: null, entries: [], milestones: [], profit: null, isDegraded: true };
  }

  const profitRow = asRows(profit.data)[0] ?? null;

  return {
    project: toProject(row),
    entries: asRows(entries.data).map((entry) => {
      const person = asRow(entry['users']);

      return {
        entryId: readString(entry, 'id') ?? '',
        entryDate: readString(entry, 'entry_date') ?? '',
        description: readString(entry, 'description') ?? '',
        minutes: readNumber(entry, 'duration_minutes') ?? 0,
        isBillable: readBoolean(entry, 'is_billable'),
        status: readString(entry, 'status') ?? 'pending',
        billableAmount: readAmount(entry, 'billable_amount'),
        personName: person === null ? null : readString(person, 'full_name'),
        isRunning: entry['ended_at'] === null,
      };
    }),
    milestones: asRows(milestones.data).map((milestone) => ({
      milestoneId: readString(milestone, 'id') ?? '',
      name: readString(milestone, 'name') ?? '',
      dueDate: readString(milestone, 'due_date'),
      amount: readAmount(milestone, 'amount'),
      isComplete: readString(milestone, 'status') === 'completed',
      completedAt: readString(milestone, 'completed_at'),
    })),
    profit:
      profitRow === null
        ? null
        : {
            loggedHours: readAmount(profitRow, 'logged_hours'),
            billableHours: readAmount(profitRow, 'billable_hours'),
            billedAmount: readAmount(profitRow, 'billed_amount'),
            uninvoicedAmount: readAmount(profitRow, 'uninvoiced_amount'),
            labourCost: readAmount(profitRow, 'labour_cost'),
            expenseCost: readAmount(profitRow, 'expense_cost'),
            grossProfit: readAmount(profitRow, 'gross_profit'),
            marginPercentage: readAmount(profitRow, 'margin_percentage'),
          },
    isDegraded: false,
  };
}
