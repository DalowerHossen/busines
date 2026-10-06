// src/features/invoices/actions/create-invoice.ts
// Creates a draft invoice with its lines. A draft carries no number: the
// number is assigned when the invoice is issued, so a draft that is never sent
// cannot leave a gap in the sequence.

'use server';

import { revalidatePath } from 'next/cache';

import { createInvoiceSchema } from '@/features/invoices/validation/invoice';
import { createAction } from '@/lib/actions/create-action';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { toInvoiceItemRows } from '@/features/invoices/actions/line-rows';

export interface CreateInvoiceResult {
  /** Identifier of the draft that was created. */
  invoiceId: string;
}

export const createInvoice = createAction(
  createInvoiceSchema,
  async (input): Promise<CreateInvoiceResult> => {
    const { user, company } = await requirePermission('invoices', 'create');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        company_id: company.id,
        client_id: input.clientId,
        currency: input.currency,
        base_currency: company.baseCurrency,
        issue_date: input.issueDate,
        due_date: input.dueDate,
        purchase_order_reference: input.purchaseOrderReference,
        notes: input.notes,
        terms_and_conditions: input.termsAndConditions,
        footer_note: input.footerNote,
        internal_memo: input.internalMemo,
        shipping_amount: input.shippingAmount,
        created_by: user.id,
        updated_by: user.id,
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Could not create a draft invoice', error, { companyId: company.id });

      throw new AppError(
        'database_failure',
        'The invoice could not be saved. Please try again in a moment.'
      );
    }

    const invoiceId = readString(asRow(data) ?? {}, 'id');

    if (invoiceId === null) {
      throw new AppError('database_failure', 'The invoice was saved but could not be read back.');
    }

    const { error: lineError } = await supabase
      .from('invoice_items')
      .insert(toInvoiceItemRows(input.lines, company.id, invoiceId, user.id));

    if (lineError) {
      logger.error('Could not save the invoice lines', lineError, { invoiceId });

      throw new AppError(
        'database_failure',
        'The invoice was created but its lines could not be saved. Open the draft and try again.'
      );
    }

    revalidatePath('/dashboard/invoices');

    return { invoiceId };
  },
  { name: 'createInvoice' }
);
