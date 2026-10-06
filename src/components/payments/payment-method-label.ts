// src/components/payments/payment-method-label.ts
// How a payment method and a provider are named on screen. One definition,
// shared by the list, the filters and the detail page.

import type { GatewayProvider, PaymentMethodType } from '@/types/enums';

export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  card: 'Card',
  bank_transfer: 'Bank transfer',
  mobile_money: 'Mobile money',
  digital_wallet: 'Digital wallet',
  buy_now_pay_later: 'Buy now, pay later',
  cash: 'Cash',
  cheque: 'Cheque',
  platform_wallet: 'Platform wallet',
  other: 'Other',
};

export const PAYMENT_PROVIDER_LABELS: Record<GatewayProvider, string> = {
  stripe: 'Stripe',
  paypal: 'PayPal',
  paddle: 'Paddle',
  nmi: 'NMI',
  twocheckout: '2Checkout',
  adyen: 'Adyen',
  nium: 'Nium',
  bkash: 'bKash',
  nagad: 'Nagad',
  manual: 'Recorded by hand',
  bnpl_partner: 'Buy now, pay later partner',
  custom: 'Custom gateway',
};
