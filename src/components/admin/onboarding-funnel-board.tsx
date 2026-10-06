// src/components/admin/onboarding-funnel-board.tsx
// Who signed up and never got as far as being paid.
//
// A platform like this lives or dies on how many new sellers reach their
// first payment. This board names the ones who stopped and the exact step
// they stopped on, which is the only useful form that number takes.

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
import type { FunnelRow } from '@/features/onboarding/queries/list-funnel';
import { formatDate } from '@/lib/dates';
import { formatNumber, humanise } from '@/lib/format';

export interface OnboardingFunnelBoardProps {
  /** Sellers who signed up in the period. */
  rows: readonly FunnelRow[];
}

/**
 * Renders the signup funnel.
 *
 * @param props The sellers who signed up.
 * @returns The rendered board.
 */
export function OnboardingFunnelBoard({ rows }: OnboardingFunnelBoardProps) {
  const paid = rows.filter((row) => row.hasFirstPayment).length;

  return (
    <Card>
      <CardHeader>
        <CardTitle>New sellers</CardTitle>
        <CardDescription>
          {rows.length === 0
            ? 'Nobody has signed up in this period.'
            : `${formatNumber(paid)} of ${formatNumber(rows.length)} new sellers have taken their first payment.`}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <EmptyState
            title="No signups in this period"
            description="When a business signs up, it appears here with the step it is currently stuck on."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Business</TableHead>
                <TableHead>Signed up</TableHead>
                <TableHead>State</TableHead>
                <TableHead isNumeric>Steps done</TableHead>
                <TableHead>Waiting on</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.companyId}>
                  <TableCell>{row.companyName ?? 'Unnamed business'}</TableCell>
                  <TableCell>{formatDate(row.signedUpAt)}</TableCell>
                  <TableCell>{humanise(row.status)}</TableCell>
                  <TableCell isNumeric>
                    {`${formatNumber(row.requiredDone)} of ${formatNumber(row.requiredCount)}`}
                  </TableCell>
                  <TableCell>
                    {row.hasFirstPayment ? (
                      <Badge tone="success">Taking payments</Badge>
                    ) : (
                      <Badge tone="warning">{row.stuckOn ?? 'Ready, no invoice yet'}</Badge>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
