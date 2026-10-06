// src/app/(accountant)/accountant/[companyId]/page.tsx
// One set of books, read over a chosen period: the headline figures, the
// trial balance, the trading result, the position, and the entries behind
// all of it.

import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { BooksSummary } from '@/components/accountant/books-summary';
import { JournalEntryList } from '@/components/accountant/journal-entry-list';
import { LedgerReportTable } from '@/components/accountant/ledger-report-table';
import { PeriodFilter } from '@/components/accountant/period-filter';
import { TrialBalanceTable } from '@/components/accountant/trial-balance-table';
import { VisitRecorder } from '@/components/accountant/visit-recorder';
import { Alert } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PageHeader } from '@/components/ui/page-header';
import { ROUTES } from '@/config/app';
import { loadCompanyBooks } from '@/features/accountants/queries/get-company-books';
import { loadAccountantWorkspaces } from '@/features/accountants/queries/list-workspaces';
import { getSessionUser } from '@/lib/auth/session';
import { formatDate } from '@/lib/dates';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildMetadata({
  title: 'Books',
  description: 'The ledger, the reports and the entries of one business.',
  path: ROUTES.accountant,
  noIndex: true,
});

export interface AccountantBooksPageProps {
  /** The business being opened. */
  params: { companyId: string };
  /** The period asked for in the address bar. */
  searchParams: { from?: string; to?: string };
}

const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Chooses the period to read, defaulting to the year to date.
 *
 * @param searchParams Query values from the address bar.
 * @returns The first and last day of the period.
 */
function resolvePeriod(searchParams: { from?: string; to?: string }): {
  from: string;
  to: string;
} {
  const today = new Date();
  const defaultTo = today.toISOString().slice(0, 10);
  const defaultFrom = `${today.getUTCFullYear()}-01-01`;

  const from =
    searchParams.from !== undefined && ISO_DAY.test(searchParams.from)
      ? searchParams.from
      : defaultFrom;
  const to =
    searchParams.to !== undefined && ISO_DAY.test(searchParams.to) ? searchParams.to : defaultTo;

  return from <= to ? { from, to } : { from: to, to: from };
}

/**
 * Renders the books of one business.
 *
 * @param props The business and the period asked for.
 * @returns The rendered page.
 */
export default async function AccountantBooksPage({
  params,
  searchParams,
}: AccountantBooksPageProps) {
  const user = await getSessionUser();

  if (!user) {
    redirect(ROUTES.login);
  }

  const { workspaces } = await loadAccountantWorkspaces();
  const workspace = workspaces.find((entry) => entry.companyId === params.companyId);

  if (workspace === undefined && user.role !== 'super_admin') {
    notFound();
  }

  const period = resolvePeriod(searchParams);
  const books = await loadCompanyBooks(params.companyId, period.from, period.to);

  if (books === null) {
    notFound();
  }

  const basePath = `${ROUTES.accountant}/${params.companyId}`;

  return (
    <div className="space-y-6">
      <VisitRecorder companyId={params.companyId} />

      <PageHeader
        title={books.displayName}
        description={`Books for ${formatDate(books.periodStart)} to ${formatDate(books.periodEnd)}, kept in ${books.baseCurrency}.`}
        actions={
          <Link
            href={ROUTES.accountant}
            className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}
          >
            All businesses
          </Link>
        }
      />

      {books.isDegraded ? (
        <Alert tone="warning" title="Part of the ledger could not be read">
          What is shown is correct as far as it goes, but do not file anything from this page until
          it loads in full.
        </Alert>
      ) : null}

      {books.isBalanced ? null : (
        <Alert tone="danger" title="This ledger does not balance">
          Debits and credits disagree. Write to support before you close the period.
        </Alert>
      )}

      <BooksSummary books={books} />

      <PeriodFilter
        basePath={basePath}
        periodStart={books.periodStart}
        periodEnd={books.periodEnd}
      />

      <Card>
        <CardHeader>
          <CardTitle>Trial balance</CardTitle>
          <CardDescription>
            Every account that moved in the period, with the two columns that have to agree.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TrialBalanceTable lines={books.trialBalance} currency={books.baseCurrency} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Profit and loss</CardTitle>
          <CardDescription>What the business earned and spent over the period.</CardDescription>
        </CardHeader>
        <CardContent>
          <LedgerReportTable
            lines={books.profitAndLoss}
            currency={books.baseCurrency}
            caption="Profit and loss for the period"
            totalLabel="TOTAL"
            emptyTitle="Nothing was earned or spent in this period"
            emptyDescription="Widen the period, or check that the business has issued its invoices."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Balance sheet</CardTitle>
          <CardDescription>
            What the business owned and owed on {formatDate(books.periodEnd)}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LedgerReportTable
            lines={books.balanceSheet}
            currency={books.baseCurrency}
            caption="Balance sheet on the closing date"
            totalLabel="TOTAL"
            emptyTitle="There is nothing on the balance sheet yet"
            emptyDescription="Assets and liabilities appear here as soon as the first entries are posted."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Journal</CardTitle>
          <CardDescription>
            The fifty most recent entries, with the document that produced each one.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <JournalEntryList entries={books.entries} />
        </CardContent>
      </Card>
    </div>
  );
}
