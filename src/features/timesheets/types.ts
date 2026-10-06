// src/features/timesheets/types.ts
// The shapes the timesheet and retainer screens work with.

export interface TimesheetRow {
  timesheetId: string;
  personName: string | null;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalHours: string;
  billableHours: string;
  entryCount: number;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  isMine: boolean;
}

export interface RetainerRow {
  agreementId: string;
  name: string;
  clientName: string | null;
  status: string;
  billingPeriod: string;
  currency: string;
  amount: string;
  includedHours: string;
  overageHourlyRate: string | null;
  nextBillingDate: string | null;
  currentPeriodId: string | null;
  usedHours: string;
  remainingHours: string;
  overageHours: string;
  periodStart: string | null;
  periodEnd: string | null;
}
