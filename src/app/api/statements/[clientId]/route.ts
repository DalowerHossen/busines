// src/app/api/statements/[clientId]/route.ts
// The statement of one client, as a file they can hand to their accounts
// department.
//
// One page with every outstanding invoice on it tends to get several of
// them paid at once, which is why this exists separately from the reminder
// that chases a single invoice.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { loadClientStatement } from '@/features/statements/queries/get-statement';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { formatDate, todayIso } from '@/lib/dates';
import { toCsvLine } from '@/lib/export/csv';
import { buildTablePdf } from '@/lib/export/pdf';
import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';

export const dynamic = 'force-dynamic';

export interface StatementContext {
  /** Route parameters of the request. */
  params: { clientId: string };
}

/**
 * Serves the statement of one client as a file.
 *
 * @param request Incoming request, carrying the format wanted.
 * @param context Route parameters of the request.
 * @returns The statement, or an explanation in the usual shape.
 */
export async function GET(request: NextRequest, context: StatementContext): Promise<NextResponse> {
  const user = await getSessionUser();

  if (!user) {
    return errorResponse('Sign in first.', HTTP_STATUS.unauthorised, 'unauthenticated');
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (company === null || !can(user, 'invoices', 'export')) {
    return errorResponse(
      'You do not have permission to export a statement.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const statement = await loadClientStatement(company.id, context.params.clientId);

  if (statement.summary === null) {
    return errorResponse('That statement could not be read.', HTTP_STATUS.notFound, 'not_found');
  }

  const headers = ['Invoice', 'Issued', 'Due', 'Total', 'Paid', 'Outstanding', 'Days late'];

  const rows = statement.lines.map((line) => [
    line.invoiceNumber,
    formatDate(line.issueDate),
    formatDate(line.dueDate),
    line.totalAmount,
    line.paidAmount,
    line.balanceDue,
    line.daysOverdue > 0 ? String(line.daysOverdue) : '',
  ]);

  const totalRow = ['TOTAL', '', '', '', '', statement.summary.totalOutstanding, ''];
  const fileName = `statement-${statement.summary.clientName.replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}-${todayIso()}`;

  if (request.nextUrl.searchParams.get('format') === 'csv') {
    const csv = [headers, ...rows, totalRow].map((line) => toCsvLine(line)).join('\r\n');

    return new NextResponse(csv, {
      status: HTTP_STATUS.ok,
      headers: {
        'content-type': 'text/csv; charset=utf-8',
        'content-disposition': `attachment; filename="${fileName}.csv"`,
        'cache-control': 'no-store',
      },
    });
  }

  const file = buildTablePdf({
    title: `Statement for ${statement.summary.clientName}`,
    subtitles: [
      `${company.displayName} · ${formatDate(todayIso())}`,
      `Outstanding ${statement.summary.totalOutstanding} ${statement.summary.currency} across ${String(statement.summary.invoiceCount)} invoices`,
      statement.summary.oldestDueDate === null
        ? 'Nothing is overdue.'
        : `Oldest unpaid invoice was due ${formatDate(statement.summary.oldestDueDate)}.`,
    ],
    headers,
    rows,
    totalRow,
    numericColumns: [3, 4, 5],
    footerNote:
      'Amounts are shown in the currency of each invoice. Please quote the invoice number when paying.',
  });

  return new NextResponse(Buffer.from(file), {
    status: HTTP_STATUS.ok,
    headers: {
      'content-type': 'application/pdf',
      'content-disposition': `attachment; filename="${fileName}.pdf"`,
      'cache-control': 'no-store',
    },
  });
}
