// src/components/storefronts/storefront-setup-guide.tsx
// What to do at the shop end, written out per platform.
//
// The steps are deliberately the same shape everywhere: send the order, send
// the shopper to the address we hand back, and let the notification tell the
// shop when the money landed.

import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface StorefrontSetupGuideProps {
  /** The address of this installation, used in the examples. */
  baseUrl: string;
}

interface PlatformGuide {
  key: string;
  name: string;
  steps: readonly string[];
}

const GUIDES: readonly PlatformGuide[] = [
  {
    key: 'woocommerce',
    name: 'WooCommerce',
    steps: [
      'In your shop, install the checkout bridge and open its settings screen.',
      'Paste the shop key you issued below into the key field, and the signing secret into the secret field.',
      'Set the checkout mode to redirect so the shopper is sent to the hosted payment page.',
      'Place a one unit test order and confirm it appears in the order list on this page.',
    ],
  },
  {
    key: 'shopify',
    name: 'Shopify',
    steps: [
      'In your shop admin, open Settings and then Notifications, and add a webhook for order creation and order cancellation.',
      'Point both webhooks at the notification address shown next to your shop below.',
      'Store the shop key with your checkout app so it can request a payment address for each order.',
      'Place a draft order and pay it to confirm the whole route works end to end.',
    ],
  },
  {
    key: 'custom',
    name: 'A shop you built yourself',
    steps: [
      'Send a POST to /api/storefront/checkout-sessions with your shop key in the X-Store-Key header.',
      'The body carries the order reference, the amount, the currency and the shopper email address.',
      'Send the shopper to the checkout address that comes back, and keep the order reference.',
      'Ask /api/storefront/orders/{reference} at any time, or let us call your notification address when the money arrives.',
    ],
  },
];

/**
 * Renders the setup guide.
 *
 * @param props The address of this installation.
 * @returns The rendered guide.
 */
export function StorefrontSetupGuide({ baseUrl }: StorefrontSetupGuideProps) {
  return (
    <div className="space-y-6">
      <Alert tone="info" title="Card details never touch your shop or this application">
        The shopper is sent to a payment page served by the provider itself, so neither your shop
        nor this application ever sees a card number. That is what keeps your business in the
        lightest band of the card industry rules, and it is the only checkout mode we offer.
      </Alert>

      <div className="grid gap-4 lg:grid-cols-3">
        {GUIDES.map((guide) => (
          <Card key={guide.key}>
            <CardHeader>
              <CardTitle>{guide.name}</CardTitle>
              <CardDescription>Four steps, about ten minutes.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                {guide.steps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>The two addresses your shop needs</CardTitle>
          <CardDescription>
            Both are the same for every shop you connect. The key decides which shop is talking.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="break-all">
            <span className="font-medium">Ask for a payment address: </span>
            <code className="rounded bg-surface-muted px-1.5 py-0.5">{`POST ${baseUrl}/api/storefront/checkout-sessions`}</code>
          </p>
          <p className="break-all">
            <span className="font-medium">Check an order: </span>
            <code className="rounded bg-surface-muted px-1.5 py-0.5">{`GET ${baseUrl}/api/storefront/orders/{your-order-reference}`}</code>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
