// src/components/admin/app-review-queue.tsx
// The platform decision on third party applications: what they may ask
// accounts for, and whether they may keep asking.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { EmptyState } from '@/components/ui/empty-state';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { reviewDeveloperApp } from '@/features/admin/actions/review-developer-app';
import { API_SCOPES } from '@/features/developers/scopes';
import type { DeveloperAppQueueEntry } from '@/features/developers/types';
import { formatDate } from '@/lib/dates';
import { formatNumber, humanise } from '@/lib/format';

export interface AppReviewQueueProps {
  /** Every application the platform team can see. */
  entries: readonly DeveloperAppQueueEntry[];
}

/**
 * Renders the application review console.
 *
 * @param props The applications waiting for a decision.
 * @returns The rendered console.
 */
export function AppReviewQueue({ entries }: AppReviewQueueProps) {
  const router = useRouter();
  const [granted, setGranted] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const waiting = entries.filter((entry) => entry.status === 'in_review');
  const decided = entries.filter((entry) => entry.status !== 'in_review');

  /**
   * Records one decision.
   *
   * @param entry Application being decided.
   * @param decision What is being decided.
   * @returns Nothing.
   */
  async function decide(
    entry: DeveloperAppQueueEntry,
    decision: 'approve' | 'reject' | 'suspend' | 'retire'
  ): Promise<void> {
    setBusyId(entry.appId);
    setFailure(null);

    const result = await reviewDeveloperApp({
      appId: entry.appId,
      decision,
      allowedScopes: granted[entry.appId] ?? [...entry.requestedScopes],
      reason: notes[entry.appId] ?? '',
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success(`The application is now ${humanise(result.data.status).toLowerCase()}.`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {failure ? (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Waiting for a decision</CardTitle>
          <CardDescription>
            Approve only the permissions the application has a reason to hold.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {waiting.length === 0 ? (
            <EmptyState
              title="Nothing is waiting"
              description="Applications appear here the moment a builder sends one for review."
            />
          ) : (
            waiting.map((entry) => (
              <div key={entry.appId} className="space-y-3 rounded-lg border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{entry.appName}</p>
                    <p className="text-sm text-muted-foreground">
                      {entry.ownerName} · {humanise(entry.appType)} ·{' '}
                      {entry.submittedAt === null
                        ? 'just submitted'
                        : `submitted ${formatDate(entry.submittedAt)}`}
                    </p>
                    {entry.homepageUrl ? (
                      <p className="text-sm text-muted-foreground">{entry.homepageUrl}</p>
                    ) : null}
                  </div>
                  <Badge tone="info">{humanise(entry.distribution)}</Badge>
                </div>

                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Permissions to grant</legend>
                  {API_SCOPES.filter((scope) => entry.requestedScopes.includes(scope.key)).map(
                    (scope) => {
                      const current = granted[entry.appId] ?? [...entry.requestedScopes];

                      return (
                        <Checkbox
                          key={scope.key}
                          label={scope.label}
                          description={scope.description}
                          checked={current.includes(scope.key)}
                          onChange={() =>
                            setGranted((state) => ({
                              ...state,
                              [entry.appId]: current.includes(scope.key)
                                ? current.filter((value) => value !== scope.key)
                                : [...current, scope.key],
                            }))
                          }
                        />
                      );
                    }
                  )}
                </fieldset>

                <Input
                  value={notes[entry.appId] ?? ''}
                  placeholder="Reason, needed when you refuse"
                  onChange={(event) =>
                    setNotes((state) => ({ ...state, [entry.appId]: event.target.value }))
                  }
                  aria-label={`Reason for ${entry.appName}`}
                />

                <div className="flex flex-wrap justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={busyId === entry.appId}
                    loadingLabel="Saving"
                    onClick={() => {
                      void decide(entry, 'reject');
                    }}
                  >
                    Ask for changes
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    isLoading={busyId === entry.appId}
                    loadingLabel="Saving"
                    onClick={() => {
                      void decide(entry, 'approve');
                    }}
                  >
                    Approve
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Everything else</CardTitle>
          <CardDescription>
            An application that starts misbehaving can be stopped here, which also kills every token
            it holds.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {decided.length === 0 ? (
            <EmptyState
              title="No applications yet"
              description="Applications appear here once they have been decided."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Application</TableHead>
                  <TableHead>Owner</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead isNumeric>Accounts</TableHead>
                  <TableHead>Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {decided.map((entry) => (
                  <TableRow key={entry.appId}>
                    <TableCell>{entry.appName}</TableCell>
                    <TableCell>{entry.ownerName}</TableCell>
                    <TableCell>
                      <Badge
                        tone={
                          entry.status === 'approved'
                            ? 'success'
                            : entry.status === 'suspended'
                              ? 'danger'
                              : 'neutral'
                        }
                      >
                        {humanise(entry.status)}
                      </Badge>
                    </TableCell>
                    <TableCell isNumeric>{formatNumber(entry.installCount)}</TableCell>
                    <TableCell>
                      {entry.status === 'approved' ? (
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          isLoading={busyId === entry.appId}
                          loadingLabel="Saving"
                          onClick={() => {
                            setNotes((state) => ({
                              ...state,
                              [entry.appId]: state[entry.appId] ?? 'Suspended by the platform team',
                            }));
                            void decide(entry, 'suspend');
                          }}
                        >
                          Suspend
                        </Button>
                      ) : (
                        <span className="text-sm text-muted-foreground">No action needed</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
