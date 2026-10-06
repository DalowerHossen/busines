// src/components/messaging/route-activity-table.tsx
// What each chain actually did: which channels it tried, which one landed,
// what it cost, and a way to call off one that should not continue.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { notify } from '@/components/ui/toaster';
import { stopRouteRun } from '@/features/messaging/actions/stop-route-run';
import type { RouteActivityRecord } from '@/features/messaging/types';
import { formatDateTime } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

export interface RouteActivityTableProps {
  /** The conversations to show. */
  runs: readonly RouteActivityRecord[];
  /** Currency the cost is counted in. */
  currency: string;
  /** False when the viewer may look but not change anything. */
  canManage: boolean;
}

/**
 * Picks the colour that matches how a chain ended.
 *
 * @param status Status recorded on the chain.
 * @returns The tone of the badge.
 */
function toneFor(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'delivered' || status === 'engaged') {
    return 'success';
  }

  if (status === 'running') {
    return 'warning';
  }

  if (status === 'failed') {
    return 'danger';
  }

  return 'neutral';
}

/**
 * Renders the activity table.
 *
 * @param props The conversations and what the viewer may do.
 * @returns The rendered table.
 */
export function RouteActivityTable({ runs, currency, canManage }: RouteActivityTableProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Calls off one chain.
   *
   * @param run Chain being stopped.
   * @returns Nothing.
   */
  async function onStop(run: RouteActivityRecord): Promise<void> {
    setBusyId(run.runId);
    setFailure(null);

    const result = await stopRouteRun({
      runId: run.runId,
      reason: 'Stopped from the messaging page',
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('Nothing further will be sent about that.');
    router.refresh();
  }

  if (runs.length === 0) {
    return (
      <EmptyState
        title="No chains have run yet"
        description="The moment a reminder goes out on a chain, its progress appears here."
      />
    );
  }

  return (
    <div className="space-y-4">
      {failure ? (
        <Alert tone="danger" title="That did not work">
          {failure}
        </Alert>
      ) : null}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Chain</TableHead>
            <TableHead>Client</TableHead>
            <TableHead>Tried</TableHead>
            <TableHead>Result</TableHead>
            <TableHead isNumeric>Cost</TableHead>
            <TableHead>Started</TableHead>
            <TableHead>Action</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {runs.map((run) => (
            <TableRow key={run.runId}>
              <TableCell>{run.routeName}</TableCell>
              <TableCell>{run.clientName ?? 'Somebody in your team'}</TableCell>
              <TableCell>
                {run.attemptedChannels.length === 0
                  ? 'Nothing yet'
                  : run.attemptedChannels.map((channel) => humanise(channel)).join(', ')}
              </TableCell>
              <TableCell>
                <Badge tone={toneFor(run.status)}>{humanise(run.status)}</Badge>
                {run.deliveredChannel ? (
                  <span className="block text-sm text-muted-foreground">
                    Landed on {humanise(run.deliveredChannel)}
                  </span>
                ) : null}
              </TableCell>
              <TableCell isNumeric>{formatMoney(run.totalCost, currency)}</TableCell>
              <TableCell>{formatDateTime(run.startedAt)}</TableCell>
              <TableCell>
                {canManage && run.status === 'running' ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    isLoading={busyId === run.runId}
                    loadingLabel="Stopping"
                    onClick={() => {
                      void onStop(run);
                    }}
                  >
                    Stop
                  </Button>
                ) : (
                  <span className="text-sm text-muted-foreground">Finished</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
