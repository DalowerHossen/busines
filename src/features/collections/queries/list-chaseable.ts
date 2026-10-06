// src/features/collections/queries/list-chaseable.ts
// The unpaid invoices an owner could chase right now.
//
// Deliberately narrow: only invoices that are actually outstanding, only
// clients who have an email address, and the oldest first. A list that
// includes things that cannot be chased wastes the time of the person
// reading it.

import { todayIso } from '@/lib/dates';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface ChaseableInvoice {
  invoiceId: string;
  invoiceNumber: string;
  clientName: string | null;
  clientEmail: string | null;
  dueDate: string;
  currency: string;
  balanceDue: string;
  daysOverdue: number;
  lastChasedAt: string | null;
}

export interface ChaseableBoard {
  invoices: readonly ChaseableInvoice[];
  /** True when the read failed. */
  isDegraded: boolean;
}

/**
 * Reads the invoices that could be chased today.
 *
 * @param companyId Business being read.
 * @returns The invoices, oldest first.
 */
export async function loadChaseableInvoices(companyId: string): Promise<ChaseableBoard> {
  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('invoices')
    .select(
      'id, invoice_number, due_date, currency, balance_due, last_reminder_sent_at, clients(display_name, email)'
    )
    .eq('company_id', companyId)
    .is('deleted_at', null)
    .gt('balance_due', 0)
    .not('invoice_number', 'is', null)
    .in('status', ['sent', 'viewed', 'partially_paid', 'overdue'])
    .order('due_date', { ascending: true })
    .limit(100);

  if (error) {
    logger.error('The chaseable invoices could not be read', error, { companyId });

    return { invoices: [], isDegraded: true };
  }

  const today = Date.parse(todayIso());

  return {
    invoices: asRows(data).map((row) => {
      const client = asRow(row['clients']);
      const dueDate = readString(row, 'due_date') ?? '';
      const daysOverdue =
        dueDate === '' ? 0 : Math.max(Math.floor((today - Date.parse(dueDate)) / 86400000), 0);

      return {
        invoiceId: readString(row, 'id') ?? '',
        invoiceNumber: readString(row, 'invoice_number') ?? '',
        clientName: client === null ? null : readString(client, 'display_name'),
        clientEmail: client === null ? null : readString(client, 'email'),
        dueDate,
        currency: readString(row, 'currency') ?? 'USD',
        balanceDue: readAmount(row, 'balance_due'),
        daysOverdue,
        lastChasedAt: readString(row, 'last_reminder_sent_at'),
      };
    }),
    isDegraded: false,
  };
}
