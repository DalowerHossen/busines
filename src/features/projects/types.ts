// src/features/projects/types.ts
// The shapes the project screens work with.

export interface ProjectSummary {
  projectId: string;
  projectCode: string;
  name: string;
  clientName: string | null;
  status: string;
  billingType: string;
  currency: string;
  hourlyRate: string | null;
  budgetHours: string | null;
  loggedHours: string;
  billableHours: string;
  billedAmount: string;
  uninvoicedAmount: string;
  startDate: string | null;
  endDate: string | null;
}

export interface TimeEntryRow {
  entryId: string;
  entryDate: string;
  description: string;
  minutes: number;
  isBillable: boolean;
  status: string;
  billableAmount: string;
  personName: string | null;
  isRunning: boolean;
}

export interface ProjectProfit {
  loggedHours: string;
  billableHours: string;
  billedAmount: string;
  uninvoicedAmount: string;
  labourCost: string;
  expenseCost: string;
  grossProfit: string;
  marginPercentage: string;
}

export interface MilestoneRow {
  milestoneId: string;
  name: string;
  dueDate: string | null;
  amount: string;
  isComplete: boolean;
  completedAt: string | null;
}
