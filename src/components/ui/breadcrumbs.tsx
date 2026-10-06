// src/components/ui/breadcrumbs.tsx
// The trail above a page title, so a person always knows where they are and
// can step back one level.

import { ChevronRight } from 'lucide-react';
import Link from 'next/link';

import { cn } from '@/lib/utils';
import type { Breadcrumb } from '@/types/common';

export interface BreadcrumbsProps {
  /** The trail, from the top level down to the current page. */
  items: readonly Breadcrumb[];
  /** Extra classes for the wrapper. */
  className?: string;
}

/**
 * Renders the breadcrumb trail.
 *
 * @param props The trail to render.
 * @returns The rendered breadcrumbs.
 */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  if (items.length === 0) {
    return null;
  }

  return (
    <nav aria-label="Breadcrumb" className={cn('text-sm', className)}>
      <ol className="flex flex-wrap items-center gap-1 text-muted-foreground">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-1">
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  className="rounded px-1 py-0.5 hover:text-foreground hover:underline"
                >
                  {item.label}
                </Link>
              ) : (
                <span
                  aria-current={isLast ? 'page' : undefined}
                  className="px-1 py-0.5 text-foreground"
                >
                  {item.label}
                </span>
              )}
              {!isLast ? (
                <ChevronRight aria-hidden="true" className="h-4 w-4 text-muted-foreground" />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
