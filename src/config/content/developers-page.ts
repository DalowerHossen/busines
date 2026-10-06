// src/config/content/developers-page.ts
// The words on the public developer page: what can be connected, how an
// application is authorised, and what the interface answers with.

/** One way of connecting, written for the person deciding whether to build. */
export interface IntegrationRoute {
  key: string;
  title: string;
  description: string;
  steps: readonly string[];
}

/** One endpoint of the public interface. */
export interface EndpointSummary {
  method: 'GET' | 'POST';
  path: string;
  description: string;
  scope: string;
}

export const DEVELOPERS_PAGE_INTRO = {
  eyebrow: 'For developers',
  title: 'Connect your own tools to your billing',
  description:
    'Everything the interface does is available to you: read invoices and clients, raise new ones, and react to what happens. Connect through an automation service, a browser extension, or code of your own.',
} as const;

export const INTEGRATION_ROUTES: readonly IntegrationRoute[] = [
  {
    key: 'automation',
    title: 'Automation services',
    description:
      'Build a workflow without writing code. Our connector speaks the standard authorisation flow, so you connect it the same way you connect any other service in your automation tool, and it appears under Connected applications in your settings.',
    steps: [
      'Add a new connection in your automation tool and choose this platform.',
      'Sign in as the owner of the business and read what the connector is asking for.',
      'Pick a trigger, such as an invoice being paid, and point it anywhere you like.',
    ],
  },
  {
    key: 'extension',
    title: 'Browser extension',
    description:
      'An extension is a public client, so it uses a proof key rather than a secret stored on a device. Register it as an extension, list the exact return address your extension uses, and ask only for the permissions it needs.',
    steps: [
      'Register an application of type extension in your developer portal.',
      'Add the return address your extension listens on, exactly as it is written.',
      'Send the owner to the consent screen with a proof key, then trade the code for a token.',
    ],
  },
  {
    key: 'api',
    title: 'Your own code',
    description:
      'A server you control can hold a client secret, so it uses the plain authorisation flow. Tokens are short lived and come with a refresh token; secrets can be replaced at any time with a grace period so nothing breaks mid deployment.',
    steps: [
      'Register an application and copy the client identifier and secret.',
      'Trade an authorisation code for a token at the token endpoint.',
      'Call the interface with that token, and watch the allowance headers on every answer.',
    ],
  },
];

export const PUBLIC_ENDPOINTS: readonly EndpointSummary[] = [
  {
    method: 'GET',
    path: '/api/v1/ping',
    description: 'Confirms the token works and tells you which business it belongs to.',
    scope: 'any',
  },
  {
    method: 'GET',
    path: '/api/v1/invoices',
    description: 'Lists invoices newest first, with a cursor for the next page.',
    scope: 'invoices.read',
  },
  {
    method: 'GET',
    path: '/api/v1/clients',
    description: 'Lists clients newest first, with a cursor for the next page.',
    scope: 'clients.read',
  },
  {
    method: 'POST',
    path: '/api/oauth/token',
    description: 'Trades an authorisation code for an access token and a refresh token.',
    scope: 'any',
  },
];

/** The rules that apply to every call, stated once. */
export const INTERFACE_RULES: readonly string[] = [
  'Tokens are bound to one business. A token issued by one account can never read another.',
  'Each answer carries the remaining allowance in its headers, so you can slow down before you are refused.',
  'Lists are paged by cursor, at most one hundred records at a time, and never skip a record added while you page.',
  'An owner can disconnect your application at any moment, and every token you hold stops working the same second.',
  'Permissions are granted one at a time. Asking for something you do not need is the quickest way to be refused at review.',
];
