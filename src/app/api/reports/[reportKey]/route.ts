// src/app/api/reports/[reportKey]/route.ts
// Downloading a report. The same figures the page shows are written into a
// spreadsheet file or a PDF, with the total row at the bottom of both.

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { reportFileName, reportToCsv, reportToPdf } from '@/features/reports/export';
import { runReport } from '@/features/reports/queries/run-report';
import { reportRequestSchema } from '@/features/reports/validation/report';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { recordAuditEntry } from '@/lib/audit/record';
import { errorResponse, HTTP_STATUS } from '@/lib/http/responses';
import { logger } from '@/lib/logger';
import { toFieldErrors } from '@/lib/validation/primitives';

export const dynamic = 'force-dynamic';

export interface ReportRouteContext {
  /** Route parameters of the request. */
  params: { reportKey: string };
}

/**
 * Answers a report download request.
 *
 * @param request Incoming request, carrying the period in the query string.
 * @param context Route parameters of the request.
 * @returns The file, or an error in the usual shape.
 */
export async function GET(
  request: NextRequest,
  context: ReportRouteContext
): Promise<NextResponse> {
  const user = await getSessionUser();

  if (!user) {
    return errorResponse(
      'Sign in to download this report.',
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

  if (!can(user, 'reports', 'export')) {
    return errorResponse(
      'You do not have permission to export reports.',
      HTTP_STATUS.forbidden,
      'forbidden'
    );
  }

  const parsed = reportRequestSchema.safeParse({
    reportKey: context.params.reportKey,
    fromDate: request.nextUrl.searchParams.get('from') ?? undefined,
    toDate: request.nextUrl.searchParams.get('to') ?? undefined,
    format: request.nextUrl.searchParams.get('format') ?? undefined,
  });

  if (!parsed.success) {
    return errorResponse(
      'That report request is not valid.',
      HTTP_STATUS.unprocessable,
      'validation_failed',
      toFieldErrors(parsed.error)
    );
  }

  const report = await runReport(parsed.data.reportKey, company.id, company.baseCurrency, {
    fromDate: parsed.data.fromDate,
    toDate: parsed.data.toDate,
  });

  if (report === null) {
    return errorResponse('That report does not exist.', HTTP_STATUS.notFound, 'not_found');
  }

  if (report.isDegraded) {
    logger.error(
      'A report was exported while the figures could not be read',
      new Error('report_degraded'),
      { companyId: company.id, reportKey: report.reportKey }
    );
  }

  await recordAuditEntry({
    action: 'export',
    entityType: 'report',
    entityId: null,
    companyId: company.id,
    description: `Report ${report.title} exported as ${parsed.data.format.toUpperCase()}.`,
  });

  const companyName = company.displayName;

  if (parsed.data.format === 'pdf') {
    const file = reportToPdf(report, companyName);

    return new NextResponse(Buffer.from(file), {
      status: HTTP_STATUS.ok,
      headers: {
        'content-type': 'application/pdf',
        'content-disposition': `attachment; filename="${reportFileName(report, 'pdf')}"`,
        'cache-control': 'no-store',
        'referrer-policy': 'no-referrer',
      },
    });
  }

  return new NextResponse(reportToCsv(report, companyName), {
    status: HTTP_STATUS.ok,
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="${reportFileName(report, 'csv')}"`,
      'cache-control': 'no-store',
      'referrer-policy': 'no-referrer',
    },
  });
}
