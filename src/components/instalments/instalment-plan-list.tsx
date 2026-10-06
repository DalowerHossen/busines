// src/components/instalments/instalment-plan-list.tsx
// Every arrangement in one table, with how far through it is and what is
// late, so the one that needs a telephone call is obvious.

import Link from 'next/link';

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
import { ROUTES } from '@/config/app';
import type { InstalmentPlanSummary } from '@/features/instalments/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

export interface InstalmentPlanListProps {
  /** The arrangements to show. */
  plans: readonly InstalmentPlanSummary[];
}

/**
 * Picks the tone that matches where an arrangement has got to.
 *
 * @param plan The arrangement.
 * @returns The tone of the badge.
 */
function planTone(plan: InstalmentPlanSummary): 'success' | 'warning' | 'danger' | 'neutral' {
  if (plan.status === 'completed') {
    return 'success';
  }

  if (plan.status === 'defaulted' || plan.status === 'declined') {
    return 'danger';
  }

  if (plan.overdueCount > 0 || plan.status === 'pending') {
    return 'warning';
  }

  return 'neutral';
}

/**
 * Renders the arrangement table.
 *
 * @param props The arrangements.
 * @returns The rendered table.
 */
export function InstalmentPlanList({ plans }: InstalmentPlanListProps) {
  if (plans.length === 0) {
    return (
      <EmptyState
        title="Nobody is paying in parts yet"
        description="Set the terms you are willing to be paid on, then offer them on any invoice that has been sent. The schedule, the reminders and the chasing are handled for you."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Plan</TableHead>
          <TableHead>Invoice</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>State</TableHead>
          <TableHead isNumeric>Paid</TableHead>
          <TableHead isNumeric>Still owed</TableHead>
          <TableHead>Next payment</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {plans.map((plan) => (
          <TableRow key={plan.planId}>
            <TableCell>
              <Link
                href={`${ROUTES.payments}/instalments/${plan.planId}`}
                className="font-medium text-brand-700 underline-offset-4 hover:underline"
              >
                {plan.planReference}
              </Link>
            </TableCell>
            <TableCell>{plan.invoiceNumber ?? '—'}</TableCell>
            <TableCell>{plan.clientName ?? '—'}</TableCell>
            <TableCell>
              <Badge tone={planTone(plan)}>
                {plan.overdueCount > 0
                  ? `${humanise(plan.status)}, ${String(plan.overdueCount)} late`
                  : humanise(plan.status)}
              </Badge>
            </TableCell>
            <TableCell isNumeric>
              {`${String(plan.paidCount)} of ${String(plan.instalmentCount)}`}
            </TableCell>
            <TableCell isNumeric>{formatMoney(plan.outstandingAmount, plan.currency)}</TableCell>
            <TableCell>{plan.nextDueDate === null ? '—' : formatDate(plan.nextDueDate)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
