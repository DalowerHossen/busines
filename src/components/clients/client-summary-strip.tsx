// src/components/clients/client-summary-strip.tsx
// The four counts shown above the client list, so the size and health of the
// client book is visible before a single row is read.

import { Archive, PauseCircle, UserCheck, Users } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { ClientCounts } from '@/features/clients/queries/list-clients';
import { formatNumber } from '@/lib/format';

export interface ClientSummaryStripProps {
  /** Counts read from the database. */
  counts: ClientCounts;
}

interface SummaryTile {
  key: string;
  label: string;
  value: number;
  icon: LucideIcon;
}

/**
 * Renders the counts above the client list.
 *
 * @param props The counts to show.
 * @returns The rendered strip.
 */
export function ClientSummaryStrip({ counts }: ClientSummaryStripProps) {
  const tiles: SummaryTile[] = [
    { key: 'total', label: 'Clients', value: counts.total, icon: Users },
    { key: 'active', label: 'Active', value: counts.active, icon: UserCheck },
    { key: 'inactive', label: 'Inactive', value: counts.inactive, icon: PauseCircle },
    { key: 'archived', label: 'Archived', value: counts.archived, icon: Archive },
  ];

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((tile) => (
        <div
          key={tile.key}
          className="flex items-center gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-50 text-brand-700">
            <tile.icon aria-hidden="true" className="h-5 w-5" />
          </span>
          <div>
            <dt className="text-sm text-muted-foreground">{tile.label}</dt>
            <dd className="tabular text-xl font-semibold text-foreground">
              {formatNumber(tile.value)}
            </dd>
          </div>
        </div>
      ))}
    </dl>
  );
}
