// src/components/developers/connected-app-list.tsx
// What is reading this account, and the one button that stops it.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { notify } from '@/components/ui/toaster';
import { disconnectApp } from '@/features/developers/actions/disconnect-app';
import { describeScope } from '@/features/developers/scopes';
import type { ConnectedApp } from '@/features/developers/types';
import { formatDateTime } from '@/lib/dates';
import { formatNumber } from '@/lib/format';

export interface ConnectedAppListProps {
  /** The applications connected to this account. */
  apps: readonly ConnectedApp[];
  /** False when the signed in account may only read. */
  canManage: boolean;
}

/**
 * Renders the connected applications of one business.
 *
 * @param props The grants and what the viewer may do.
 * @returns The rendered list.
 */
export function ConnectedAppList({ apps, canManage }: ConnectedAppListProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Disconnects one application.
   *
   * @param app Grant being closed.
   * @returns Nothing.
   */
  async function onDisconnect(app: ConnectedApp): Promise<void> {
    setBusyId(app.installId);
    setFailure(null);

    const result = await disconnectApp({
      installId: app.installId,
      reason: 'Disconnected from the settings page',
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(`${app.appName} can no longer read this account.`);
    router.refresh();
  }

  const live = apps.filter((app) => app.status === 'active');
  const past = apps.filter((app) => app.status !== 'active');

  return (
    <div className="space-y-4">
      {failure ? (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      ) : null}

      {live.length === 0 ? (
        <EmptyState
          title="Nothing is connected to this account"
          description="When you connect an automation service or a tool of your own, it appears here and can be cut off in one click."
        />
      ) : (
        <ul className="space-y-3">
          {live.map((app) => (
            <li key={app.installId}>
              <Card>
                <CardContent className="flex flex-wrap items-start justify-between gap-3 pt-6">
                  <div className="space-y-1">
                    <p className="font-medium">{app.appName}</p>
                    <p className="text-sm text-muted-foreground">
                      Connected {formatDateTime(app.installedAt)} · {formatNumber(app.requestCount)}{' '}
                      requests ·{' '}
                      {app.lastUsedAt === null
                        ? 'not used yet'
                        : `last used ${formatDateTime(app.lastUsedAt)}`}
                    </p>
                    <ul className="flex flex-wrap gap-2 pt-1">
                      {app.grantedScopes.map((scope) => (
                        <li key={scope}>
                          <Badge tone={describeScope(scope).isWrite ? 'warning' : 'neutral'}>
                            {describeScope(scope).label}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {canManage ? (
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      isLoading={busyId === app.installId}
                      loadingLabel="Disconnecting"
                      onClick={() => {
                        void onDisconnect(app);
                      }}
                    >
                      Disconnect
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {past.length > 0 ? (
        <Card>
          <CardContent className="space-y-2 pt-6">
            <p className="text-sm font-medium">Previously connected</p>
            <ul className="space-y-1 text-sm text-muted-foreground">
              {past.map((app) => (
                <li key={app.installId}>
                  {app.appName} · disconnected after {formatNumber(app.requestCount)} requests
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
