// src/app/(app)/dashboard/reports/page.tsx
// The report library: every figure the business needs, each one downloadable
// as a spreadsheet or a PDF with its total row.

import type { Metadata } from 'next';
import { redirect } from 'next/navigation';

import { ReportFilters } from '@/components/reports/report-filters';
import { ReportLibrary } from '@/components/reports/report-library';
import { Alert } from '@/components/ui/alert';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadCompany } from '@/lib/auth/company-context';
import { can } from '@/lib/auth/permissions';
import { getSessionUser } from '@/lib/auth/session';
import { addMonthsIso, todayIso } from '@/lib/dates';
import { buildMetadata } from '@/lib/seo/metadata';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Reports',
  description: 'Revenue, receivables, tax and spending, ready to download.',
  path: ROUTES.reports,
  noIndex: true,
});

export interface ReportsPageProps {
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
 * Renders the report library.
 *
 * @param props The search parameters of the request.
 * @returns The rendered page.
 */
export default async function ReportsPage({ searchParams }: ReportsPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const company = user.companyId ? await loadCompany(user.companyId) : null;

  if (!company) {
    return (
      <>
        <PageHeader title="Reports" description="This account is not attached to a business yet." />
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
        <PageHeader title="Reports" description="You do not have access to the reports." />
        <Alert tone="warning" title="You cannot see reports">
          Ask the owner of this business to give your account permission to view reports.
        </Alert>
      </>
    );
  }

  const today = todayIso();
  const fromDate = readParam(searchParams['from']) ?? addMonthsIso(today, -12);
  const toDate = readParam(searchParams['to']) ?? today;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Every report ends with a total line, and downloads as a spreadsheet or a PDF."
      />

      <ReportFilters fromDate={fromDate} toDate={toDate} />

      <ReportLibrary fromDate={fromDate} toDate={toDate} />
    </div>
  );
}
