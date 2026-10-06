// src/app/pay/[token]/result/page.tsx
// Where the provider sends the client back to. The browser is never trusted
// with the outcome: the invoice itself is read again, and the provider
// webhook is what actually settles the money.

import type { Metadata } from 'next';

import { CheckoutNotice } from '@/components/checkout/checkout-notice';
import { getCheckout } from '@/features/checkout/queries/get-checkout';
import { formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Your payment',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export interface CheckoutResultPageProps {
  /** The token taken from the address. */
  params: { token: string };
  /** What the provider appended when it sent the client back. */
  searchParams: { status?: string };
}

/**
 * Renders what happened after a client returned from the provider.
 *
 * @param props The token and the status the provider appended.
 * @returns The rendered page.
 */
export default async function CheckoutResultPage({
  params,
  searchParams,
}: CheckoutResultPageProps) {
  const result = await getCheckout(decodeURIComponent(params.token));

  if (!result.isAvailable) {
    return (
      <CheckoutNotice
        title="This link cannot be opened"
        message={result.message}
        footnote="If you have just paid, your payment is safe. The sender will see it on their side."
      />
    );
  }

  if (result.isSettled) {
    return (
      <CheckoutNotice
        title="Thank you, this invoice is paid"
        message={`${result.invoice.number} from ${result.invoice.supplierName} is settled in full. A receipt follows by email.`}
      />
    );
  }

  if (searchParams.status === 'cancelled') {
    return (
      <CheckoutNotice
        title="Your payment was cancelled"
        message={`Nothing has been taken. ${formatMoney(
          result.invoice.balanceDue,
          result.invoice.currency
        )} is still outstanding on ${result.invoice.number}.`}
        footnote="Open your invoice link again whenever you are ready to pay."
      />
    );
  }

  return (
    <CheckoutNotice
      title="Your payment is being confirmed"
      message={`${result.invoice.supplierName} has not had confirmation from the payment provider yet. This usually takes a few seconds.`}
      footnote={`Refresh this page in a moment. ${formatMoney(
        result.invoice.balanceDue,
        result.invoice.currency
      )} is shown as outstanding until the provider confirms.`}
    />
  );
}
