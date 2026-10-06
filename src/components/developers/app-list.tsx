// src/components/developers/app-list.tsx
// Everything the signed in account has built, and the one button that
// matters on each line: open it, or put it forward for review.

'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { RegisterAppForm } from '@/components/developers/register-app-form';
import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/config/app';
import type { DeveloperAppStatus, DeveloperAppSummary } from '@/features/developers/types';
import { formatDate } from '@/lib/dates';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface AppListProps {
  /** The applications to show. */
  apps: readonly DeveloperAppSummary[];
}

const STATUS_TONES: Readonly<
  Record<DeveloperAppStatus, 'neutral' | 'info' | 'success' | 'warning' | 'danger'>
> = {
  draft: 'neutral',
  in_review: 'info',
  approved: 'success',
  rejected: 'warning',
  suspended: 'danger',
  retired: 'neutral',
};

const STATUS_LABELS: Readonly<Record<DeveloperAppStatus, string>> = {
  draft: 'Draft',
  in_review: 'Waiting for review',
  approved: 'Approved',
  rejected: 'Changes requested',
  suspended: 'Suspended',
  retired: 'Retired',
};

/**
 * Renders the list of applications a builder owns.
 *
 * @param props The applications to show.
 * @returns The rendered list.
 */
export function AppList({ apps }: AppListProps) {
  const router = useRouter();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [newSecret, setNewSecret] = useState<{ clientId: string; clientSecret: string } | null>(
    null
  );

  return (
    <div className="space-y-4">
      {newSecret ? (
        <Alert tone="warning" title="Copy the secret now">
          <span className="block">
            This is the only time the secret is shown. Store it where your application reads its
            configuration from.
          </span>
          <span className="mt-2 block break-all font-mono text-sm">
            client_id: {newSecret.clientId}
          </span>
          <span className="block break-all font-mono text-sm">
            client_secret: {newSecret.clientSecret}
          </span>
        </Alert>
      ) : null}

      <div className="flex justify-end">
        <Button
          type="button"
          leadingIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
          onClick={() => setIsFormOpen(true)}
        >
          Register an application
        </Button>
      </div>

      {apps.length === 0 ? (
        <EmptyState
          title="You have not built anything yet"
          description="Register an application to connect your own tools, an automation service or a browser extension to this account."
        />
      ) : (
        <ul className="grid gap-4 md:grid-cols-2">
          {apps.map((app) => (
            <li key={app.appId}>
              <Card>
                <CardContent className="space-y-3 pt-6">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{app.appName}</p>
                      <p className="text-sm text-muted-foreground">
                        {app.tagline ?? `Connected through ${app.appType.replace('_', ' ')}`}
                      </p>
                    </div>
                    <Badge tone={STATUS_TONES[app.status]}>{STATUS_LABELS[app.status]}</Badge>
                  </div>

                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <dt className="text-muted-foreground">Accounts using it</dt>
                      <dd className="tabular">{formatNumber(app.activeInstalls)}</dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">Registered</dt>
                      <dd>{app.createdAt ? formatDate(app.createdAt) : 'Just now'}</dd>
                    </div>
                  </dl>

                  {app.rejectionReason ? (
                    <Alert tone="warning" title="The platform team asked for a change">
                      {app.rejectionReason}
                    </Alert>
                  ) : null}

                  <div className="flex justify-end">
                    <Link
                      href={`${ROUTES.dashboard}/developers/${app.appId}`}
                      className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
                    >
                      Open
                    </Link>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <RegisterAppForm
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        onRegistered={(credentials) => {
          setNewSecret(credentials);
          setIsFormOpen(false);
          router.refresh();
        }}
      />
    </div>
  );
}
