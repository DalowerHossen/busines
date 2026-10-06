// src/features/purchasing/actions/manage-purchasing.ts
// Recording who you buy from, what they billed you and what you paid.
//
// A bill is money leaving the business, so it is written down the same way
// money arriving is: against a named supplier, with the supplier's own
// reference on it, and with the payment recorded separately from the bill
// rather than by editing the bill into looking settled.

'use server';

import { revalidatePath } from 'next/cache';

import {
  billIdSchema,
  recordBillPaymentSchema,
  saveBillSchema,
  saveSupplierSchema,
} from '@/features/purchasing/validation/purchasing';
import { createAction } from '@/lib/actions/create-action';
import { recordAuditEntry } from '@/lib/audit/record';
import { requirePermission, requireWritableCompany } from '@/lib/auth/guards';
import { todayIso } from '@/lib/dates';
import { AppError } from '@/lib/errors';
import { logger } from '@/lib/logger';
import { asRow, readAmount } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';

/** Where the supplier screens live, for cache invalidation. */
const PURCHASING_PATH = '/dashboard/expenses/suppliers';

export interface SupplierResult {
  /** Identifier of the supplier. */
  vendorId: string;
}

export const saveSupplier = createAction(
  saveSupplierSchema,
  async (input): Promise<SupplierResult> => {
    const { company } = await requirePermission('expenses', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const values = {
      company_id: company.id,
      display_name: input.displayName,
      legal_name: input.legalName ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      country_code: input.countryCode ?? null,
      tax_number: input.taxNumber ?? null,
      payment_terms_days: input.paymentTermsDays,
    };

    if (input.vendorId === undefined) {
      const { data, error } = await supabase
        .from('vendors')
        .insert(values)
        .select('id')
        .maybeSingle();

      if (error || data === null) {
        logger.error('A supplier could not be created', error, { companyId: company.id });

        throw new AppError('database_failure', 'That supplier could not be added.');
      }

      const vendorId = typeof data.id === 'string' ? data.id : '';

      await recordAuditEntry({
        action: 'insert',
        entityType: 'vendor',
        entityId: vendorId,
        companyId: company.id,
        description: `Supplier ${input.displayName} added.`,
      });

      revalidatePath(PURCHASING_PATH);

      return { vendorId };
    }

    const { error } = await supabase
      .from('vendors')
      .update(values)
      .eq('id', input.vendorId)
      .eq('company_id', company.id)
      .is('deleted_at', null);

    if (error) {
      logger.error('A supplier could not be changed', error, { companyId: company.id });

      throw new AppError('database_failure', 'That supplier could not be changed.');
    }

    revalidatePath(PURCHASING_PATH);

    return { vendorId: input.vendorId };
  },
  { name: 'saveSupplier' }
);

export interface BillResult {
  /** Identifier of the bill. */
  billId: string;
}

export const saveSupplierBill = createAction(
  saveBillSchema,
  async (input): Promise<BillResult> => {
    const { company } = await requirePermission('expenses', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();
    const subtotal = (
      Number.parseFloat(input.totalAmount) - Number.parseFloat(input.taxAmount)
    ).toFixed(2);

    if (Number.parseFloat(subtotal) < 0) {
      throw new AppError(
        'validation_failed',
        'The tax cannot be more than the whole bill. Check the two figures.'
      );
    }

    const values = {
      company_id: company.id,
      vendor_id: input.vendorId,
      bill_number: input.vendorInvoiceNumber,
      vendor_invoice_number: input.vendorInvoiceNumber,
      bill_date: input.billDate,
      due_date: input.dueDate,
      currency: company.baseCurrency,
      subtotal_amount: subtotal,
      tax_amount: input.taxAmount,
      total_amount: input.totalAmount,
      notes: input.notes ?? null,
    };

    if (input.billId === undefined) {
      const { data, error } = await supabase
        .from('supplier_bills')
        .insert(values)
        .select('id')
        .maybeSingle();

      if (error || data === null) {
        logger.error('A supplier bill could not be recorded', error, {
          companyId: company.id,
        });

        throw new AppError(
          'database_failure',
          'That bill could not be recorded. The supplier may already have a bill with that number.'
        );
      }

      const billId = typeof data.id === 'string' ? data.id : '';

      await recordAuditEntry({
        action: 'insert',
        entityType: 'supplier_bill',
        entityId: billId,
        companyId: company.id,
        description: `Bill ${input.vendorInvoiceNumber} recorded.`,
        metadata: { total_amount: input.totalAmount },
      });

      revalidatePath(PURCHASING_PATH);

      return { billId };
    }

    const { error } = await supabase
      .from('supplier_bills')
      .update(values)
      .eq('id', input.billId)
      .eq('company_id', company.id)
      .is('deleted_at', null);

    if (error) {
      logger.error('A supplier bill could not be changed', error, { companyId: company.id });

      throw new AppError('database_failure', 'That bill could not be changed.');
    }

    revalidatePath(PURCHASING_PATH);

    return { billId: input.billId };
  },
  { name: 'saveSupplierBill' }
);

export interface BillPaymentResult {
  /** What is still owed on the bill. */
  balanceDue: string;
}

export const recordBillPayment = createAction(
  recordBillPaymentSchema,
  async (input): Promise<BillPaymentResult> => {
    const { company } = await requirePermission('expenses', 'edit');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { data, error } = await supabase
      .from('supplier_bills')
      .select('id, total_amount, paid_amount')
      .eq('id', input.billId)
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .maybeSingle();

    const bill = asRow(data);

    if (error || bill === null) {
      throw new AppError('not_found', 'That bill could not be found.');
    }

    const total = readAmount(bill, 'total_amount');
    const alreadyPaid = readAmount(bill, 'paid_amount');
    const paid = (Number.parseFloat(alreadyPaid) + Number.parseFloat(input.amount)).toFixed(2);

    if (Number.parseFloat(paid) > Number.parseFloat(total)) {
      throw new AppError(
        'validation_failed',
        'That is more than the bill is for. Record what you actually paid.'
      );
    }

    const isSettled = Number.parseFloat(paid) >= Number.parseFloat(total);

    const { error: updateError } = await supabase
      .from('supplier_bills')
      .update({
        paid_amount: paid,
        status: isSettled ? 'paid' : 'partially_paid',
        paid_at: isSettled ? new Date().toISOString() : null,
      })
      .eq('id', input.billId)
      .eq('company_id', company.id);

    if (updateError) {
      logger.error('A supplier payment could not be recorded', updateError, {
        companyId: company.id,
      });

      throw new AppError('database_failure', 'That payment could not be recorded.');
    }

    await recordAuditEntry({
      action: 'update',
      entityType: 'supplier_bill',
      entityId: input.billId,
      companyId: company.id,
      description: `Paid ${input.amount} against a supplier bill on ${input.paidOn ?? todayIso()}.`,
      metadata: { amount: input.amount },
    });

    revalidatePath(PURCHASING_PATH);

    return {
      balanceDue: (Number.parseFloat(total) - Number.parseFloat(paid)).toFixed(2),
    };
  },
  { name: 'recordBillPayment' }
);

export const deleteSupplierBill = createAction(
  billIdSchema,
  async (input): Promise<{ isDeleted: boolean }> => {
    const { company } = await requirePermission('expenses', 'delete');
    requireWritableCompany(company);

    const supabase = createServerSupabaseClient();

    const { error } = await supabase
      .from('supplier_bills')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', input.billId)
      .eq('company_id', company.id)
      .is('deleted_at', null);

    if (error) {
      logger.error('A supplier bill could not be removed', error, { companyId: company.id });

      throw new AppError('database_failure', 'That bill could not be removed.');
    }

    await recordAuditEntry({
      action: 'soft_delete',
      entityType: 'supplier_bill',
      entityId: input.billId,
      companyId: company.id,
      description: 'Supplier bill removed.',
    });

    revalidatePath(PURCHASING_PATH);

    return { isDeleted: true };
  },
  { name: 'deleteSupplierBill' }
);
