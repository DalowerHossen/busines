// src/components/admin/partner-review-queue.tsx
// White label applications and the partners already selling. Approving one
// sets the terms at the same moment, because a partner with no agreed
// revenue share is a dispute waiting to happen.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
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
import { reviewReseller } from '@/features/admin/actions/review-reseller';
import type { ResellerRecord } from '@/features/admin/queries/list-resellers';
import { formatDate } from '@/lib/dates';
import { formatNumber, humanise } from '@/lib/format';

export interface PartnerReviewQueueProps {
  /** Applications waiting for a decision. */
  pending: readonly ResellerRecord[];
  /** Partners already in the programme. */
  active: readonly ResellerRecord[];
}

interface DecisionDraft {
  note: string;
  revenueShare: string;
  maxAccounts: string;
}

const EMPTY_DRAFT: DecisionDraft = { note: '', revenueShare: '20', maxAccounts: '' };

/**
 * Renders the white label console.
 *
 * @param props Applications and existing partners.
 * @returns The rendered console.
 */
export function PartnerReviewQueue({ pending, active }: PartnerReviewQueueProps) {
  const router = useRouter();
  const [drafts, setDrafts] = useState<Record<string, DecisionDraft>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Reads the draft decision for one application.
   *
   * @param id Application identifier.
   * @returns The draft, or the opening values.
   */
  function draftFor(id: string): DecisionDraft {
    return drafts[id] ?? EMPTY_DRAFT;
  }

  /**
   * Records a decision on one application.
   *
   * @param record Application being decided.
   * @param isApproved True to let the partner start selling.
   * @returns Nothing.
   */
  async function decide(record: ResellerRecord, isApproved: boolean): Promise<void> {
    const draft = draftFor(record.id);

    setBusyId(record.id);
    setFailure(null);

    const result = await reviewReseller({
      resellerId: record.id,
      isApproved,
      ...(draft.note.trim().length > 0 ? { note: draft.note } : {}),
      ...(isApproved && draft.revenueShare.length > 0
        ? { revenueShare: Number(draft.revenueShare) }
        : {}),
      ...(isApproved && draft.maxAccounts.length > 0
        ? { maxSubTenants: Number(draft.maxAccounts) }
        : {}),
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
            description="New white label applications appear here as soon as they are made."
          />
        ) : (
          pending.map((record) => {
            const draft = draftFor(record.id);

            return (
              <Card key={record.id}>
                <CardHeader>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <CardTitle>{record.partnerName}</CardTitle>
                      <CardDescription>
                        {record.contactEmail} &middot; {record.slug} &middot; {record.countryCode}{' '}
                        &middot; applied {formatDate(record.createdAt)}
                      </CardDescription>
                    </div>
                    <Badge tone="warning">Waiting</Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <FormField
                      id={`partner-share-${record.id}`}
                      label="Revenue share for this partner"
                      hint="The percentage of each bill the partner keeps."
                    >
                      <Input
                        {...fieldAccessibilityProps(`partner-share-${record.id}`, true, false)}
                        type="number"
                        min={0}
                        max={100}
                        step="0.01"
                        value={draft.revenueShare}
                        onChange={(event) => {
                          setDrafts((current) => ({
                            ...current,
                            [record.id]: { ...draft, revenueShare: event.target.value },
                          }));
                        }}
                      />
                    </FormField>

                    <FormField
                      id={`partner-accounts-${record.id}`}
                      label="Accounts allowed"
                      hint="Leave empty for no ceiling."
                    >
                      <Input
                        {...fieldAccessibilityProps(`partner-accounts-${record.id}`, true, false)}
                        type="number"
                        min={1}
                        value={draft.maxAccounts}
                        onChange={(event) => {
                          setDrafts((current) => ({
                            ...current,
                            [record.id]: { ...draft, maxAccounts: event.target.value },
                          }));
                        }}
                      />
                    </FormField>
                  </div>

                  <FormField
                    id={`partner-note-${record.id}`}
                    label="Note to the applicant"
                    hint="Required when refusing. The applicant reads this word for word."
                  >
                    <Textarea
                      {...fieldAccessibilityProps(`partner-note-${record.id}`, true, false)}
                      rows={2}
                      value={draft.note}
                      onChange={(event) => {
                        setDrafts((current) => ({
                          ...current,
                          [record.id]: { ...draft, note: event.target.value },
                        }));
                      }}
                    />
                  </FormField>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      isLoading={busyId === record.id}
                      loadingLabel="Saving"
                      onClick={() => {
                        void decide(record, true);
                      }}
                    >
                      Approve partner
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busyId === record.id}
                      onClick={() => {
                        void decide(record, false);
                      }}
                    >
                      Refuse
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-base font-semibold text-foreground">Partners selling</h2>

        {active.length === 0 ? (
          <EmptyState
            title="No partners yet"
            description="Approved partners and the size of their book appear here."
          />
        ) : (
          <Table caption="White label partners and the accounts they hold">
            <TableHeader>
              <TableRow>
                <TableHead>Partner</TableHead>
                <TableHead>State</TableHead>
                <TableHead>Brand</TableHead>
                <TableHead>Domain</TableHead>
                <TableHead isNumeric>Share</TableHead>
                <TableHead isNumeric>Accounts</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {active.map((record) => (
                <TableRow key={record.id}>
                  <TableCell>
                    <span className="font-medium text-foreground">{record.partnerName}</span>
                    <span className="block text-xs text-muted-foreground">{record.slug}</span>
                  </TableCell>
                  <TableCell>
                    <Badge tone={record.status === 'approved' ? 'success' : 'neutral'}>
                      {humanise(record.status)}
                    </Badge>
                  </TableCell>
                  <TableCell>{record.brandName ?? 'Ours'}</TableCell>
                  <TableCell>{record.customDomain ?? 'Not set'}</TableCell>
                  <TableCell isNumeric>{record.revenueSharePercentage}%</TableCell>
                  <TableCell isNumeric>
                    {record.maxSubTenants === null
                      ? formatNumber(record.subTenantCount)
                      : `${formatNumber(record.subTenantCount)} of ${formatNumber(record.maxSubTenants)}`}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </section>
    </div>
  );
}
