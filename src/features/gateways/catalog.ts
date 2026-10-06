// src/features/gateways/catalog.ts
// Which payment providers can be connected, and what each of them asks for.
//
// Everything a provider needs is described here rather than written into the
// forms, so adding a provider is a matter of adding an entry. A provider the
// platform has never heard of is connected through the custom adapter, which
// takes its endpoints as configuration instead of code.

import type { GatewayProvider } from '@/types/enums';

export interface CredentialField {
  /** Name the value is stored under inside the encrypted bundle. */
  key: string;
  /** Label shown beside the input. */
  label: string;
  /** Sentence explaining where the business finds this value. */
  hint: string;
  /** True when the value is secret and must never be shown again. */
  isSecret: boolean;
  /** False when the provider works without it. */
  isRequired: boolean;
}

export interface GatewayDefinition {
  provider: GatewayProvider;
  label: string;
  description: string;
  /** Where the business signs up or finds their keys. */
  dashboardUrl: string | null;
  fields: readonly CredentialField[];
  supportsPayouts: boolean;
  supportsRefunds: boolean;
  /** True when the provider is reached through the configurable adapter. */
  usesCustomAdapter: boolean;
}

const secret = (key: string, label: string, hint: string): CredentialField => ({
  key,
  label,
  hint,
  isSecret: true,
  isRequired: true,
});

const open = (key: string, label: string, hint: string): CredentialField => ({
  key,
  label,
  hint,
  isSecret: false,
  isRequired: true,
});

