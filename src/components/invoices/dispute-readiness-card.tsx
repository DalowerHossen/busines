// src/components/invoices/dispute-readiness-card.tsx
// How well this invoice would defend itself.
//
// A card dispute is won on paperwork assembled before the argument starts.
// This card scores what the platform could submit today and names the gaps
// in plain words, so the seller closes them while the client is still
// friendly rather than ninety days later.

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { DisputeReadiness } from '@/features/disputes/queries/get-readiness';
import { formatNumber } from '@/lib/format';

export interface DisputeReadinessCardProps {
  /** The score and what is behind it. */
  readiness: DisputeReadiness;
}

const BAND_TONES: Readonly<Record<string, 'success' | 'warning' | 'danger'>> = {
  strong: 'success',
  workable: 'warning',
  weak: 'danger',
};

const BAND_WORDS: Readonly<Record<string, string>> = {
  strong: 'This invoice would defend itself',
  workable: 'This invoice is defensible, with gaps',
  weak: 'This invoice would be hard to defend',
};

/**
 * Renders the dispute readiness card.
 *
 * @param props The readiness score.
 * @returns The rendered card.
 */
export function DisputeReadinessCard({ readiness }: DisputeReadinessCardProps) {
  const checks = [
    { label: 'Proof of the delivered work', isDone: readiness.hasWorkEvidence },
    { label: 'The payer agreed before paying', isDone: readiness.hasConsentRecord },
    { label: 'Delivery of the invoice recorded', isDone: readiness.hasDeliveryProof },
    { label: 'The client opened the link', isDone: readiness.hasViewProof },
    { label: 'Terms printed on the invoice', isDone: readiness.hasTerms },
    { label: 'Your business details frozen on it', isDone: readiness.hasFrozenProfile },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>If this payment were challenged</CardTitle>
        <CardDescription>
          A bank decides a dispute on the file it is sent, not on who is right. This is the file we
          would send today.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <span className="tabular text-3xl font-semibold">{formatNumber(readiness.score)}</span>
          <span className="text-sm text-muted-foreground">out of 100</span>
          <Badge tone={BAND_TONES[readiness.band] ?? 'danger'}>
            {BAND_WORDS[readiness.band] ?? BAND_WORDS['weak']}
          </Badge>
        </div>

        <ul className="space-y-2 text-sm">
          {checks.map((check) => (
            <li key={check.label} className="flex items-start gap-2">
              <span
                aria-hidden="true"
                className={
                  check.isDone
                    ? 'mt-1 inline-block h-2 w-2 rounded-full bg-success'
                    : 'mt-1 inline-block h-2 w-2 rounded-full bg-warning'
                }
              />
              <span className={check.isDone ? 'text-muted-foreground' : 'text-foreground'}>
                {check.label}
              </span>
              <span className="visually-hidden">{check.isDone ? 'In place' : 'Missing'}</span>
            </li>
          ))}
        </ul>

        {readiness.missing.length === 0 ? null : (
          <div className="rounded-md border border-border bg-surface-muted p-3">
            <p className="text-sm font-medium text-foreground">Close these and it is airtight</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {readiness.missing.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
