// src/components/admin/kyc-review-queue.tsx
// The platform team's view of businesses waiting to be verified: what they
// told us, what they uploaded, and the two decisions available.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { FormField, fieldAccessibilityProps } from '@/components/ui/form-field';
import { StatusBadge } from '@/components/ui/status-badge';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { reviewKyc } from '@/features/admin/actions/review-kyc';
import type { KycQueueItem } from '@/features/admin/queries/list-kyc-queue';
import { formatDate } from '@/lib/dates';
import { humanise } from '@/lib/format';

export interface KycReviewQueueProps {
  /** Checks waiting for a decision. */
  items: readonly KycQueueItem[];
  /** Checks decided recently, shown underneath for context. */
  recent: readonly KycQueueItem[];
}

/**
 * Renders the identity check queue.
 *
 * @param props Waiting checks and recent decisions.
 * @returns The rendered queue.
 */
export function KycReviewQueue({ items, recent }: KycReviewQueueProps) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  /**
   * Records a decision against one check.
   *
   * @param verificationId Check being decided.
   * @param isApproved True to verify the business.
   * @returns Nothing.
   */
  async function decide(verificationId: string, isApproved: boolean): Promise<void> {
    setBusyId(verificationId);
    setFailure(null);

    const note = notes[verificationId] ?? '';

    const result = await reviewKyc({
      verificationId,
      isApproved,
      ...(note.trim().length > 0 ? { note } : {}),
      validMonths: 24,
    });

    setBusyId(null);

    if (!result.success) {
      setFailure(result.error);
      return;
    }

    notify.success(isApproved ? 'Business verified.' : 'Check sent back to the business.');
    router.refresh();
  }

  if (items.length === 0 && recent.length === 0) {
    return (
      <EmptyState
        title="Nothing to verify"
        description="Checks appear here the moment a business sends its papers in."
      />
    );
  }

  return (
    <div className="space-y-4">
      {failure ? (
        <Alert tone="danger" title="That decision was not recorded">
          {failure}
        </Alert>
      ) : null}

      {items.length === 0 ? (
        <EmptyState
          title="The queue is clear"
          description="Every check sent in has been decided. Recent decisions are listed below."
        />
      ) : null}

      {items.map((item) => (
        <Card key={item.id}>
          <CardHeader>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <CardTitle>{item.companyName}</CardTitle>
                <CardDescription>
                  {item.legalName} &middot; {humanise(item.legalEntityType)} &middot;{' '}
                  {item.incorporationCountry}
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Badge tone={item.riskLevel === 'low' ? 'neutral' : 'warning'}>
                  {humanise(item.riskLevel)} risk
                </Badge>
                <StatusBadge kind="kyc" status={item.status} />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">Person answering</dt>
                <dd className="text-foreground">
                  {item.representativeName} &middot; {item.representativeEmail}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Registration and tax numbers</dt>
                <dd className="text-foreground">
                  {item.registrationNumber ?? 'None given'} &middot;{' '}
                  {item.taxIdentificationNumber ?? 'None given'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Sent in</dt>
                <dd className="text-foreground">
                  {item.submittedAt ? formatDate(item.submittedAt) : 'Not recorded'}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Expected monthly volume</dt>
                <dd className="tabular text-foreground">
                  {item.expectedMonthlyVolume ?? 'Not stated'}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-muted-foreground">What they sell</dt>
                <dd className="text-foreground">
                  {item.businessDescription ?? 'Nothing was written here.'}
                </dd>
              </div>
            </dl>

            <div>
              <p className="text-sm font-medium text-foreground">Papers</p>
              {item.documents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing was uploaded.</p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
                  {item.documents.map((document) => (
                    <li key={document.id}>
                      {humanise(document.documentType)} &middot; {humanise(document.documentSide)}{' '}
                      &middot; {document.fileName}
                      {document.expiresOn ? ` · expires ${formatDate(document.expiresOn)}` : ''}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <FormField
              id={`kyc-note-${item.id}`}
              label="Note to the business"
              hint="Required when sending a check back. The owner sees this word for word."
            >
              <Textarea
                {...fieldAccessibilityProps(`kyc-note-${item.id}`, true, false)}
                rows={2}
                value={notes[item.id] ?? ''}
                onChange={(event) => {
                  setNotes((current) => ({ ...current, [item.id]: event.target.value }));
                }}
              />
            </FormField>

            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                isLoading={busyId === item.id}
                loadingLabel="Saving"
                onClick={() => {
                  void decide(item.id, true);
                }}
              >
                Verify this business
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={busyId === item.id}
                onClick={() => {
                  void decide(item.id, false);
                }}
              >
                Send it back
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {recent.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Recent decisions</CardTitle>
            <CardDescription>The last ten checks this team closed.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {recent.map((item) => (
                <li key={item.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="truncate text-foreground">{item.companyName}</span>
                  <StatusBadge kind="kyc" status={item.status} />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
