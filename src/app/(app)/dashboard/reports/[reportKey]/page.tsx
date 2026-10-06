// src/app/(app)/dashboard/reports/[reportKey]/page.tsx
// One report, worked out for the chosen period and ready to download.

import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';

import { ReportExportButtons } from '@/components/reports/report-export-buttons';
import { ReportFilters } from '@/components/reports/report-filters';
import { ReportTable } from '@/components/reports/report-table';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { runReport } from '@/features/reports/queries/run-report';
import { findReport } from '@/features/reports/registry';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { addMonthsIso, todayIso } from '@/lib/dates';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Report',
  description: 'One report for the period you chose, with its total row.',
  path: ROUTES.reports,
  noIndex: true,
});

export interface ReportPageProps {
  /** Route parameters of the request. */
  params: { reportKey: string };
  /** Period read from the address bar. */
  searchParams: Record<string, string | string[] | undefined>;
}

/**
 * Reads one search parameter as text.
 *
 * @param value Raw value from the address bar.
 * @returns The text, or undefined when it is not a single value.
 */
function readParam(value: string | string[] | undefined): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

/**
 * Renders one report.
 *
 * @param props The route parameters and the period of the request.
 * @returns The rendered page.
 */
export default async function ReportPage({ params, searchParams }: ReportPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const definition = findReport(params.reportKey);

  if (definition === null) {
    notFound();
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader
          title={definition.title}
          description="This account is not attached to a business yet."
        />
        <Alert tone="warning" title="No business is attached to this account">
          Ask the owner of the business to invite you again, or write to support and we will put it
          right.
        </Alert>
      </>
    );
  }

  if (!can(user, 'reports', 'view')) {
    return (
      <>
        <PageHeader title={definition.title} description="You do not have access to the reports." />
        <Alert tone="warning" title="You cannot see reports">
          Ask the owner of this business to give your account permission to view reports.
        </Alert>
      </>
    );
  }

  const today = todayIso();
  const rawFrom = readParam(searchParams['from']) ?? addMonthsIso(today, -12);
  const rawTo = readParam(searchParams['to']) ?? today;
  const fromDate = rawTo < rawFrom ? rawTo : rawFrom;
  const toDate = rawTo < rawFrom ? rawFrom : rawTo;

  const report = await runReport(definition.key, company.id, company.baseCurrency, {
    fromDate,
    toDate,
  });

  if (report === null) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={report.title}
        description={`${report.description} Period: ${report.periodLabel}.`}
        breadcrumbs={[{ label: 'Reports', href: ROUTES.reports }, { label: report.title }]}
        actions={
          <ReportExportButtons
            reportKey={report.reportKey}
            fromDate={fromDate}
            toDate={toDate}
            canExport={can(user, 'reports', 'export')}
          />
        }
      />

      {report.isDegraded ? (
        <Alert tone="warning" title="The figures could not be read">
          Nothing has been lost. Refresh the page in a moment and the report will come back.
        </Alert>
      ) : null}

      <ReportFilters fromDate={fromDate} toDate={toDate} />

      <ReportTable report={report} />
    </div>
  );
}
