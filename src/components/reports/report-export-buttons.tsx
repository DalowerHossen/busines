// src/components/reports/report-export-buttons.tsx
// The two download buttons every report carries.

import { Download, FileSpreadsheet } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface ReportExportButtonsProps {
  /** Key of the report being downloaded. */
  reportKey: string;
  /** First day of the period. */
  fromDate: string;
  /** Last day of the period. */
  toDate: string;
  /** False when the account may not export. */
  canExport: boolean;
}

/**
 * Renders the download buttons for one report.
 *
 * @param props The report, the period and whether downloads are allowed.
 * @returns The rendered buttons.
 */
export function ReportExportButtons({
  reportKey,
  fromDate,
  toDate,
  canExport,
}: ReportExportButtonsProps) {
  if (!canExport) {
    return (
      <p className="text-sm text-muted-foreground">
        Ask the owner for permission to export if you need this as a file.
      </p>
    );
  }

  const query = `from=${fromDate}&to=${toDate}`;

  return (
    <div className="flex flex-wrap gap-2">
      <a
        href={`/api/reports/${reportKey}?${query}&format=csv`}
        className={cn(buttonVariants({ variant: 'secondary' }))}
        rel="noopener"
      >
        <FileSpreadsheet aria-hidden="true" className="mr-2 h-4 w-4" />
        Spreadsheet
      </a>
      <a
        href={`/api/reports/${reportKey}?${query}&format=pdf`}
        className={cn(buttonVariants({ variant: 'secondary' }))}
        rel="noopener"
      >
        <Download aria-hidden="true" className="mr-2 h-4 w-4" />
        PDF
      </a>
    </div>
  );
}
