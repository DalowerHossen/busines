// src/features/invoices/actions/cancel-invoice.ts
// Cancels an issued invoice. The document stays on record with the reason, so
// the numbering and the audit trail remain complete.

'use server';

import { revalidatePath } from 'next/cache';

import { cancelInvoiceSchema } from '@/features/invoices/validation/invoice';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { recordAuditEntry } from '@/lib/audit/record';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readAmount, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface CancelInvoiceResult {
  /** Identifier of the invoice that was cancelled. */
  invoiceId: string;
}

export const cancelInvoice = createAction(
  cancelInvoiceSchema,
  async (input): Promise<CancelInvoiceResult> => {
    const { user, company } = await requirePermission('invoices', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const existing = await supabase
      .from('invoices')
      .select('id, status, paid_amount')
      .eq('company_id', company.id)
      .eq('id', input.invoiceId)
      .is('deleted_at', null)
      .maybeSingle();

    const current = asRow(existing.data);

    if (existing.error !== null || current === null) {
      throw new AppError('not_found', 'That invoice no longer exists.');
    }

    const status = readString(current, 'status');

    if (status === 'cancelled') {
      throw new AppError('conflict', 'This invoice has already been cancelled.');
    }

    if (Number.parseFloat(readAmount(current, 'paid_amount')) > 0) {
      throw new AppError(
        'conflict',
        'This invoice has money against it. Raise a credit note or refund the payment instead of cancelling.'
      );
    }

    const { error } = await supabase
      .from('invoices')
      .update({
        status: 'cancelled',
        cancelled_at: new Date().toISOString(),
        cancellation_reason: input.reason,
        updated_by: user.id,
      })
      .eq('company_id', company.id)
      .eq('id', input.invoiceId);

    if (error) {
      logger.error('Could not cancel an invoice', error, { companyId: company.id });

      throw new AppError('database_failure', 'The invoice could not be cancelled just now.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'invoice',
      entityId: input.invoiceId,
      companyId: company.id,
      description: `Invoice cancelled: ${input.reason}`,
    });

    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${input.invoiceId}`);

    return { invoiceId: input.invoiceId };
  },
  { name: 'cancelInvoice' }
);
