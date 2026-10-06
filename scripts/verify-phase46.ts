// scripts/verify-phase46.ts
// Static and behavioural checks for the dashboard, the tenant-scoped global
// search, the command palette and the notification centre.
//
// The demo fixtures this script used to assert against were removed when the
// dashboard was wired to the database, so the search and notification
// behaviour is now proven with fixtures owned by this script.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { searchGlobalDocuments } from '@/lib/core/search';
import type { SearchDocument } from '@/lib/core/types';
import { useNotificationStore } from '@/stores/notification-store';
import type { ISODateString, UUID } from '@/types/core';
import type { Notification } from '@/types/notification';

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(resolve(root, relativePath), 'utf8');
}

const COMPANY_ID = '10000000-0000-0000-0000-000000000001' as unknown as UUID;
const OTHER_COMPANY_ID = '10000000-0000-0000-0000-000000000002' as unknown as UUID;
const USER_ID = '00000000-0000-0000-0000-000000000001' as unknown as UUID;

const DOCUMENTS: readonly SearchDocument[] = [
  {
    id: 'doc-1',
    companyId: COMPANY_ID,
    entityType: 'client',
    title: 'Acme Studio',
    subtitle: 'Client',
    searchText: 'acme studio client',
    href: '/dashboard/clients/doc-1',
    updatedAt: '2026-10-01T09:00:00.000Z',
  },
  {
    id: 'doc-2',
    companyId: COMPANY_ID,
    entityType: 'invoice',
    title: 'INV-0001',
    subtitle: 'Acme Studio',
    searchText: 'inv-0001 acme studio',
    href: '/dashboard/invoices/doc-2',
    updatedAt: '2026-10-02T09:00:00.000Z',
  },
  {
    id: 'doc-3',
    companyId: OTHER_COMPANY_ID,
    entityType: 'client',
    title: 'Acme Rival',
    subtitle: 'Client',
    searchText: 'acme rival client',
    href: '/dashboard/clients/doc-3',
    updatedAt: '2026-10-03T09:00:00.000Z',
  },
];

const NOTIFICATIONS: readonly Notification[] = [
  {
    id: '20000000-0000-0000-0000-000000000001' as unknown as UUID,
    companyId: COMPANY_ID,
    createdAt: '2026-10-01T09:00:00.000Z' as unknown as ISODateString,
    updatedAt: '2026-10-01T09:00:00.000Z' as unknown as ISODateString,
    deletedAt: null,
    recipientUserId: USER_ID,
    type: 'invoice_paid',
    title: 'INV-0001 was paid',
    body: 'Acme Studio paid in full.',
    linkPath: '/dashboard/invoices/doc-2',
    readAt: null,
    deliveredChannels: ['in_app'],
  },
  {
    id: '20000000-0000-0000-0000-000000000002' as unknown as UUID,
    companyId: COMPANY_ID,
    createdAt: '2026-10-02T09:00:00.000Z' as unknown as ISODateString,
    updatedAt: '2026-10-02T09:00:00.000Z' as unknown as ISODateString,
    deletedAt: null,
    recipientUserId: USER_ID,
    type: 'invoice_overdue',
    title: 'INV-0002 is late',
    body: 'The due date has passed.',
    linkPath: null,
    readAt: null,
    deliveredChannels: ['in_app'],
  },
  {
    id: '20000000-0000-0000-0000-000000000003' as unknown as UUID,
    companyId: COMPANY_ID,
    createdAt: '2026-10-03T09:00:00.000Z' as unknown as ISODateString,
    updatedAt: '2026-10-03T09:00:00.000Z' as unknown as ISODateString,
    deletedAt: null,
    recipientUserId: USER_ID,
    type: 'system_announcement',
    title: 'Scheduled maintenance',
    body: 'A short maintenance window is planned.',
    linkPath: null,
    readAt: '2026-10-03T10:00:00.000Z' as unknown as ISODateString,
    deliveredChannels: ['in_app'],
  },
];

function main(): void {
  for (const relativePath of [
    'src/app/(app)/layout.tsx',
    'src/app/(app)/dashboard/page.tsx',
    'src/app/(app)/notifications/page.tsx',
    'src/features/dashboard/queries/overview.ts',
    'src/features/notifications/queries/list-notifications.ts',
    'src/features/dashboard/notification-center.tsx',
    'src/components/layout/command-palette.tsx',
    'src/components/layout/command-launcher.tsx',
  ]) {
    assert.equal(existsSync(resolve(root, relativePath)), true, `${relativePath} is missing.`);
  }

  // Search stays inside one tenant and refuses a platform wide scope.
  const actor = { userId: USER_ID, role: 'owner' as const, companyIds: [COMPANY_ID] };
  const searchResults = searchGlobalDocuments({
    actor,
    query: 'Acme',
    documents: DOCUMENTS,
    scope: { type: 'tenant', companyId: COMPANY_ID },
  });
  assert.equal(
    searchResults.some((result) => result.title.includes('Acme Studio')),
    true
  );
  assert.equal(
    searchResults.some((result) => result.title.includes('Acme Rival')),
    false,
    'search leaked a record from another tenant'
  );
  assert.throws(() =>
    searchGlobalDocuments({
      actor,
      query: 'invoice',
      documents: DOCUMENTS,
      scope: { type: 'platform' },
    })
  );

  // The notification store counts, marks and clears correctly.
  const notificationStore = useNotificationStore.getState();
  notificationStore.clear();
  NOTIFICATIONS.forEach((notification) => notificationStore.upsert(notification));
  assert.equal(useNotificationStore.getState().unreadCount, 2);
  const firstNotification = NOTIFICATIONS[0];
  assert.ok(firstNotification);
  notificationStore.markRead(firstNotification.id);
  assert.equal(useNotificationStore.getState().unreadCount, 1);
  notificationStore.markAllRead();
  assert.equal(useNotificationStore.getState().unreadCount, 0);
  notificationStore.clear();

  const commandPalette = read('src/components/layout/command-palette.tsx');
  assert.match(commandPalette, /searchGlobalDocuments/u);
  assert.match(commandPalette, /Records/u);
  assert.match(commandPalette, /Workspace/u);

  const launcher = read('src/components/layout/command-launcher.tsx');
  assert.match(launcher, /metaKey/u);

  // The workspace frame must guard the session rather than assume one.
  const shell = read('src/app/(app)/layout.tsx');
  assert.match(shell, /getSessionUser/u);
  assert.match(shell, /redirect\(ROUTES\.login\)/u);
  assert.doesNotMatch(shell, /company-demo/u);

  // The dashboard must read the database, not a fixture.
  const dashboard = read('src/app/(app)/dashboard/page.tsx');
  assert.match(dashboard, /loadDashboardOverview/u);
  assert.match(dashboard, /getSessionUser/u);

  const notificationCenter = read('src/features/dashboard/notification-center.tsx');
  assert.match(notificationCenter, /markAllRead/u);
  assert.match(notificationCenter, /aria-label="Notification filter"/u);

  process.stdout.write(
    'Phase 46 verification passed: database-backed dashboard, guarded workspace shell, tenant-scoped global search, keyboard command palette, and notification-centre state flows are covered.\n'
  );
}

main();
