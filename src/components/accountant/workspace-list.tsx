// src/components/accountant/workspace-list.tsx
// The businesses one accountant serves, on one screen. Each line answers the
// only question that matters at this point: does this set of books need me
// today?

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
import type { AccountantWorkspace } from '@/features/accountants/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber } from '@/lib/format';

export interface WorkspaceListProps {
  /** Businesses this accountant may work on. */
  workspaces: readonly AccountantWorkspace[];
}

/**
 * Renders the list of businesses.
 *
 * @param props The workspaces available to the accountant.
 * @returns The rendered table.
 */
export function WorkspaceList({ workspaces }: WorkspaceListProps) {
  if (workspaces.length === 0) {
    return (
      <EmptyState
        title="No business has invited you yet"
        description="An owner grants access from their settings. Once they do, the business appears here with its books ready to read."
      />
    );
  }

  return (
    <Table caption="Businesses you keep the books for">
      <TableHeader>
        <TableRow>
          <TableHead>Business</TableHead>
          <TableHead isNumeric>Owed to them</TableHead>
          <TableHead isNumeric>Overdue</TableHead>
          <TableHead isNumeric>Collected this month</TableHead>
          <TableHead isNumeric>Spent this month</TableHead>
          <TableHead>Waiting on you</TableHead>
          <TableHead>Last opened</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {workspaces.map((workspace) => (
          <TableRow key={workspace.companyId}>
            <TableCell>
              <Link
                href={`${ROUTES.accountant}/${workspace.companyId}`}
                className="font-medium text-brand-700 underline-offset-2 hover:underline"
              >
                {workspace.displayName}
              </Link>
              <p className="text-xs text-muted-foreground">
                Access since {formatDate(workspace.grantedAt)}
                {workspace.expiresAt === null ? '' : ` until ${formatDate(workspace.expiresAt)}`}
              </p>
            </TableCell>
            <TableCell isNumeric>
              {formatMoney(workspace.outstandingAmount, workspace.baseCurrency)}
            </TableCell>
            <TableCell isNumeric>
              {formatMoney(workspace.overdueAmount, workspace.baseCurrency)}
            </TableCell>
            <TableCell isNumeric>
              {formatMoney(workspace.collectedThisMonth, workspace.baseCurrency)}
            </TableCell>
            <TableCell isNumeric>
              {formatMoney(workspace.expensesThisMonth, workspace.baseCurrency)}
            </TableCell>
            <TableCell>
              <div className="flex flex-wrap gap-1">
                {workspace.draftEntries > 0 ? (
                  <Badge tone="warning">{formatNumber(workspace.draftEntries)} draft entries</Badge>
                ) : null}
                {workspace.unreconciledTransactions > 0 ? (
                  <Badge tone="info">
                    {formatNumber(workspace.unreconciledTransactions)} to reconcile
                  </Badge>
                ) : null}
                {workspace.draftEntries === 0 && workspace.unreconciledTransactions === 0 ? (
                  <Badge tone="success">Nothing waiting</Badge>
                ) : null}
              </div>
            </TableCell>
            <TableCell>
              {workspace.lastAccessedAt === null
                ? 'Not yet opened'
                : formatDate(workspace.lastAccessedAt)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
