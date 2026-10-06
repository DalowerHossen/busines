// src/components/contracts/contract-trail.tsx
// The permanent record: who did what and when. This is the part a lawyer
// asks for, so it reads in plain order and is never edited.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { ContractEventRecord } from '@/features/contracts/types';
import { formatDateTime } from '@/lib/dates';
import { humanise } from '@/lib/format';

export interface ContractTrailProps {
  /** The entries, oldest first. */
  events: readonly ContractEventRecord[];
}

/**
 * Renders the trail of an agreement.
 *
 * @param props The entries.
 * @returns The rendered trail.
 */
export function ContractTrail({ events }: ContractTrailProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>What has happened</CardTitle>
        <CardDescription>
          Every step is written down as it happens and cannot be edited afterwards.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing has happened to this agreement yet.
          </p>
        ) : (
          <ol className="space-y-3">
            {events.map((event) => (
              <li
                key={`${event.occurredAt}-${event.eventType}-${event.description}`}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border pb-3 last:border-b-0 last:pb-0"
              >
                <div className="space-y-1">
                  <p className="text-sm font-medium">{event.description}</p>
                  <p className="text-sm text-muted-foreground">
                    {humanise(event.eventType)}
                    {event.signerName === null ? '' : ` · ${event.signerName}`}
                  </p>
                </div>
                <span className="tabular text-sm text-muted-foreground">
                  {formatDateTime(event.occurredAt)}
                </span>
              </li>
            ))}
          </ol>
        )}
      </CardContent>
    </Card>
  );
}
