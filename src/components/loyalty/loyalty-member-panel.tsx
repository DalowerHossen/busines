// src/components/loyalty/loyalty-member-panel.tsx
// One membership: the balance, how it was arrived at, and what has been
// claimed against it.

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import type { LoyaltyMemberDetail } from '@/features/loyalty/types';
import { formatDate, formatDateTime } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface LoyaltyMemberPanelProps {
  /** The membership being shown. */
  member: LoyaltyMemberDetail;
}

/**
 * Picks the tone that matches a movement.
 *
 * @param entryType Kind of movement.
 * @returns The tone of the badge.
 */
function movementTone(entryType: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (entryType === 'earned' || entryType === 'bonus') {
    return 'success';
  }

  if (entryType === 'expired') {
    return 'danger';
  }

  return entryType === 'redeemed' ? 'warning' : 'neutral';
}

/**
 * Renders one membership.
 *
 * @param props The membership.
 * @returns The rendered membership.
 */
export function LoyaltyMemberPanel({ member }: LoyaltyMemberPanelProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{member.membershipNumber}</CardTitle>
          <CardDescription>
            {`${member.clientName ?? 'No client recorded'} · joined ${formatDate(member.joinedAt)}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Badge tone={member.isSuspended ? 'danger' : 'neutral'}>
              {member.isSuspended ? 'Suspended' : humanise(member.tier)}
            </Badge>
            {member.nextExpiryDate === null ? null : (
              <Badge tone="warning">{`Points expire ${formatDate(member.nextExpiryDate)}`}</Badge>
            )}
          </div>

          {member.suspensionReason === null ? null : (
            <p className="text-sm text-muted-foreground">{member.suspensionReason}</p>
          )}

          <dl className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Points held</dt>
              <dd className="tabular text-sm font-medium">{formatNumber(member.pointsBalance)}</dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">What they are worth</dt>
              <dd className="tabular text-sm font-medium">
                {formatMoney(member.pointsValue, member.currency)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Earned since joining</dt>
              <dd className="tabular text-sm font-medium">
                {formatNumber(member.pointsEarnedLifetime)}
              </dd>
            </div>
            <div className="space-y-1">
              <dt className="text-sm text-muted-foreground">Spent and expired</dt>
              <dd className="tabular text-sm font-medium">
                {`${formatNumber(member.pointsRedeemedLifetime)} and ${formatNumber(
                  member.pointsExpiredLifetime
                )}`}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Every movement</CardTitle>
          <CardDescription>
            The balance is the sum of these rows. Nothing here is ever edited; a mistake is
            corrected with another movement.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {member.movements.length === 0 ? (
            <p className="text-sm text-muted-foreground">No points have moved yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>When</TableHead>
                  <TableHead>What happened</TableHead>
                  <TableHead>Why</TableHead>
                  <TableHead isNumeric>Points</TableHead>
                  <TableHead isNumeric>Balance after</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {member.movements.map((movement) => (
                  <TableRow key={movement.movementId}>
                    <TableCell>{formatDateTime(movement.createdAt)}</TableCell>
                    <TableCell>
                      <Badge tone={movementTone(movement.entryType)}>
                        {humanise(movement.entryType)}
                      </Badge>
                    </TableCell>
                    <TableCell>{movement.reason}</TableCell>
                    <TableCell isNumeric>{formatNumber(movement.points)}</TableCell>
                    <TableCell isNumeric>{formatNumber(movement.balanceAfter)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rewards claimed</CardTitle>
          <CardDescription>
            Each claim carries a code, so it can be honoured on an invoice and never twice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {member.redemptions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing has been claimed yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Reward</TableHead>
                  <TableHead isNumeric>Points</TableHead>
                  <TableHead isNumeric>Worth</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Claimed</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {member.redemptions.map((claim) => (
                  <TableRow key={claim.redemptionId}>
                    <TableCell className="font-mono text-sm">{claim.redemptionCode}</TableCell>
                    <TableCell>{claim.rewardName ?? '—'}</TableCell>
                    <TableCell isNumeric>{formatNumber(claim.pointsSpent)}</TableCell>
                    <TableCell isNumeric>
                      {claim.rewardValue === null
                        ? '—'
                        : formatMoney(claim.rewardValue, claim.currency)}
                    </TableCell>
                    <TableCell>
                      <Badge tone={claim.status === 'applied' ? 'success' : 'neutral'}>
                        {humanise(claim.status)}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatDate(claim.issuedAt)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
