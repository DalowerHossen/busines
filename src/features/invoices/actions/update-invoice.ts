// src/features/invoices/actions/update-invoice.ts
// Saves a draft invoice. Only a draft can be changed: once an invoice has been
// issued it is locked, and a correction is made with a credit note or a
// revision instead.

'use server';

import { revalidatePath } from 'next/cache';

import { toInvoiceItemRows } from '@/features/invoices/actions/line-rows';
import { updateInvoiceSchema } from '@/features/invoices/validation/invoice';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readBoolean, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

export interface UpdateInvoiceResult {
  /** Identifier of the draft that was saved. */
  invoiceId: string;
}

export const updateInvoice = createAction(
  updateInvoiceSchema,
  async (input): Promise<UpdateInvoiceResult> => {
    const { user, company } = await requirePermission('invoices', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const existing = await supabase
      .from('invoices')
      .select('id, status, is_locked')
      .eq('company_id', company.id)
      .eq('id', input.invoiceId)
      .is('deleted_at', null)
      .maybeSingle();

    const current = asRow(existing.data);

    if (existing.error !== null || current === null) {
      throw new AppError('not_found', 'That invoice no longer exists.');
    }

    if (readBoolean(current, 'is_locked') || readString(current, 'status') !== 'draft') {
      throw new AppError(
        'conflict',
        'This invoice has already been issued, so it can no longer be changed. Raise a credit note or a revision instead.'
      );
    }

    const { error } = await supabase
      .from('invoices')
      .update({
        client_id: input.clientId,
        currency: input.currency,
        issue_date: input.issueDate,
        due_date: input.dueDate,
        purchase_order_reference: input.purchaseOrderReference,
        notes: input.notes,
        terms_and_conditions: input.termsAndConditions,
        footer_note: input.footerNote,
        internal_memo: input.internalMemo,
        shipping_amount: input.shippingAmount,
        updated_by: user.id,
      })
      .eq('company_id', company.id)
      .eq('id', input.invoiceId);

    if (error) {
      logger.error('Could not save a draft invoice', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The invoice could not be saved. Please try again in a moment.'
      );
    }

    const { error: removeError } = await supabase
      .from('invoice_items')
      .delete()
      .eq('company_id', company.id)
      .eq('invoice_id', input.invoiceId);

    if (removeError) {
      logger.error('Could not clear the old invoice lines', removeError, {
        invoiceId: input.invoiceId,
      });

      throw new AppError('database_failure', 'The invoice lines could not be replaced.');
    }

    const { error: lineError } = await supabase
      .from('invoice_items')
      .insert(toInvoiceItemRows(input.lines, company.id, input.invoiceId, user.id));

    if (lineError) {
      logger.error('Could not save the invoice lines', lineError, {
        invoiceId: input.invoiceId,
      });

      throw new AppError('database_failure', 'The invoice lines could not be saved.');
    }

    revalidatePath('/dashboard/invoices');
    revalidatePath(`/dashboard/invoices/${input.invoiceId}`);

    return { invoiceId: input.invoiceId };
  },
  { name: 'updateInvoice' }
);
