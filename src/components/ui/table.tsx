// src/components/ui/table.tsx
// The table used by every list in the product. On a narrow screen it scrolls
// sideways inside its own region rather than breaking the page layout.

import {
  type HTMLAttributes,
  type ReactNode,
  type TdHTMLAttributes,
  type ThHTMLAttributes,
} from 'react';

import { cn } from '@/lib/utils';

export interface TableProps extends HTMLAttributes<HTMLTableElement> {
  /** Description announced to a screen reader. */
  caption?: ReactNode;
}

/**
 * Renders a scrollable table region.
 *
 * @param props Table attributes and caption.
 * @returns The rendered table.
 */
export function Table({ className, caption, children, ...props }: TableProps) {
  return (
    <div
      className="w-full overflow-x-auto rounded-lg border border-border"
      tabIndex={0}
      role="region"
      aria-label={typeof caption === 'string' ? caption : 'Data table'}
    >
      <table className={cn('w-full border-collapse text-sm', className)} {...props}>
        {caption ? <caption className="visually-hidden">{caption}</caption> : null}
        {children}
      </table>
    </div>
  );
}

/**
 * Renders the header rows of a table.
 *
 * @param props Standard section attributes.
 * @returns The rendered header.
 */
export function TableHeader({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <thead className={cn('bg-surface-muted', className)} {...props} />;
}

/**
 * Renders the body rows of a table.
 *
 * @param props Standard section attributes.
 * @returns The rendered body.
 */
export function TableBody({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return <tbody className={cn('divide-y divide-border', className)} {...props} />;
}

/**
 * Renders the totals row of a table.
 *
 * @param props Standard section attributes.
 * @returns The rendered footer.
 */
export function TableFooter({ className, ...props }: HTMLAttributes<HTMLTableSectionElement>) {
  return (
    <tfoot
      className={cn('border-t-2 border-border bg-surface-muted font-semibold', className)}
      {...props}
    />
  );
}

/**
 * Renders one row.
 *
 * @param props Standard row attributes.
 * @returns The rendered row.
 */
export function TableRow({ className, ...props }: HTMLAttributes<HTMLTableRowElement>) {
  return <tr className={cn('transition-colors hover:bg-surface-muted/60', className)} {...props} />;
}

export interface TableHeadProps extends ThHTMLAttributes<HTMLTableCellElement> {
  /** Aligns the column to the right, used for money and counts. */
  isNumeric?: boolean;
}

/**
 * Renders a header cell.
 *
 * @param props Cell attributes and alignment.
 * @returns The rendered header cell.
 */
export function TableHead({ className, isNumeric = false, ...props }: TableHeadProps) {
  return (
    <th
      scope="col"
      className={cn(
        'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground',
        isNumeric ? 'text-right' : '',
        className
      )}
      {...props}
    />
  );
}

export interface TableCellProps extends TdHTMLAttributes<HTMLTableCellElement> {
  /** Aligns the cell to the right and lines the digits up. */
  isNumeric?: boolean;
}

/**
 * Renders a body cell.
 *
 * @param props Cell attributes and alignment.
 * @returns The rendered cell.
 */
export function TableCell({ className, isNumeric = false, ...props }: TableCellProps) {
  return (
    <td
      className={cn(
        'px-4 py-3 align-middle text-foreground',
        isNumeric ? 'tabular text-right' : '',
        className
      )}
      {...props}
    />
  );
}
