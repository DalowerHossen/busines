// src/components/instalments/instalment-offer-picker.tsx
// Offering one invoice to be paid in parts, with the deposit and the monthly
// figure worked out before anything is agreed.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { notify } from '@/components/ui/toaster';
import { createInstalmentPlan } from '@/features/instalments/actions/create-plan';
import type { InvoiceOfferQuote } from '@/features/instalments/types';
import { formatMoney, formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface InstalmentOfferPickerProps {
  /** Invoice being offered in parts. */
  invoiceId: string;
  /** Currency of the invoice. */
  currency: string;
  /** The terms this invoice qualifies for. */
  quotes: readonly InvoiceOfferQuote[];
  /** True when the viewer may agree an arrangement. */
  canAgree: boolean;
}

/**
 * Renders the instalment choices for one invoice.
 *
 * @param props The invoice, its quotes and what the viewer may do.
 * @returns The rendered choices.
 */
export function InstalmentOfferPicker({
  invoiceId,
  currency,
  quotes,
  canAgree,
}: InstalmentOfferPickerProps) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(quotes[0]?.offerId ?? null);
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  if (quotes.length === 0) {
    return null;
  }

  /**
   * Agrees the chosen arrangement.
   *
   * @returns Nothing.
   */
  async function onAgree(): Promise<void> {
    if (selectedId === null) {
      return;
    }

    setIsWorking(true);
    setFailure(null);

    const result = await createInstalmentPlan({ invoiceId, offerId: selectedId });

    setIsWorking(false);

    if (!result.success) {
      setFailure(result.error);

      return;
    }

    notify.success('That arrangement is set up and the schedule is live.');
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pay in parts</CardTitle>
        <CardDescription>
          A client who cannot pay today can often pay over a few months. Choose the terms and the
          schedule is written against this invoice.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {failure === null ? null : (
          <Alert tone="danger" title="That arrangement was not set up">
            {failure}
          </Alert>
        )}

        <ul className="space-y-2">
          {quotes.map((quote) => (
            <li key={quote.offerId}>
              <button
                type="button"
                aria-pressed={selectedId === quote.offerId}
                onClick={() => setSelectedId(quote.offerId)}
                className={cn(
                  'min-h-touch w-full rounded-lg border p-3 text-left transition-colors',
                  selectedId === quote.offerId
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-border hover:bg-surface-muted'
                )}
              >
                <span className="block text-sm font-medium">{quote.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {`${formatNumber(quote.instalmentCount)} payments of ${formatMoney(
                    quote.instalmentAmount,
                    currency
                  )} every ${formatNumber(quote.intervalCount)} ${
                    quote.intervalUnit === 'week' ? 'week' : 'month'
                  }.`}
                </span>
                <span className="block text-sm text-muted-foreground">
                  {`${
                    Number.parseFloat(quote.downPaymentAmount) > 0
                      ? `${formatMoney(quote.downPaymentAmount, currency)} today, then `
                      : 'Nothing today, then '
                  }${formatMoney(quote.totalPayable, currency)} in total.${
                    quote.requiresApproval ? ' Needs your approval first.' : ''
                  }`}
                </span>
              </button>
            </li>
          ))}
        </ul>

        {canAgree ? (
          <Button
            type="button"
            fullWidth
            isLoading={isWorking}
            loadingLabel="Setting up"
            onClick={() => void onAgree()}
          >
            Set up this arrangement
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">
            Ask the owner of this business to agree an arrangement on your behalf.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
