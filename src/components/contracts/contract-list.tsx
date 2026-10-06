// src/components/contracts/contract-list.tsx
// Every agreement in one table, with how far through signing it is, so the
// one that is stuck is obvious.

import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { EmptyState } from '@/components/ui/empty-state';
import { ROUTES } from '@/config/app';
import type { ContractSummaryRecord } from '@/features/contracts/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, humanise } from '@/lib/format';

/**
 * Picks the tone that matches where an agreement has got to.
 *
 * @param status State recorded on the agreement.
 * @returns The tone of the badge.
 */
function statusTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'completed') {
    return 'success';
  }

  if (status === 'sent' || status === 'partially_signed') {
    return 'warning';
  }

  if (status === 'declined' || status === 'expired' || status === 'voided') {
    return 'danger';
  }

  return 'neutral';
}

export interface ContractListProps {
  /** The agreements to show. */
  contracts: readonly ContractSummaryRecord[];
  /** Currency used when an agreement carries none of its own. */
  fallbackCurrency: string;
}

/**
 * Renders the agreement table.
 *
 * @param props The agreements and the fallback currency.
 * @returns The rendered table.
 */
export function ContractList({ contracts, fallbackCurrency }: ContractListProps) {
  if (contracts.length === 0) {
    return (
      <EmptyState
        title="No agreements yet"
        description="Draft one from the wording the platform ships with, name the people who have to sign, and send it. Everything that happens afterwards is recorded for you."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Reference</TableHead>
          <TableHead>Title</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>State</TableHead>
          <TableHead isNumeric>Signed</TableHead>
          <TableHead isNumeric>Value</TableHead>
          <TableHead>Closes</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {contracts.map((contract) => (
          <TableRow key={contract.contractId}>
            <TableCell>
              <Link
                href={`${ROUTES.contracts}/${contract.contractId}`}
                className="font-medium text-brand-700 underline-offset-4 hover:underline"
              >
                {contract.contractNumber}
              </Link>
            </TableCell>
            <TableCell>{contract.title}</TableCell>
            <TableCell>{contract.clientName ?? 'Not linked to a client'}</TableCell>
            <TableCell>
              <Badge tone={statusTone(contract.status)}>{humanise(contract.status)}</Badge>
            </TableCell>
            <TableCell isNumeric>{`${contract.signedCount} of ${contract.signerCount}`}</TableCell>
            <TableCell isNumeric>
              {contract.contractValue === null
                ? '—'
                : formatMoney(contract.contractValue, contract.currency ?? fallbackCurrency)}
            </TableCell>
            <TableCell>
              {contract.validUntil === null ? '—' : formatDate(contract.validUntil)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
