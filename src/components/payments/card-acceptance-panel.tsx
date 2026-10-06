// src/components/payments/card-acceptance-panel.tsx
// Deciding whether cards are accepted at all, and on what conditions.
//
// A card is the only payment a buyer can reverse on their own, months after
// the work was delivered, by telling their bank a short story. Everything on
// this panel exists to make that either impossible or unwinnable: the switch
// that removes cards entirely, the ceiling above which they are not offered,
// and the sentence the payer has to agree to before the button does
// anything. That sentence is stored word for word with the time, address and
// device it was agreed from, and it is what the platform submits if the
// payment is ever challenged.

'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { notify } from '@/components/ui/toaster';
import { saveCheckoutPreferences } from '@/features/checkout/actions/save-preferences';
import type { CheckoutPreferences } from '@/features/checkout/queries/get-preferences';

export interface CardAcceptancePanelProps {
  /** How this business is willing to be paid today. */
  preferences: CheckoutPreferences;
  /** True when the viewer may change it. */
  canManage: boolean;
  /** Currency the amounts are in. */
  currency: string;
}

/**
 * Renders the card acceptance panel.
 *
 * @param props The preferences, the currency and whether they can be edited.
 * @returns The rendered panel.
 */
export function CardAcceptancePanel({
  preferences,
  canManage,
  currency,
}: CardAcceptancePanelProps) {
  const router = useRouter();

  const [acceptCards, setAcceptCards] = useState(preferences.acceptCardPayments);
  const [acceptBank, setAcceptBank] = useState(preferences.acceptBankTransfer);
  const [acceptLocal, setAcceptLocal] = useState(preferences.acceptLocalMethods);
  const [requireTerms, setRequireTerms] = useState(preferences.requireTermsAcceptance);
  const [requireDelivery, setRequireDelivery] = useState(preferences.requireDeliveryConfirmation);
  const [requireAddress, setRequireAddress] = useState(preferences.requireBillingAddress);
  const [blockCountry, setBlockCountry] = useState(preferences.blockMismatchedCountry);
  const [minimum, setMinimum] = useState(preferences.cardMinimumAmount);
  const [maximum, setMaximum] = useState(preferences.cardMaximumAmount ?? '');
  const [statement, setStatement] = useState(preferences.consentStatement);
  const [refundWindow, setRefundWindow] = useState(String(preferences.refundWindowDays));
  const [isSaving, setIsSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  /**
   * Saves the preferences.
   *
   * @returns Nothing.
   */
  async function onSave(): Promise<void> {
    setIsSaving(true);
    setFieldErrors({});

    const result = await saveCheckoutPreferences({
      acceptCardPayments: acceptCards,
      acceptBankTransfer: acceptBank,
      acceptLocalMethods: acceptLocal,
      requireTermsAcceptance: requireTerms,
      requireDeliveryConfirmation: requireDelivery,
      requireBillingAddress: requireAddress,
      blockMismatchedCountry: blockCountry,
      cardMinimumAmount: minimum === '' ? '0' : minimum,
      cardMaximumAmount: maximum === '' ? undefined : maximum,
      consentStatement: statement,
      refundWindowDays: refundWindow,
    });

    setIsSaving(false);

    if (!result.success) {
      setFieldErrors(result.fieldErrors ?? {});
      notify.error(result.error);

      return;
    }

    notify.success('Saved. This applies to every invoice from now on.');
    router.refresh();
  }

  const toggles = [
    {
      id: 'accept-cards',
      label: 'Accept card payments',
      description:
        'Off removes every card option from every invoice you send. Bank transfer and the other methods are unaffected.',
      checked: acceptCards,
      onChange: setAcceptCards,
    },
    {
      id: 'accept-bank',
      label: 'Accept bank transfer',
      description: 'The payer is shown your account details and your invoice reference.',
      checked: acceptBank,
      onChange: setAcceptBank,
    },
    {
      id: 'accept-local',
      label: 'Accept local payment methods',
      description: "Methods offered through licensed partners in your client's country.",
      checked: acceptLocal,
      onChange: setAcceptLocal,
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>How you are willing to be paid</CardTitle>
        <CardDescription>
          A card payment can be reversed by the buyer long after the work is delivered. You decide
          whether to accept that risk, above what amount you will not, and what the payer has to
          agree to first.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4 rounded-lg border border-border p-4">
          {toggles.map((toggle) => (
            <div key={toggle.id} className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="font-medium text-foreground">{toggle.label}</p>
                <p className="text-sm text-muted-foreground">{toggle.description}</p>
              </div>

              <Switch
                id={toggle.id}
                label={toggle.label}
                checked={toggle.checked}
                disabled={!canManage}
                onCheckedChange={toggle.onChange}
              />
            </div>
          ))}
        </div>

        {acceptCards ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                id="card-minimum"
                label={`Smallest card payment (${currency})`}
                hint="Below this the payer is offered bank transfer instead."
                errors={fieldErrors['cardMinimumAmount']}
              >
                <Input
                  id="card-minimum"
                  type="number"
                  step="0.01"
                  min="0"
                  value={minimum}
                  disabled={!canManage}
                  onChange={(event) => setMinimum(event.target.value)}
                />
              </FormField>

              <FormField
                id="card-maximum"
                label={`Largest card payment (${currency})`}
                hint="Leave empty for no ceiling. The biggest invoices carry the biggest reversal risk."
                errors={fieldErrors['cardMaximumAmount']}
              >
                <Input
                  id="card-maximum"
                  type="number"
                  step="0.01"
                  min="0"
                  value={maximum}
                  disabled={!canManage}
                  onChange={(event) => setMaximum(event.target.value)}
                />
              </FormField>

              <FormField
                id="refund-window"
                label="Your own refund window in days"
                hint="Printed on the invoice. A stated policy is the first thing a card scheme looks for."
                errors={fieldErrors['refundWindowDays']}
              >
                <Input
                  id="refund-window"
                  type="number"
                  step="1"
                  min="0"
                  max="180"
                  value={refundWindow}
                  disabled={!canManage}
                  onChange={(event) => setRefundWindow(event.target.value)}
                />
              </FormField>
            </div>

            <FormField
              id="consent-statement"
              label="What the payer agrees to before paying"
              hint="Stored word for word with the time, address and device it was agreed from."
              errors={fieldErrors['consentStatement']}
              isRequired
            >
              <Textarea
                id="consent-statement"
                rows={3}
                value={statement}
                disabled={!canManage}
                onChange={(event) => setStatement(event.target.value)}
              />
            </FormField>

            <div className="space-y-3">
              <Checkbox
                id="require-terms"
                label="Require your terms to be accepted"
                description="The payer ticks a box next to your terms before the pay button works."
                checked={requireTerms}
                disabled={!canManage}
                onChange={(event) => setRequireTerms(event.target.checked)}
              />

              <Checkbox
                id="require-address"
                label="Require a billing address"
                description="An address that matches the card is one of the strongest signals in a dispute."
                checked={requireAddress}
                disabled={!canManage}
                onChange={(event) => setRequireAddress(event.target.checked)}
              />

              <Checkbox
                id="require-delivery"
                label="Require the client to confirm delivery"
                description="Ask the payer to confirm they received the work before they can pay."
                checked={requireDelivery}
                disabled={!canManage}
                onChange={(event) => setRequireDelivery(event.target.checked)}
              />

              <Checkbox
                id="block-country"
                label="Refuse a card from a country other than the client's"
                description="Catches a card used from somewhere the client has never been."
                checked={blockCountry}
                disabled={!canManage}
                onChange={(event) => setBlockCountry(event.target.checked)}
              />
            </div>
          </>
        ) : (
          <Alert tone="info" title="Cards are switched off">
            Your invoices will offer bank transfer and the other methods you have enabled. Nothing
            already paid is affected.
          </Alert>
        )}

        {canManage ? (
          <Button isLoading={isSaving} loadingLabel="Saving" onClick={() => void onSave()}>
            Save how I take payments
          </Button>
        ) : (
          <Alert tone="info" title="This is the owner's decision">
            Ask the owner of this business to change how payments are taken.
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
