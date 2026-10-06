// src/app/api/billing/invoices/[invoiceId]/pdf/route.ts
// The PDF of one charge the platform raised against a business, itemised the
// same way the billing page shows it.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { recordAuditEntry } from '@/lib/audit/record';
import { loadCompany } from '@/lib/auth/company-context';
import { getSessionUser } from '@/lib/auth/session';
import { formatDate } from '@/lib/dates';
import { buildTablePdf } from '@/lib/export/pdf';
import { formatMoney } from '@/lib/format';
import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readString } from '@/lib/records';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { isJsonObject } from '@/types/json';

export const dynamic = 'force-dynamic';

export interface PlatformInvoiceRouteContext {
  /** Route parameters of the request. */
  params: { invoiceId: string };
}

/**
 * Answers a platform invoice download request.
 *
 * @param _request Incoming request.
 * @param context Route parameters of the request.
 * @returns The PDF, or an explanation in the usual shape.
 */
export async function GET(
  _request: NextRequest,
  context: PlatformInvoiceRouteContext
): Promise<NextResponse> {
  const user = await getSessionUser();

  if (!user) {
    return errorResponse(
      'Sign in to download this invoice.',
      HTTP_STATUS.unauthorised,
      'unauthenticated'
    );
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return errorResponse(
      'This account is not attached to a business.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  if (user.role !== 'owner' && user.role !== 'super_admin' && user.role !== 'accountant') {
    return errorResponse(
      'Only the owner and the accountant can download what we charge you.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const supabase = createServerSupabaseClient();

  const { data, error } = await supabase
    .from('subscription_invoices')
    .select(
      'id, invoice_number, status, description, period_start, period_end, issue_date, due_date, currency, subtotal_amount, discount_amount, tax_amount, total_amount, paid_amount, balance_due, merchant_fee_amount, line_items'
    )
    .eq('id', context.params.invoiceId)
    .eq('company_id', company.id)
    .is('deleted_at', null)
    .maybeSingle();

  const invoice = asRow(data);

  if (error) {
    logger.error('A platform invoice could not be read', error, { companyId: company.id });

    return errorResponse(
      'This invoice could not be opened right now.',
      HTTP_STATUS.serverError,
      'database_failure'
    );
  }

  if (invoice === null) {
    return errorResponse('That invoice was not found.', HTTP_STATUS.notFound, 'not_found');
  }

  const currency = readString(invoice, 'currency') ?? 'USD';
  const lineItems = asRows(invoice['line_items']).filter((item) => isJsonObject(item));

  const rows: string[][] =
    lineItems.length > 0
      ? lineItems.map((item) => [
          readString(item, 'description') ?? 'Subscription',
          readString(item, 'quantity') ?? '1',
          formatMoney(readAmount(item, 'unit_amount'), currency),
          formatMoney(readAmount(item, 'amount'), currency),
        ])
      : [
          [
            readString(invoice, 'description') ?? 'Subscription for the period',
            '1',
            formatMoney(readAmount(invoice, 'subtotal_amount'), currency),
            formatMoney(readAmount(invoice, 'subtotal_amount'), currency),
          ],
        ];

  const merchantFee = readAmount(invoice, 'merchant_fee_amount');

  if (Number.parseFloat(merchantFee) > 0) {
    rows.push([
      'Collection fees kept while taking payments for you',
      '1',
      formatMoney(merchantFee, currency),
      formatMoney(merchantFee, currency),
    ]);
  }

  const periodStart = readString(invoice, 'period_start');
  const periodEnd = readString(invoice, 'period_end');

  const file = buildTablePdf({
    title: `Invoice ${readString(invoice, 'invoice_number') ?? ''}`,
    subtitles: [
      `Billed to ${company.legalName || company.displayName}`,
      `Issued ${formatDate(readString(invoice, 'issue_date') ?? '')} · due ${formatDate(
        readString(invoice, 'due_date') ?? ''
      )}`,
      periodStart && periodEnd
        ? `Period ${formatDate(periodStart)} to ${formatDate(periodEnd)}`
        : 'One off charge',
    ],
    headers: ['Description', 'Quantity', 'Unit price', 'Amount'],
    rows,
    totalRow: ['TOTAL', '', '', formatMoney(readAmount(invoice, 'total_amount'), currency)],
    numericColumns: [1, 2, 3],
    footerNote: `Paid ${formatMoney(readAmount(invoice, 'paid_amount'), currency)} · outstanding ${formatMoney(
      readAmount(invoice, 'balance_due'),
      currency
    )}. KD SOLUTION IT, support@kdsolutionit.com.`,
  });

  await recordAuditEntry({
    action: 'export',
    entityType: 'subscription_invoice',
    entityId: readString(invoice, 'id'),
    companyId: company.id,
    description: 'Platform invoice downloaded.',
  });

  return new NextResponse(Buffer.from(file), {
    status: HTTP_STATUS.ok,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${readString(invoice, 'invoice_number') ?? 'invoice'}.pdf"`,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    },
  });
}
