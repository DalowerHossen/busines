'use client';

import { Filter, Search, X } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button, Input } from '@/components/ui';
import { cn } from '@/lib/cn';

export interface DataTableToolbarProps {
  readonly searchValue: string;
  readonly onSearchChange: (value: string) => void;
  readonly searchPlaceholder?: string;
  readonly filterContent?: ReactNode;
  readonly hasActiveFilters?: boolean;
  readonly onClearFilters?: () => void;
  readonly resultLabel?: string;
  readonly className?: string;
}

export function DataTableToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search records',
  filterContent,
  hasActiveFilters = false,
  onClearFilters,
  resultLabel,
  className,
}: DataTableToolbarProps): ReactNode {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-border bg-card p-3 shadow-xs sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-sm">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9"
          />
        </div>
        {filterContent ? (
          <div className="flex items-center gap-2">
            <Filter className="hidden h-4 w-4 text-muted-foreground sm:block" aria-hidden="true" />
            {filterContent}
          </div>
        ) : null}
        {hasActiveFilters && onClearFilters ? (
          <Button
            type="button"
            variant="quiet"
            size="sm"
            onClick={onClearFilters}
            leftIcon={<X className="h-4 w-4" aria-hidden="true" />}
          >
            Clear
          </Button>
        ) : null}
      </div>
      {resultLabel ? (
        <span className="shrink-0 text-xs font-medium text-muted-foreground">{resultLabel}</span>
      ) : null}
    </div>
  );
}
