// src/app/pay/[token]/page.tsx
// The page a client pays an invoice on. The token in the address is the only
// key, so the page is never indexed and never leaks a referrer.

import type { Metadata } from 'next';

import { CheckoutNotice } from '@/components/checkout/checkout-notice';
import { CheckoutPanel } from '@/components/checkout/checkout-panel';
import { getCheckout } from '@/features/checkout/queries/get-checkout';
import { formatMoney } from '@/lib/format';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Pay your invoice',
  robots: { index: false, follow: false, nocache: true },
  referrer: 'no-referrer',
};

export interface CheckoutPageProps {
  /** The token taken from the address. */
  params: { token: string };
}

/**
 * Renders the payment page behind a client link.
 *
 * @param props The token from the address.
 * @returns The rendered page.
 */
export default async function CheckoutPage({ params }: CheckoutPageProps) {
  const token = decodeURIComponent(params.token);
  const result = await getCheckout(token);

  if (!result.isAvailable) {
    return (
      <CheckoutNotice
        title="This payment link cannot be opened"
        message={result.message}
        footnote="Reply to the email the invoice came with and the sender will send a fresh link."
      />
    );
  }

  if (result.isSettled) {
    return (
      <CheckoutNotice
        title="This invoice is already settled"
        message={`${result.invoice.number} from ${result.invoice.supplierName} has nothing left to pay. Thank you.`}
        footnote={`The full amount of ${formatMoney(
          result.invoice.balanceDue,
          result.invoice.currency
        )} outstanding has been cleared.`}
      />
    );
  }

  return (
    <CheckoutPanel
      invoice={result.invoice}
      methods={result.methods}
      token={token}
      terms={result.terms}
    />
  );
}
