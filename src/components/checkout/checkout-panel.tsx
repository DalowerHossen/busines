// src/components/checkout/checkout-panel.tsx
// Where a client chooses how to pay an invoice and is sent on their way.

'use client';

import { useEffect, useRef, useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { startCheckout } from '@/features/checkout/actions/start-checkout';
import type { CheckoutInvoice, CheckoutMethod, CheckoutTerms } from '@/features/checkout/types';
import { formatDate } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { cn } from '@/lib/utils';

export interface CheckoutPanelProps {
  /** The invoice being paid. */
  invoice: CheckoutInvoice;
  /** The ways this business accepts payment. */
  methods: readonly CheckoutMethod[];
  /** The token from the address, which is the only credential there is. */
  token: string;
  /** What the payer has to agree to before the button does anything. */
  terms: CheckoutTerms;
}

/**
 * Renders the payment chooser.
 *
 * @param props The invoice, the methods and the link token.
 * @returns The rendered panel.
 */
export function CheckoutPanel({ invoice, methods, token, terms }: CheckoutPanelProps) {
  const [selectedId, setSelectedId] = useState(methods[0]?.gatewayId ?? '');
  const [isWorking, setIsWorking] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [hasConfirmedDelivery, setHasConfirmedDelivery] = useState(false);
  const openedAt = useRef<number>(Date.now());
  const [browserFacts, setBrowserFacts] = useState<{
    timeZone: string;
    language: string;
    fingerprint: string;
  } | null>(null);

  // Read once the page is in a browser, because what the payer's own device
  // reports is part of the record if this payment is ever challenged.
  useEffect(() => {
    setBrowserFacts({
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      fingerprint: `${String(window.screen.width)}x${String(window.screen.height)}`,
    });
  }, []);

  /**
   * Starts the payment with the chosen provider.
   *
   * @returns Nothing.
   */
  async function handlePay(): Promise<void> {
    setIsWorking(true);
    setFailure(null);
    setInstructions(null);

    const result = await startCheckout({
      token,
      gatewayId: selectedId,
      consentStatement: terms.consentStatement,
      hasAgreed: true,
      timeZone: browserFacts?.timeZone,
      acceptLanguage: browserFacts?.language,
      screenFingerprint: browserFacts?.fingerprint,
      viewedSeconds: Math.round((Date.now() - openedAt.current) / 1000),
    });

    if (!result.success) {
      setIsWorking(false);
      setFailure(result.error);
      return;
    }

    if (result.data.checkoutUrl) {
      window.location.assign(result.data.checkoutUrl);
      return;
    }

    setIsWorking(false);
    setInstructions(result.data.instructions ?? 'Follow the instructions above to pay.');
  }

  if (methods.length === 0) {
    return (
      <Card className="mx-auto w-full max-w-content">
        <CardHeader>
          <CardTitle>Paying this invoice</CardTitle>
          <CardDescription>
            {invoice.supplierName} has not switched on online payment yet. Reply to the email this
            invoice came with and they will confirm how they would like to be paid.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="mx-auto w-full max-w-content">
      <CardHeader>
        <CardTitle>Pay {formatMoney(invoice.balanceDue, invoice.currency)}</CardTitle>
        <CardDescription>
          {invoice.number} from {invoice.supplierName}
          {invoice.dueDate ? `, due by ${formatDate(invoice.dueDate)}` : ''}.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {failure ? (
          <Alert tone="danger" title="This payment did not start">
            {failure}
          </Alert>
        ) : null}

        {instructions ? (
          <Alert tone="info" title="How to finish this payment">
            {instructions}
          </Alert>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-foreground">Choose how to pay</legend>

          {methods.map((method) => {
            const isSelected = method.gatewayId === selectedId;

            return (
              <label
                key={method.gatewayId}
                className={cn(
                  'flex min-h-touch cursor-pointer items-start gap-3 rounded-md border p-4 transition',
                  isSelected
                    ? 'border-brand-600 bg-brand-50'
                    : 'border-border bg-surface hover:bg-surface-muted'
                )}
              >
                <input
                  type="radio"
                  name="payment-method"
                  value={method.gatewayId}
                  checked={isSelected}
                  disabled={isWorking}
                  className="mt-1 h-4 w-4"
                  onChange={() => {
                    setSelectedId(method.gatewayId);
                  }}
                />
                <span>
                  <span className="block font-medium text-foreground">{method.label}</span>
                  <span className="block text-sm text-muted-foreground">{method.description}</span>
                  {method.instructions ? (
                    <span className="mt-1 block whitespace-pre-line text-sm text-muted-foreground">
                      {method.instructions}
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}
        </fieldset>

        <div className="space-y-3 rounded-md border border-border bg-surface-muted p-4">
          <label className="flex min-h-touch cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              checked={hasAgreed}
              disabled={isWorking}
              className="mt-1 h-4 w-4"
              onChange={(event) => {
                setHasAgreed(event.target.checked);
              }}
            />
            <span className="text-sm text-foreground">{terms.consentStatement}</span>
          </label>

          {terms.requireDeliveryConfirmation ? (
            <label className="flex min-h-touch cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                checked={hasConfirmedDelivery}
                disabled={isWorking}
                className="mt-1 h-4 w-4"
                onChange={(event) => {
                  setHasConfirmedDelivery(event.target.checked);
                }}
              />
              <span className="text-sm text-foreground">
                I confirm the work described on this invoice has been delivered to me.
              </span>
            </label>
          ) : null}

          <p className="text-xs text-muted-foreground">
            {terms.refundWindowDays > 0
              ? `${invoice.supplierName} offers a refund within ${String(terms.refundWindowDays)} days. Contact them first; it is faster than a bank.`
              : `Contact ${invoice.supplierName} first if anything is wrong with this invoice.`}
          </p>
        </div>

        <Button
          type="button"
          className="w-full sm:w-auto"
          isLoading={isWorking}
          loadingLabel="Opening your payment"
          disabled={
            selectedId.length === 0 ||
            !hasAgreed ||
            (terms.requireDeliveryConfirmation && !hasConfirmedDelivery)
          }
          onClick={() => {
            void handlePay();
          }}
        >
          Pay {formatMoney(invoice.balanceDue, invoice.currency)}
        </Button>

        <p className="text-xs text-muted-foreground">
          Card details are entered with the payment provider, never on this page, and this link is
          personal to you.
        </p>
      </CardContent>
    </Card>
  );
}
