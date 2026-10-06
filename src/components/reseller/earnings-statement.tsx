// src/components/reseller/earnings-statement.tsx
// What a partner is owed and what has already been paid to them.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import type { ResellerPayoutRecord, ResellerStatement } from '@/features/resellers/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';
import { addMoney } from '@/lib/money';

export interface EarningsStatementProps {
  /** Figures for the last twelve months. */
  statement: ResellerStatement | null;
  /** Payments already made to this partner. */
  payouts: readonly ResellerPayoutRecord[];
  /** Currency the partner is paid in. */
  currency: string;
}

/**
 * Renders the earnings statement and payment history.
 *
 * @param props Statement, payments and currency.
 * @returns The rendered card.
 */
export function EarningsStatement({ statement, payouts, currency }: EarningsStatementProps) {
  const total = payouts.reduce<string>(
    (running, payout) => addMoney(running, payout.amount).toString(),
    '0'
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Your margin</CardTitle>
          <CardDescription>
            A margin is confirmed once the account has actually paid its bill, and is included in
            the next monthly payment run.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {statement === null ? (
            <EmptyState
              title="Nothing earned yet"
              description="Figures appear here as soon as the first account you manage is billed."
            />
          ) : (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Billed to your accounts</dt>
                <dd className="tabular text-foreground">
                  {formatMoney(statement.retailTotal, statement.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Our wholesale price</dt>
                <dd className="tabular text-foreground">
                  {formatMoney(statement.wholesaleTotal, statement.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Confirmed margin</dt>
                <dd className="tabular text-foreground">
                  {formatMoney(statement.commissionEarned, statement.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Waiting on payment</dt>
                <dd className="tabular text-foreground">
                  {formatMoney(statement.commissionPending, statement.currency)}
                </dd>
              </div>
            </dl>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments to you</CardTitle>
          <CardDescription>One line per monthly payment run.</CardDescription>
        </CardHeader>

        <CardContent>
          {payouts.length === 0 ? (
            <EmptyState
              title="No payments yet"
              description="Your first payment run appears here once a margin has been confirmed."
            />
          ) : (
            <Table caption="Payments made to this partner">
              <TableHeader>
                <TableRow>
                  <TableHead>Reference</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead isNumeric>Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payouts.map((payout) => (
                  <TableRow key={payout.id}>
                    <TableCell>{payout.payoutReference}</TableCell>
                    <TableCell>
                      {formatDate(payout.periodStart)} to {formatDate(payout.periodEnd)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={payout.status === 'paid' ? 'success' : 'neutral'}>
                        {humanise(payout.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {payout.paidAt === null ? 'Not yet' : formatDate(payout.paidAt)}
                    </TableCell>
                    <TableCell isNumeric>{formatMoney(payout.amount, payout.currency)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={4}>TOTAL</TableCell>
                  <TableCell isNumeric>{formatMoney(total, currency)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
