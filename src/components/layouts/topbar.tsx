'use client';

import Link from 'next/link';
import { Bell, Command, Menu, Search } from 'lucide-react';
import type { ReactNode } from 'react';
import type { AccountRole } from '@/types/auth';
import { Avatar, IconButton } from '@/components/ui';
import { Breadcrumb } from './breadcrumb';

export interface TopbarProps {
  readonly role: AccountRole | null;
  readonly onMobileMenuClick: () => void;
  readonly onCommandPaletteClick: () => void;
  readonly notificationCount?: number;
  readonly userName?: string;
  readonly userEmail?: string;
  readonly userAvatarUrl?: string | null;
  readonly companyName?: string;
}

export function Topbar({
  role,
  onMobileMenuClick,
  onCommandPaletteClick,
  notificationCount = 0,
  userName = 'Account',
  userEmail,
  userAvatarUrl,
  companyName,
}: TopbarProps): ReactNode {
  return (
    <header className="sticky top-0 z-header flex min-h-topbar items-center justify-between gap-3 border-b border-border bg-background/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <IconButton
          label="Open navigation"
          variant="quiet"
          className="lg:hidden"
          onClick={onMobileMenuClick}
        >
          <Menu className="h-5 w-5" aria-hidden="true" />
        </IconButton>
        <div className="hidden min-w-0 md:block">
          <Breadcrumb role={role} />
        </div>
        <div className="min-w-0 md:hidden">
          <span className="truncate text-sm font-semibold text-foreground">
            {companyName ?? 'Workspace'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
        <button
          type="button"
          className="hidden h-10 min-w-40 items-center justify-between gap-3 rounded-md border border-border bg-surface px-3 text-sm text-muted-foreground shadow-xs transition-colors hover:border-brand-300 hover:text-foreground md:flex"
          onClick={onCommandPaletteClick}
        >
          <span className="flex items-center gap-2">
            <Search className="h-4 w-4" aria-hidden="true" />
            Search
          </span>
          <kbd className="rounded border border-border bg-surface-muted px-1.5 py-0.5 font-mono text-[10px]">
            ⌘K
          </kbd>
        </button>
        <IconButton
          label="Open command palette"
          variant="quiet"
          className="md:hidden"
          onClick={onCommandPaletteClick}
        >
          <Command className="h-5 w-5" aria-hidden="true" />
        </IconButton>
        <Link
          href="/notifications"
          aria-label={
            notificationCount > 0 ? `${notificationCount} unread notifications` : 'Notifications'
          }
          className="relative flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground hover:bg-surface-muted hover:text-foreground"
        >
          <Bell className="h-5 w-5" aria-hidden="true" />
          {notificationCount > 0 ? (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-white">
              {notificationCount > 99 ? '99+' : notificationCount}
            </span>
          ) : null}
        </Link>
        <div className="ml-1 flex items-center gap-2 border-l border-border pl-2 sm:pl-3">
          <Avatar src={userAvatarUrl} alt={userName} fallback={userName} size="sm" />
          <div className="hidden min-w-0 max-w-36 lg:block">
            <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
            {userEmail ? (
              <p className="truncate text-xs text-muted-foreground">{userEmail}</p>
            ) : null}
          </div>
        </div>
      </div>
    </header>
  );
}
