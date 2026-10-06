// src/components/accountant/journal-entry-list.tsx
// The entries behind the figures. An accountant reading somebody else's
// books needs to see where each movement came from, so the source of every
// entry is shown next to it.

import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { JournalEntrySummary } from '@/features/accountants/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

export interface JournalEntryListProps {
  /** Entries to show, newest first. */
  entries: readonly JournalEntrySummary[];
}

/**
 * Picks the badge tone that matches the state of an entry.
 *
 * @param status State of the entry.
 * @returns The tone to render.
 */
function toneForStatus(status: string): 'success' | 'warning' | 'neutral' {
  if (status === 'posted') {
    return 'success';
  }

  if (status === 'draft') {
    return 'warning';
  }

  return 'neutral';
}

/**
 * Renders the recent entries of one ledger.
 *
 * @param props The entries to show.
 * @returns The rendered table.
 */
export function JournalEntryList({ entries }: JournalEntryListProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="The ledger is empty"
        description="Entries appear here as soon as the business issues an invoice, records a payment or posts one by hand."
      />
    );
  }

  return (
    <Table caption="Recent journal entries">
      <TableHeader>
        <TableRow>
          <TableHead>Entry</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Memo</TableHead>
          <TableHead>Raised by</TableHead>
          <TableHead>State</TableHead>
          <TableHead isNumeric>Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {entries.map((entry) => (
          <TableRow key={entry.id}>
            <TableCell className="tabular font-medium">{entry.entryNumber}</TableCell>
            <TableCell>{formatDate(entry.entryDate)}</TableCell>
            <TableCell>{entry.memo ?? 'No memo'}</TableCell>
            <TableCell>{humanise(entry.sourceType)}</TableCell>
            <TableCell>
              <Badge tone={toneForStatus(entry.status)}>{humanise(entry.status)}</Badge>
            </TableCell>
            <TableCell isNumeric>{formatMoney(entry.totalDebit, entry.currency)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
