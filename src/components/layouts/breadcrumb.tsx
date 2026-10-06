'use client';

import Link from 'next/link';
import { ChevronRight, Home } from 'lucide-react';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import type { AccountRole } from '@/types/auth';
import { buildBreadcrumbs, type BreadcrumbItem } from './navigation-utils';
import { cn } from '@/lib/cn';

export function Breadcrumb({
  role,
  items,
  className,
}: {
  readonly role: AccountRole | null;
  readonly items?: readonly BreadcrumbItem[];
  readonly className?: string;
}): ReactNode {
  const pathname = usePathname() ?? '/';
  const breadcrumbs = items ?? buildBreadcrumbs(pathname, role);
  if (breadcrumbs.length === 0) return null;
  return (
    <nav
      aria-label="Breadcrumb"
      className={cn('flex min-w-0 items-center gap-1.5 text-sm text-muted-foreground', className)}
    >
      <Link
        href="/dashboard"
        aria-label="Dashboard"
        className="shrink-0 rounded-sm p-1 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Home className="h-4 w-4" aria-hidden="true" />
      </Link>
      {breadcrumbs.map((item, index) => (
        <span key={`${item.label}-${index}`} className="flex min-w-0 items-center gap-1.5">
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          {item.href && index !== breadcrumbs.length - 1 ? (
            <Link href={item.href} className="truncate hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="truncate font-medium text-foreground">
              {item.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
