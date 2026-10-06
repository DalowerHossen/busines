'use client';

import Link from 'next/link';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AccountRole } from '@/types/auth';
import type { NavItem } from '@/config/navigation';
import { Sheet, SheetContent, SheetDescription, SheetTitle, IconButton } from '@/components/ui';
import { getVisibleNavigation } from './navigation-utils';
import { getNavIcon } from './nav-icons';
import { cn } from '@/lib/cn';

export function MobileNav({
  role,
  open,
  onOpenChange,
  brandName = 'KD SOLUTION IT',
}: {
  readonly role: AccountRole | null;
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly brandName?: string;
}): ReactNode {
  const items = getVisibleNavigation(role);
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        showClose={false}
        className="w-[min(86vw,20rem)] bg-sidebar p-0 text-sidebar-foreground"
      >
        <div className="flex h-topbar items-center justify-between border-b border-sidebar-border px-4">
          <SheetTitle className="text-sm text-sidebar-foreground">{brandName}</SheetTitle>
          <SheetDescription className="sr-only">Workspace navigation</SheetDescription>
          <IconButton
            label="Close navigation"
            variant="quiet"
            className="text-sidebar-muted hover:bg-sidebar-active/15 hover:text-sidebar-foreground"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </IconButton>
        </div>
        <nav className="space-y-1 overflow-y-auto p-3" aria-label="Mobile workspace navigation">
          {items.map((item) => (
            <MobileNavItem key={item.key} item={item} onNavigate={() => onOpenChange(false)} />
          ))}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function MobileNavItem({
  item,
  onNavigate,
}: {
  readonly item: NavItem;
  readonly onNavigate: () => void;
}): ReactNode {
  const Icon = getNavIcon(item.iconName);
  return (
    <div>
      <Link
        href={item.href}
        onClick={onNavigate}
        className="flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-muted hover:bg-sidebar-active/15 hover:text-sidebar-foreground"
      >
        <Icon className="h-4 w-4" aria-hidden="true" />
        {item.label}
      </Link>
      {item.children?.length ? (
        <div className="ml-5 mt-1 space-y-1 border-l border-sidebar-border pl-3">
          {item.children.map((child) => {
            const ChildIcon = getNavIcon(child.iconName);
            return (
              <Link
                key={child.key}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  'flex min-h-10 items-center gap-3 rounded-md px-3 text-sm text-sidebar-muted hover:bg-sidebar-active/15 hover:text-sidebar-foreground'
                )}
              >
                <ChildIcon className="h-4 w-4" aria-hidden="true" />
                {child.label}
              </Link>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
