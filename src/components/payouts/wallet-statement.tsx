// src/components/payouts/wallet-statement.tsx
// Every movement behind the balance, so a business can see exactly where its
// money came from and what was taken out of it.

import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { WalletEntry } from '@/features/payouts/types';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

export interface WalletStatementProps {
  /** The ledger entries to show, newest first. */
  entries: readonly WalletEntry[];
}

/**
 * Renders the wallet statement.
 *
 * @param props The ledger entries to show.
 * @returns The rendered statement.
 */
export function WalletStatement({ entries }: WalletStatementProps) {
  if (entries.length === 0) {
    return (
      <EmptyState
        title="Nothing has moved through this wallet yet"
        description="Once a client pays you online, the proceeds and the fees taken from them appear here line by line."
      />
    );
  }

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>When</TableHead>
              <TableHead>What happened</TableHead>
              <TableHead>Kind</TableHead>
              <TableHead isNumeric>Amount</TableHead>
              <TableHead isNumeric>Balance after</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {entries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell>{formatDateTime(entry.occurredAt)}</TableCell>
                <TableCell>
                  {entry.description}
                  {entry.isPending && entry.availableFrom ? (
                    <span className="block text-sm text-muted-foreground">
                      Available from {formatDate(entry.availableFrom)}
                    </span>
                  ) : null}
                </TableCell>
                <TableCell>{humanise(entry.transactionType)}</TableCell>
                <TableCell isNumeric>{formatMoney(entry.amount, entry.currency)}</TableCell>
                <TableCell isNumeric>{formatMoney(entry.balanceAfter, entry.currency)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="space-y-3 md:hidden">
        {entries.map((entry) => (
          <li key={entry.id} className="rounded-lg border border-border bg-surface p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-foreground">{entry.description}</p>
                <p className="text-sm text-muted-foreground">
                  {humanise(entry.transactionType)} · {formatDateTime(entry.occurredAt)}
                </p>
              </div>
              <p className="tabular font-medium text-foreground">
                {formatMoney(entry.amount, entry.currency)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}
