'use client';

import { useEffect, useState, type ReactNode } from 'react';
import type { AccountRole } from '@/types/auth';
import type { SearchActor, SearchDocument } from '@/lib/core/types';
import { useAppStore, useNotificationStore } from '@/stores';
import { CommandPalette } from './command-palette';
import { MobileNav } from './mobile-nav';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

export interface AppShellProps {
  readonly role: AccountRole | null;
  readonly children: ReactNode;
  readonly brandName?: string;
  readonly brandMark?: ReactNode;
  readonly companyName?: string;
  readonly userName?: string;
  readonly userEmail?: string;
  readonly userAvatarUrl?: string | null;
  readonly notificationCount?: number;
  readonly searchDocuments?: readonly SearchDocument[];
  readonly searchActor?: SearchActor;
  readonly searchCompanyId?: string;
}

export function AppShell({
  role,
  children,
  brandName,
  brandMark,
  companyName,
  userName,
  userEmail,
  userAvatarUrl,
  notificationCount,
  searchDocuments = [],
  searchActor,
  searchCompanyId,
}: AppShellProps): ReactNode {
  const { isSidebarOpen, isMobileNavOpen, setSidebarOpen, setMobileNavOpen } = useAppStore();
  const storeNotificationCount = useNotificationStore((state) => state.unreadCount);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const resolvedNotificationCount = notificationCount ?? storeNotificationCount;

  useEffect(() => {
    const openPalette = () => setCommandPaletteOpen(true);
    const handleKeyboard = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openPalette();
      }
    };
    window.addEventListener('open-command-palette', openPalette);
    window.addEventListener('keydown', handleKeyboard);
    return () => {
      window.removeEventListener('open-command-palette', openPalette);
      window.removeEventListener('keydown', handleKeyboard);
    };
  }, []);
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        role={role}
        collapsed={!isSidebarOpen}
        onCollapsedChange={(collapsed) => setSidebarOpen(!collapsed)}
        brandName={brandName}
        brandMark={brandMark}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar
          role={role}
          onMobileMenuClick={() => setMobileNavOpen(true)}
          onCommandPaletteClick={() => setCommandPaletteOpen(true)}
          notificationCount={resolvedNotificationCount}
          userName={userName}
          userEmail={userEmail}
          userAvatarUrl={userAvatarUrl}
          companyName={companyName}
        />
        <main className="mx-auto w-full max-w-content flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
      <MobileNav
        role={role}
        open={isMobileNavOpen}
        onOpenChange={setMobileNavOpen}
        brandName={brandName}
      />
      <CommandPalette
        role={role}
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        searchDocuments={searchDocuments}
        searchActor={searchActor}
        searchCompanyId={searchCompanyId}
      />
    </div>
  );
}
