// src/components/affiliate/commission-table.tsx
// What a partner has earned. Each line says what was paid to us, what share
// of it is theirs and when it becomes available, and never which business it
// came from.

import { Badge } from '@/components/ui/badge';
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
import type { AffiliateCommission } from '@/features/affiliates/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { addMoney } from '@/lib/money';

export interface CommissionTableProps {
  /** Commissions earned by this partner, newest first. */
  commissions: readonly AffiliateCommission[];
  /** Currency the partner is paid in. */
  currency: string;
}

/**
 * Describes the state of one commission in plain words.
 *
 * @param commission The commission being described.
 * @returns A label and a tone for the badge.
 */
function stateOf(commission: AffiliateCommission): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'neutral';
} {
  if (commission.reversedAt !== null) {
    return { label: 'Reversed', tone: 'danger' };
  }

  if (commission.status === 'approved') {
    return { label: 'Released', tone: 'success' };
  }

  if (commission.status === 'cancelled') {
    return { label: 'Cancelled', tone: 'neutral' };
  }

  return { label: 'Held', tone: 'warning' };
}

/**
 * Renders the commission history.
 *
 * @param props The commissions and the payout currency.
 * @returns The rendered table.
 */
export function CommissionTable({ commissions, currency }: CommissionTableProps) {
  if (commissions.length === 0) {
    return (
      <EmptyState
        title="Nothing earned yet"
        description="A commission appears here the first time a business you referred pays us."
      />
    );
  }

  const total = commissions
    .filter((commission) => commission.reversedAt === null)
    .reduce<string>((running, commission) => addMoney(running, commission.amount).toString(), '0');

  return (
    <Table caption="Commissions earned">
      <TableHeader>
        <TableRow>
          <TableHead>Earned on</TableHead>
          <TableHead>Share</TableHead>
          <TableHead>State</TableHead>
          <TableHead>Available</TableHead>
          <TableHead isNumeric>Amount</TableHead>
        </TableRow>
      </TableHeader>

      <TableBody>
        {commissions.map((commission) => {
          const state = stateOf(commission);

          return (
            <TableRow key={commission.id}>
              <TableCell>{formatDate(commission.createdAt)}</TableCell>
              <TableCell>{commission.commissionPercentage}%</TableCell>
              <TableCell>
                <Badge tone={state.tone}>{state.label}</Badge>
              </TableCell>
              <TableCell>
                {commission.availableOn === null
                  ? 'When released'
                  : formatDate(commission.availableOn)}
              </TableCell>
              <TableCell isNumeric>{formatMoney(commission.amount, commission.currency)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>

      <TableFooter>
        <TableRow>
          <TableCell colSpan={4}>TOTAL</TableCell>
          <TableCell isNumeric>{formatMoney(total, currency)}</TableCell>
        </TableRow>
      </TableFooter>
    </Table>
  );
}
