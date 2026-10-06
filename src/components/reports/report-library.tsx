// src/components/reports/report-library.tsx
// The library of reports, grouped the way people think about them.

import Link from 'next/link';

import { REPORT_DEFINITIONS, REPORT_GROUP_LABELS } from '@/features/reports/registry';
import type { ReportDefinition } from '@/features/reports/types';
import { ROUTES } from '@/config/app';

export interface ReportLibraryProps {
  /** First day of the period the links carry. */
  fromDate: string;
  /** Last day of the period the links carry. */
  toDate: string;
}

/** The order the groups appear in. */
const GROUP_ORDER: ReportDefinition['group'][] = ['sales', 'money', 'clients', 'spending'];

/**
 * Renders the report library.
 *
 * @param props The period the links should open with.
 * @returns The rendered library.
 */
export function ReportLibrary({ fromDate, toDate }: ReportLibraryProps) {
  const query = `from=${fromDate}&to=${toDate}`;

  return (
    <div className="space-y-8">
      {GROUP_ORDER.map((group) => {
        const reports = REPORT_DEFINITIONS.filter((report) => report.group === group);

        if (reports.length === 0) {
          return null;
        }

        return (
          <section key={group} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              {REPORT_GROUP_LABELS[group]}
            </h2>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {reports.map((report) => (
                <li key={report.key}>
                  <Link
                    href={`${ROUTES.reports}/${report.key}?${query}`}
                    className="flex h-full flex-col rounded-lg border border-border bg-surface p-4 shadow-xs transition hover:border-primary hover:shadow-sm"
                  >
                    <span className="font-medium text-foreground">{report.title}</span>
                    <span className="mt-1 text-sm text-muted-foreground">{report.summary}</span>
                    <span className="mt-3 text-sm font-medium text-primary">Open report</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
