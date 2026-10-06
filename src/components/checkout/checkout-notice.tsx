// src/components/checkout/checkout-notice.tsx
// What a client sees when a payment link cannot be opened, or once their
// payment is finished. There is nothing to click back to, because a client
// never has an account here.

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface CheckoutNoticeProps {
  /** Heading of the message. */
  title: string;
  /** The sentence explaining what happened. */
  message: string;
  /** Extra guidance shown underneath. */
  footnote?: string;
}

/**
 * Renders a standalone message on the payment pages.
 *
 * @param props The heading and the message.
 * @returns The rendered message.
 */
export function CheckoutNotice({ title, message, footnote }: CheckoutNoticeProps) {
  return (
    <Card className="mx-auto w-full max-w-content">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      {footnote ? (
        <CardContent>
          <p className="text-sm text-muted-foreground">{footnote}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
