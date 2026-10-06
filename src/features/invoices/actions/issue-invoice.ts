// src/features/invoices/actions/issue-invoice.ts
// Issues a draft. The database assigns the number, freezes the business and
// client identity onto the document and locks it, so an issued invoice can
// never drift from what the client received.

'use server';

import { revalidatePath } from 'next/cache';

import { issueInvoiceSchema } from '@/features/invoices/validation/invoice';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface IssueInvoiceResult {
  /** The number the invoice was given. */
  invoiceNumber: string;
}

export const issueInvoice = createAction(
  issueInvoiceSchema,
  async (input): Promise<IssueInvoiceResult> => {
    const { company } = await requirePermission('invoices', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase.rpc('issue_invoice', {
      p_invoice_id: input.invoiceId,
      ...(input.issueDate === undefined ? {} : { p_issue_date: input.issueDate }),
    });

    if (error) {
      logger.error('Could not issue an invoice', error, {
        companyId: company.id,
        invoiceId: input.invoiceId,
      });

      throw new AppError(
        'conflict',
        'The invoice could not be issued. Check that it has at least one line and has not been issued already.'
      );
    }

    const invoiceNumber = typeof data === 'string' ? data : null;

    if (invoiceNumber === null) {
      throw new AppError('database_failure', 'The invoice was issued but returned no number.');
    }

    await recordAuditEntry({
      action: 'approve',
      entityType: 'invoice',
      entityId: input.invoiceId,
      companyId: company.id,
      description: `Invoice ${invoiceNumber} issued.`,
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${input.invoiceId}`);

    return { invoiceNumber };
  },
  { name: 'issueInvoice' }
);
