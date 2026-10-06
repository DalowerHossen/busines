// src/features/reports/registry.ts
// Every report the dashboard offers, in the order the library shows them.

import type { ReportDefinition } from '@/features/reports/types';

export const REPORT_DEFINITIONS: readonly ReportDefinition[] = [
  {
    key: 'revenue-summary',
    title: 'Revenue summary',
    description: 'Invoiced, collected and still outstanding, month by month.',
    summary: 'See what you billed and what actually arrived, month by month.',
    group: 'sales',
  },
  {
    key: 'invoice-register',
    title: 'Invoice register',
    description: 'Every invoice issued in the period, with its balance.',
    summary: 'The full list of invoices for a period, ready for your accountant.',
    group: 'sales',
  },
  {
    key: 'receivables-ageing',
    title: 'Receivables ageing',
    description: 'What is owed to you, sorted by how long it has been waiting.',
    summary: 'Find the money that has been outstanding the longest.',
    group: 'money',
  },
  {
    key: 'payments-received',
    title: 'Payments received',
    description: 'Every payment recorded in the period, with its method.',
    summary: 'Reconcile what landed in the bank against what you recorded.',
    group: 'money',
  },
  {
    key: 'tax-summary',
    title: 'Tax summary',
    description: 'Tax charged on sales and tax paid on purchases.',
    summary: 'The figures a return needs, for sales and for purchases.',
    group: 'money',
  },
  {
    key: 'client-revenue',
    title: 'Revenue by client',
    description: 'What each client was billed and what each has paid.',
    summary: 'Know which clients carry the business, and which still owe.',
    group: 'clients',
  },
  {
    key: 'expense-summary',
    title: 'Spending by category',
    description: 'What the business spent, grouped by expense category.',
    summary: 'See where the money went, grouped the way you file it.',
    group: 'spending',
  },
];

/**
 * Finds one report by its key.
 *
 * @param key Key taken from the address bar.
 * @returns The definition, or null when the key is unknown.
 */
export function findReport(key: string): ReportDefinition | null {
  return REPORT_DEFINITIONS.find((report) => report.key === key) ?? null;
}

export const REPORT_GROUP_LABELS: Record<ReportDefinition['group'], string> = {
  sales: 'Sales',
  money: 'Money in',
  spending: 'Spending',
  clients: 'Clients',
};
