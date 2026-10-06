// src/components/loyalty/loyalty-member-table.tsx
// Who holds points, how many, and what they are worth.

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
import type { LoyaltyMemberSummary } from '@/features/loyalty/types';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface LoyaltyMemberTableProps {
  /** The members to show. */
  members: readonly LoyaltyMemberSummary[];
  /** Currency the points are priced in. */
  currency: string;
}

/**
 * Picks the tone that matches a tier.
 *
 * @param tier Tier the member has reached.
 * @returns The tone of the badge.
 */
function tierTone(tier: string): 'success' | 'warning' | 'neutral' {
  if (tier === 'platinum' || tier === 'gold') {
    return 'success';
  }

  return tier === 'silver' ? 'warning' : 'neutral';
}

/**
 * Renders the member table.
 *
 * @param props The members and the currency.
 * @returns The rendered table.
 */
export function LoyaltyMemberTable({ members, currency }: LoyaltyMemberTableProps) {
  if (members.length === 0) {
    return (
      <EmptyState
        title="Nobody is collecting points yet"
        description="Clients join the moment they settle an invoice, as long as the scheme is switched on. Set the earning rate and the rewards first, so there is something worth collecting for."
      />
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Member</TableHead>
          <TableHead>Client</TableHead>
          <TableHead>Tier</TableHead>
          <TableHead isNumeric>Points</TableHead>
          <TableHead isNumeric>Worth</TableHead>
          <TableHead>Points expire</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {members.map((member) => (
          <TableRow key={member.accountId}>
            <TableCell>
              <Link
                href={`${ROUTES.loyalty}/${member.accountId}`}
                className="font-medium text-brand-700 underline-offset-4 hover:underline"
              >
                {member.membershipNumber}
              </Link>
            </TableCell>
            <TableCell>{member.clientName ?? '—'}</TableCell>
            <TableCell>
              <Badge tone={member.isSuspended ? 'danger' : tierTone(member.tier)}>
                {member.isSuspended ? 'Suspended' : humanise(member.tier)}
              </Badge>
            </TableCell>
            <TableCell isNumeric>{formatNumber(member.pointsBalance)}</TableCell>
            <TableCell isNumeric>{formatMoney(member.pointsValue, currency)}</TableCell>
            <TableCell>
              {member.nextExpiryDate === null ? 'Never' : formatDate(member.nextExpiryDate)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
