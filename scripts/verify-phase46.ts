import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  DASHBOARD_DATA,
  DASHBOARD_NOTIFICATIONS,
  DASHBOARD_SEARCH_DOCUMENTS,
} from '@/features/dashboard/dashboard-data';
import { searchGlobalDocuments } from '@/lib/core/search';
import { useNotificationStore } from '@/stores/notification-store';

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

function main(): void {
  for (const relativePath of [
    'src/app/(app)/layout.tsx',
    'src/app/(app)/dashboard/page.tsx',
    'src/app/(app)/notifications/page.tsx',
    'src/features/dashboard/dashboard-page.tsx',
    'src/features/dashboard/notification-center.tsx',
    'src/components/layouts/command-palette.tsx',
  ]) {
    assert.equal(existsSync(resolve(root, relativePath)), true, `${relativePath} is missing.`);
  }

  assert.equal(DASHBOARD_DATA.stats.length, 4);
  assert.equal(DASHBOARD_DATA.recentInvoices.length, 4);
  assert.equal(DASHBOARD_SEARCH_DOCUMENTS.length >= 5, true);
  assert.equal(DASHBOARD_NOTIFICATIONS.length, 3);

  const searchResults = searchGlobalDocuments({
    actor: { userId: 'user-owner-demo', role: 'owner', companyIds: ['company-demo'] },
    query: 'Acme',
    documents: DASHBOARD_SEARCH_DOCUMENTS,
    scope: { type: 'tenant', companyId: 'company-demo' },
  });
  assert.equal(
    searchResults.some((result) => result.title.includes('Acme Studio')),
    true
  );
  assert.throws(() =>
    searchGlobalDocuments({
      actor: { userId: 'user-owner-demo', role: 'owner', companyIds: ['company-demo'] },
      query: 'invoice',
      documents: DASHBOARD_SEARCH_DOCUMENTS,
      scope: { type: 'platform' },
    })
  );

  const notificationStore = useNotificationStore.getState();
  notificationStore.clear();
  DASHBOARD_NOTIFICATIONS.forEach((notification) => notificationStore.upsert(notification));
  assert.equal(useNotificationStore.getState().unreadCount, 2);
  const firstNotification = DASHBOARD_NOTIFICATIONS[0];
  assert.ok(firstNotification);
  notificationStore.markRead(firstNotification.id);
  assert.equal(useNotificationStore.getState().unreadCount, 1);
  notificationStore.markAllRead();
  assert.equal(useNotificationStore.getState().unreadCount, 0);
  notificationStore.clear();

  const commandPalette = read('src/components/layouts/command-palette.tsx');
  assert.match(commandPalette, /searchGlobalDocuments/u);
  assert.match(commandPalette, /Records/u);
  assert.match(commandPalette, /Workspace/u);
  const appShell = read('src/components/layouts/app-shell.tsx');
  assert.match(appShell, /open-command-palette/u);
  assert.match(appShell, /metaKey/u);
  assert.match(appShell, /notificationCount/u);
  const notificationCenter = read('src/features/dashboard/notification-center.tsx');
  assert.match(notificationCenter, /markAllRead/u);
  assert.match(notificationCenter, /aria-label="Notification filter"/u);

  process.stdout.write(
    'Phase 46 verification passed: dashboard overview, tenant-scoped global search, keyboard command palette, and notification-center state flows are covered.\n'
  );
}

main();
