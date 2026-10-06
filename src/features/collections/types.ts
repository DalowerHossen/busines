// src/features/collections/types.ts
// The shapes the collections screen works with.

export interface CollectionsSummary {
  overdueAmount: string;
  overdueCount: number;
  dueWithinAWeek: string;
  scheduledReminders: number;
  promisedAmount: string;
  isEnabled: boolean;
  timeZone: string;
  quietHoursStart: string;
  quietHoursEnd: string;
  sendingWeekdays: readonly number[];
  sendStatements: boolean;
  statementDayOfMonth: number | null;
  hasSettings: boolean;
}

export interface ReminderRuleRow {
  ruleId: string;
  name: string;
  offsetDays: number;
  minimumBalance: string;
  maxReminders: number;
  skipIfPromiseToPay: boolean;
  isActive: boolean;
  scheduledCount: number;
  sentCount: number;
}

export interface PromiseRow {
  promiseId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  clientName: string | null;
  promisedDate: string;
  promisedAmount: string | null;
  balanceDue: string;
  note: string | null;
  isLate: boolean;
}
