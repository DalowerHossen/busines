// src/features/statements/types.ts
// The shapes the statement screens work with.

export interface StatementLine {
  invoiceId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate: string;
  currency: string;
  totalAmount: string;
  paidAmount: string;
  balanceDue: string;
  daysOverdue: number;
  status: string;
}

export interface StatementSummary {
  clientName: string;
  clientEmail: string | null;
  invoiceCount: number;
  totalOutstanding: string;
  notYetDue: string;
  overdueUpTo30: string;
  overdue31To60: string;
  overdue61To90: string;
  overdueOver90: string;
  oldestDueDate: string | null;
  currency: string;
}

export interface DebtorRow {
  clientId: string;
  clientName: string;
  clientEmail: string | null;
  invoiceCount: number;
  totalOutstanding: string;
  overdueAmount: string;
  oldestDueDate: string | null;
  currency: string;
}
