// src/features/recurring/types.ts
// The shapes the recurring billing module works with: the schedules that
// produce invoices on their own, and the template each one copies.

import type { RecurrenceFrequency, RecurringScheduleStatus } from '@/types/enums';

export interface ScheduleSummary {
  id: string;
  name: string;
  status: RecurringScheduleStatus;
  clientId: string;
  clientName: string;
  currency: string;
  amount: string;
  frequency: RecurrenceFrequency;
  intervalCount: number;
  customIntervalDays: number | null;
  startDate: string;
  endDate: string | null;
  nextRunDate: string | null;
  lastRunDate: string | null;
  occurrencesGenerated: number;
  maxOccurrences: number | null;
  autoIssue: boolean;
  autoSend: boolean;
  isDeleted: boolean;
}

export interface ScheduleDetail extends ScheduleSummary {
  templateInvoiceId: string;
  templateInvoiceNumber: string | null;
  lastGeneratedInvoiceId: string | null;
  paymentTermsDays: number;
  daysBeforeToCreate: number;
  autoCharge: boolean;
  timeZone: string;
  notes: string | null;
  pausedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
}

export interface ScheduleListFilters {
  /** Free text matched against the schedule name and the client name. */
  search: string | null;
  /** Status to narrow by, or null for every status. */
  status: RecurringScheduleStatus | null;
  /** Client to narrow by, or null for every client. */
  clientId: string | null;
  /** True to list schedules that have been deleted. */
  includeDeleted: boolean;
}

export interface ScheduleTotals {
  currency: string;
  monthlyValue: string;
  activeCount: number;
  dueThisWeekCount: number;
  totalCount: number;
}

export interface TemplateInvoiceOption {
  id: string;
  label: string;
  clientId: string;
  clientName: string;
  currency: string;
  totalAmount: string;
}

export interface ScheduleFormData {
  templates: readonly TemplateInvoiceOption[];
}
