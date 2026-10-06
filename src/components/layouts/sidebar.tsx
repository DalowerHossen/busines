'use client';

import Link from 'next/link';
import { ChevronDown, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { AccountRole } from '@/types/auth';
import type { NavItem } from '@/config/navigation';
import { getVisibleNavigation } from './navigation-utils';
import { getNavIcon } from './nav-icons';
import { cn } from '@/lib/cn';
import { IconButton } from '@/components/ui';

export interface SidebarProps {
  readonly role: AccountRole | null;
  readonly collapsed: boolean;
  readonly onCollapsedChange: (collapsed: boolean) => void;
  readonly brandName?: string;
  readonly brandMark?: ReactNode;
}

export function Sidebar({
  role,
  collapsed,
  onCollapsedChange,
  brandName = 'KD SOLUTION IT',
  brandMark,
}: SidebarProps): ReactNode {
  const pathname = usePathname() ?? '/';
  const items = getVisibleNavigation(role);
  return (
    <aside
      className={cn(
        'hidden h-screen shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground transition-[width] duration-slow ease-standard lg:flex',
        collapsed ? 'w-sidebar-collapsed' : 'w-sidebar'
      )}
      aria-label="Primary navigation"
    >
      <div
        className={cn(
          'flex h-topbar items-center border-b border-sidebar-border px-4',
          collapsed ? 'justify-center' : 'gap-3'
        )}
      >
        {brandMark ?? (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary font-heading text-sm font-bold text-primary-foreground">
            K
          </span>
        )}
        {!collapsed ? (
          <span className="truncate font-heading text-sm font-bold tracking-tight">
            {brandName}
          </span>
        ) : null}
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-3" aria-label="Workspace">
        {items.map((item) => (
          <SidebarItem key={item.key} item={item} pathname={pathname} collapsed={collapsed} />
        ))}
      </nav>
      <div
        className={cn(
          'border-t border-sidebar-border p-3',
          collapsed ? 'flex justify-center' : 'flex justify-end'
        )}
      >
        <IconButton
          label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          variant="quiet"
          className="text-sidebar-muted hover:bg-sidebar-active/15 hover:text-sidebar-foreground"
          onClick={() => onCollapsedChange(!collapsed)}
        >
          {collapsed ? (
            <ChevronsRight className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronsLeft className="h-4 w-4" aria-hidden="true" />
          )}
        </IconButton>
      </div>
    </aside>
  );
}

function SidebarItem({
  item,
  pathname,
  collapsed,
}: {
  readonly item: NavItem;
  readonly pathname: string;
  readonly collapsed: boolean;
}): ReactNode {
  const hasChildren = Boolean(item.children?.length);
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const [expanded, setExpanded] = useState(isActive);
  const Icon = getNavIcon(item.iconName);
  return (
    <div>
      <div className="flex items-center gap-1">
        <Link
          href={item.href}
          aria-current={isActive ? 'page' : undefined}
          title={collapsed ? item.label : undefined}
          className={cn(
            'flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-md px-3 text-sm font-medium text-sidebar-muted transition-colors duration-fast hover:bg-sidebar-active/15 hover:text-sidebar-foreground',
            isActive && 'bg-sidebar-active text-white shadow-brand',
            collapsed && 'justify-center px-0'
          )}
        >
          <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
          {!collapsed ? <span className="truncate">{item.label}</span> : null}
        </Link>
        {hasChildren && !collapsed ? (
          <button
            type="button"
            aria-label={`${expanded ? 'Collapse' : 'Expand'} ${item.label}`}
            aria-expanded={expanded}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-sidebar-muted hover:bg-sidebar-active/15 hover:text-sidebar-foreground"
            onClick={() => setExpanded((value) => !value)}
          >
            <ChevronDown
              className={cn('h-4 w-4 transition-transform duration-fast', expanded && 'rotate-180')}
              aria-hidden="true"
            />
          </button>
        ) : null}
      </div>
      {hasChildren && expanded && !collapsed ? (
        <div className="ml-5 mt-1 space-y-1 border-l border-sidebar-border pl-3">
          {item.children?.map((child) => (
            <SidebarItem key={child.key} item={child} pathname={pathname} collapsed={false} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
