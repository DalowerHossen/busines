// src/components/ui/pagination.tsx
// The footer under every list: which rows are shown, how many there are in
// total, and the controls to move between pages.

'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { PAGE_SIZES } from '@/config/app';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  /** Page currently shown, counting from one. */
  page: number;
  /** Rows shown on one page. */
  pageSize: number;
  /** Rows matching the filter in total. */
  totalCount: number;
  /** Called with the page to move to. */
  onPageChange: (page: number) => void;
  /** Called with the new page size. */
  onPageSizeChange?: (pageSize: number) => void;
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders the paging controls under a list.
 *
 * @param props Current page, size and total.
 * @returns The rendered controls.
 */
export function Pagination({
  page,
  pageSize,
  totalCount,
  onPageChange,
  onPageSizeChange,
  className,
}: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const firstRow = totalCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastRow = Math.min(page * pageSize, totalCount);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-between gap-3 border-t border-border px-4 py-3 sm:flex-row',
        className
      )}
    >
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Showing {formatNumber(firstRow)} to {formatNumber(lastRow)} of {formatNumber(totalCount)}{' '}
        {totalCount === 1 ? 'record' : 'records'}
      </p>

      <div className="flex items-center gap-3">
        {onPageSizeChange ? (
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="whitespace-nowrap">Rows per page</span>
            <Select
              aria-label="Rows per page"
              className="h-9 w-20"
              value={String(pageSize)}
              options={PAGE_SIZES.map((size) => ({ value: String(size), label: String(size) }))}
              onChange={(event) => {
                onPageSizeChange(Number.parseInt(event.target.value, 10));
              }}
            />
          </label>
        ) : null}

        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Previous page"
            disabled={page <= 1}
            onClick={() => {
              onPageChange(page - 1);
            }}
          >
            <ChevronLeft aria-hidden="true" className="h-4 w-4" />
          </Button>
          <span className="px-2 text-sm text-foreground">
            Page {formatNumber(page)} of {formatNumber(totalPages)}
          </span>
          <Button
            variant="outline"
            size="icon"
            aria-label="Next page"
            disabled={page >= totalPages}
            onClick={() => {
              onPageChange(page + 1);
            }}
          >
            <ChevronRight aria-hidden="true" className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
