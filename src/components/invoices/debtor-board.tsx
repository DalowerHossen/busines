// src/components/invoices/debtor-board.tsx
// Everybody who owes this business something, oldest debt first.
//
// This is the list somebody works down on a Friday afternoon, so it is
// ordered by how long the money has been outstanding rather than by how
// large it is. A statement button sits on every row because one page
// listing six invoices usually gets more of them paid than six reminders.

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { DebtorRow } from '@/features/statements/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';

export interface DebtorBoardProps {
  /** Everybody who owes something. */
  debtors: readonly DebtorRow[];
  /** Everything owed across every client. */
  totalOutstanding: string;
  /** The part already late. */
  totalOverdue: string;
  /** Currency this business works in. */
  currency: string;
}

/**
 * Describes how old the oldest unpaid invoice of a client is.
 *
 * @param oldestDueDate The earliest due date still unpaid.
 * @returns A sentence, or null when nothing is overdue.
 */
function ageNote(oldestDueDate: string | null): string | null {
  if (oldestDueDate === null) {
    return null;
  }

  const days = Math.floor((Date.now() - Date.parse(oldestDueDate)) / 86400000);

  if (days <= 0) {
    return null;
  }

  return `${formatNumber(days)} days`;
}

/**
 * Renders the debtor board.
 *
 * @param props The debtors and the totals.
 * @returns The rendered board.
 */
export function DebtorBoard({
  debtors,
  totalOutstanding,
  totalOverdue,
  currency,
}: DebtorBoardProps) {
  return (
    <div className="space-y-6">
      <dl className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Owed to you</dt>
            <dd className="tabular text-2xl font-semibold">
              {formatMoney(totalOutstanding, currency)}
            </dd>
            <p className="text-sm text-muted-foreground">Across every unpaid invoice.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Already late</dt>
            <dd className="tabular text-2xl font-semibold">
              {formatMoney(totalOverdue, currency)}
            </dd>
            <p className="text-sm text-muted-foreground">Past the date you agreed.</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-1 pt-6">
            <dt className="text-sm text-muted-foreground">Clients who owe you</dt>
            <dd className="tabular text-2xl font-semibold">{formatNumber(debtors.length)}</dd>
            <p className="text-sm text-muted-foreground">Oldest debt is listed first.</p>
          </CardContent>
        </Card>
      </dl>

      <Card>
        <CardHeader>
          <CardTitle>Who owes you</CardTitle>
          <CardDescription>
            A statement lists every outstanding invoice on one page, which is usually what gets
            several of them paid at once.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {debtors.length === 0 ? (
            <EmptyState
              title="Nobody owes you anything"
              description="Every invoice you have issued has been paid. This is the page you want to be empty."
            />
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead isNumeric>Invoices</TableHead>
                  <TableHead isNumeric>Outstanding</TableHead>
                  <TableHead isNumeric>Of which late</TableHead>
                  <TableHead>Waiting since</TableHead>
                  <TableHead>Statement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {debtors.map((debtor) => (
                  <TableRow key={debtor.clientId}>
                    <TableCell>
                      <Link
                        href={`/dashboard/clients/${debtor.clientId}`}
                        className="text-brand-700 underline"
                      >
                        {debtor.clientName}
                      </Link>
                    </TableCell>
                    <TableCell isNumeric>{formatNumber(debtor.invoiceCount)}</TableCell>
                    <TableCell isNumeric>
                      {formatMoney(debtor.totalOutstanding, debtor.currency)}
                    </TableCell>
                    <TableCell isNumeric>
                      {formatMoney(debtor.overdueAmount, debtor.currency)}
                    </TableCell>
                    <TableCell>
                      {debtor.oldestDueDate === null ? (
                        'Nothing late'
                      ) : ageNote(debtor.oldestDueDate) === null ? (
                        `Due ${formatDate(debtor.oldestDueDate)}`
                      ) : (
                        <Badge tone="warning">{ageNote(debtor.oldestDueDate)}</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        <a
                          className="text-sm text-brand-700 underline"
                          href={`/api/statements/${debtor.clientId}`}
                        >
                          As a file
                        </a>
                        <a
                          className="text-sm text-brand-700 underline"
                          href={`/api/statements/${debtor.clientId}?format=csv`}
                        >
                          As a spreadsheet
                        </a>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow>
                  <TableCell colSpan={2}>TOTAL</TableCell>
                  <TableCell isNumeric>{formatMoney(totalOutstanding, currency)}</TableCell>
                  <TableCell isNumeric>{formatMoney(totalOverdue, currency)}</TableCell>
                  <TableCell colSpan={2}>Across every client</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
