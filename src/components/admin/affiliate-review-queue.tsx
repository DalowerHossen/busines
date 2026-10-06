// src/components/admin/affiliate-review-queue.tsx
// The platform team's view of the referral programme: applications waiting
// for a decision, and how the partners already in it are doing.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { reviewAffiliate } from '@/features/admin/actions/review-affiliate';
import type { AffiliateRecord } from '@/features/admin/queries/list-affiliates';
import { formatDate } from '@/lib/dates';
import { formatMoney, formatNumber, humanise } from '@/lib/format';

export interface AffiliateReviewQueueProps {
  /** Applications waiting for a decision. */
  pending: readonly AffiliateRecord[];
  /** Partners already in the programme. */
  active: readonly AffiliateRecord[];
}

/**
 * Renders the referral programme console.
 *
 * @param props Applications and existing partners.
 * @returns The rendered console.
 */
export function AffiliateReviewQueue({ pending, active }: AffiliateReviewQueueProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Records a decision on one application.
   *
   * @param affiliateId Application being decided.
   * @param isApproved True to let the partner into the programme.
   * @returns Nothing.
   */
  async function decide(affiliateId: string, isApproved: boolean): Promise<void> {
    setBusyId(affiliateId);
    setFailure(null);

    const note = notes[affiliateId] ?? '';

    const result = await reviewAffiliate({
      affiliateId,
      isApproved,
      ...(note.trim().length > 0 ? { note } : {}),
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success(isApproved ? 'Partner approved.' : 'Application refused.');
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {failure ? (
        <Alert tone="danger" title="That decision was not recorded">
          {failure}
        </Alert>
      ) : null}

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Applications waiting</h2>

        {pending.length === 0 ? (
          <EmptyState
            title="No applications waiting"
            description="New applications appear here as soon as somebody applies."
          />
        ) : (
          pending.map((record) => (
            <Card key={record.id}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle>{record.displayName}</CardTitle>
                    <CardDescription>
                      {record.contactEmail} &middot; code {record.referralCode} &middot; applied{' '}
                      {formatDate(record.createdAt)}
                    </CardDescription>
                  </div>
                  <Badge tone="warning">Waiting</Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <dl className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Website or profile</dt>
                    <dd className="truncate text-foreground">{record.website ?? 'None given'}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Country</dt>
                    <dd className="text-foreground">{record.countryCode ?? 'Not stated'}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-muted-foreground">How they plan to promote us</dt>
                    <dd className="text-foreground">
                      {record.promotionMethod ?? 'Nothing was written here.'}
                    </dd>
                  </div>
                </dl>

                <FormField
                  id={`affiliate-note-${record.id}`}
                  label="Note to the applicant"
                  hint="Required when refusing. The applicant reads this word for word."
                >
                  <Textarea
                    {...fieldAccessibilityProps(`affiliate-note-${record.id}`, true, false)}
                    rows={2}
                    value={notes[record.id] ?? ''}
                    onChange={(event) => {
                      setNotes((current) => ({ ...current, [record.id]: event.target.value }));
                    }}
                  />
                </FormField>

                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    isLoading={busyId === record.id}
                    loadingLabel="Saving"
                    onClick={() => {
                      void decide(record.id, true);
                    }}
                  >
                    Approve partner
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={busyId === record.id}
                    onClick={() => {
                      void decide(record.id, false);
                    }}
                  >
                    Refuse
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Partners in the programme</h2>

        {active.length === 0 ? (
          <EmptyState
            title="No partners yet"
            description="Approved partners and their performance appear here."
          />
        ) : (
          <Table caption="Referral partners and their performance">
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>State</TableHead>
                <TableHead isNumeric>Visits</TableHead>
                <TableHead isNumeric>Signups</TableHead>
                <TableHead isNumeric>Earned</TableHead>
                <TableHead isNumeric>Paid</TableHead>
                <TableHead isNumeric>Flagged</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">{record.displayName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {record.referralCode}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge tone={record.status === 'approved' ? 'success' : 'neutral'}>
                      {humanise(record.status)}
                    </Badge>
                  </TableCell>
                  <TableCell isNumeric>{formatNumber(record.totalClicks)}</TableCell>
                  <TableCell isNumeric>{formatNumber(record.totalSignups)}</TableCell>
                  <TableCell isNumeric>
                    {formatMoney(record.totalCommissionEarned, record.payoutCurrency)}
                  </TableCell>
                  <TableCell isNumeric>
                    {formatMoney(record.totalCommissionPaid, record.payoutCurrency)}
                  </TableCell>
                  <TableCell isNumeric>{formatNumber(record.flaggedReferrals)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
