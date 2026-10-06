import type { ReactNode } from 'react';
import { EmptyState } from './empty-state';
import { ErrorState } from './error-state';
import { LoadingState } from './loading-state';
import { cn } from '@/lib/cn';

export interface DataTableColumn<TData> {
  readonly key: string;
  readonly header: ReactNode;
  readonly cell: (row: TData, rowIndex: number) => ReactNode;
  readonly className?: string;
  readonly headerClassName?: string;
}

export interface DataTableProps<TData> {
  readonly rows: readonly TData[];
  readonly columns: readonly DataTableColumn<TData>[];
  readonly getRowId: (row: TData, rowIndex: number) => string;
  readonly caption?: string;
  readonly isLoading?: boolean;
  readonly error?: string | null;
  readonly onRetry?: () => void;
  readonly emptyTitle?: string;
  readonly emptyDescription?: string;
  readonly emptyActionLabel?: string;
  readonly onEmptyAction?: () => void;
  readonly className?: string;
}

export function DataTable<TData>({
  rows,
  columns,
  getRowId,
  caption,
  isLoading = false,
  error = null,
  onRetry,
  emptyTitle = 'Nothing here yet',
  emptyDescription = 'New records will appear here when they are available.',
  emptyActionLabel,
  onEmptyAction,
  className,
}: DataTableProps<TData>): ReactNode {
  if (isLoading) return <LoadingState label="Loading records" />;
  if (error) return <ErrorState description={error} onRetry={onRetry} />;
  if (rows.length === 0)
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  return (
    <div
      className={cn('overflow-hidden rounded-xl border border-border bg-card shadow-sm', className)}
    >
      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-sm">
          {caption ? <caption className="sr-only">{caption}</caption> : null}
          <thead className="bg-surface-muted text-xs uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'whitespace-nowrap px-4 py-3 font-semibold',
                    column.headerClassName
                  )}
                >
                  {column.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row, rowIndex) => (
              <tr
                key={getRowId(row, rowIndex)}
                className="transition-colors duration-fast hover:bg-surface-raised"
              >
                {columns.map((column) => (
                  <td
                    key={column.key}
                    className={cn('px-4 py-3.5 align-middle text-foreground', column.className)}
                  >
                    {column.cell(row, rowIndex)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
