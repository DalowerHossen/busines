// src/features/statements/queries/get-statement.ts
// Reading what one client owes, and who owes anything at all.

import type { DebtorRow, StatementLine, StatementSummary } from '@/features/statements/types';
import { logger } from '@/lib/logger';
import { asRows, readAmount, readNumber, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getServiceSupabaseClient } from '@/lib/supabase/service';
import { isJsonObject, type JsonObject } from '@/types/json';

export interface ClientStatement {
  lines: readonly StatementLine[];
  summary: StatementSummary | null;
  /** True when the read failed. */
  isDegraded: boolean;
}

/**
 * Reads an amount out of the summary document.
 *
 * @param source The summary.
 * @param key Field being read.
 * @returns The amount as a string.
 */
function amount(source: JsonObject, key: string): string {
  const value = source[key];

  if (typeof value === 'string') {
    return value;
  }

  return typeof value === 'number' ? String(value) : '0';
}

/**
 * Reads the statement of one client.
 *
 * @param companyId Business the client belongs to.
 * @param clientId Client being read.
 * @param useServiceRole True when there is no signed in user, as in an export.
 * @returns The lines, the ageing and whether the read failed.
 */
export async function loadClientStatement(
  companyId: string,
  clientId: string,
  useServiceRole = false
): Promise<ClientStatement> {
  const supabase = useServiceRole ? getServiceSupabaseClient() : createServerSupabaseClient();

  const [lines, summary] = await Promise.all([
    supabase.rpc('client_statement', {
      p_company_id: companyId,
      p_client_id: clientId,
      p_from: null,
      p_to: null,
    }),
    supabase.rpc('client_statement_summary', {
      p_company_id: companyId,
      p_client_id: clientId,
    }),
  ]);

  if (lines.error || summary.error) {
    logger.error('A client statement could not be read', lines.error ?? summary.error, {
      companyId,
      clientId,
    });

    return { lines: [], summary: null, isDegraded: true };
  }

  const totals = isJsonObject(summary.data) ? summary.data : {};

  return {
    lines: asRows(lines.data).map((row) => ({
      invoiceId: readString(row, 'invoice_id') ?? '',
      invoiceNumber: readString(row, 'invoice_number') ?? '',
      issueDate: readString(row, 'issue_date') ?? '',
      dueDate: readString(row, 'due_date') ?? '',
      currency: readString(row, 'currency') ?? 'USD',
      totalAmount: readAmount(row, 'total_amount'),
      paidAmount: readAmount(row, 'paid_amount'),
      balanceDue: readAmount(row, 'balance_due'),
      daysOverdue: readNumber(row, 'days_overdue') ?? 0,
      status: readString(row, 'status') ?? 'sent',
    })),
    summary: {
      clientName: typeof totals['client_name'] === 'string' ? totals['client_name'] : 'Client',
      clientEmail: typeof totals['client_email'] === 'string' ? totals['client_email'] : null,
      invoiceCount: typeof totals['invoice_count'] === 'number' ? totals['invoice_count'] : 0,
      totalOutstanding: amount(totals, 'total_outstanding'),
      notYetDue: amount(totals, 'not_yet_due'),
      overdueUpTo30: amount(totals, 'overdue_up_to_30'),
      overdue31To60: amount(totals, 'overdue_31_to_60'),
      overdue61To90: amount(totals, 'overdue_61_to_90'),
      overdueOver90: amount(totals, 'overdue_over_90'),
      oldestDueDate:
        typeof totals['oldest_due_date'] === 'string' ? totals['oldest_due_date'] : null,
      currency: typeof totals['currency'] === 'string' ? totals['currency'] : 'USD',
    },
    isDegraded: false,
  };
}

export interface DebtorBoard {
  debtors: readonly DebtorRow[];
  /** Everything owed across every client. */
  totalOutstanding: string;
  /** The part of it that is already late. */
  totalOverdue: string;
  /** True when the read failed. */
  isDegraded: boolean;
}

/**
 * Reads everybody who owes this business something.
 *
 * @param companyId Business being read.
 * @returns The debtors, oldest debt first.
 */
export async function loadDebtors(companyId: string): Promise<DebtorBoard> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase.rpc('outstanding_by_client', {
    p_company_id: companyId,
  });

  if (error) {
    logger.error('The debtor list could not be read', error, { companyId });

    return { debtors: [], totalOutstanding: '0', totalOverdue: '0', isDegraded: true };
  }

  const debtors = asRows(data).map((row) => ({
    clientId: readString(row, 'client_id') ?? '',
    clientName: readString(row, 'client_name') ?? '',
    clientEmail: readString(row, 'client_email'),
    invoiceCount: readNumber(row, 'invoice_count') ?? 0,
    totalOutstanding: readAmount(row, 'total_outstanding'),
    overdueAmount: readAmount(row, 'overdue_amount'),
    oldestDueDate: readString(row, 'oldest_due_date'),
    currency: readString(row, 'currency') ?? 'USD',
  }));

  return {
    debtors,
    totalOutstanding: debtors
      .reduce((running, debtor) => running + Number.parseFloat(debtor.totalOutstanding), 0)
      .toFixed(2),
    totalOverdue: debtors
      .reduce((running, debtor) => running + Number.parseFloat(debtor.overdueAmount), 0)
      .toFixed(2),
    isDegraded: false,
  };
}
