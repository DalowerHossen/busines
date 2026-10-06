// src/app/api/v1/invoices/[invoiceId]/route.ts
// Reading one invoice, with its lines, through the public interface.
//
// The list endpoint deliberately omits line items, because most
// integrations poll it and do not need them. This is where something that
// actually has to reproduce a document comes for the detail.

import type { NextRequest, NextResponse } from 'next/server';

import {
  authenticateDeveloperRequest,
  grantAllows,
  rateLimitHeaders,
} from '@/lib/api/developer-auth';
import { errorResponse, HTTP_STATUS, jsonResponse } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { asRow, asRows, readAmount, readString } from '@/lib/records';
import { getServiceSupabaseClient } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

export interface InvoiceRouteContext {
  /** Route parameters of the request. */
  params: { invoiceId: string };
}

/**
 * Reads one invoice belonging to the account behind the token.
 *
 * @param request Incoming request.
 * @param context Route parameters of the request.
 * @returns The invoice, or an explanation in the usual shape.
 */
export async function GET(
  request: NextRequest,
  context: InvoiceRouteContext
): Promise<NextResponse> {
  const outcome = await authenticateDeveloperRequest(request);

  if (outcome.kind === 'rate_limited') {
    return errorResponse(
      `Too many requests. Try again in ${outcome.retryAfterSeconds} seconds.`,
      HTTP_STATUS.tooManyRequests,
      'rate_limited'
    );
  }

  if (outcome.kind === 'unauthenticated') {
    return errorResponse(outcome.message, HTTP_STATUS.unauthorised, 'unauthenticated');
  }

  if (!grantAllows(outcome.grant, 'invoices:read')) {
    return errorResponse(
      'This application was not given permission to read invoices.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const supabase = getServiceSupabaseClient();

  const [invoiceResult, lineResult] = await Promise.all([
    supabase
      .from('invoices')
      .select(
        'id, invoice_number, status, issue_date, due_date, currency, subtotal_amount, tax_amount, total_amount, paid_amount, balance_due, notes, terms_and_conditions, client_id, created_at'
      )
      .eq('id', context.params.invoiceId)
      .eq('company_id', outcome.grant.companyId)
      .is('deleted_at', null)
      .maybeSingle(),
    supabase
      .from('invoice_items')
      .select('id, line_number, description, quantity, unit_price, tax_amount, line_total')
      .eq('invoice_id', context.params.invoiceId)
      .order('line_number', { ascending: true }),
  ]);

  const invoice = asRow(invoiceResult.data);

  if (invoiceResult.error !== null && invoice === null) {
    logger.error('An invoice could not be read for an application', invoiceResult.error, {
      companyId: outcome.grant.companyId,
    });
  }

  if (invoice === null) {
    return errorResponse(
      'No invoice with that identifier belongs to this account.',
      HTTP_STATUS.notFound,
      'not_found'
    );
  }

  const response = jsonResponse({
    data: {
      id: readString(invoice, 'id') ?? '',
      invoice_number: readString(invoice, 'invoice_number'),
      status: readString(invoice, 'status') ?? 'draft',
      issue_date: readString(invoice, 'issue_date'),
      due_date: readString(invoice, 'due_date'),
      currency: readString(invoice, 'currency') ?? 'USD',
      subtotal_amount: readAmount(invoice, 'subtotal_amount'),
      tax_amount: readAmount(invoice, 'tax_amount'),
      total_amount: readAmount(invoice, 'total_amount'),
      paid_amount: readAmount(invoice, 'paid_amount'),
      balance_due: readAmount(invoice, 'balance_due'),
      notes: readString(invoice, 'notes'),
      terms: readString(invoice, 'terms_and_conditions'),
      client_id: readString(invoice, 'client_id'),
      created_at: readString(invoice, 'created_at'),
      lines: asRows(lineResult.data).map((line) => ({
        id: readString(line, 'id') ?? '',
        description: readString(line, 'description'),
        quantity: readAmount(line, 'quantity'),
        unit_price: readAmount(line, 'unit_price'),
        tax_amount: readAmount(line, 'tax_amount'),
        line_total: readAmount(line, 'line_total'),
      })),
    },
  });

  for (const [name, value] of Object.entries(rateLimitHeaders(outcome.grant))) {
    response.headers.set(name, value);
  }

  return response;
}