export const GATEWAY_CATALOG: Readonly<Record<GatewayProvider, GatewayDefinition>> = {
  stripe: {
    provider: 'stripe',
    label: 'Stripe',
    description: 'Cards, wallets and bank debits in most of the world.',
    dashboardUrl: 'https://dashboard.stripe.com/apikeys',
    fields: [
      secret('secret_key', 'Secret key', 'Starts with sk_ and is only shown once by Stripe.'),
      open('publishable_key', 'Publishable key', 'Starts with pk_ and is safe to show in a page.'),
      {
        key: 'webhook_secret',
        label: 'Webhook signing secret',
        hint: 'Starts with whsec_. Needed so we can trust what Stripe tells us.',
        isSecret: true,
        isRequired: false,
      },
    ],
    supportsPayouts: true,
    supportsRefunds: true,
    usesCustomAdapter: false,
  },
  paypal: {
    provider: 'paypal',
    label: 'PayPal',
    description: 'PayPal balances, cards and Pay Later in over two hundred markets.',
    dashboardUrl: 'https://developer.paypal.com/dashboard/applications',
    fields: [
      open('client_id', 'Client ID', 'From your REST application in the PayPal dashboard.'),
      secret('client_secret', 'Secret', 'Shown beside the client ID in the same application.'),
    ],
    supportsPayouts: true,
    supportsRefunds: true,
    usesCustomAdapter: false,
  },
  paddle: {
    provider: 'paddle',
    label: 'Paddle',
    description: 'A merchant of record that handles sales tax for digital goods.',
    dashboardUrl: 'https://vendors.paddle.com/authentication',
    fields: [
      secret('api_key', 'API key', 'Created under Developer Tools in the Paddle dashboard.'),
      open('client_token', 'Client token', 'Used by the checkout that runs in the browser.'),
    ],
    supportsPayouts: false,
    supportsRefunds: true,
    usesCustomAdapter: true,
  },
  nmi: {
    provider: 'nmi',
    label: 'NMI',
    description: 'A direct gateway for merchants with their own acquiring bank.',
    dashboardUrl: 'https://secure.nmi.com/merchants/',
    fields: [secret('security_key', 'Security key', 'Found under Settings, Security Keys in NMI.')],
    supportsPayouts: false,
    supportsRefunds: true,
    usesCustomAdapter: true,
  },
  twocheckout: {
    provider: 'twocheckout',
    label: '2Checkout by Verifone',
    description: 'Global card acceptance with local payment methods.',
    dashboardUrl: 'https://secure.2checkout.com/cpanel/',
    fields: [
      open('merchant_code', 'Merchant code', 'Shown on the 2Checkout control panel home page.'),
      secret('secret_key', 'Secret key', 'From Integrations, Webhooks and API.'),
    ],
    supportsPayouts: false,
    supportsRefunds: true,
    usesCustomAdapter: true,
  },
  bkash: {
    provider: 'bkash',
    label: 'bKash',
    description: 'Mobile money collection and disbursement in Bangladesh.',
    dashboardUrl: 'https://developer.bka.sh/',
    fields: [
      open('username', 'Merchant username', 'Issued with your bKash merchant account.'),
      secret('password', 'Merchant password', 'Issued with your bKash merchant account.'),
      open('app_key', 'App key', 'From the bKash developer portal.'),
      secret('app_secret', 'App secret', 'From the bKash developer portal.'),
    ],
    supportsPayouts: true,
    supportsRefunds: true,
    usesCustomAdapter: true,
  },
  nagad: {
    provider: 'nagad',
    label: 'Nagad',
    description: 'Mobile money collection and disbursement in Bangladesh.',
    dashboardUrl: null,
    fields: [
      open('merchant_id', 'Merchant ID', 'Issued by Nagad when your account is approved.'),
      secret('private_key', 'Private key', 'The PEM key you generated for Nagad.'),
      secret('public_key', 'Nagad public key', 'The key Nagad gave you to verify their replies.'),
    ],
    supportsPayouts: true,
    supportsRefunds: false,
    usesCustomAdapter: true,
  },
  manual: {
    provider: 'manual',
    label: 'Bank transfer and cash',
    description: 'You are paid outside the platform and record the payment yourself.',
    dashboardUrl: null,
    fields: [],
    supportsPayouts: false,
    supportsRefunds: true,
    usesCustomAdapter: false,
  },
  adyen: {
    provider: 'adyen',
    label: 'Adyen',
    description:
      'Cards, wallets and local methods in one acquirer, with a balance account per business.',
    dashboardUrl: 'https://ca-test.adyen.com/ca/ca/config/api_credentials.shtml',
    fields: [
      secret('api_key', 'API key', 'Created under API credentials in your Adyen customer area.'),
      open(
        'merchant_account',
        'Merchant account',
        'The account name Adyen gave you, for example KdSolutionItECOM.'
      ),
      {
        key: 'hmac_key',
        label: 'Notification HMAC key',
        hint: 'Generated beside your standard webhook. Needed so we can trust what Adyen sends.',
        isSecret: true,
        isRequired: false,
      },
      {
        key: 'live_url_prefix',
        label: 'Live endpoint prefix',
        hint: 'Only for live mode. Adyen shows it beside your live API credential.',
        isSecret: false,
        isRequired: false,
      },
      {
        key: 'balance_account_id',
        label: 'Balance account',
        hint: 'Set this to split each payment into the business balance automatically.',
        isSecret: false,
        isRequired: false,
      },
    ],
    supportsPayouts: true,
    supportsRefunds: true,
    usesCustomAdapter: false,
  },
  nium: {
    provider: 'nium',
    label: 'Nium',
    description: 'Cross border payouts to bank accounts and wallets in over a hundred currencies.',
    dashboardUrl: 'https://www.nium.com/developers',
    fields: [
      secret('api_key', 'API key', 'Found under Configuration, API keys in the Nium portal.'),
      open('client_hash_id', 'Client ID', 'The client identifier Nium issued with your API key.'),
      {
        key: 'customer_hash_id',
        label: 'Customer ID',
        hint: 'The customer the funding wallet belongs to.',
        isSecret: false,
        isRequired: false,
      },
      {
        key: 'wallet_hash_id',
        label: 'Funding wallet',
        hint: 'The wallet payouts are taken from.',
        isSecret: false,
        isRequired: false,
      },
      {
        key: 'webhook_secret',
        label: 'Webhook secret',
        hint: 'Shared secret Nium signs its callbacks with.',
        isSecret: true,
        isRequired: false,
      },
    ],
    supportsPayouts: true,
    supportsRefunds: false,
    usesCustomAdapter: false,
  },
  bnpl_partner: {
    provider: 'bnpl_partner',
    label: 'Buy now, pay later partner',
    description: 'An instalment provider that settles the invoice in full up front.',
    dashboardUrl: null,
    fields: [
      open('partner_id', 'Partner ID', 'Given to you by the instalment provider.'),
      secret('api_key', 'API key', 'Given to you by the instalment provider.'),
    ],
    supportsPayouts: false,
    supportsRefunds: true,
    usesCustomAdapter: true,
  },
  custom: {
    provider: 'custom',
    label: 'Any other provider',
    description:
      'Describe the provider once and it works like the built in ones, with no code change.',
    dashboardUrl: null,
    fields: [
      secret('api_key', 'API key', 'Whatever the provider calls its secret credential.'),
      {
        key: 'api_secret',
        label: 'Second secret',
        hint: 'Only if the provider issues a pair of credentials.',
        isSecret: true,
        isRequired: false,
      },
    ],
    supportsPayouts: false,
    supportsRefunds: true,
    usesCustomAdapter: true,
  },
};

/** The providers offered in the connect menu, in the order they appear. */
export const GATEWAY_ORDER: readonly GatewayProvider[] = [
  'stripe',
  'paypal',
  'paddle',
  'nmi',
  'twocheckout',
  'adyen',
  'nium',
  'bkash',
  'nagad',
  'bnpl_partner',
  'manual',
  'custom',
];

/**
 * Describes one provider.
 *
 * @param provider Provider being described.
 * @returns What the provider is called and what it asks for.
 */
export function gatewayDefinition(provider: GatewayProvider): GatewayDefinition {
  return GATEWAY_CATALOG[provider];
}
